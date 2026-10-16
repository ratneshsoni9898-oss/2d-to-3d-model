import type { Plugin } from 'vite';

/**
 * Vite dev server plugin that handles /api/generate-3d requests.
 * 
 * In production, these would be real API routes.
 * In dev, this plugin intercepts them and either:
 *   - Proxies to Tripo3D if VITE_TRIPO_API_KEY is set
 *   - Returns a "use mock" signal so the client uses sample.glb
 */
export function apiPlugin(): Plugin {
  return {
    name: 'antigravity-api',
    configureServer(server) {
      // Intercept /api/generate-3d requests
      server.middlewares.use(async (req, res, next) => {
        const reqUrl = req.url || '';
        if (!reqUrl.startsWith('/api/generate-3d')) {
          return next();
        }

        const apiKey = process.env.VITE_TRIPO_API_KEY;

        if (req.method === 'POST') {
          // If no API key, signal client to use mock mode
          if (!apiKey) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ useMock: true }));
            return;
          }

          try {
            // Collect multipart form data
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(Buffer.from(chunk));
            }
            const body = Buffer.concat(chunks);

            // Extract boundary from content-type
            const contentType = req.headers['content-type'] || '';

            // Upload image to Tripo3D
            const uploadRes = await fetch('https://api.tripo3d.ai/v2/openapi/upload', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
              },
              body: body,
              // Forward content-type for multipart
              ...(contentType ? { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': contentType } } : {}),
            });

            if (!uploadRes.ok) {
              const err = await uploadRes.text();
              res.writeHead(uploadRes.status, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: `Upload to Tripo3D failed: ${err}` }));
              return;
            }

            const uploadData = await uploadRes.json() as { data?: { image_token?: string } };
            const imageToken = uploadData?.data?.image_token;

            if (!imageToken) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'No image token returned from Tripo3D' }));
              return;
            }

            // Start generation task
            const taskRes = await fetch('https://api.tripo3d.ai/v2/openapi/task', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                type: 'image_to_model',
                file: { type: 'image', file_token: imageToken },
              }),
            });

            const taskData = await taskRes.json() as { data?: { task_id?: string } };
            const taskId = taskData?.data?.task_id;

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ taskId }));
          } catch (err) {
            console.error('API error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
          }
          return;
        }

        if (req.method === 'GET') {
          // Poll for task status
          const url = new URL(req.url || '/', `http://${req.headers.host}`);
          const taskId = url.searchParams.get('taskId');

          if (!taskId || !apiKey) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing taskId or API key' }));
            return;
          }

          try {
            const pollRes = await fetch(`https://api.tripo3d.ai/v2/openapi/task/${taskId}`, {
              headers: { 'Authorization': `Bearer ${apiKey}` },
            });
            const pollData = await pollRes.json() as {
              data?: {
                status?: string;
                progress?: number;
                output?: { model?: string };
              };
            };

            const status = pollData?.data?.status;
            const progress = pollData?.data?.progress ?? 0;

            if (status === 'success') {
              const modelUrl = pollData?.data?.output?.model;
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'success', modelUrl, progress: 100 }));
            } else if (status === 'failed') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'failed', error: 'Generation failed on Tripo3D' }));
            } else {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                status: 'processing',
                progress,
                message: `Processing (${progress}%)...`,
              }));
            }
          } catch (err) {
            console.error('Poll error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to poll task status' }));
          }
          return;
        }

        next();
      });
    },
  };
}
