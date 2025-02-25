import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, X } from 'lucide-react';
import { Customer } from '../types';

interface AllocationListProps {
  customers: Customer[];
  onRemoveCustomer: (customerId: string) => void;
  onEditCustomer: (customer: Customer) => void;
}

export const AllocationList: React.FC<AllocationListProps> = ({
  customers,
  onRemoveCustomer,
  onEditCustomer,
}) => {
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());

  const toggleExpand = (customerId: string) => {
    setExpandedCustomers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(customerId)) {
        newSet.delete(customerId);
      } else {
        newSet.add(customerId);
      }
      return newSet;
    });
  };

  if (customers.length === 0) return null;

  return (
    <div className="space-y-2">
      {customers.map((customer) => {
        const isExpanded = expandedCustomers.has(customer.id);
        return (
          <div
            key={customer.id}
            className="bg-black/20 rounded-md border border-blue-500/10 overflow-hidden"
          >
            <div 
              className="flex items-center justify-between p-3 cursor-pointer"
              onClick={() => toggleExpand(customer.id)}
            >
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-blue-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-blue-400" />
                )}
                <span className="font-medium text-white">{customer.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditCustomer(customer);
                  }}
                  className="text-blue-400 hover:text-blue-300 transition-colors p-1"
                >
                  <Pencil size={18} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveCustomer(customer.id);
                  }}
                  className="text-blue-400 hover:text-blue-300 transition-colors p-1"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            
            {isExpanded && (
              <div className="px-4 pb-3 text-sm text-blue-300/80 border-t border-blue-500/10">
                {Object.entries(customer.restrictions)
                  .filter(([, value]) => value !== undefined)
                  .map(([key, value]) => (
                    <div key={key} className="mt-2 flex justify-between">
                      <span className="text-blue-400">{key}:</span>
                      <span>{value}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};