import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { StockItem } from '../../types';

interface StockAgeAnalysisProps {
  stock: StockItem[];
}

export const StockAgeAnalysis: React.FC<StockAgeAnalysisProps> = ({ stock }) => {
  const ageData = React.useMemo(() => {
    const ageGroups = stock.reduce((acc, item) => {
      const age = item['Real Stock Age'];
      acc[age] = (acc[age] || 0) + parseFloat(String(item['Stock Weight']).replace(' KG', ''));
      return acc;
    }, {} as Record<number, number>);

    return Object.entries(ageGroups)
      .map(([age, kilos]) => ({
        age: parseInt(age),
        kilos: Math.round(kilos)
      }))
      .sort((a, b) => b.age - a.age);
  }, [stock]);

  return (
    <div className="bg-black/20 backdrop-blur-sm rounded-lg p-6 border border-blue-500/10">
      <div className="flex items-center gap-3 mb-4">
        <Clock className="w-6 h-6 text-blue-400" />
        <h2 className="text-xl font-semibold text-white">Stock Age Analysis</h2>
      </div>

      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={ageData}
            layout="vertical"
            margin={{ top: 10, right: 30, left: 45, bottom: 5 }}
          >
            <XAxis type="number" unit=" KG" />
            <YAxis
              dataKey="age"
              type="number"
              unit=" days"
              domain={[0, 'auto']}
              orientation="left"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: '0.5rem'
              }}
              formatter={(value: number) => [`${value.toLocaleString()} KG`, 'Stock']}
              labelFormatter={(value: number) => `${value} days old`}
            />
            <Bar
              dataKey="kilos"
              fill="#3B82F6"
              radius={[0, 6, 6, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};