import { AnimatePresence } from 'framer-motion';
import ImageUploader from './components/ImageUploader';
import Viewport from './components/Viewport';
import ProgressOverlay from './components/ProgressOverlay';
import { useGeneration } from './hooks/useGeneration';

export default function App() {
  const { state, generate, reset } = useGeneration();

  return (
    <div className="flex flex-col min-h-dvh bg-surface-950 relative overflow-hidden">
      {/* Background gradient effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-primary-600/5 blur-[120px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-accent-500/5 blur-[100px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col flex-1">
        <AnimatePresence mode="wait">
          {state.stage === 'completed' && (state.modelUrl || state.imageUrl) ? (
            <Viewport
              key="viewport"
              modelUrl={state.modelUrl}
              imageUrl={state.imageUrl}
              initialMode={state.meshMode || 'relief'}
              onReset={reset}
            />
          ) : (
            <div
              key="uploader"
              className="flex-1 flex items-center justify-center px-4 py-8"
            >
              <ImageUploader
                onGenerate={generate}
                disabled={
                  state.stage !== 'idle' && state.stage !== 'error'
                }
              />
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Progress overlay */}
      <AnimatePresence>
        {state.stage !== 'idle' && state.stage !== 'completed' && (
          <ProgressOverlay state={state} />
        )}
      </AnimatePresence>
    </div>
  );
}
