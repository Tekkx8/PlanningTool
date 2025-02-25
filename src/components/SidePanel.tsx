import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { StockItem, AllocationRecord } from '../types';

interface SidePanelProps {
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  allocationManager?: {
    storage: {
      getAllocationByBatch: (batchNumber: string) => AllocationRecord | null;
    };
  };
  stock: StockItem[];
}

export const SidePanel: React.FC<SidePanelProps> = ({
  isOpen,
  onToggle,
  children,
  allocationManager,
  stock,
}) => {
  const allocatedStock = React.useMemo(() => {
    if (!allocationManager) return [];
    return stock.filter(item => 
      allocationManager.storage.getAllocationByBatch(item['Batch Number'])?.status === 'Allocated'
    );
  }, [stock, allocationManager]);

  return (
    <div className="relative h-full">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 w-[600px] h-full bg-black/40 backdrop-blur-sm border-l border-blue-500/20 shadow-xl z-50"
          >
            <div className="h-full overflow-y-auto p-6 scrollbar-thin">
              <h2 className="text-xl font-semibold text-white mb-4">Allocated Stock</h2>
              <div className="space-y-4">
                {allocatedStock.map((item) => {
                  const allocation = allocationManager?.storage.getAllocationByBatch(item['Batch Number']);
                  return (
                    <div
                      key={`${item.Location || 'no-loc'}-${item['Batch Number']}`}
                      className="bg-black/20 rounded-lg p-4 border border-blue-500/10 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-sm text-blue-400">
                          <span className="text-blue-300">{item.Location || '-'}</span>
                          <span className="mx-2">•</span>
                          <span>Batch: {item['Batch Number']}</span>
                        </div>
                        <div className="text-white mt-1">{item['Stock Weight']} KG</div>
                        <div className="text-xs text-blue-300/80 mt-1">
                          Age: {item['Real Stock Age']} days
                        </div>
                        {allocation && (
                          <div className="text-xs text-green-300 mt-2">
                            Allocated to: {allocation.customer}
                            {allocation.order && (
                              <span className="ml-2">• Order: {allocation.order}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end">
                        <div className={`px-2 py-1 rounded-full text-xs ${
                          item['Q3: Reinspection Quality']?.toLowerCase().includes('good')
                            ? 'bg-green-500/20 text-green-300'
                            : item['Q3: Reinspection Quality']?.toLowerCase().includes('fair')
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-yellow-500/20 text-yellow-300'
                        }`}>
                          {item['Q3: Reinspection Quality'] || 'Unknown'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <button
        onClick={onToggle}
        className="fixed top-1/2 -translate-y-1/2 right-0 bg-blue-600 text-white p-2 rounded-l-md hover:bg-blue-700 transition-colors z-50"
      >
        {isOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>
    </div>
  );
};