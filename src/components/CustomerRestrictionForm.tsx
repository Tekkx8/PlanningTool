import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Customer, CustomerRestrictions, StockItem } from '../types';

interface CustomerRestrictionFormProps {
  stock: StockItem[];
  onAddCustomer: (customer: Customer) => void;
  customerNames: string[];
  editingCustomer: Customer | null;
  onCancelEdit: () => void;
}

export const CustomerRestrictionForm: React.FC<CustomerRestrictionFormProps> = ({
  stock,
  onAddCustomer,
  customerNames,
  editingCustomer,
  onCancelEdit,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [restrictions, setRestrictions] = useState<CustomerRestrictions>({});

  useEffect(() => {
    if (editingCustomer) {
      setSelectedCustomer(editingCustomer.name);
      setRestrictions(editingCustomer.restrictions);
      setIsExpanded(true);
    }
  }, [editingCustomer]);

  const getUniqueValues = (field: keyof StockItem) => {
    const values = new Set(stock.map(item => item[field]).filter(Boolean));
    return Array.from(values).sort();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    onAddCustomer({
      id: editingCustomer?.id || crypto.randomUUID(),
      name: selectedCustomer,
      restrictions
    });

    // Reset form
    setSelectedCustomer('');
    setRestrictions({});
    setIsExpanded(false);
    onCancelEdit();
  };

  const handleFieldChange = (field: keyof CustomerRestrictions, value: string) => {
    setRestrictions(prev => ({
      ...prev,
      [field]: value === 'N/A' ? undefined : value
    }));
  };

  const fields = [
    { field: 'Origin Country', label: 'Origin' },
    { field: 'Variety', label: 'Variety' },
    { field: 'GGN', label: 'GGN' },
    { field: 'Q3: Reinspection Quality', label: 'Quality' },
    { field: 'BL/AWB/CMR', label: 'BL/AWB/CMR' },
    { field: 'MinimumSize', label: 'Minimum Size' },
    { field: 'Origin Pallet Number', label: 'Origin Pallet Number' },
    { field: 'Supplier', label: 'Supplier' }
  ];

  return (
    <div className="bg-black/20 rounded-lg p-4 mb-4 border border-blue-500/10">
      <div 
        className="flex justify-between items-center cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="text-lg font-medium text-white">
          {editingCustomer ? `Edit ${editingCustomer.name}` : 'Add Customer Restrictions'}
        </h3>
        {isExpanded ? (
          <ChevronUp size={20} className="text-blue-400" />
        ) : (
          <ChevronDown size={20} className="text-blue-400" />
        )}
      </div>

      {isExpanded && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-blue-300">
              Customer
            </label>
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="mt-1 block w-full rounded-md border-blue-500/20 bg-black/40 text-white shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500/20"
              disabled={!!editingCustomer}
            >
              <option value="">Select Customer</option>
              {customerNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {selectedCustomer && (
            <>
              {fields.map(({ field, label }) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-blue-300">
                    {label}
                  </label>
                  <select
                    value={restrictions[field as keyof CustomerRestrictions] || 'N/A'}
                    onChange={(e) => handleFieldChange(field as keyof CustomerRestrictions, e.target.value)}
                    className="mt-1 block w-full rounded-md border-blue-500/20 bg-black/40 text-white shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500/20"
                  >
                    <option value="N/A">N/A</option>
                    {getUniqueValues(field as keyof StockItem).map(value => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </div>
              ))}

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black transition-colors"
                >
                  {editingCustomer ? 'Update Restrictions' : 'Apply Restrictions'}
                </button>
                {editingCustomer && (
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-black transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </>
          )}
        </form>
      )}
    </div>
  );
};