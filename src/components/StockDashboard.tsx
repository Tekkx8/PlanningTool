import React from 'react';
import { useSpring, animated } from '@react-spring/web';
import { ArrowRight } from 'lucide-react';
import { StockItem } from '../types';
import { StockOverview } from './stock/StockOverview';
import { UnallocatedStock } from './stock/UnallocatedStock';
import { StockAgeAnalysis } from './stock/StockAgeAnalysis';
import { QualityTable } from './stock/QualityTable';
import { SupplierBreakdown } from './stock/SupplierBreakdown';
import { AllocationResult } from '../types';

interface StockDashboardProps {
  stock: StockItem[];
  allocationResults?: AllocationResult[];
}

export const StockDashboard: React.FC<StockDashboardProps> = ({ stock, allocationResults }) => {
  const [isFlipped, setIsFlipped] = React.useState(false);

  const { transform, opacity } = useSpring({
    opacity: isFlipped ? 1 : 0,
    transform: `perspective(600px) rotateY(${isFlipped ? 180 : 0}deg)`,
    config: { mass: 5, tension: 500, friction: 80 }
  });

  const calculateTotalKilos = (items: StockItem[]) => {
    return items.reduce((sum, item) => {
      return sum + (parseFloat(String(item['Stock Weight']).replace(' KG', '')) || 0);
    }, 0);
  };

  const isOrganic = (item: StockItem) => {
    const materialId = item['Material ID']?.toLowerCase() || '';
    return materialId.includes('org') || 
           materialId.includes('organic') || 
           materialId.startsWith('bob');
  };

  const conventionalStock = stock.filter(item => !isOrganic(item));
  const organicStock = stock.filter(item => isOrganic(item));

  const stockData = {
    conventional: {
      total: calculateTotalKilos(conventionalStock),
      items: conventionalStock
    },
    organic: {
      total: calculateTotalKilos(organicStock),
      items: organicStock
    },
    total: calculateTotalKilos(stock)
  };

  return (
    <div className="relative min-h-[800px]">
      {/* Flip Button */}
      <button
        onClick={() => setIsFlipped(state => !state)}
        className="absolute right-4 top-4 z-10 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-colors"
        title={isFlipped ? "Show Front" : "Show Back"}
      >
        <ArrowRight className={`w-5 h-5 transition-transform duration-500 ${isFlipped ? 'rotate-180' : ''}`} />
      </button>

      {/* Front Side */}
      <animated.div
        style={{
          opacity: opacity.to(o => 1 - o),
          transform,
          position: 'absolute',
          width: '100%'
        }}
        className={`${isFlipped ? 'pointer-events-none' : ''}`}
      >
        <div className="space-y-8">
          {/* Top Section - Total Kilos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            <div className="p-6 bg-blue-500/10 rounded-lg">
              <div className="text-sm text-blue-300">KILOS CONVENTIONAL</div>
              <div className="text-2xl font-bold text-white">
                {Math.round(stockData.conventional.total).toLocaleString()} KG
              </div>
            </div>
            <div className="p-6 bg-green-500/10 rounded-lg">
              <div className="text-sm text-green-300">KILOS ORGANIC</div>
              <div className="text-2xl font-bold text-white">
                {Math.round(stockData.organic.total).toLocaleString()} KG
              </div>
            </div>
            <div className="p-6 bg-purple-500/10 rounded-lg">
              <div className="text-sm text-purple-300">TOTAL KILOS</div>
              <div className="text-2xl font-bold text-white">
                {Math.round(stockData.total).toLocaleString()} KG
              </div>
            </div>
          </div>

          {/* Main Stock Section */}
          <div className="grid grid-cols-3 gap-6">
            {/* Left: Conventional Stock */}
            <div className="bg-black/20 backdrop-blur-sm rounded-lg p-6 border border-blue-500/10">
              <h3 className="text-lg font-medium text-white mb-4">Conventional Stock</h3>
              <div className="space-y-2">
                {Array.from(new Set(stockData.conventional.items.map(item => item.Variety))).map((variety) => (
                  <div key={variety} className="flex justify-between items-center p-3 bg-blue-500/5 rounded-lg">
                    <span className="text-blue-300">{variety}</span>
                    <span className="text-white font-medium">
                      {Math.round(stockData.conventional.items
                        .filter(item => item.Variety === variety)
                        .reduce((sum, item) => sum + parseFloat(String(item['Stock Weight']).replace(' KG', '')), 0)
                      ).toLocaleString()} KG
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Middle: Unallocated Stock */}
            <div className="bg-black/20 backdrop-blur-sm rounded-lg p-6 border border-blue-500/10">
              <UnallocatedStock stockData={stockData} allocationResults={allocationResults} />
            </div>

            {/* Right: Organic Stock */}
            <div className="bg-black/20 backdrop-blur-sm rounded-lg p-6 border border-blue-500/10">
              <h3 className="text-lg font-medium text-white mb-4">Organic Stock</h3>
              <div className="space-y-2">
                {Array.from(new Set(stockData.organic.items.map(item => item.Variety))).map((variety) => (
                  <div key={variety} className="flex justify-between items-center p-3 bg-green-500/5 rounded-lg">
                    <span className="text-green-300">{variety}</span>
                    <span className="text-white font-medium">
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
      </animated.div>

      {/* Back Side */}
      <animated.div
        style={{
          opacity,
          transform: transform.to(t => `${t} rotateY(180deg)`),
          position: 'absolute',
          width: '100%',
          height: '100%'
        }}
        className={`${!isFlipped ? 'pointer-events-none' : ''} overflow-hidden`}
      >
        <div className="space-y-6 h-full">
          {/* Top Row */}
          <div className="bg-black/20 backdrop-blur-sm rounded-lg p-6 border border-blue-500/10 mb-6">
            <QualityTable stock={stock} />
          </div>
          
          {/* Bottom Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <StockAgeAnalysis stock={stock} />
            <SupplierBreakdown stock={stock} />
          </div>
        </div>
      </animated.div>
    </div>
  );
};