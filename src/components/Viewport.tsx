import { Suspense, useRef, useCallback, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls,
  Environment,
  ContactShadows,
  PerspectiveCamera,
} from '@react-three/drei';
import { motion } from 'framer-motion';
import {
  Download,
  RotateCcw,
  Orbit,
  ToggleLeft,
  ToggleRight,
  Smartphone,
  Layers,
} from 'lucide-react';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import * as THREE from 'three';
import Model from './Model';
import { CompletionBadge } from './ProgressOverlay';
import { useGyroscope } from '../hooks/useGyroscope';
import type { MeshMode } from '../types';

interface ViewportProps {
  modelUrl: string | null;
  imageUrl?: string | null;
  initialMode?: MeshMode;
  onReset: () => void;
}

export default function Viewport({
  modelUrl,
  imageUrl,
  initialMode = 'relief',
  onReset,
}: ViewportProps) {
  const controlsRef = useRef<any>(null);
  const sceneRef = useRef<THREE.Group>(null);
  const [zeroG, setZeroG] = useState(false);
  const [activeMode, setActiveMode] = useState<MeshMode>(
    imageUrl ? initialMode : 'glb'
  );
  const [isExporting, setIsExporting] = useState(false);
  const gyro = useGyroscope();

  const handleDownload = useCallback(async () => {
    setIsExporting(true);

    try {
      if (activeMode === 'glb' && modelUrl) {
        // Direct download of remote/sample GLB
        const response = await fetch(modelUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'model-3d.glb';
        a.click();
        URL.revokeObjectURL(url);
      } else if (sceneRef.current) {
        // Export the generated 3D relief or lithophane mesh
        const exporter = new GLTFExporter();
        exporter.parse(
          sceneRef.current,
          (gltf) => {
            const blob = new Blob([gltf as ArrayBuffer], {
              type: 'model/gltf-binary',
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${activeMode}-model.glb`;
            a.click();
            URL.revokeObjectURL(url);
            setIsExporting(false);
          },
          (error) => {
            console.error('GLTF export error:', error);
            setIsExporting(false);
          },
          { binary: true }
        );
        return;
      } else if (modelUrl) {
        const response = await fetch(modelUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'model-3d.glb';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setIsExporting(false);
    }
  }, [activeMode, modelUrl]);

  const handleGyroToggle = useCallback(async () => {
    if (gyro.permissionGranted) {
      gyro.disable();
    } else {
      await gyro.requestPermission();
    }
  }, [gyro]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="flex flex-col h-full w-full select-none"
    >
      {/* Top bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 glass-panel-light border-b border-white/5"
      >
        <div className="flex items-center gap-3">
          <CompletionBadge />

          {/* 3D Mode Dropdown */}
          <div className="relative flex items-center">
            <div className="flex items-center gap-1 bg-surface-900/90 border border-white/10 rounded-xl px-2.5 py-1 text-xs shadow-inner">
              <Layers className="w-3.5 h-3.5 text-primary-400" />
              <select
                value={activeMode}
                onChange={(e) => setActiveMode(e.target.value as MeshMode)}
                aria-label="3D Model Mode"
                className="bg-transparent text-surface-200 text-xs font-medium focus:outline-none cursor-pointer pr-1 py-0.5"
              >
                {imageUrl && (
                  <>
                    <option value="relief" className="bg-surface-900 text-surface-200">
                      3D Relief Mesh (From Your Photo)
                    </option>
                    <option value="lithophane" className="bg-surface-900 text-surface-200">
                      3D Textured Lithophane
                    </option>
                  </>
                )}
                {modelUrl && (
                  <option value="glb" className="bg-surface-900 text-surface-200">
                    Sample 3D GLB Model
                  </option>
                )}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Zero-G Toggle */}
          <button
            onClick={() => setZeroG(!zeroG)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              ${
                zeroG
                  ? 'bg-primary-600/20 text-primary-300 border border-primary-500/30'
                  : 'bg-surface-800/50 text-surface-200/50 border border-white/5 hover:text-surface-200/80'
              }
            `}
          >
            {zeroG ? (
              <ToggleRight className="w-4 h-4 text-primary-400" />
            ) : (
              <ToggleLeft className="w-4 h-4" />
            )}
            Zero-G
          </button>

          {/* Gyroscope (mobile) */}
          {gyro.supported && (
            <button
              onClick={handleGyroToggle}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${
                  gyro.permissionGranted
                    ? 'bg-accent-600/20 text-accent-400 border border-accent-500/30'
                    : 'bg-surface-800/50 text-surface-200/50 border border-white/5'
                }
              `}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Gyro
            </button>
          )}
        </div>
      </motion.div>

      {/* 3D Canvas */}
      <div className="flex-1 relative canvas-container min-h-[420px]">
        <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
          <PerspectiveCamera makeDefault position={[0, 0.8, 3.8]} fov={45} />

          {/* Lighting */}
          <ambientLight intensity={0.45} />
          <directionalLight
            position={[5, 8, 5]}
            intensity={1.3}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-near={0.1}
            shadow-camera-far={50}
            shadow-camera-left={-5}
            shadow-camera-right={5}
            shadow-camera-top={5}
            shadow-camera-bottom={-5}
          />
          <directionalLight
            position={[-4, 3, -4]}
            intensity={0.4}
            color="#a78bfa"
          />

          {/* Environment */}
          <Environment preset="city" />

          {/* Model Group */}
          <group ref={sceneRef}>
            <Suspense
              fallback={
                <mesh>
                  <boxGeometry args={[0.6, 0.6, 0.6]} />
                  <meshStandardMaterial color="#6366f1" wireframe />
                </mesh>
              }
            >
              <Model
                url={modelUrl}
                imageUrl={imageUrl}
                mode={activeMode}
                zeroGEnabled={zeroG}
                gyroData={
                  gyro.permissionGranted
                    ? { beta: gyro.beta, gamma: gyro.gamma }
                    : undefined
                }
              />
            </Suspense>
          </group>

          {/* Shadow plane */}
          <ContactShadows
            position={[0, -1.6, 0]}
            opacity={0.55}
            scale={10}
            blur={2.5}
            far={4}
          />

          {/* Controls */}
          <OrbitControls
            ref={controlsRef}
            enableDamping
            dampingFactor={0.05}
            enablePan={false}
            minDistance={1.2}
            maxDistance={9}
            maxPolarAngle={Math.PI / 1.4}
            touches={{
              ONE: 0, // THREE.TOUCH.ROTATE
              TWO: 2, // THREE.TOUCH.DOLLY_PAN
            }}
          />
        </Canvas>

        {/* Viewport hint */}
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ delay: 3.5, duration: 1 }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-panel text-xs text-surface-200/60 pointer-events-none"
        >
          <Orbit className="w-3.5 h-3.5" />
          Drag to rotate · Pinch/scroll to zoom
        </motion.div>
      </div>

      {/* Bottom action bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex items-center justify-center gap-3 px-4 py-4 glass-panel-light border-t border-white/5"
      >
        <button
          onClick={handleDownload}
          disabled={isExporting}
          className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {isExporting ? 'Exporting...' : 'Download .GLB'}
        </button>
        <button
          onClick={onReset}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <RotateCcw className="w-4 h-4" />
          Upload New Image
        </button>
      </motion.div>
    </motion.div>
  );
}
