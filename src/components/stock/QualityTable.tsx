import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { StockItem } from '../../types';

const QUALITY_COLORS = {
  'Good': '#22c55e',       // Green
  'Good Q/S': '#86efac',   // Faded Green
  'Fair': '#3b82f6',       // Blue
  'Fair M/C': '#93c5fd',   // Faded Blue
  'Poor': '#ca8a04',       // Dark Yellow
  'Poor M/C': '#fde047',   // Light Yellow
  'Bad': '#ef4444',        // Red
  'Unknown': '#6b7280',    // Grey
};

const QUALITY_ORDER = [
  'Good',
  'Good Q/S',
  'Fair',
  'Fair M/C',
  'Poor',
  'Poor M/C',
  'Bad',
  'Unknown'
];

interface QualityTableProps {
  stock: StockItem[];
}

interface QualityData {
  name: string;
  value: number;
  varieties?: { name: string; value: number; }[];
}

export const QualityTable: React.FC<QualityTableProps> = ({ stock }) => {
  const [activeQuality, setActiveQuality] = React.useState<string | null>(null);
  const [hoveredQuality, setHoveredQuality] = React.useState<string | null>(null);

  const { qualityData, varietyData } = React.useMemo(() => {
    const qualityMap: Record<string, number> = {};
    const varietyMap: Record<string, Record<string, number>> = {};
    
    stock.forEach(item => {
      const quality = item['Q3: Reinspection Quality'] || 'Unknown';
      const variety = item.Variety || 'Unknown';
      const weight = parseFloat(String(item['Stock Weight']).replace(' KG', ''));

      // Update quality totals
      qualityMap[quality] = (qualityMap[quality] || 0) + weight;

      // Update variety breakdown per quality
      if (!varietyMap[quality]) {
        varietyMap[quality] = {};
      }
      varietyMap[quality][variety] = (varietyMap[quality][variety] || 0) + weight;
    });

    // Convert to chart data format
    const qualityData = QUALITY_ORDER.map(quality => ({
      name: quality,
      value: qualityMap[quality] || 0,
      varieties: Object.entries(varietyMap[quality] || {}).map(([name, value]) => ({
        name,
        value
      }))
    })).filter(item => item.value > 0);

    return { qualityData, varietyData: varietyMap };
  }, [stock]);

  const totalWeight = qualityData.reduce((sum, item) => sum + item.value, 0);

  const getDisplayData = () => {
    if (activeQuality && qualityData.find(q => q.name === activeQuality)?.varieties) {
      return qualityData
        .find(q => q.name === activeQuality)
        ?.varieties
        ?.sort((a, b) => b.value - a.value) || [];
    }
    return qualityData;
  };

  const handleMouseEnter = (quality: string) => {
    setHoveredQuality(quality);
  };

  const handleMouseLeave = () => {
    setHoveredQuality(null);
  };

  const handleClick = (quality: string) => {
    setActiveQuality(activeQuality === quality ? null : quality);
  };

  return (
    <div className="w-full relative">
      <div className="flex items-center gap-3 mb-2">
        <CheckCircle className="w-6 h-6 text-blue-400" />
        <h2 className="text-xl font-semibold text-white">
          {activeQuality ? `${activeQuality} by Variety` : 'Quality Distribution'}
        </h2>
        {activeQuality && (
          <button
            onClick={() => setActiveQuality(null)}
            className="ml-auto text-sm text-blue-400 hover:text-blue-300"
          >
            Back to Overview
          </button>
        )}
      </div>

      <div className="h-[400px] mt-6">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={getDisplayData()}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="45%"
              innerRadius="60%"
              outerRadius="80%"
              paddingAngle={2}
              onClick={(data) => handleClick(data.name)}
              onMouseEnter={(data) => handleMouseEnter(data.name)}
              onMouseLeave={handleMouseLeave}
            >
              {getDisplayData().map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={activeQuality ? QUALITY_COLORS[activeQuality] : QUALITY_COLORS[entry.name]}
                  opacity={hoveredQuality === entry.name ? 1 : 0.8}
                  style={{ cursor: 'pointer' }}
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const data = payload[0].payload;
                const percentage = ((data.value / totalWeight) * 100).toFixed(1);
                return (
                  <div className="bg-black/80 border border-blue-500/20 rounded-lg p-3 shadow-lg">
                    <div className="text-white font-medium">{data.name}</div>
                    <div className="text-blue-300">
                      {Math.round(data.value).toLocaleString()} KG
                    </div>
                    <div className="text-blue-300">{percentage}%</div>
                  </div>
                );
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={48}
              content={({ payload }) => (
                <div className="flex flex-wrap justify-center gap-3 mt-4">
                  {payload?.map((entry: any) => (
                    <div
                      key={entry.value}
                      className="flex items-center gap-2 cursor-pointer"
                      onClick={() => handleClick(entry.value)}
                      onMouseEnter={() => handleMouseEnter(entry.value)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor: entry.color,
                          opacity: hoveredQuality === entry.value ? 1 : 0.8
                        }}
                      />
                      <span className="text-sm text-blue-300">{entry.value}</span>
                    </div>
                  ))}
                </div>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Center Text */}
      <div
        className="absolute top-[45%] left-1/2 transform -translate-x-1/2 -translate-y-1/2
                   text-center pointer-events-none"
      >
        <div className="text-4xl font-bold text-white">
          {Math.round(totalWeight).toLocaleString()}
        </div>
        <div className="text-sm text-blue-300">
          Total KG
        </div>
      </div>
    </div>
  );
};