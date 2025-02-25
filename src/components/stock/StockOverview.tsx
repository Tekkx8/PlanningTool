import React from 'react';
import { motion } from 'framer-motion';
import { Package } from 'lucide-react';

interface StockData {
  conventional: {
    total: number;
    items: any[];
  };
  organic: {
    total: number;
    items: any[];
  };
  total: number;
}

interface StockOverviewProps {
  stockData: StockData;
}

export const StockOverview: React.FC<StockOverviewProps> = ({ stockData }) => {
  return (
    <div className="bg-black/20 backdrop-blur-sm rounded-lg p-6 border border-blue-500/10">
      <div className="flex items-center gap-3 mb-6">
        <Package className="w-6 h-6 text-blue-400" />
        <h2 className="text-xl font-semibold text-white">Blueberries</h2>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-4 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-blue-500/10 rounded-lg"
        >
          <div className="text-sm text-blue-300">KILOS CONVENTIONAL</div>
          <div className="text-2xl font-bold text-white truncate">
            {Math.round(stockData.conventional.total).toLocaleString()} KG
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 bg-green-500/10 rounded-lg"
        >
          <div className="text-sm text-green-300">KILOS ORGANIC</div>
          <div className="text-2xl font-bold text-white truncate">
            {Math.round(stockData.organic.total).toLocaleString()} KG
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-4 bg-purple-500/10 rounded-lg"
        >
          <div className="text-sm text-purple-300">TOTAL KILOS</div>
          <div className="text-2xl font-bold text-white truncate">
            {Math.round(stockData.total).toLocaleString()} KG
          </div>
        </motion.div>
      </div>

      {/* Conventional Stock */}
      <div className="grid grid-cols-1 gap-6">
        <div>
          <h3 className="text-lg font-medium text-white mb-4">Conventional Stock</h3>
          <div className="space-y-2">
            {Array.from(new Set(stockData.conventional.items.map(item => item.Variety))).map((variety) => (
              <div key={variety} className="flex justify-between items-center p-3 bg-blue-500/5 rounded-lg">
                <span className="text-blue-300 truncate mr-2">{variety}</span>
                <span className="text-white font-medium whitespace-nowrap">
                  {Math.round(stockData.conventional.items
                    .filter(item => item.Variety === variety)
                    .reduce((sum, item) => sum + parseFloat(String(item['Stock Weight']).replace(' KG', '')), 0)
                  ).toLocaleString()} KG
                </span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-lg font-medium text-white mb-4">Organic Stock</h3>
          <div className="space-y-2">
            {Array.from(new Set(stockData.organic.items.map(item => item.Variety))).map((variety) => (
              <div key={variety} className="flex justify-between items-center p-3 bg-green-500/5 rounded-lg">
                <span className="text-green-300 truncate mr-2">{variety}</span>
                <span className="text-white font-medium whitespace-nowrap">
                  {Math.round(stockData.organic.items
                    .filter(item => item.Variety === variety)
                    .reduce((sum, item) => sum + parseFloat(String(item['Stock Weight']).replace(' KG', '')), 0)
                  ).toLocaleString()} KG
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};