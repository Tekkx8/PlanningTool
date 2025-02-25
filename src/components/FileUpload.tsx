import React, { useCallback, useState } from 'react';
import { Upload, AlertCircle, Loader2, CheckCircle2, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';

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

export const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded, title, isProcessing }) => {
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

    setError(null);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array', cellDates: true, cellStyles: true, raw: true }); // Enhanced parsing
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        throw new Error('Excel file appears to be empty or invalid');
      }

      const worksheet = workbook.Sheets[sheetName];

      if (!worksheet || worksheet['!ref'] === undefined) {
        throw new Error('First sheet appears to be empty or invalid');
      }

      // Attempt to parse as JSON, default to empty array if parsing fails
      let jsonData: any[] = [];
      try {
        jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: true, header: 1 }) || [];
        // Convert array of arrays to array of objects if necessary
        if (Array.isArray(jsonData) && jsonData.length > 0 && Array.isArray(jsonData[0])) {
          const headers = jsonData[0] as string[];
          jsonData = jsonData.slice(1).map((row: any[]) => 
            headers.reduce((obj, header, i) => {
              const value = row[i];
              // Handle numeric or string values for stock fields
              if (header.toLowerCase().includes('stock weight') && typeof value === 'number') {
                return { ...obj, [header]: `${value} KG` };
              }
              if (header.toLowerCase().includes('real stock age') && typeof value === 'number') {
                return { ...obj, [header]: value };
              }
              return { ...obj, [header]: value };
            }, {})
          ).filter(row => Object.keys(row).length > 0); // Filter out empty rows
        } else {
          jsonData = jsonData.filter(row => Object.keys(row).length > 0); // Filter out empty objects
        }
      } catch (parseError) {
        console.warn('Parsing error, treating as empty:', parseError);
        jsonData = [];
      }

      if (!Array.isArray(jsonData)) {
        throw new Error('Invalid data format in Excel file');
      }

      if (jsonData.length === 0) {
        throw new Error('No data found in the first sheet');
      }

      const headers = Object.keys(jsonData[0] || {}).map(h => h.toLowerCase().trim());
      
      if (headers.length === 0) {
        throw new Error('No column headers found in the Excel file');
      }

      const isStockFile = headers.some(h => 
        h.includes('stock') || 
        h.includes('batch') ||
        h.includes('weight') ||
        h.includes('age')
      );
      
      const isOrderFile = headers.some(h => 
        h.includes('loading') || 
        h.includes('sales') ||
        h.includes('order') || 
        h.includes('quantity')
      );

      if (!isStockFile && !isOrderFile) {
        throw new Error(
          'Could not determine file type. Please ensure the Excel file contains either:\n' +
          '- Stock data (with columns for stock, batch, weight, or age)\n' +
          '- Order data (with columns for loading, sales, order, or quantity)'
        );
      }

      // Validate stock-specific headers if it's a stock file
      if (isStockFile) {
        const requiredStockHeaders = ['batch number', 'stock weight', 'real stock age'];
        if (!requiredStockHeaders.every(header => headers.includes(header))) {
          throw new Error('Missing required stock headers. Ensure columns for Batch Number, Stock Weight, and Real Stock Age exist.');
        }
      }

      onDataLoaded({
        data: jsonData,
        type: isStockFile ? 'stock' : 'orders',
        filename: file.name
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 
        'Error processing file. Please ensure it’s a valid Excel file with data in the first sheet.';
      
      console.error('File processing error:', {
        error: err,
        message,
        fileName: file.name
      });
      
      setError(message);
      
      if (fileInputRef.current) fileInputRef.current.value = '';
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
        <div className="flex items-center gap-2 text-red-400 bg-red-900/20 p-3 rounded-lg border border-red-500/20 w-full">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};
