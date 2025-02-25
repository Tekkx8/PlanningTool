import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Logo } from './Logo';
import { FileUpload } from './FileUpload';

interface StartPageProps {
  onDataLoaded: (fileData: any) => void;
  uploadedFiles: string[];
  onEnter: () => void;
  isProcessing: boolean;
}

export const StartPage: React.FC<StartPageProps> = ({
  onDataLoaded,
  uploadedFiles,
  onEnter,
  isProcessing
}) => {
  return (
    <div 
      className="fixed inset-0 flex flex-col items-center justify-center p-4"
      style={{
        backgroundImage: `
          linear-gradient(to bottom, rgba(0, 0, 0, 0.8), rgba(10, 31, 68, 0.9)),
          url('https://images.unsplash.com/photo-1597474561103-0435361c9e04?auto=format&fit=crop&q=80')
        `,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-12"
      >
        <Logo className="scale-150" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="w-full max-w-md"
      >
        <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-blue-500/20 p-8">
          <div className="text-center">
            <FileUpload
              title="Upload Stock or Orders"
              isProcessing={isProcessing}
              onDataLoaded={onDataLoaded}
            />
            
            {uploadedFiles.length > 0 && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                onClick={onEnter}
                className="mt-6 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 
                         transition-colors flex items-center justify-center gap-2 group mx-auto"
              >
                <span>Enter</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}