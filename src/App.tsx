import React, { useState, useCallback } from 'react';
import { useSpring, animated } from '@react-spring/web';
import { FileUpload } from './components/FileUpload';
import { StartPage } from './components/StartPage';
import { CustomerList } from './components/CustomerList';
import { AllocationModal } from './components/AllocationModal';
import { StockDashboard } from './components/StockDashboard';
import { ScrollablePanel } from './components/ScrollablePanel';
import { ProductionDashboard } from './components/ProductionDashboard';
import { SidePanel } from './components/SidePanel';
import { StockItem, OrderItem, Customer, AllocationResult } from './types';
import { ClipboardList, Settings, RotateCcw, LayoutDashboard, CheckCircle2, X, ArrowRight, Download, AlertCircle } from 'lucide-react';
import { Logo } from './components/Logo';
import * as XLSX from 'xlsx';
import { parse, format, parseISO } from 'date-fns';
import { AllocationManager } from './utils/allocationManager';

function App() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeTab, setActiveTab] = useState<'allocation' | 'stock' | 'production'>('allocation');
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAllocationFlipped, setIsAllocationFlipped] = useState(false);
  const [allocationResults, setAllocationResults] = useState<AllocationResult[]>([]);
  const [hasEnteredApp, setHasEnteredApp] = useState(false);
  const [hasAllocated, setHasAllocated] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(() => {
    const today = new Date();
    return {
      start: format(today, 'yyyy-MM-dd'),
      end: format(today, 'yyyy-MM-dd')
    };
  });
  const [allocationManager] = useState(() => new AllocationManager());
  const [includeSpotSales, setIncludeSpotSales] = useState(true);

  const { transform, opacity } = useSpring({
    opacity: isAllocationFlipped ? 1 : 0,
    transform: `perspective(600px) rotateY(${isAllocationFlipped ? 180 : 0}deg)`,
    config: { mass: 5, tension: 500, friction: 80 }
  });

  const handleUpdateCustomer = (updatedCustomer: Customer) => {
    setCustomers(prev => prev.map(customer => 
      customer.id === updatedCustomer.id ? updatedCustomer : customer
    ));
  };

  const handleRemoveCustomer = (customerId: string) => {
    setCustomers(prev => prev.filter(customer => customer.id !== customerId));
  };

  const downloadAllocation = useCallback(() => {
    if (!allocationResults.length) return;

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(allocationResults);
    XLSX.utils.book_append_sheet(wb, ws, 'Allocation');
    XLSX.writeFile(wb, 'fruit-allocation.xlsx');
  }, [allocationResults]);

  const allocateFruit = useCallback(() => {
    // Filter orders by date range
    const filteredOrders = orders.filter(order => {
      const orderDate = parseISO(order['Loading Date']);
      return (
        format(orderDate, 'yyyy-MM-dd') >= dateRange.start &&
        format(orderDate, 'yyyy-MM-dd') <= dateRange.end
      );
    });

    // Filter by spot sales if needed
    const relevantOrders = includeSpotSales ? 
      filteredOrders : 
      filteredOrders.filter(order => !order.isSpotSale);

    const allocation: AllocationResult[] = stock.map((item, index) => ({
      ...item,
      originalRow: index + 2,
      customer: '',
      allocatedQuantity: 0,
      allocationDetails: undefined
    }));

    // Sort stock by quality and age
    allocation.sort((a, b) => {
      const qualityOrder = {
        'Poor M/C': 0,
        'Poor': 1,
        'Fair M/C': 2,
        'Fair': 3,
        'Good Q/S': 4,
        'Good': 5
      };
      const qualityA = qualityOrder[a['Q3: Reinspection Quality'] as keyof typeof qualityOrder] ?? 999;
      const qualityB = qualityOrder[b['Q3: Reinspection Quality'] as keyof typeof qualityOrder] ?? 999;
      
      // First sort by quality
      if (qualityA !== qualityB) return qualityA - qualityB;
      
      // Then by age (oldest first)
      return b['Real Stock Age'] - a['Real Stock Age'];
    });

    // Process orders chronologically by loading date
    const sortedOrders = [...relevantOrders].sort((a, b) => 
      parseISO(a['Loading Date']).getTime() - parseISO(b['Loading Date']).getTime()
    ).filter(order => {
      const status = order.OrderStatus?.toLowerCase() || '';
      return status !== 'delivered' && status !== 'in delivery';
    });

    for (const order of sortedOrders) {
      const customer = customers.find(c => c.name === order.SoldToParty);
      if (!customer) continue;
      
      const requiredQuantity = parseFloat(order.SalesQuantityKG.replace(/[^\d.-]/g, ''));
      let remainingQuantity = requiredQuantity;
      
      // Calculate extra allocation for production orders (10% more)
      const targetQuantity = order.isSpotSale ? 
        requiredQuantity : 
        requiredQuantity * 1.1; // 10% extra for production orders

      // Find matching stock items that meet all criteria
      const matchingStock = allocation.filter(item => {
        // Skip if already allocated
        if (item.customer) return false;

        // Check customer restrictions
        return Object.entries(customer.restrictions).every(([key, value]) => {
          if (!value) return true; // Skip if no restriction
          return item[key as keyof StockItem] === value;
        });
      });

      // Allocate stock to order
      for (const item of matchingStock) {
        if (remainingQuantity <= 0) break;

        const stockWeight = parseFloat(String(item['Stock Weight']).replace(' KG', ''));
        const allocateQuantity = Math.min(stockWeight, remainingQuantity);

        // Update allocation
        item.customer = order.SoldToParty;
        item.allocatedQuantity = allocateQuantity;
        item.allocationDetails = {
          orderNumber: order.Order || '',
          salesDocument: order['Sales document'],
          requiredQuantity,
          allocatedQuantity: allocateQuantity,
          isPartial: remainingQuantity > allocateQuantity,
          isSpotSale: order.isSpotSale || false
        };

        remainingQuantity -= allocateQuantity;
      }
    }

    setAllocationResults(allocation);
    setHasAllocated(true);
    setIsAllocationFlipped(true);
  }, [stock, customers, orders, dateRange, includeSpotSales]);

  const handleFileUpload = (fileData: { data: any[], type: 'stock' | 'orders', filename: string }) => {
    setIsProcessing(true);
    if (fileData.type === 'stock') {
      const processedStock = fileData.data.map(item => ({
        ...item,
        'Stock Weight': parseFloat(String(item['Stock Weight']).replace(' KG', '')),
        'Real Stock Age': parseInt(String(item['Real Stock Age'] || '0'), 10)
      }));
      setStock(processedStock);
    } else if (fileData.type === 'orders') {
      const processedOrders = fileData.data.map(order => {
        try {
          if (!order['Sales document'] || !order['Loading Date']) {
            console.warn('Missing required fields:', order);
            return null;
          }

          // Ensure we have a valid date
          let loadingDate: Date;
          const rawDate = order['Loading Date'];

          if (rawDate instanceof Date) {
            loadingDate = rawDate;
          } else if (typeof rawDate === 'number') {
            // Excel date number (days since 1900)
            loadingDate = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
          } else {
            loadingDate = new Date(rawDate);
          }

          if (isNaN(loadingDate.getTime())) {
            console.error('Invalid date:', rawDate);
            return null;
          }

          const isOrganic = order['Material Description']?.toLowerCase().includes('org') ||
                          order['Material Description']?.toLowerCase().includes('organic');

          const isSpotSale = order.Material ? 
            order.Material.startsWith('BCB') || order.Material.startsWith('BOB') :
            order['Material Description']?.toLowerCase().includes('spot') || false;

          return {
            ...order,
            'Loading Date': format(loadingDate, 'yyyy-MM-dd'),
            Order: order.Order || '',
            'Sales document': order['Sales document'],
            'Sales document item': order['Sales Document Item']?.toString() || '10',
            SalesQuantityKG: String(parseFloat(String(order.SalesQuantityKG || '0').replace(/[^\d.-]/g, ''))),
            SalesQuantityCS: String(parseFloat(String(order.SalesQuantityCS || '0').replace(/[^\d.-]/g, ''))),
            Material: order.Material || '',
            OrderStatus: order.OrderStatus || 'Not Released',
            isOrganic,
            isSpotSale
          };
        } catch (error) {
          console.error('Error processing order:', order, error);
          return null;
        }
      }).filter((order): order is OrderItem => order !== null);

      setOrders(processedOrders);
      
      // Extract unique customers
      const uniqueCustomers = Array.from(new Set(processedOrders.map(order => order.SoldToParty)))
        .filter(Boolean)
        .map(name => ({
          id: crypto.randomUUID(),
          name,
          restrictions: {}
        }));
      setCustomers(uniqueCustomers);
    }
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen">
      {!hasEnteredApp ? (
        <StartPage
          onDataLoaded={handleFileUpload}
          uploadedFiles={[
            ...(stock.length > 0 ? ['stock.xlsx'] : []),
            ...(orders.length > 0 ? ['orders.xlsx'] : [])
          ]}
          onEnter={() => setHasEnteredApp(true)}
          isProcessing={isProcessing}
        />
      ) : (
        <>
          <header className="bg-black/40 backdrop-blur-sm border-b border-blue-500/20">
            <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setHasEnteredApp(false)}
                  className="transition-transform hover:scale-105"
                >
                  <Logo />
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('allocation')}
                    className={`px-4 py-2 rounded-md transition-colors ${
                      activeTab === 'allocation'
                        ? 'bg-blue-600 text-white'
                        : 'text-blue-400 hover:bg-blue-600/20'
                    }`}
                  >
                    Allocation
                  </button>
                  <button
                    onClick={() => setActiveTab('stock')}
                    className={`px-4 py-2 rounded-md transition-colors ${
                      activeTab === 'stock'
                        ? 'bg-blue-600 text-white'
                        : 'text-blue-400 hover:bg-blue-600/20'
                    }`}
                  >
                    Stock Dashboard
                  </button>
                  <button
                    onClick={() => setActiveTab('production')}
                    className={`px-4 py-2 rounded-md transition-colors ${
                      activeTab === 'production'
                        ? 'bg-blue-600 text-white'
                        : 'text-blue-400 hover:bg-blue-600/20'
                    }`}
                  >
                    Production Dashboard
                  </button>
                </div>
              </div>
            </div>
          </header>

          <main className="container mx-auto px-4 py-6 lg:px-8 space-y-6 max-w-[1920px] relative z-10">
            {activeTab === 'allocation' ? (
              <>
                <div className="relative min-h-[600px] mt-6">
                  {/* Flip Button */}
                  <button
                    onClick={() => setIsAllocationFlipped(state => !state)}
                    className="absolute right-4 top-4 z-10 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-colors"
                    title={isAllocationFlipped ? "Show Restrictions" : "Show Results"}
                  >
                    <ArrowRight className={`w-5 h-5 transition-transform duration-500 ${isAllocationFlipped ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Front Side - Customer Restrictions */}
                  <animated.div
                    style={{
                      opacity: opacity.to(o => 1 - o),
                      transform,
                      position: 'absolute',
                      width: '100%'
                    }}
                    className={`${isAllocationFlipped ? 'pointer-events-none' : ''}`}
                  >
                    <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-blue-500/20 p-6">
                      <div className="flex items-center gap-6 mb-6">
                        <div className="flex items-center gap-2">
                          <Settings className="w-6 h-6 text-blue-400" />
                          <h2 className="text-xl font-semibold text-white">Customer Restrictions</h2>
                        </div>
                        <button
                          onClick={allocateFruit}
                          disabled={!customers.length}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
                            customers.length
                              ? 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 shadow-lg shadow-blue-500/20'
                              : 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          <span>Allocate</span>
                        </button>
                      </div>
                      {customers.length > 0 ? (
                        <CustomerList
                          customers={customers}
                          stock={stock}
                          orders={orders}
                          dateRange={dateRange}
                          onDateRangeChange={setDateRange}
                          includeSpotSales={includeSpotSales}
                          onIncludeSpotSalesChange={setIncludeSpotSales}
                          onUpdateCustomer={handleUpdateCustomer}
                          onRemoveCustomer={handleRemoveCustomer}
                        />
                      ) : (
                        <div className="text-blue-300/80 text-sm">
                          Please upload orders data to see customer list
                        </div>
                      )}
                    </div>
                  </animated.div>

                  {/* Back Side - Allocation Results */}
                  <animated.div
                    style={{
                      opacity,
                      transform: transform.to(t => `${t} rotateY(180deg)`),
                      position: 'absolute',
                      width: '100%'
                    }}
                    className={`${!isAllocationFlipped ? 'pointer-events-none' : ''}`}
                  >
                    <ScrollablePanel
                      title="Allocation Results"
                      headerActions={
                        <button
                          onClick={downloadAllocation}
                          disabled={!hasAllocated}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                            hasAllocated
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          <Download className="w-4 h-4" />
                          <span>Export</span>
                        </button>
                      }
                      maxHeight="calc(100vh - 16rem)"
                    >
                      {allocationResults.length > 0 ? (
                        <div className="space-y-4">
                          {allocationResults.map((result, index) => (
                            <div
                              key={`${result['Batch Number']}-${index}`}
                              className="bg-black/20 rounded-lg p-4 border border-blue-500/10"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-white font-medium">
                                    Batch: {result['Batch Number']}
                                  </div>
                                  <div className="text-blue-300 text-sm mt-1">
                                    {result['Stock Weight']} KG
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-blue-300">
                                    {result.customer || 'Unallocated'}
                                  </div>
                                  {result.allocationDetails && (
                                    <div className="text-sm text-blue-300/80 mt-1">
                                      Order: {result.allocationDetails.orderNumber}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center text-blue-300/80 py-8">
                          No allocations yet. Run allocation to see results.
                        </div>
                      )}
                    </ScrollablePanel>
                  </animated.div>
                </div>
              </>
            ) : activeTab === 'stock' ? (
              <StockDashboard stock={stock} allocationResults={allocationResults} />
            ) : (
              <ProductionDashboard 
                orders={orders}
                allocationManager={allocationManager}
              />
            )}
          </main>

          <SidePanel 
            isOpen={sidePanelOpen} 
            onToggle={() => setSidePanelOpen(!sidePanelOpen)}
            allocationManager={allocationManager}
            stock={stock}
          >
          </SidePanel>
        </>
      )}
    </div>
  );
}

export default App;