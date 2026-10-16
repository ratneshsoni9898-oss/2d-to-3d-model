import { useCallback, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Image as ImageIcon,
  X,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import type { SampleImage } from '../types';

const SAMPLE_IMAGES: SampleImage[] = [
  {
    id: 'shoe',
    name: 'Running Shoe',
    src: '/samples/shoe.svg',
    label: '👟 Shoe',
  },
  {
    id: 'chair',
    name: 'Modern Chair',
    src: '/samples/chair.svg',
    label: '🪑 Chair',
  },
  {
    id: 'toy',
    name: 'Toy Robot',
    src: '/samples/toy.svg',
    label: '🤖 Toy',
  },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

interface ImageUploaderProps {
  onGenerate: (file: File | null, previewUrl?: string) => void;
  disabled?: boolean;
}

export default function ImageUploader({
  onGenerate,
  disabled,
}: ImageUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    setError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Please upload a PNG, JPG, or WEBP image.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('File size must be under 10MB.');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleSampleClick = useCallback(
    (sample: SampleImage) => {
      setPreview(sample.src);
      setSelectedFile(null);
      setError(null);
      onGenerate(null, sample.src);
    },
    [onGenerate]
  );

  const clearSelection = useCallback(() => {
    setSelectedFile(null);
    setPreview(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-lg mx-auto"
    >
      {/* Header */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-panel-light text-xs font-medium text-primary-300 mb-4"
        >
          <Sparkles className="w-3.5 h-3.5" />
          AI-Powered 3D Generation
        </motion.div>
        <h1 className="text-3xl sm:text-4xl font-bold gradient-text mb-3 leading-tight">
          Image to 3D Model
        </h1>
        <p className="text-surface-200/60 text-sm max-w-md mx-auto">
          Upload any image and watch it transform into an interactive 3D model
          with anti-gravity physics.
        </p>
      </div>

      {/* Drop Zone */}
      <AnimatePresence mode="wait">
        {!preview ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative cursor-pointer rounded-2xl border-2 border-dashed
                transition-all duration-300 p-8 sm:p-10
                ${
                  isDragOver
                    ? 'drop-zone-active'
                    : 'border-surface-700/50 hover:border-primary-500/40 bg-surface-900/30'
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="flex flex-col items-center text-center">
                <motion.div
                  animate={isDragOver ? { scale: 1.1, y: -4 } : { scale: 1, y: 0 }}
                  className="w-14 h-14 rounded-2xl bg-primary-600/10 flex items-center justify-center mb-4"
                >
                  <Upload className="w-6 h-6 text-primary-400" />
                </motion.div>
                <p className="text-sm font-medium text-surface-200 mb-1">
                  Drop your image here or{' '}
                  <span className="text-primary-400">browse</span>
                </p>
                <p className="text-xs text-surface-200/40">
                  PNG, JPG, WEBP — max 10MB
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="relative"
          >
            <div className="glass-panel rounded-2xl p-4 relative overflow-hidden">
              <button
                onClick={clearSelection}
                className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-surface-900/80 flex items-center justify-center hover:bg-surface-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="aspect-video rounded-xl overflow-hidden bg-surface-950 flex items-center justify-center">
                <img
                  src={preview}
                  alt="Preview"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-surface-200/70">
                  <ImageIcon className="w-4 h-4" />
                  {selectedFile
                    ? selectedFile.name
                    : 'Sample Image'}
                </div>
                <button
                  onClick={() => onGenerate(selectedFile, preview || undefined)}
                  disabled={disabled}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate 3D Model
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-red-400 text-xs text-center mt-3"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Sample Images */}
      <div className="mt-8">
        <p className="text-xs text-surface-200/40 text-center mb-3">
          Or try a sample image:
        </p>
        <div className="flex justify-center gap-3">
          {SAMPLE_IMAGES.map((sample, i) => (
            <motion.button
              key={sample.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.08 }}
              onClick={() => handleSampleClick(sample)}
              disabled={disabled}
              className="group flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl glass-panel-light hover:bg-surface-800/60 transition-all duration-200 disabled:opacity-40"
            >
              <span className="text-2xl">{sample.label.split(' ')[0]}</span>
              <span className="text-[11px] text-surface-200/50 group-hover:text-surface-200/80 transition-colors">
                {sample.name}
              </span>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
