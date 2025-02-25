import React, { useCallback, useState } from 'react';
import { Upload, AlertCircle, Loader2, CheckCircle2, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parse } from 'date-fns';

interface FileData { 
  data: any[];
  type: 'stock' | 'orders';
  filename: string;
}

interface FileUploadProps {
  onDataLoaded: (data: FileData) => void;
  title: string;
  isProcessing: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded, title, isProcessing }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      files.forEach(processFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setError(null);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      files.forEach(processFile);
    }
  };

  const validateExcelFile = (file: File): boolean => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a valid Excel file (.xlsx or .xls)');
      return false;
    }
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setError('File size must be less than 10MB');
      return false;
    }
    return true;
  };

  const processFile = useCallback(async (file: File) => {
    if (!validateExcelFile(file)) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { 
        type: 'array',
        cellDates: false,
        cellNF: true,
        cellText: false
      });
      
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        throw new Error('Excel file appears to be empty or invalid');
      }

      const worksheet = workbook.Sheets[sheetName];
      
      if (!worksheet || worksheet['!ref'] === undefined) {
        throw new Error('First sheet appears to be empty or invalid');
      }

      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        raw: true,
        cellDates: false,
        blankrows: false,
        dateNF: 'yyyy-MM-dd'
      });

      if (!Array.isArray(jsonData)) {
        throw new Error('Invalid data format in Excel file');
      }

      if (jsonData.length === 0) {
        throw new Error('No data found in the Excel file. Please ensure the file contains data rows.');
      }

      if (!jsonData[0] || typeof jsonData[0] !== 'object') {
        throw new Error('Invalid data format. Please ensure the file contains proper column headers and data.');
      }
      
      const headers = Object.keys(jsonData[0]).map(h => h.toLowerCase().trim());
      
      // First try to detect by filename
      const detectFileTypeByName = (filename: string): 'stock' | 'orders' | null => {
        const name = filename.toLowerCase();
        if (name.includes('stock')) return 'stock';
        if (name.includes('l07')) return 'orders';
        return null;
      };

      // Detect file type based on content pattern
      const detectFileType = (data: any[], headers: string[]): 'stock' | 'orders' | null => {
        // Check first row for characteristic columns
        const firstRow = data[0];
        const lowerHeaders = headers.map(h => h.toLowerCase());
        
        // Stock file pattern
        const stockHeaders = ['batch number', 'stock weight', 'material id'];
        if (stockHeaders.every(h => lowerHeaders.some(header => header.includes(h)))) {
          return 'stock';
        }

        // L07 orders file pattern
        const l07Headers = ['sales document', 'loading date', 'soldtoparty', 'order'];
        if (l07Headers.every(h => lowerHeaders.some(header => header.includes(h)))) {
          return 'orders';
        }
        
        return null;
      };
      
      // Try filename detection first, then fall back to content detection
      let fileType = detectFileTypeByName(file.name) || detectFileType(jsonData, headers);
      
      if (!fileType) {
        throw new Error(
          'Could not determine file type. Please ensure the file name contains "stock", "l07", or "orders",\n' +
          'or that it contains the required columns:\n\n' +
          'For Stock data:\n' +
          '- Batch Number\n' +
          '- Stock Weight\n' +
          '- Material ID\n\n' +
          'For Order data (either):\n' +
          '- Sales Document, Loading Date, SoldToParty, Order'
        );
      }

      // Pre-process data to ensure consistent formats
      const processedData = jsonData.map(row => {
        const newRow = { ...row };
        
        // Handle loading date in different formats
        const loadingDateKey = 'Loading Date' in newRow ? 'Loading Date' : 'Loading date';
        if (loadingDateKey in newRow) {
          let loadingDate = newRow[loadingDateKey];
          
          // Handle Excel date number format
          if (typeof loadingDate === 'number') {
            const date = new Date(Math.round((loadingDate - 25569) * 86400 * 1000));
            loadingDate = format(date, 'yyyy-MM-dd');
          }
          
          let date: Date | null = null;

          try {
            if (loadingDate instanceof Date) {
              date = loadingDate;
            } else if (typeof loadingDate === 'number') {
              date = new Date(Math.round((loadingDate - 25569) * 86400 * 1000));
            } else if (typeof loadingDate === 'string') {
              // Try different date formats
              const formats = ['dd/MM/yyyy', 'M/d/yyyy', 'yyyy-MM-dd'];
              for (const fmt of formats) {
                try {
                  date = parse(loadingDate, fmt, new Date());
                  if (!isNaN(date.getTime())) break;
                } catch {
                  continue;
                }
              }
            }

            if (!date || isNaN(date.getTime())) {
              throw new Error('Invalid date format');
            }

            newRow[loadingDateKey] = format(date, 'yyyy-MM-dd');
          } catch (error) {
            console.warn('Error parsing date:', loadingDate);
            newRow[loadingDateKey] = format(new Date(), 'yyyy-MM-dd');
          }
        }
        
        // Handle stock weight
        if ('Stock Weight' in newRow) {
          const weightStr = String(newRow['Stock Weight']);
          const matches = weightStr.match(/(\d+(?:\.\d+)?)/);
          const weight = matches ? parseFloat(matches[1]) : 0;
          newRow['Stock Weight'] = isNaN(weight) ? 0 : weight;
        }
        
        // Handle sales quantity
        if ('SalesQuantityKG' in newRow) {
          const quantityStr = String(newRow['SalesQuantityKG']);
          const matches = quantityStr.match(/(\d+(?:\.\d+)?)/);
          const quantity = matches ? parseFloat(matches[1]) : 0;
          newRow['SalesQuantityKG'] = isNaN(quantity) ? 0 : quantity;
        }
        
        // Normalize column names
        if ('Sales Document' in newRow) {
          newRow['Sales document'] = newRow['Sales Document'];
          delete newRow['Sales Document'];
        }
        
        if ('Sales Document Item' in newRow) {
          newRow['Sales document item'] = String(newRow['Sales Document Item'] || '10');
          delete newRow['Sales Document Item'];
        }
        
        // Ensure Sales document item is always a string
        if ('Sales document item' in newRow) {
          newRow['Sales document item'] = String(newRow['Sales document item'] || '10');
        }
        
        return newRow;
      });

      onDataLoaded({
        data: processedData,
        type: fileType,
        filename: file.name
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 
        'Error processing file. Please ensure it\'s a valid Excel file with proper data and column headers.';
      
      console.error('File processing error:', {
        error: err,
        message,
        fileName: file.name
      });
      
      setError(message);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [onDataLoaded]);

  return (
    <div className="space-y-4">
      <div
        className={`p-6 border-2 border-dashed rounded-lg transition-all duration-200 ${
          isDragging 
          ? 'drag-active border-blue-400' 
          : 'border-blue-500/30 bg-gradient-to-br from-gray-900/50 to-blue-900/30 hover:bg-blue-900/20'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <label className="flex flex-col items-center justify-center cursor-pointer">
          {isProcessing ? (
            <Loader2 className="w-8 h-8 mb-2 text-blue-400 animate-spin" />
          ) : (
            <Upload className={`w-8 h-8 mb-2 ${isDragging ? 'text-blue-400' : 'text-blue-500'}`} />
          )}
          <span className="text-sm font-medium text-blue-100">{title}</span>
          <span className="text-xs text-blue-300/80 mt-1">
            Drag & drop or click to upload Excel files
          </span>
          <input
            type="file"
            className="hidden"
            ref={fileInputRef}
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            disabled={isProcessing}
            multiple
          />
        </label>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 bg-red-900/20 p-3 rounded-lg border border-red-500/20">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}

export { FileUpload }