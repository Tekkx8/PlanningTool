import React, { useState } from 'react';
import { Customer } from '../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';

interface CustomerRestrictionFormProps {
  customer: Customer;
  stock: any[];
  onUpdate: (updatedCustomer: Customer) => void;
}

export const CustomerRestrictionForm: React.FC<CustomerRestrictionFormProps> = ({ customer, stock, onUpdate }) => {
  const [restrictions, setRestrictions] = useState(customer.restrictions);

  const handleChange = (field: string, value: string) => {
    setRestrictions(prev => ({ ...prev, [field]: value || undefined }));
  };

  const uniqueOrigins = [...new Set(stock.map(item => item['Origin Country'] || ''))].filter(Boolean).sort();
  const uniqueVarieties = [...new Set(stock.map(item => item['Variety'] || ''))].filter(Boolean).sort();
  const uniqueGGNs = [...new Set(stock.map(item => item['GGN'] || ''))].filter(Boolean).sort();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate({ ...customer, restrictions });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-black/20 rounded-lg border border-blue-500/10 p-4">
      <div className="space-y-2">
        <label className="text-sm text-blue-400">Origin Country</label>
        <Select
          value={restrictions['Origin Country'] || ''}
          onValueChange={(value) => handleChange('Origin Country', value)}
        >
          <SelectTrigger className="bg-black/30 border-blue-500/20 text-white">
            <SelectValue placeholder="Select origin" />
          </SelectTrigger>
          <SelectContent className="bg-black/40 border-blue-500/20 text-white">
            <SelectItem value="">None</SelectItem>
            {uniqueOrigins.map(origin => (
              <SelectItem key={origin} value={origin} className="hover:bg-blue-500/20">
                {origin}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-blue-400">Variety</label>
        <Select
          value={restrictions['Variety'] || ''}
          onValueChange={(value) => handleChange('Variety', value)}
        >
          <SelectTrigger className="bg-black/30 border-blue-500/20 text-white">
            <SelectValue placeholder="Select variety" />
          </SelectTrigger>
          <SelectContent className="bg-black/40 border-blue-500/20 text-white">
            <SelectItem value="">None</SelectItem>
            {uniqueVarieties.map(variety => (
              <SelectItem key={variety} value={variety} className="hover:bg-blue-500/20">
                {variety}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-blue-400">GGN</label>
        <Select
          value={restrictions['GGN'] || ''}
          onValueChange={(value) => handleChange('GGN', value)}
        >
          <SelectTrigger className="bg-black/30 border-blue-500/20 text-white">
            <SelectValue placeholder="Select GGN" />
          </SelectTrigger>
          <SelectContent className="bg-black/40 border-blue-500/20 text-white">
            <SelectItem value="">None</SelectItem>
            {uniqueGGNs.map(ggn => (
              <SelectItem key={ggn} value={ggn} className="hover:bg-blue-500/20">
                {ggn}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
      >
        Update Restrictions
      </button>
    </form>
  );
};
