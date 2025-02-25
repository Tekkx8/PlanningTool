import React from 'react';
import { Modal } from './Modal';
import { AlertCircle, Check } from 'lucide-react';
import { StockItem, OrderItem } from '../types';
import { MaterialTypeHandler } from '../utils/MaterialTypeHandler';

interface OrganicAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderItem;
  availableStock: StockItem[];
  onConfirm: (supplier: string) => void;
}

export const OrganicAllocationModal: React.FC<OrganicAllocationModalProps> = ({
  isOpen,
  onClose,
  order,
  availableStock,
  onConfirm
}) => {
  const [selectedSupplier, setSelectedSupplier] = React.useState<string>('');

  const {
    canUseOrganic,
    availableSuppliers,
    recommendedSupplier
  } = MaterialTypeHandler.getOrganicAllocationOptions({
    order,
    availableStock
  });

  // Set recommended supplier as default
  React.useEffect(() => {
    if (recommendedSupplier) {
      setSelectedSupplier(recommendedSupplier);
    }
  }, [recommendedSupplier]);

  if (!canUseOrganic) return null;

  const handleConfirm = () => {
    if (selectedSupplier) {
      onConfirm(selectedSupplier);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Use Organic Stock for Conventional Order"
    >
      <div className="space-y-6">
        <div className="flex items-start gap-3 p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-300">
            <p className="font-medium mb-1">Organic Stock Available</p>
            <p>
              This conventional order can be fulfilled using organic stock.
              Please select a supplier to use for allocation.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-blue-300">Available Suppliers</h3>
          <div className="space-y-2">
            {availableSuppliers.map(supplier => (
              <button
                key={supplier}
                onClick={() => setSelectedSupplier(supplier)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  selectedSupplier === supplier
                    ? 'bg-blue-500/20 border-blue-500/40 text-white'
                    : 'bg-black/20 border-blue-500/10 text-blue-300 hover:bg-blue-500/10'
                }`}
              >
                <span>{supplier}</span>
                {selectedSupplier === supplier && (
                  <Check className="w-4 h-4 text-blue-400" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-blue-500/20">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-blue-300 hover:text-blue-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedSupplier}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              selectedSupplier
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-blue-500/20 text-blue-300 cursor-not-allowed'
            }`}
          >
            Confirm Allocation
          </button>
        </div>
      </div>
    </Modal>
  );
}