import { useState, useEffect } from 'react';
import * as THREE from 'three';

interface ImageMeshProps {
  imageUrl: string;
  mode: 'relief' | 'lithophane';
  depthScale?: number;
}

interface ProcessedMeshData {
  geometry: THREE.BufferGeometry;
  texture: THREE.CanvasTexture;
  aspect: number;
  width: number;
  height: number;
}

export default function ImageMesh({
  imageUrl,
  mode,
  depthScale = 0.6,
}: ImageMeshProps) {
  const [meshData, setMeshData] = useState<ProcessedMeshData | null>(null);

  useEffect(() => {
    let cancelled = false;

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      if (cancelled) return;

      const naturalW = img.naturalWidth || 512;
      const naturalH = img.naturalHeight || 512;
      const aspect = naturalW / naturalH;

      // Proportional dimensions so image retains natural aspect ratio
      const maxDim = 3.0;
      const geomW = aspect >= 1 ? maxDim : maxDim * aspect;
      const geomH = aspect >= 1 ? maxDim / aspect : maxDim;

      // Step 1: 128x128 2D Canvas & Proper Background Masking
      const W = 128;
      const H = 128;

      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(img, 0, 0, W, H);
      const imgData = ctx.getImageData(0, 0, W, H);
      const data = imgData.data;

      // Detect background color from 4 corners
      const cornerIndices = [
        0, // (0,0)
        (W - 1) * 4, // (W-1, 0)
        (H - 1) * W * 4, // (0, H-1)
        ((H - 1) * W + (W - 1)) * 4, // (W-1, H-1)
      ];

      let bgR = 0, bgG = 0, bgB = 0;
      for (const idx of cornerIndices) {
        bgR += data[idx];
        bgG += data[idx + 1];
        bgB += data[idx + 2];
      }
      bgR /= 4;
      bgG /= 4;
      bgB /= 4;

      const mask = new Uint8Array(W * H);

      for (let i = 0; i < W * H; i++) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];
        const a = data[i * 4 + 3];

        const colorDist = Math.sqrt(
          (r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2
        );

        if (a < 50 || colorDist < 45) {
          mask[i] = 0; // background
          data[i * 4 + 3] = 0; // make transparent
        } else {
          mask[i] = 1; // foreground subject
        }
      }

      ctx.putImageData(imgData, 0, 0);

      // Create Three.js Texture with sRGB color space
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.needsUpdate = true;

      // Step 2: Exact Euclidean Distance Transform (EDT) on mask
      const dist = new Float32Array(W * H);
      dist.fill(1e6);

      // Forward Pass
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (mask[i] === 0) {
            dist[i] = 0;
          } else {
            let d = dist[i];
            if (x > 0) d = Math.min(d, dist[i - 1] + 1);
            if (y > 0) d = Math.min(d, dist[i - W] + 1);
            if (x > 0 && y > 0) d = Math.min(d, dist[i - W - 1] + 1.414);
            if (x < W - 1 && y > 0) d = Math.min(d, dist[i - W + 1] + 1.414);
            dist[i] = d;
          }
        }
      }

      // Backward Pass
      for (let y = H - 1; y >= 0; y--) {
        for (let x = W - 1; x >= 0; x--) {
          const i = y * W + x;
          if (mask[i] !== 0) {
            let d = dist[i];
            if (x < W - 1) d = Math.min(d, dist[i + 1] + 1);
            if (y < H - 1) d = Math.min(d, dist[i + W] + 1);
            if (x < W - 1 && y < H - 1) d = Math.min(d, dist[i + W + 1] + 1.414);
            if (x > 0 && y < H - 1) d = Math.min(d, dist[i + W - 1] + 1.414);
            dist[i] = d;
          }
        }
      }

      let maxDist = 0;
      for (let i = 0; i < W * H; i++) {
        if (dist[i] > maxDist) maxDist = dist[i];
      }
      if (maxDist === 0) maxDist = 1;

      // Step 3: Closed Double-Sided Volumetric 3D Geometry
      const N = W * H;
      const positions = new Float32Array(2 * N * 3);
      const uvs = new Float32Array(2 * N * 2);
      const indices: number[] = [];

      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          const u = x / (W - 1);
          const v = 1 - y / (H - 1);

          const posX = (u - 0.5) * geomW;
          const posY = (v - 0.5) * geomH;

          let h = 0;
          if (mask[i] === 1 && dist[i] > 1.5) {
            const normDist = Math.min(dist[i] / maxDist, 1.0);
            // Spherical Dome Inflation:
            const dome = Math.sqrt(Math.max(0, 1 - Math.pow(1 - normDist, 2)));

            // Pixel luminance:
            const r = data[i * 4];
            const g = data[i * 4 + 1];
            const b = data[i * 4 + 2];
            const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

            // Combine 80% dome height + 20% luminance
            h = 0.8 * dome + 0.2 * lum * dome;
          }

          const zFront = h * depthScale;
          const zBack = -h * depthScale;

          // Front vertex (index i)
          positions[i * 3] = posX;
          positions[i * 3 + 1] = posY;
          positions[i * 3 + 2] = zFront;
          uvs[i * 2] = u;
          uvs[i * 2 + 1] = v;

          // Back vertex (index i + N)
          const iBack = i + N;
          positions[iBack * 3] = posX;
          positions[iBack * 3 + 1] = posY;
          positions[iBack * 3 + 2] = zBack;
          uvs[iBack * 2] = u;
          uvs[iBack * 2 + 1] = v;
        }
      }

      // Generate triangles only where at least one vertex is foreground
      for (let y = 0; y < H - 1; y++) {
        for (let x = 0; x < W - 1; x++) {
          const tl = y * W + x;
          const tr = y * W + (x + 1);
          const bl = (y + 1) * W + x;
          const br = (y + 1) * W + (x + 1);

          if (
            mask[tl] === 1 ||
            mask[tr] === 1 ||
            mask[bl] === 1 ||
            mask[br] === 1
          ) {
            // Front triangles (counter-clockwise looking from +Z)
            indices.push(tl, bl, tr);
            indices.push(tr, bl, br);

            // Back triangles (counter-clockwise looking from -Z)
            const tlB = tl + N;
            const trB = tr + N;
            const blB = bl + N;
            const brB = br + N;
            indices.push(tlB, trB, blB);
            indices.push(trB, brB, blB);
          }
        }
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(positions, 3)
      );
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geometry.setIndex(indices);

      // CRITICAL: Compute vertex normals after setting positions
      geometry.computeVertexNormals();

      setMeshData({
        geometry,
        texture,
        aspect,
        width: geomW,
        height: geomH,
      });
    };

    img.onerror = (err) => {
      console.warn('ImageMesh failed to load image:', err);
    };

    img.src = imageUrl;

    return () => {
      cancelled = true;
    };
  }, [imageUrl, depthScale]);

  if (!meshData) {
    return (
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#6366f1" wireframe />
      </mesh>
    );
  }

  const isLithophane = mode === 'lithophane';

  return (
    <group>
      <mesh
        geometry={meshData.geometry}
        castShadow
        receiveShadow
      >
        {isLithophane ? (
          <meshPhysicalMaterial
            map={meshData.texture}
            transparent={true}
            alphaTest={0.1}
            color="#fffdf7"
            emissive="#ffeec4"
            emissiveIntensity={0.12}
            roughness={0.3}
            metalness={0.05}
            transmission={0.15}
            ior={1.48}
            side={THREE.DoubleSide}
          />
        ) : (
          <meshStandardMaterial
            map={meshData.texture}
            transparent={true}
            alphaTest={0.1}
            roughness={0.4}
            metalness={0.1}
            side={THREE.DoubleSide}
          />
        )}
      </mesh>

      {isLithophane && (
        <pointLight
          position={[0, 0, -1]}
          intensity={2.8}
          color="#ffd699"
          distance={6}
        />
      )}
    </group>
  );
}
