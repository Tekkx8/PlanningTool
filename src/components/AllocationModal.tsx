import React from 'react';
import { Modal } from './Modal';
import { ScrollablePanel } from './ScrollablePanel';
import { AllocationRecord } from '../types';
import { format, parseISO } from 'date-fns';
import { X, RotateCcw } from 'lucide-react';

interface AllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  allocations: AllocationRecord[];
  onResetAllocation: (batchNumber: string) => void;
  onResetCustomerAllocations: (customer: string) => void;
  onResetOrderAllocations: (salesDocument: string, salesDocumentItem: string) => void;
  onResetAll: () => void;
}

export const AllocationModal: React.FC<AllocationModalProps> = ({
  isOpen,
  onClose,
  allocations,
  onResetAllocation,
  onResetCustomerAllocations,
  onResetOrderAllocations,
  onResetAll
}) => {
  const [activeQuality, setActiveQuality] = React.useState<string | null>(null);
  const [hoveredQuality, setHoveredQuality] = React.useState<string | null>(null);

  // Track allocation status
  const [allocationStatus, setAllocationStatus] = React.useState<{
    allocated: number;
    total: number;
    canReallocate: boolean;
  }>({
    allocated: 0,
    total: 0,
    canReallocate: false
  });

  // Update allocation status when allocations change
  React.useEffect(() => {
    const total = allocations.length;
    const allocated = allocations.filter(a => a.status === 'Allocated').length;
    const canReallocate = allocations.every(a => a.canReallocate);

    setAllocationStatus({
      allocated,
      total,
      canReallocate
    });
  }, [allocations]);

  // Group allocations by customer
  const groupedAllocations = React.useMemo(() => {
    return allocations.reduce((acc, allocation) => {
      if (!acc[allocation.customer]) {
        acc[allocation.customer] = [];
      }
      acc[allocation.customer].push(allocation);
      return acc;
    }, {} as Record<string, AllocationRecord[]>);
  }, [allocations]);

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      title="Current Allocations"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-blue-300">
          {allocations.length} active allocations
        </div>
        <button
          onClick={onResetAll}
          className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 rounded-lg text-red-300 hover:bg-red-500/20 transition-colors text-sm"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Reset All</span>
        </button>
      </div>

      <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
        {Object.entries(groupedAllocations).map(([customer, customerAllocations]) => (
          <div 
            key={customer}
            className="bg-black/20 rounded-lg border border-blue-500/10 overflow-hidden"
          >
            <div className="bg-blue-900/20 px-4 py-3 flex items-center justify-between">
              <h3 className="font-medium text-white">{customer}</h3>
              <button
                onClick={() => onResetCustomerAllocations(customer)}
                className="text-blue-400 hover:text-blue-300 transition-colors p-1 hover:bg-blue-500/10 rounded"
                title="Reset customer allocations"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 space-y-3">
              {Object.entries(customerAllocations.reduce((acc, allocation) => {
                const key = `${allocation.salesDocument}-${allocation.salesDocumentItem}`;
                if (!acc[key]) {
                  acc[key] = [];
                }
                acc[key].push(allocation);
                return acc;
              }, {} as Record<string, AllocationRecord[]>)).map(([key, orderAllocations]) => (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-blue-300">
                      Order: {orderAllocations[0].order || 'N/A'}
                      <span className="mx-2">•</span>
                      Sales Doc: {orderAllocations[0].salesDocument}
                    </div>
                    <button
                      onClick={() => onResetOrderAllocations(
                        orderAllocations[0].salesDocument,
                        orderAllocations[0].salesDocumentItem
                      )}
                      className="text-blue-400 hover:text-blue-300 transition-colors p-1 hover:bg-blue-500/10 rounded"
                      title="Reset order allocations"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {orderAllocations.map(allocation => (
                    <div 
                      key={allocation.batchNumber}
                      className="flex items-center justify-between bg-blue-500/5 rounded-lg p-2 text-sm"
                    >
                      <div>
                        <div className="text-white">Batch: {allocation.batchNumber}</div>
                        <div className="text-blue-300 text-xs mt-1">
                          {format(parseISO(allocation.allocationDate), 'MMM d, yyyy HH:mm')}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-white">{allocation.quantityKG} KG</span>
                        <button
                          onClick={() => onResetAllocation(allocation.batchNumber)}
                          className="text-blue-400 hover:text-blue-300 transition-colors p-1 hover:bg-blue-500/10 rounded"
                          title="Reset allocation"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
};