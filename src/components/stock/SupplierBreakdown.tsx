import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { Building2 } from 'lucide-react';
import { StockItem } from '../../types';

interface SupplierBreakdownProps {
  stock: StockItem[];
}

export const SupplierBreakdown: React.FC<SupplierBreakdownProps> = ({ stock }) => {
  const supplierData = React.useMemo(() => {
    const data = stock.reduce((acc, item) => {
      const supplier = item.Supplier || 'Unknown';
      const weight = parseFloat(String(item['Stock Weight']).replace(' KG', ''));
      acc[supplier] = (acc[supplier] || 0) + weight;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(data)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({
        name,
        value: Math.round(value)
      }));
  }, [stock]);

  return (
    <div className="bg-black/20 backdrop-blur-sm rounded-lg p-6 border border-blue-500/10">
      <div className="flex items-center gap-3 mb-4">
        <Building2 className="w-6 h-6 text-blue-400" />
        <h2 className="text-xl font-semibold text-white">Supplier Breakdown</h2>
      </div>

      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={supplierData}
            margin={{ top: 10, right: 30, left: 45, bottom: 70 }}
          >
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={80}
              interval={0}
              tick={{ fill: '#94A3B8', fontSize: 10 }}
            />
            <YAxis
              unit=" KG"
              tick={{ fill: '#94A3B8' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: '0.5rem'
              }}
              formatter={(value: number) => [`${value.toLocaleString()} KG`, 'Stock']}
            />
            <Bar
              dataKey="value"
              fill="#3B82F6"
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};