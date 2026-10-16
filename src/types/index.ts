export type GenerationStage =
  | 'idle'
  | 'uploading'
  | 'processing'
  | 'polling'
  | 'completed'
  | 'error';

export type MeshMode = 'relief' | 'lithophane' | 'glb';

export interface GenerationState {
  stage: GenerationStage;
  progress: number;
  message: string;
  modelUrl: string | null;
  imageUrl: string | null;
  meshMode?: MeshMode;
  error: string | null;
}

export interface SampleImage {
  id: string;
  name: string;
  src: string;
  label: string;
}

export interface PhysicsState {
  zeroGEnabled: boolean;
  gyroscopeEnabled: boolean;
  flingVelocity: { x: number; y: number };
  deviceOrientation: { alpha: number; beta: number; gamma: number };
}

export interface ViewportSettings {
  autoRotate: boolean;
  showGrid: boolean;
  shadowsEnabled: boolean;
}
