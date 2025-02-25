import React from 'react';
import { format, parseISO, addDays, subDays } from 'date-fns';
import { OrderItem } from '../../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SpotSalesProps {
  orders: OrderItem[];
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

export const SpotSales: React.FC<SpotSalesProps> = ({ orders, selectedDate, onDateChange }) => {
  const isSpotSale = (order: OrderItem) => {
    return order.isSpotSale === true || 
           (order.Material && (order.Material.startsWith('BCB') || order.Material.startsWith('BOB'))) ||
           order['Material Description']?.toLowerCase().includes('spot');
  };

  const getOrderStats = () => {
    const dayOrders = orders.filter(order => 
      format(parseISO(order['Loading Date']), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
    );

    const spotSales = dayOrders.filter(isSpotSale);
    const productionOrders = dayOrders.filter(order => !isSpotSale(order));

    const spotKilos = spotSales.reduce((sum, order) => 
      sum + (parseFloat(order.SalesQuantityKG.replace(/[^\d.-]/g, '')) || 0), 0);
    const productionKilos = productionOrders.reduce((sum, order) => 
      sum + (parseFloat(order.SalesQuantityKG.replace(/[^\d.-]/g, '')) || 0), 0);
    const totalKilos = spotKilos + productionKilos;

    return {
      spotKilos,
      productionKilos,
      productionKilos,
      spotPercentage: totalKilos > 0 ? (spotKilos / totalKilos) * 100 : 0
    };
  };

  const { spotKilos, productionKilos, spotPercentage } = getOrderStats();
  const isMoreSpot = spotKilos > productionKilos;
  const fillPercentage = isMoreSpot ? spotPercentage : 100 - spotPercentage;

  // Get date range from orders
  const dateRange = React.useMemo(() => {
    const dates = orders.map(order => parseISO(order['Loading Date']));
    if (dates.length === 0) return { start: new Date(), end: new Date() };
    return {
      start: new Date(Math.min(...dates.map(date => date.getTime()))),
      end: new Date(Math.max(...dates.map(date => date.getTime())))
    };
  }, [orders]);

  // Add date picker for easier navigation
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onDateChange(new Date(e.target.value));
  };

  const handlePrevDay = () => {
    const newDate = subDays(selectedDate, 1);
    if (newDate >= dateRange.start) {
      onDateChange(newDate);
    }
  };

  const handleNextDay = () => {
    const newDate = addDays(selectedDate, 1);
    if (newDate <= dateRange.end) {
      onDateChange(newDate);
    }
  };

  return (
    <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-blue-500/20 p-6 h-[400px]">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Spot Sales</h2>
        <input
          type="date"
          value={format(selectedDate, 'yyyy-MM-dd')}
          onChange={handleDateChange}
          className="bg-black/40 border border-blue-500/20 rounded px-3 py-1 text-white"
        />
      </div>

      <div className="relative mb-8">
        <div className="flex items-center justify-between bg-black/40 border border-blue-500/20 rounded px-3 py-2">
          <button
            onClick={handlePrevDay}
            disabled={selectedDate <= dateRange.start}
            className={`p-1 rounded-full transition-colors ${
              selectedDate <= dateRange.start
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-blue-500/20'
            }`}
          >
            <ChevronLeft className="w-5 h-5 text-blue-400" />
          </button>
          
          <span className="text-white font-medium">
            {format(selectedDate, 'MMMM d, yyyy')}
          </span>
          
          <button
            onClick={handleNextDay}
            disabled={selectedDate >= dateRange.end}
            className={`p-1 rounded-full transition-colors ${
              selectedDate >= dateRange.end
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-blue-500/20'
            }`}
          >
            <ChevronRight className="w-5 h-5 text-blue-400" />
          </button>
        </div>
      </div>

      <div className="text-center mb-8">
        <div className="text-4xl font-bold text-white">
          {Math.round(spotKilos).toLocaleString()}
        </div>
        <div className="text-sm text-blue-300">Kilos in Spot Sales</div>
      </div>

      <div className="relative pt-2">
        {/* Gauge Background */}
        <div className="absolute inset-x-0 top-0 flex justify-between text-xs text-gray-400">
          <span>Production</span>
          <span>Spot</span>
        </div>
        
        <div className="h-2 relative mt-6">
          {/* Background Track */}
          <div className="absolute inset-0 rounded-full bg-gray-700"></div>
          
          {/* Progress Arc */}
          <div 
            className={`absolute inset-0 rounded-full overflow-hidden ${
              isMoreSpot 
                ? 'bg-yellow-500' 
                : 'bg-blue-500'
            }`}
            style={{
              clipPath: isMoreSpot
                ? `polygon(${100 - fillPercentage}% 0, 100% 0, 100% 100%, ${100 - fillPercentage}% 100%)`
                : `polygon(0 0, ${fillPercentage}% 0, ${fillPercentage}% 100%, 0 100%)`
            }}
          ></div>
          
          {/* Tick Marks */}
          <div className="absolute inset-0 flex justify-between px-1">
            {[0, 20, 40, 60, 80, 100].map((tick) => (
              <div 
                key={tick}
                className="w-px h-3 bg-gray-600"
                style={{ transform: 'translateY(-4px)' }}
              ></div>
            ))}
          </div>
          
          {/* Percentage Indicator */}
          <div 
            className="absolute top-0 w-1 h-4 bg-white rounded-full transform -translate-y-1/2"
            style={{ 
              left: isMoreSpot ? `${100 - fillPercentage}%` : `${fillPercentage}%`,
              transform: 'translateX(-50%) translateY(-50%)'
            }}
          ></div>
        </div>
        
        {/* Percentage Display */}
        <div className="text-center mt-4 text-sm text-gray-400">
          {isMoreSpot ? (
            <span>
              <span className="text-yellow-500">{Math.round(spotPercentage)}% Spot</span>
              {' / '}
              <span className="text-blue-500">{Math.round(100 - spotPercentage)}% Production</span>
            </span>
          ) : (
            <span>
              <span className="text-blue-500">{Math.round(100 - spotPercentage)}% Production</span>
              {' / '}
              <span className="text-yellow-500">{Math.round(spotPercentage)}% Spot</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};