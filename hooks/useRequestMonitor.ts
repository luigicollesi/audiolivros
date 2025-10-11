// hooks/useRequestMonitor.ts
/**
 * Development hook to monitor and log API requests for optimization validation
 * Only active in development mode
 */
import { useCallback, useEffect, useRef } from 'react';

interface RequestLog {
  url: string;
  method: string;
  timestamp: number;
  duration?: number;
  cached?: boolean;
  deduped?: boolean;
}

const requestLogs = new Map<string, RequestLog[]>();
const duplicateWarnings = new Set<string>();

// Override console for development monitoring
const originalFetch = global.fetch;
let requestCounter = 0;
let isMonitoring = false;

export function useRequestMonitor(enabled: boolean = __DEV__) {
  const logsRef = useRef<RequestLog[]>([]);

  const startMonitoring = useCallback(() => {
    if (!enabled || isMonitoring) return;
    
    isMonitoring = true;
    
    // Override global fetch to monitor requests
    global.fetch = async (...args) => {
      const [url, options] = args;
      const requestId = ++requestCounter;
      const startTime = Date.now();
      const method = options?.method || 'GET';
      
      console.log(`🌐 [${requestId}] ${method} ${url}`);
      
      try {
        const response = await originalFetch(...args);
        const duration = Date.now() - startTime;
        
        console.log(`✅ [${requestId}] ${response.status} ${method} ${url} (${duration}ms)`);
        
        // Log for analysis
        const logEntry: RequestLog = {
          url: String(url),
          method,
          timestamp: startTime,
          duration,
        };
        
        logsRef.current.push(logEntry);
        
        // Check for potential duplicates
        const recentSimilar = logsRef.current.filter(log => 
          log.url === String(url) && 
          log.method === method && 
          startTime - log.timestamp < 5000 // Within 5 seconds
        );
        
        if (recentSimilar.length > 1) {
          const warningKey = `${method}:${url}`;
          if (!duplicateWarnings.has(warningKey)) {
            console.warn(`⚠️  Potential duplicate request detected: ${method} ${url}`);
            duplicateWarnings.add(warningKey);
          }
        }
        
        return response;
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ [${requestId}] ${method} ${url} (${duration}ms)`, error);
        throw error;
      }
    };
    
    console.log('📊 Request monitoring started');
  }, [enabled]);

  const stopMonitoring = useCallback(() => {
    if (!enabled || !isMonitoring) return;
    
    global.fetch = originalFetch;
    isMonitoring = false;
    console.log('📊 Request monitoring stopped');
  }, [enabled]);

  const getStats = useCallback(() => {
    const logs = logsRef.current;
    const now = Date.now();
    
    // Get logs from last 30 seconds
    const recent = logs.filter(log => now - log.timestamp < 30000);
    
    const byUrl = recent.reduce((acc, log) => {
      const key = `${log.method} ${log.url}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(log);
      return acc;
    }, {} as Record<string, RequestLog[]>);
    
    const duplicates = Object.entries(byUrl).filter(([, logs]) => logs.length > 1);
    
    return {
      totalRequests: recent.length,
      uniqueEndpoints: Object.keys(byUrl).length,
      duplicates: duplicates.length,
      duplicateDetails: duplicates.map(([url, logs]) => ({
        url,
        count: logs.length,
        timestamps: logs.map(log => log.timestamp)
      }))
    };
  }, []);

  const printStats = useCallback(() => {
    const stats = getStats();
    console.group('📊 Request Statistics (Last 30s)');
    console.log(`Total requests: ${stats.totalRequests}`);
    console.log(`Unique endpoints: ${stats.uniqueEndpoints}`);
    console.log(`Duplicates: ${stats.duplicates}`);
    
    if (stats.duplicateDetails.length > 0) {
      console.group('🔄 Duplicate Requests:');
      stats.duplicateDetails.forEach(({ url, count, timestamps }) => {
        console.log(`${url}: ${count} calls`, timestamps);
      });
      console.groupEnd();
    }
    console.groupEnd();
  }, [getStats]);

  useEffect(() => {
    if (enabled) {
      startMonitoring();
      
      // Print stats every 30 seconds in development
      const interval = setInterval(printStats, 30000);
      
      return () => {
        stopMonitoring();
        clearInterval(interval);
      };
    }
  }, [enabled, startMonitoring, stopMonitoring, printStats]);

  return {
    getStats,
    printStats,
    isMonitoring,
  };
}
