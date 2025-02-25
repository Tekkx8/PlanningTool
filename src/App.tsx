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
            message: `Customer ${customerName} (${type} orders) could not be fully allocated. Required: ${totals[type]}KG, Remaining: ${remainingQuantity}KG`
          });
        }

        allocationsByCustomer[customerName][type] = allocatedBatches;
      });
    });

    // Handle restriction groups
    const restrictionGroups: Record<string, { customers: string[], totalKG: number, type: 'conventional' | 'organic' }> = {};
    customers.forEach(customer => {
      const restrictionKey = JSON.stringify(customer.restrictions);
      ['conventional', 'organic'].forEach(type => {
        const total = customerOrders[customer.name]?.[type] || 0;
        if (total > 0) {
          if (!restrictionGroups[restrictionKey]) {
            restrictionGroups[restrictionKey] = { customers: [], totalKG: 0, type };
          }
          restrictionGroups[restrictionKey].customers.push(customer.name);
          restrictionGroups[restrictionKey].totalKG += total;
        }
      });
    });

    Object.entries(restrictionGroups).forEach(([key, group]) => {
      if (group.totalKG === 0) return;

      const targetQuantity = group.type === 'organic' || !isSpotSale(orders.find(o => group.customers.includes(o.SoldToParty))) 
        ? group.totalKG * 1.1 // +10% for production orders
        : group.totalKG; // Exact match for spot sales

      let remainingQuantity = targetQuantity;

      const matchingStock = allocation.filter(item => {
        const stockWeight = parseFloat(String(item['Stock Weight']).replace(' KG', '')) || 0;
        const existingAllocations = allocationManager.storage.getAllocationsByBatch(item['Batch Number']);
        const totalAllocated = existingAllocations.reduce((sum, a) => sum + (a.quantityKG || 0), 0);
        const remainingStock = stockWeight - totalAllocated;

        if (remainingStock <= 0) return false;

        const isOrg = isOrganic(item);
        if ((group.type === 'conventional' && isOrg) || (group.type === 'organic' && !isOrg)) return false;

        const customer = customers.find(c => group.customers.includes(c.name));
        if (!customer) return false;

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

        group.customers.forEach(customer => {
          allocationManager.storage.addAllocation({
            batchNumber: item['Batch Number'],
            order: '',
            salesDocument: '',
            salesDocumentItem: '10',
            customer,
            allocationDate: new Date().toISOString(),
            quantityKG: allocateQuantity / group.customers.length, // Distribute evenly among customers
            status: 'Allocated',
            materialDescription: item['Material Description'] || '',
            materialId: item['Material ID'] || '',
            loadingDate: '',
            originalQuantity: stockWeight
          });
        });

        item.allocatedQuantity = (item.allocatedQuantity || 0) + allocateQuantity;
        item.customer = group.customers.join(', ');
        item.allocationDetails = {
          orderNumber: '',
          salesDocument: '',
          requiredQuantity: group.totalKG,
          allocatedQuantity: allocateQuantity,
          isPartial: remainingQuantity > 0,
          isSpotSale: false
        };
      }

      if (remainingQuantity > 0) {
        addNotification({
          type: 'error',
          title: 'Insufficient Stock for Restriction Group',
          message: `Restriction group (${group.type}) could not be fully allocated. Required: ${group.totalKG}KG, Remaining: ${remainingQuantity}KG`
        });
      }
    });

    setAllocationResults(allocation.filter(a => a.customer));
    setHasAllocated(true);
    setIsAllocationFlipped(true);
    allocationManager.storage.commitAllocationBatch();
  }, [stock, customers, orders, dateRange, includeSpotSales, isOrganic, isSpotSale]);

  const downloadAllocation = useCallback(() => {
    if (!allocationResults.length) return;

    const groupedResults = allocationResults.reduce((acc, result) => {
      const customers = result.customer.split(', ') || [result.customer];
      customers.forEach(customer => {
        if (!acc[customer]) acc[customer] = { conventional: [], organic: [] };
        if (isOrganic(result)) acc[customer].organic.push(result);
        else acc[customer].conventional.push(result);
      });
      return acc;
    }, {} as Record<string, { conventional: AllocationResult[], organic: AllocationResult[] }>);

    const excelData: any[] = [];

    Object.entries(groupedResults).forEach(([customer, allocations]) => {
      excelData.push({
        'Customer': customer,
        'Location': '',
        'Batch Number': '',
        'Stock Weight': '',
        'Quality': '',
        'Age': '',
        'GGN': ''
      });

      if (allocations.conventional.length > 0) {
        excelData.push({
          'Customer': '  Conventional:',
          'Location': '',
          'Batch Number': '',
          'Stock Weight': '',
          'Quality': '',
          'Age': '',
          'GGN': ''
        });

        allocations.conventional.forEach(item => {
          excelData.push({
            'Customer': '',
            'Location': item.Location || '-',
            'Batch Number': item['Batch Number'],
            'Stock Weight': `${item['Stock Weight']} KG`,
            'Quality': item['Q3: Reinspection Quality'] || '-',
            'Age': `${item['Real Stock Age']} days`,
            'GGN': item.GGN || '-'
          });
        });
      }

      if (allocations.organic.length > 0) {
        excelData.push({
          'Customer': '  Organic:',
          'Location': '',
          'Batch Number': '',
          'Stock Weight': '',
          'Quality': '',
          'Age': '',
          'GGN': ''
        });

        allocations.organic.forEach(item => {
          excelData.push({
            'Customer': '',
            'Location': item.Location || '-',
            'Batch Number': item['Batch Number'],
            'Stock Weight': `${item['Stock Weight']} KG`,
            'Quality': item['Q3: Reinspection Quality'] || '-',
            'Age': `${item['Real Stock Age']} days`,
            'GGN': item.GGN || '-'
          });
        });
      }

      excelData.push({
        'Customer': '',
        'Location': '',
        'Batch Number': '',
        'Stock Weight': '',
        'Quality': '',
        'Age': '',
        'GGN': ''
      });
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    ws['!cols'] = [
      { wch: 30 }, // Customer
      { wch: 15 }, // Location
      { wch: 15 }, // Batch Number
      { wch: 15 }, // Stock Weight
      { wch: 15 }, // Quality
      { wch: 10 }, // Age
      { wch: 15 }, // GGN
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Allocation');
    XLSX.writeFile(wb, 'fruit-allocation.xlsx');
  }, [allocationResults, isOrganic]);

  const toggleCustomerCollapse = (customerName: string) => {
    setCollapsedCustomers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(customerName)) newSet.delete(customerName);
      else newSet.add(customerName);
      return newSet;
    });
  };

  return (
    <div className="min-h-screen">
      {!hasEnteredApp ? (
        <StartPage
          onDataLoaded={(fileData) => {
            setIsProcessing(true);
            if (fileData.type === 'stock') {
              handleStockUpload(fileData);
            } else if (fileData.type === 'orders') {
              handleOrdersUpload(fileData);
            }
            setIsProcessing(false);
          }}
          uploadedFiles={uploadedFiles}
          onEnter={() => setHasEnteredApp(true)}
          isProcessing={isProcessing}
        />
      ) : (
        <>
          <AllocationNotifications
            notifications={notifications}
            onDismiss={dismissNotification}
          />
          
          <OrganicAllocationModal
            isOpen={showOrganicModal}
            onClose={() => setShowOrganicModal(false)}
            order={currentOrder}
            availableStock={stock}
            onConfirm={(supplier) => {
              if (currentOrder) {
                const organicStock = stock.filter(item => 
                  isOrganic(item) && 
                  !item.customer && 
                  item.Supplier === supplier
                );
                
                const orderQuantity = parseFloat(currentOrder.SalesQuantityKG.replace(/[^\d.-]/g, '')) || 0;
                let remainingQuantity = orderQuantity;
                
                for (const item of organicStock) {
                  if (remainingQuantity <= 0) break;
                  
                  const stockWeight = parseFloat(String(item['Stock Weight']).replace(' KG', '')) || 0;
                  const allocateQuantity = Math.min(stockWeight, remainingQuantity);
                  
                  const allocationItem = allocationResults.find(r => 
                    r['Batch Number'] === item['Batch Number']
                  );
                  
                  if (allocationItem) {
                    allocationItem.customer = currentOrder.SoldToParty;
                    allocationItem.allocatedQuantity = allocateQuantity;
                    allocationItem.allocationDetails = {
                      orderNumber: currentOrder.Order || '',
                      salesDocument: currentOrder['Sales document'],
                      requiredQuantity: orderQuantity,
                      allocatedQuantity,
                      isPartial: false,
                      isSpotSale: currentOrder.isSpotSale || false
                    };
                  }
                  
                  remainingQuantity -= allocateQuantity;
                }
                
                setAllocationResults([...allocationResults]);
                setShowOrganicModal(false);
                
                addNotification({
                  type: 'warning',
                  title: 'Organic Stock Allocated',
                  message: `Allocated organic stock from supplier ${supplier} to order ${currentOrder.Order || currentOrder['Sales document']}`
                });
              }
            }}
          />
          
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
                  <button
                    onClick={() => setIsAllocationFlipped(state => !state)}
                    className="absolute right-4 top-4 z-10 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-colors"
                    title={isAllocationFlipped ? "Show Restrictions" : "Show Results"}
                  >
                    <ArrowRight className={`w-5 h-5 transition-transform duration-500 ${isAllocationFlipped ? 'rotate-180' : ''}`} />
                  </button>

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
                          <Settings className="h-6 w-6 text-blue-400" />
                          <h2 className="text-xl font-semibold text-white">Customer Restrictions</h2>
                        </div>
                        <div className="flex items-center gap-2 bg-black/40 border border-blue-500/20 rounded-lg overflow-hidden">
                          <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            className="bg-transparent border-r border-blue-500/20 px-3 py-1.5 text-white text-sm w-36"
                          />
                          <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            className="bg-transparent px-3 py-1.5 text-white text-sm w-36"
                          />
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
                        <div className="flex items-center gap-2 mr-12">
                          <button
                            onClick={() => setIsAllocationFlipped(false)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded-lg text-blue-300 hover:bg-blue-500/20 transition-colors text-sm"
                          >
                            <span>View Summary</span>
                          </button>
                          <button
                            onClick={downloadAllocation}
                            disabled={!hasAllocated}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                              hasAllocated
                                ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                                : 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            <Download className="w-4 h-4" />
                            <span>Export</span>
                          </button>
                        </div>
                      }
                      maxHeight="calc(100vh - 16rem)"
                    >
                      <div className="space-y-6">
                        {Array.from(new Set(allocationResults.map(r => r.customer.split(', ')[0] || r.customer))).map(customerName => {
                          const customerAllocations = allocationResults.filter(r => r.customer.includes(customerName));
                          const customerOrders = orders.filter(o => 
                            o.SoldToParty === customerName &&
                            format(parseISO(o['Loading Date']), 'yyyy-MM-dd') >= dateRange.start &&
                            format(parseISO(o['Loading Date']), 'yyyy-MM-dd') <= dateRange.end &&
                            !['delivered', 'shipped', 'finished', 'in delivery'].includes(o.OrderStatus?.toLowerCase() || '')
                          );
                          
                          const conventionalOrders = customerOrders.filter(o => !o.isOrganic && !o.isSpotSale);
                          const organicOrders = customerOrders.filter(o => o.isOrganic && !o.isSpotSale);
                          const spotOrders = customerOrders.filter(o => o.isSpotSale);

                          const conventionalAllocations = customerAllocations.filter(a => !isOrganic(a));
                          const organicAllocations = customerAllocations.filter(a => isOrganic(a));

                          const conventionalTotal = conventionalOrders.reduce((sum, o) => sum + (parseFloat(o.SalesQuantityKG) || 0), 0);
                          const organicTotal = organicOrders.reduce((sum, o) => sum + (parseFloat(o.SalesQuantityKG) || 0), 0);
                          const spotTotal = spotOrders.reduce((sum, o) => sum + (parseFloat(o.SalesQuantityKG) || 0), 0);

                          const conventionalAllocated = conventionalAllocations.reduce((sum, a) => sum + (a.allocatedQuantity || 0), 0);
                          const organicAllocated = organicAllocations.reduce((sum, a) => sum + (a.allocatedQuantity || 0), 0);

                          const isCollapsed = collapsedCustomers.has(customerName);

                          return (
                            <div key={customerName} className="bg-black/20 rounded-lg border border-blue-500/10 overflow-hidden">
                              <button
                                onClick={() => toggleCustomerCollapse(customerName)}
                                className="w-full bg-blue-900/20 px-6 py-4 flex items-center justify-between hover:bg-blue-900/30 transition-colors"
                              >
                                <h3 className="text-lg font-semibold text-white">{customerName}</h3>
                                {isCollapsed ? (
                                  <ChevronDown className="h-5 w-5 text-blue-400" />
                                ) : (
                                  <ChevronUp className="h-5 w-5 text-blue-400" />
                                )}
                              </button>

                              {!isCollapsed && (
                                <>
                                  <div className="px-6 py-3 border-b border-blue-500/10">
                                    <div className="text-sm text-blue-300 mb-2">Orders:</div>
                                    
                                    {conventionalTotal > 0 && (
                                      <div className="mb-4">
                                        <h4 className="text-sm font-medium text-blue-400 mb-2">Conventional Orders</h4>
                                        <div className="space-y-2">
                                          <p className="text-blue-300 text-sm">
                                            Total: {conventionalTotal} KG (Target: {conventionalTotal * 1.1} KG)
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                    
                                    {organicTotal > 0 && (
                                      <div className="mb-4">
                                        <h4 className="text-sm font-medium text-green-400 mb-2">Organic Orders</h4>
                                        <div className="space-y-2">
                                          <p className="text-green-300 text-sm">
                                            Total: {organicTotal} KG (Target: {organicTotal * 1.1} KG)
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                    
                                    {spotTotal > 0 && (
                                      <div>
                                        <h4 className="text-sm font-medium text-yellow-400 mb-2">Spot Sale Orders</h4>
                                        <div className="space-y-2">
                                          <p className="text-yellow-300 text-sm">
                                            Total: {spotTotal} KG
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="px-6 py-4">
                                    {conventionalAllocations.length > 0 && (
                                      <div className="mb-6">
                                        <h4 className="text-sm font-medium text-blue-400 mb-2">Conventional Stock</h4>
                                        <div className="space-y-2">
                                          {conventionalAllocations.map((item, index) => (
                                            <div 
                                              key={`${item.Location || 'no-loc'}-${item['Batch Number']}`}
                                              className="flex items-center justify-between py-2 px-4 bg-blue-500/5 rounded-lg hover:bg-blue-500/10 transition-colors"
                                            >
                                              <div className="flex items-center gap-4">
                                                <span className="text-blue-300">{item.Location || '-'}</span>
                                                <span className="text-white">{item['Batch Number']}</span>
                                                <span className="text-blue-300">{item['Stock Weight']} KG</span>
                                              </div>
                                              <div className="flex items-center gap-4">
                                                <span className="text-blue-300">{item['Q3: Reinspection Quality'] || '-'}</span>
                                                <span className="text-blue-300">{item['Real Stock Age']} days</span>
                                                <span className="text-blue-300">GGN: {item.GGN || '-'}</span>
                                              </div>
                                            </div>
                                          ))}
                                          <p className="text-blue-300 text-sm mt-2">
                                            Allocated: {conventionalAllocated} KG (+{((conventionalAllocated / conventionalTotal - 1) * 100 || 0).toFixed(1)}% over-allocation)
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                    
                                    {organicAllocations.length > 0 && (
                                      <div>
                                        <h4 className="text-sm font-medium text-green-400 mb-2">Organic Stock</h4>
                                        <div className="space-y-2">
                                          {organicAllocations.map((item, index) => (
                                            <div 
                                              key={`${item.Location || 'no-loc'}-${item['Batch Number']}`}
                                              className="flex items-center justify-between py-2 px-4 bg-green-500/5 rounded-lg hover:bg-green-500/10 transition-colors"
                                            >
                                              <div className="flex items-center gap-4">
                                                <span className="text-green-300">{item.Location || '-'}</span>
                                                <span className="text-white">{item['Batch Number']}</span>
                                                <span className="text-green-300">{item['Stock Weight']} KG</span>
                                              </div>
                                              <div className="flex items-center gap-4">
                                                <span className="text-green-300">{item['Q3: Reinspection Quality'] || '-'}</span>
                                                <span className="text-green-300">{item['Real Stock Age']} days</span>
                                                <span className="text-green-300">GGN: {item.GGN || '-'}</span>
                                              </div>
                                            </div>
                                          ))}
                                          <p className="text-green-300 text-sm mt-2">
                                            Allocated: {organicAllocated} KG (+{((organicAllocated / organicTotal - 1) * 100 || 0).toFixed(1)}% over-allocation)
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollablePanel>
                  </animated.div>
                </div>
              </>
            ) : activeTab === 'stock' ? (
              <>
                <div className="max-w-[1920px] mx-auto">
                  <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-blue-500/20 p-8 min-h-[1000px]">
                    <div className="flex items-center mb-4">
                      <LayoutDashboard className="h-6 w-6 text-blue-400 mr-2" />
                      <h2 className="text-xl font-semibold text-white">Stock Dashboard</h2>
                    </div>
                    {stock.length > 0 ? (
                      <StockDashboard stock={stock} allocationResults={allocationResults} />
                    ) : (
                      <div className="text-blue-300/80 text-sm">
                        Please upload stock data to view the dashboard
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="max-w-[1920px] mx-auto">
                  <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-blue-500/20 p-8 min-h-[1000px]">
                    <div className="flex items-center mb-4">
                      <LayoutDashboard className="h-6 w-6 text-blue-400 mr-2" />
                      <h2 className="text-xl font-semibold text-white">Production Dashboard</h2>
                    </div>
                    {orders.length > 0 ? (
                      <ProductionDashboard 
                        orders={orders}
                        allocationManager={allocationManager}
                      />
                    ) : (
                      <div className="text-blue-300/80 text-sm">Please upload orders data to view the dashboard</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </main>

          <SidePanel 
            isOpen={sidePanelOpen} 
            onToggle={() => setSidePanelOpen(!sidePanelOpen)}
            allocationManager={allocationManager}
            stock={stock}
          />
        </>
      )}
    </div>
  );
}

export default App;
