import { useRef, useEffect, useMemo, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import ImageMesh from './ImageMesh';
import type { MeshMode } from '../types';

interface ModelProps {
  url?: string | null;
  imageUrl?: string | null;
  mode: MeshMode;
  zeroGEnabled: boolean;
  gyroData?: { beta: number; gamma: number };
}

function GLBObject({ url }: { url: string }) {
  const { scene } = useGLTF(url);

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    // Auto-center and normalize size
    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const scale = 2.2 / maxDim;
    clone.scale.setScalar(scale);
    clone.position.sub(center.multiplyScalar(scale));

    // Enable shadows on all meshes
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return clone;
  }, [scene]);

  return <primitive object={clonedScene} />;
}

export default function Model({
  url,
  imageUrl,
  mode,
  zeroGEnabled,
  gyroData,
}: ModelProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const timeRef = useRef(0);

  // Fling physics state
  const velocityRef = useRef({ x: 0, y: 0 });
  const lastPointerRef = useRef<{ x: number; y: number; time: number } | null>(
    null
  );
  const isDraggingRef = useRef(false);

  // Handle pointer events for fling physics
  useEffect(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    const onPointerDown = (e: PointerEvent) => {
      isDraggingRef.current = true;
      lastPointerRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
      velocityRef.current = { x: 0, y: 0 };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const now = Date.now();
      const last = lastPointerRef.current;
      if (last) {
        const dt = Math.max(now - last.time, 1);
        velocityRef.current = {
          x: ((e.clientX - last.x) / dt) * 0.015,
          y: ((e.clientY - last.y) / dt) * 0.015,
        };
      }
      lastPointerRef.current = { x: e.clientX, y: e.clientY, time: now };
    };

    const onPointerUp = () => {
      isDraggingRef.current = false;
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerUp);
    };
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    timeRef.current += delta;

    if (zeroGEnabled) {
      // Sinusoidal bobbing
      const bobY = Math.sin(timeRef.current * 0.8) * 0.15;
      const bobX = Math.sin(timeRef.current * 0.5) * 0.03;
      groupRef.current.position.y = bobY;
      groupRef.current.position.x = bobX;

      // Gentle drift rotation
      groupRef.current.rotation.y += delta * 0.15;
      groupRef.current.rotation.x = Math.sin(timeRef.current * 0.3) * 0.08;
      groupRef.current.rotation.z = Math.sin(timeRef.current * 0.4) * 0.05;
    } else {
      // Reset position when zero-g is off
      groupRef.current.position.y *= 0.92;
      groupRef.current.position.x *= 0.92;
    }

    // Apply fling velocity
    if (!isDraggingRef.current) {
      const vel = velocityRef.current;
      if (Math.abs(vel.x) > 0.0001 || Math.abs(vel.y) > 0.0001) {
        groupRef.current.rotation.y += vel.x;
        groupRef.current.rotation.x += vel.y;
        // Dampen
        vel.x *= 0.97;
        vel.y *= 0.97;
      }
    }

    // Gyroscope influence
    if (gyroData) {
      const gyroInfluence = 0.0005;
      groupRef.current.rotation.x +=
        (gyroData.beta * gyroInfluence - groupRef.current.rotation.x) * 0.02;
      groupRef.current.rotation.z +=
        (gyroData.gamma * gyroInfluence - groupRef.current.rotation.z) * 0.02;
    }
  });

  const shouldRenderGLB = mode === 'glb' && Boolean(url);
  const shouldRenderImage =
    (mode === 'relief' || mode === 'lithophane' || !url) && Boolean(imageUrl);

  return (
    <group ref={groupRef}>
      {shouldRenderGLB && url ? (
        <Suspense
          fallback={
            <mesh>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color="#6366f1" wireframe />
            </mesh>
          }
        >
          <GLBObject url={url} />
        </Suspense>
      ) : shouldRenderImage && imageUrl ? (
        <ImageMesh
          imageUrl={imageUrl}
          mode={mode === 'lithophane' ? 'lithophane' : 'relief'}
        />
      ) : url ? (
        <Suspense
          fallback={
            <mesh>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color="#6366f1" wireframe />
            </mesh>
          }
        >
          <GLBObject url={url} />
        </Suspense>
      ) : (
        <mesh>
          <boxGeometry args={[1.5, 1.5, 1.5]} />
          <meshStandardMaterial color="#6366f1" wireframe />
        </mesh>
      )}
    </group>
  );
}
