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
import { StockItem, OrderItem, Customer, AllocationResult, AllocationNotification } from './types';
import { ClipboardList, Settings, RotateCcw, LayoutDashboard, CheckCircle2, X, ArrowRight, Download, AlertCircle } from 'lucide-react';
import { Logo } from './components/Logo';
import * as XLSX from 'xlsx';
import { parse, format, parseISO } from 'date-fns';
import { AllocationManager } from './utils/allocationManager';
import { ChevronDown, ChevronUp } from 'lucide-react';

function App() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeTab, setActiveTab] = useState<'allocation' | 'stock' | 'production'>('allocation');
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [orderMapping, setOrderMapping] = useState<{
    bySalesDocItem: Record<string, { order: string; material: string }>;
  }>({
    bySalesDocItem: {}
  });
  const [mappingErrors, setMappingErrors] = useState<Set<string>>(new Set());
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
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
  const [allocationMessages, setAllocationMessages] = useState<{
    errors: string[];
    warnings: string[];
  }>({ errors: [], warnings: [] });
  const [notifications, setNotifications] = useState<AllocationNotification[]>([]);
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [includeSpotSales, setIncludeSpotSales] = useState(true);
  const [showOrganicModal, setShowOrganicModal] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<OrderItem | null>(null);
  const [collapsedCustomers, setCollapsedCustomers] = useState<Set<string>>(new Set());

  const isOrganic = React.useCallback((item: StockItem) => {
    const materialId = item['Material ID']?.toLowerCase() || '';
    return materialId.includes('org') ||
           materialId.includes('organic') ||
           materialId.startsWith('bob') ||
           materialId.startsWith('bio');
  }, []);

  const isSpotSale = React.useCallback((item: OrderItem) => {
    const material = item.Material?.toLowerCase() || '';
    return material.startsWith('bcb') || material.startsWith('bob');
  }, []);

  const { transform, opacity } = useSpring({
    opacity: isAllocationFlipped ? 1 : 0,
    transform: `perspective(600px) rotateY(${isAllocationFlipped ? 180 : 0}deg)`,
    config: { mass: 5, tension: 500, friction: 80 }
  });

  const handleStockUpload = (fileData: { data: any[], type: 'stock' | 'orders', filename: string }) => {
    if (fileData.type === 'orders') {
      handleOrdersUpload(fileData);
      return;
    }
    
    allocationManager.storage.beginAllocationBatch();
    
    const processedData = Array.isArray(fileData.data) ? fileData.data : [];
    
    if (processedData.length === 0) {
      setAllocationMessages({
        errors: ['No data found in stock file. Please check the data in stock.xlsx.'],
        warnings: []
      });
      allocationManager.storage.rollbackAllocationBatch();
      return;
    }

    const processedStock = processedData.map(item => ({
      ...item,
      'Stock Weight': parseFloat(String(item['Stock Weight']).replace(' KG', '')) || 0,
      'Real Stock Age': parseInt(String(item['Real Stock Age'] || '0'), 10) || 0
    }));
    
    allocationManager.storage.resetAllocations(processedStock);
    setStock(processedStock);
    setUploadedFiles(prev => [...prev, fileData.filename]);
    
    const result = allocationManager.processNewData(processedStock, orders);
    
    if (result.errors.length > 0) {
      allocationManager.storage.rollbackAllocationBatch();
    } else {
      allocationManager.storage.commitAllocationBatch();
    }
    
    setAllocationMessages({
      errors: result.errors,
      warnings: result.warnings
    });
  };

  const handleOrdersUpload = (fileData: { data: any[], type: 'stock' | 'orders', filename: string }) => {
    if (fileData.type === 'stock') {
      handleStockUpload(fileData);
      return;
    }
    
    allocationManager.storage.beginAllocationBatch();
    
    const isMappingFile = fileData.data.some(row => 
      row.Order && row['Sales Document']
    );

    if (isMappingFile) {
      const mappings = fileData.data.reduce((acc, row) => {
        if (!row['Sales Document'] || !row.Order) {
          return acc;
        }

        const salesDoc = row['Sales Document']?.toString();
        const salesDocItem = row['Sales Document Item'] || '10';
        const order = row.Order;
        const material = row.Material;
        const key = `${salesDoc}-${salesDocItem}`;

        acc.bySalesDocItem[key] = { 
          order, 
          material: material || ''
        };

        return acc;
      }, {
        bySalesDocItem: {} as Record<string, { order: string; material: string }>
      });
      
      setOrderMapping(mappings);
      
      setOrders(prevOrders => prevOrders.map(order => ({
        ...order,
        Order: getMappedOrder(order, mappings) || order.Order || '',
        Material: getMappedMaterial(order, mappings)
      })).filter(Boolean));

      setUploadedFiles(prev => [...prev, fileData.filename]);
      
      const result = allocationManager.processNewData(stock, orders);
      if (result.errors.length > 0) {
        allocationManager.storage.rollbackAllocationBatch();
      } else {
        allocationManager.storage.commitAllocationBatch();
      }
      
      setAllocationMessages({
        errors: result.errors,
        warnings: result.warnings
      });
      
      return;
    }
    
    const processedOrders = fileData.data
      .filter(order => {
        const status = order.OrderStatus?.toLowerCase() || '';
        return status !== 'delivered' && status !== 'shipped' && status !== 'finished' && status !== 'in delivery';
      })
      .map(order => {
        try {
          if (!order['Sales document'] || !order['Loading Date']) {
            console.warn('Skipping order due to missing required fields:', order);
            return null;
          }

          const isOrganic = order['Material Description']?.toLowerCase().includes('org') ||
                          order['Material Description']?.toLowerCase().includes('organic');

          let date;
          const loadingDate = order['Loading Date'] || order.LoadingDate;
          if (typeof loadingDate === 'number') {
            date = new Date(Math.round((loadingDate - 25569) * 86400 * 1000));
          } else {
            const dateStr = String(loadingDate).trim();
            try {
              date = parse(dateStr, 'dd/MM/yyyy', new Date());
            } catch {
              try {
                date = parse(dateStr, 'M/d/yyyy', new Date());
              } catch {
                try {
                  date = parse(dateStr, 'yyyy-MM-dd', new Date());
                } catch {
                  const numDate = parseFloat(dateStr);
                  if (!isNaN(numDate)) {
                    date = new Date(Math.round((numDate - 25569) * 86400 * 1000));
                  } else {
                    console.error('Could not parse date:', dateStr);
                    throw new Error('Invalid date format');
                  }
                }
              }
            }
          }

          if (isNaN(date.getTime())) {
            throw new Error('Invalid date');
          }

          const quantityKG = parseFloat(String(order.SalesQuantityKG || '0').replace(/[^\d.-]/g, '')) || 0;

          const salesDocKey = order['Sales document'];
          
          if (mappingErrors.has(salesDocKey)) {
            console.warn(`Skipping record with mapping error for Sales Document: ${salesDocKey}`);
            return null;
          }

          const mappedData = getMappedData(order, orderMapping);
          const material = mappedData?.material || order.Material || '';
          const orderNumber = mappedData?.order || order.Order || '';
          const isSpotSale = material ? 
            material.startsWith('bcb') || material.startsWith('bob') :
            order['Material Description']?.toLowerCase().includes('spot') || false;

          return {
            ...order,
            'Loading Date': format(date, 'yyyy-MM-dd'),
            Order: orderNumber,
            'Sales document': order['Sales document'],
            'Sales document item': order['Sales Document Item']?.toString() || '10',
            SalesQuantityKG: String(quantityKG),
            SalesQuantityCS: String(parseFloat(String(order.SalesQuantityCS || '0').replace(/[^\d.-]/g, '')) || '0'),
            Material: material,
            OrderStatus: order.OrderStatus?.toLowerCase() || 'pending',
            isOrganic,
            isSpotSale
          };
        } catch (error) {
          console.error('Error processing order:', order, error);
          return null;
        }
      })
      .filter((order): order is OrderItem => order !== null);

    setOrders(processedOrders);
    setUploadedFiles(prev => [...prev, fileData.filename]);

    const result = allocationManager.processNewData(stock, processedOrders);
    
    if (result.errors.length > 0) {
      allocationManager.storage.rollbackAllocationBatch();
    } else {
      allocationManager.storage.commitAllocationBatch();
    }
    
    setAllocationMessages({
      errors: result.errors,
      warnings: result.warnings
    });

    const uniqueCustomers = new Set(processedOrders.map(order => order.SoldToParty));
    const initialCustomers = Array.from(uniqueCustomers).map(name => ({
      id: crypto.randomUUID(),
      name,
      restrictions: {}
    }));
    setCustomers(initialCustomers);
  };

  const getMappedData = (order: any, mappings: typeof orderMapping) => {
    const salesDoc = order['Sales document']?.toString();
    const salesDocItem = order['Sales document item']?.toString() || '10';
    const key = `${salesDoc}-${salesDocItem}`;
    return mappings.bySalesDocItem[key];
  };

  const getMappedOrder = (order: any, mappings: typeof orderMapping) => {
    const data = getMappedData(order, mappings);
    return data?.order || order.Order || '';
  };

  const getMappedMaterial = (order: any, mappings: typeof orderMapping) => {
    const data = getMappedData(order, mappings);
    return data?.material || order.Material || '';
  };

  const handleUpdateCustomer = (updatedCustomer: Customer) => {
    setCustomers(prev => prev.map(customer => 
      customer.id === updatedCustomer.id ? updatedCustomer : customer
    ));
  };

  const handleRemoveCustomer = (customerId: string) => {
    setCustomers(prev => prev.filter(customer => customer.id !== customerId));
  };

  const addNotification = (notification: Omit<AllocationNotification, 'id'>) => {
    const id = crypto.randomUUID();
    setNotifications(prev => [...prev, { ...notification, id }]);
    
    if (!notification.action) {
      setTimeout(() => {
        dismissNotification(id);
      }, 10000);
    }
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const allocateFruit = useCallback(() => {
    allocationManager.storage.beginAllocationBatch();
    
    const filteredOrders = orders.filter(order => {
      const orderDate = parseISO(order['Loading Date']);
      return (
        format(orderDate, 'yyyy-MM-dd') >= dateRange.start &&
        format(orderDate, 'yyyy-MM-dd') <= dateRange.end
      );
    });

    const relevantOrders = includeSpotSales ? 
      filteredOrders : 
      filteredOrders.filter(order => !order.isSpotSale);

    // Aggregate orders by customer and type
    const customerOrders: Record<string, Record<'conventional' | 'organic', number>> = {};
    relevantOrders.forEach(order => {
      const customer = order.SoldToParty || '';
      const type = order.isOrganic ? 'organic' : 'conventional';
      if (!customerOrders[customer]) customerOrders[customer] = { conventional: 0, organic: 0 };
      customerOrders[customer][type] += parseFloat(order.SalesQuantityKG) || 0;
    });

    const allocation: AllocationResult[] = stock.map((item, index) => ({
      ...item,
      originalRow: index + 2,
      customer: '',
      allocatedQuantity: 0,
      allocationDetails: undefined
    }));

    // Sort stock by quality and age (Poor/Fair before Good, oldest first)
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
      
      if (qualityA !== qualityB) return qualityA - qualityB;
      return b['Real Stock Age'] - a['Real Stock Age'];
    });

    const allocationsByCustomer: Record<string, { conventional: AllocationResult[], organic: AllocationResult[] }> = {};

    Object.entries(customerOrders).forEach(([customerName, totals]) => {
      allocationsByCustomer[customerName] = { conventional: [], organic: [] };

      ['conventional', 'organic'].forEach(type => {
        if (totals[type] === 0) return;

        const targetQuantity = type === 'organic' || !isSpotSale(orders.find(o => o.SoldToParty === customerName)) 
          ? totals[type] * 1.1 // +10% for production orders
          : totals[type]; // Exact match for spot sales

        let remainingQuantity = targetQuantity;
        const customer = customers.find(c => c.name === customerName);
        if (!customer) return;

        const matchingStock = allocation.filter(item => {
          const stockWeight = parseFloat(String(item['Stock Weight']).replace(' KG', '')) || 0;
          const existingAllocations = allocationManager.storage.getAllocationsByBatch(item['Batch Number']);
          const totalAllocated = existingAllocations.reduce((sum, a) => sum + (a.quantityKG || 0), 0);
          const remainingStock = stockWeight - totalAllocated;

          if (remainingStock <= 0) return false;

          if (existingAllocations.length > 0 && existingAllocations[0].customer !== customerName) {
            return false;
          }

          const isOrg = isOrganic(item);
          if ((type === 'conventional' && isOrg) || (type === 'organic' && !isOrg)) return false;

          return Object.entries(customer.restrictions).every(([key, value]) => {
            if (!value) return true;
            return item[key as keyof StockItem] === value;
          });
        });

        let allocatedBatches: AllocationResult[] = [];
        let totalAllocated = 0;

        for (const item of matchingStock) {
          if (remainingQuantity <= 0) break;

          const stockWeight = parseFloat(String(item['Stock Weight']).replace(' KG', '')) || 0;
          const existingAllocations = allocationManager.storage.getAllocationsByBatch(item['Batch Number']);
          const totalAllocatedForBatch = existingAllocations.reduce((sum, a) => sum + (a.quantityKG || 0), 0);
          const remainingStock = stockWeight - totalAllocatedForBatch;
          const allocateQuantity = Math.min(remainingStock, remainingQuantity);

          if (allocateQuantity <= 0) continue;

          allocatedBatches.push(item);
          totalAllocated += allocateQuantity;
          remainingQuantity -= allocateQuantity;

          allocationManager.storage.addAllocation({
            batchNumber: item['Batch Number'],
            order: '', // No specific order, aggregated by customer
            salesDocument: '',
            salesDocumentItem: '10',
            customer: customerName,
            allocationDate: new Date().toISOString(),
            quantityKG: allocateQuantity,
            status: 'Allocated',
            materialDescription: item['Material Description'] || '',
            materialId: item['Material ID'] || '',
            loadingDate: '', // Not applicable for aggregated allocations
            originalQuantity: stockWeight
          });

          item.allocatedQuantity = (item.allocatedQuantity || 0) + allocateQuantity;
          item.customer = customerName;
          item.allocationDetails = {
            orderNumber: '',
            salesDocument: '',
            requiredQuantity: totals[type],
            allocatedQuantity: allocateQuantity,
            isPartial: remainingQuantity > 0,
            isSpotSale: type === 'organic' && isSpotSale(orders.find(o => o.SoldToParty === customerName)) || false
          };
        }

        // Optimize with larger batches if target not met (for production orders only)
        if (remainingQuantity > 0 && !isSpotSale(orders.find(o => o.SoldToParty === customerName))) {
          const largerBatches = matchingStock
            .filter(item => !allocatedBatches.includes(item))
            .sort((a, b) => {
              const weightA = parseFloat(String(a['Stock Weight']).replace(' KG', '')) || 0;
              const weightB = parseFloat(String(b['Stock Weight']).replace(' KG', '')) || 0;
              return weightB - weightA; // Sort descending by weight
            });

          for (const largeBatch of largerBatches) {
            if (remainingQuantity <= 0) break;

            const stockWeight = parseFloat(String(largeBatch['Stock Weight']).replace(' KG', '')) || 0;
            const existingAllocations = allocationManager.storage.getAllocationsByBatch(largeBatch['Batch Number']);
            const totalAllocatedForBatch = existingAllocations.reduce((sum, a) => sum + (a.quantityKG || 0), 0);
            const remainingStock = stockWeight - totalAllocatedForBatch;
            const allocateQuantity = Math.min(remainingStock, targetQuantity - totalAllocated);

            if (allocateQuantity <= 0) continue;

            // Remove smaller allocations for this customer/type match
            const existingSmaller = allocatedBatches.filter(b => 
              parseFloat(String(b['Stock Weight']).replace(' KG', '')) < stockWeight
            );
            existingSmaller.forEach(smallBatch => {
              const smallAllocations = allocationManager.storage.getAllocationsByBatch(smallBatch['Batch Number']);
              smallAllocations.forEach(allocation => allocationManager.storage.removeAllocation(allocation.batchNumber));
              smallBatch.allocatedQuantity = 0;
              smallBatch.customer = '';
              smallBatch.allocationDetails = undefined;
            });

            allocatedBatches = [largeBatch];
            totalAllocated = allocateQuantity;
            remainingQuantity = targetQuantity - totalAllocated;

            allocationManager.storage.addAllocation({
              batchNumber: largeBatch['Batch Number'],
              order: '',
              salesDocument: '',
              salesDocumentItem: '10',
              customer: customerName,
              allocationDate: new Date().toISOString(),
              quantityKG: allocateQuantity,
              status: 'Allocated',
              materialDescription: largeBatch['Material Description'] || '',
              materialId: largeBatch['Material ID'] || '',
              loadingDate: '',
              originalQuantity: stockWeight
            });

            largeBatch.allocatedQuantity = allocateQuantity;
            largeBatch.customer = customerName;
            largeBatch.allocationDetails = {
              orderNumber: '',
              salesDocument: '',
              requiredQuantity: totals[type],
              allocatedQuantity: allocateQuantity,
              isPartial: remainingQuantity > 0,
              isSpotSale: false
            };
          }
        }

        if (remainingQuantity > 0) {
          addNotification({
            type: 'error',
            title: 'Insufficient Stock',
