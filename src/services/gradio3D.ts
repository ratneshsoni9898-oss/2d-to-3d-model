import { Client } from '@gradio/client';

const GRADIO_SPACES = [
  'TencentARC/InstantMesh',
  'stabilityai/TripoSR',
  'JeffreyXiang/TRELLIS',
];

const GRADIO_TIMEOUT_MS = 25000;

/**
 * Connects to public Hugging Face 2D-to-3D Spaces using @gradio/client
 * Attempts to generate a 360-degree .glb/.obj model.
 * Times out after 25 seconds if the queue/space is busy or offline.
 */
export async function generate3DFromGradio(
  imageBlob: Blob | File,
  onProgress?: (message: string, progress: number) => void
): Promise<string | null> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error('Gradio 3D AI generation timed out (25s limit)')),
      GRADIO_TIMEOUT_MS
    );
  });

  const generateTask = async (): Promise<string | null> => {
    for (const spaceName of GRADIO_SPACES) {
      try {
        onProgress?.(`Connecting to AI Space (${spaceName})...`, 25);
        
        // Connect to space
        const client = await Client.connect(spaceName);
        
        onProgress?.(`AI Space connected! Processing 3D mesh...`, 50);

        // Submit image
        let result: any;
        try {
          result = await client.predict(0, [imageBlob]);
        } catch {
          // Alternative endpoint call
          result = await client.predict('/preprocess_and_generate', [imageBlob]);
        }

        // Check for model URL in response
        if (result && result.data) {
          const files = Array.isArray(result.data) ? result.data : [result.data];
          for (const item of files) {
            if (typeof item === 'string' && (item.endsWith('.glb') || item.endsWith('.gltf') || item.endsWith('.obj'))) {
              return item;
            }
            if (item && typeof item === 'object') {
              if (item.url && (item.url.endsWith('.glb') || item.url.endsWith('.gltf') || item.url.endsWith('.obj'))) {
                return item.url;
              }
              if (item.path && (item.path.endsWith('.glb') || item.path.endsWith('.gltf') || item.path.endsWith('.obj'))) {
                return item.path;
              }
            }
          }
        }
      } catch (spaceErr) {
        console.warn(`Space ${spaceName} was unavailable or busy:`, spaceErr);
        // Continue to next space
      }
    }
    return null;
  };

  try {
    const modelUrl = await Promise.race([generateTask(), timeoutPromise]);
    return modelUrl;
  } catch (err) {
    console.warn('Gradio 3D generation fallback triggered:', err);
    return null;
  }
}
