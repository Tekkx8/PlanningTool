import React from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { motion } from 'framer-motion';
import { AlertCircle, Info } from 'lucide-react';

interface UnallocatedStockProps {
  stockData: {
    conventional: {
      total: number;
      items: any[];
    };
    organic: {
      total: number;
      items: any[];
    };
  };
  allocationResults?: any[];
}

const isOrganic = (item: any) => {
  const materialId = item['Material ID']?.toLowerCase() || '';
  return materialId.includes('org') ||
         materialId.includes('organic') ||
         materialId.startsWith('bob');
};

export const UnallocatedStock: React.FC<UnallocatedStockProps> = ({ stockData, allocationResults }) => {
  const calculateUnallocatedPercentage = (items: any[], isOrganic: boolean) => {
    if (!allocationResults || !items.length) return 0;
    
    const totalWeight = items.reduce((sum, item) => 
      sum + (typeof item['Stock Weight'] === 'number' ? item['Stock Weight'] : parseFloat(item['Stock Weight'])), 0);
    
    const allocatedWeight = allocationResults
      .filter(result => {
        const resultIsOrganic = result['Material ID']?.toLowerCase().includes('org') ||
                               result['Material ID']?.toLowerCase().includes('organic') ||
                               result['Material ID']?.toLowerCase().startsWith('bob');
        return resultIsOrganic === isOrganic && result.customer;
      })
      .reduce((sum, result) => 
        sum + (typeof result['Stock Weight'] === 'number' ? result['Stock Weight'] : parseFloat(result['Stock Weight'])), 0);

    return Math.round(((totalWeight - allocatedWeight) / totalWeight) * 100);
  };

  const conventionalUnallocated = calculateUnallocatedPercentage(stockData.conventional.items, false);
  const organicUnallocated = calculateUnallocatedPercentage(stockData.organic.items, true);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        <AlertCircle className="w-6 h-6 text-blue-400" />
        <h2 className="text-xl font-semibold text-white">Unallocated Stock</h2>
        {!allocationResults && (
          <div className="flex items-center gap-2 ml-auto text-sm text-blue-300">
            <Info className="w-4 h-4" />
            <span>Run allocation to see results</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        {/* Conventional Meter */}
        <div>
          <h3 className="text-lg font-medium text-blue-300 mb-4 text-center">Conventional</h3>
          <div className="w-40 h-40 mx-auto">
            <CircularProgressbar
              value={conventionalUnallocated}
              text={`${conventionalUnallocated}%`}
              styles={buildStyles({
                pathColor: '#3B82F6',
                textColor: '#3B82F6',
                trailColor: '#1E3A8A',
                textSize: '20px',
                pathTransitionDuration: 0.5
              })}
            />
          </div>
        </div>

        {/* Organic Meter */}
        <div>
          <h3 className="text-lg font-medium text-green-300 mb-4 text-center">Organic</h3>
          <div className="w-40 h-40 mx-auto">
            <CircularProgressbar
              value={organicUnallocated}
              text={`${organicUnallocated}%`}
              styles={buildStyles({
                pathColor: '#22C55E',
                textColor: '#22C55E',
                trailColor: '#1E3A8A',
                textSize: '20px',
                pathTransitionDuration: 0.5
              })}
            />
          </div>
        </div>
      </div>
      
      {/* Detailed Breakdown */}
      <div className="grid grid-cols-2 gap-6 mt-auto">
        <div className="space-y-3">
          <div className="bg-blue-500/5 rounded-lg p-4 backdrop-blur-sm border border-blue-500/10 hover:bg-blue-500/10 transition-colors">
            <div className="flex justify-between items-center">
              <span className="text-blue-300 font-medium">Conv allocated</span>
              <span className="text-white font-semibold">
                {Math.round(
                  (allocationResults?.filter(r => !isOrganic(r) && r.customer) || [])
                    .reduce((sum, item) => sum + parseFloat(String(item['Stock Weight']).replace(' KG', '')), 0)
                ).toLocaleString()}
                <span className="text-blue-300 ml-1 text-sm">KG</span>
              </span>
            </div>
          </div>
          <div className="bg-blue-500/5 rounded-lg p-4 backdrop-blur-sm border border-blue-500/10 hover:bg-blue-500/10 transition-colors">
            <div className="flex justify-between items-center">
              <span className="text-blue-300 font-medium">Conv unallocated</span>
              <span className="text-white font-semibold">
                {Math.round(
                  (allocationResults?.filter(r => !isOrganic(r) && !r.customer) || [])
                    .reduce((sum, item) => sum + parseFloat(String(item['Stock Weight']).replace(' KG', '')), 0)
                ).toLocaleString()}
                <span className="text-blue-300 ml-1 text-sm">KG</span>
              </span>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="bg-green-500/5 rounded-lg p-4 backdrop-blur-sm border border-green-500/10 hover:bg-green-500/10 transition-colors">
            <div className="flex justify-between items-center">
              <span className="text-green-300 font-medium">Org allocated</span>
              <span className="text-white font-semibold">
                {Math.round(
                  (allocationResults?.filter(r => isOrganic(r) && r.customer) || [])
                    .reduce((sum, item) => sum + parseFloat(String(item['Stock Weight']).replace(' KG', '')), 0)
                ).toLocaleString()}
                <span className="text-green-300 ml-1 text-sm">KG</span>
              </span>
            </div>
          </div>
          <div className="bg-green-500/5 rounded-lg p-4 backdrop-blur-sm border border-green-500/10 hover:bg-green-500/10 transition-colors">
            <div className="flex justify-between items-center">
              <span className="text-green-300 font-medium">Org unallocated</span>
              <span className="text-white font-semibold">
                {Math.round(
                  (allocationResults?.filter(r => isOrganic(r) && !r.customer) || [])
                    .reduce((sum, item) => sum + parseFloat(String(item['Stock Weight']).replace(' KG', '')), 0)
                ).toLocaleString()}
                <span className="text-green-300 ml-1 text-sm">KG</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Orders Breakdown */}
      <div className="grid grid-cols-2 gap-6 mt-6">
        <div className="bg-blue-500/5 rounded-lg p-4 backdrop-blur-sm border border-blue-500/10 hover:bg-blue-500/10 transition-colors">
          <div className="flex justify-between items-center">
            <span className="text-blue-300 font-medium">Orders</span>
            <span className="text-white font-semibold">
              {Math.round(
                (allocationResults?.filter(r => r.customer && r.allocationDetails && !r.allocationDetails.isSpotSale) || [])
                  .reduce((sum, item) => sum + (item.allocatedQuantity || 0), 0)
              ).toLocaleString()}
              <span className="text-blue-300 ml-1 text-sm">KG</span>
            </span>
          </div>
        </div>
        <div className="bg-yellow-500/5 rounded-lg p-4 backdrop-blur-sm border border-yellow-500/10 hover:bg-yellow-500/10 transition-colors">
          <div className="flex justify-between items-center">
            <span className="text-yellow-300 font-medium">Spot</span>
            <span className="text-white font-semibold">
              {Math.round(
                (allocationResults?.filter(r => r.customer && r.allocationDetails?.isSpotSale) || [])
                  .reduce((sum, item) => sum + (item.allocatedQuantity || 0), 0)
              ).toLocaleString()}
              <span className="text-yellow-300 ml-1 text-sm">KG</span>
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};