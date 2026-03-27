import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { memoryCache, persistentGet, persistentSet, deduplicatedFetch, createCacheKey } from '@/utils/cache';
import { logAuditEvent, getAuditStats, detectAnomalies, AuditStats } from '@/utils/audit';

interface PerformanceMetrics {
  appStartTime: number;
  lastActiveTime: number;
  totalSessionTime: number;
  screenTransitions: number;
  apiCallCount: number;
  cacheHitRate: number;
  errorCount: number;
}

interface NetworkQuality {
  isOnline: boolean;
  connectionType: 'wifi' | 'cellular' | 'unknown';
  latency: number;
}

const METRICS_KEY = 'performance_metrics';
const OFFLINE_QUEUE_KEY = 'offline_queue';

interface QueuedOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  resource: string;
  data: unknown;
  timestamp: number;
  retries: number;
}

export const [PerformanceProvider, usePerformance] = createContextHook(() => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    appStartTime: Date.now(),
    lastActiveTime: Date.now(),
    totalSessionTime: 0,
    screenTransitions: 0,
    apiCallCount: 0,
    cacheHitRate: 0,
    errorCount: 0,
  });

  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>({
    isOnline: true,
    connectionType: 'unknown',
    latency: 0,
  });

  const [offlineQueue, setOfflineQueue] = useState<QueuedOperation[]>([]);
  const [auditStats, setAuditStats] = useState<AuditStats | null>(null);

  const sessionStartRef = useRef(Date.now());
  const apiCallsRef = useRef(0);
  const cacheHitsRef = useRef(0);
  const cacheMissesRef = useRef(0);

  useEffect(() => {
    const loadPersistedData = async () => {
      try {
        const storedMetrics = await persistentGet<PerformanceMetrics>(METRICS_KEY);
        if (storedMetrics) {
          setMetrics(prev => ({
            ...prev,
            totalSessionTime: storedMetrics.totalSessionTime,
          }));
        }

        const storedQueue = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
        if (storedQueue) {
          setOfflineQueue(JSON.parse(storedQueue));
        }
      } catch (error) {
        console.error('Failed to load persisted performance data:', error);
      }
    };

    loadPersistedData();
    logAuditEvent('NAVIGATION', 'App started', { severity: 'info' });
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        sessionStartRef.current = Date.now();
        setMetrics(prev => ({ ...prev, lastActiveTime: Date.now() }));
        logAuditEvent('NAVIGATION', 'App became active', { severity: 'info' });
      } else if (nextAppState === 'background') {
        const sessionDuration = Date.now() - sessionStartRef.current;
        setMetrics(prev => {
          const updated = {
            ...prev,
            totalSessionTime: prev.totalSessionTime + sessionDuration,
          };
          persistentSet(METRICS_KEY, updated);
          return updated;
        });
        logAuditEvent('NAVIGATION', 'App went to background', { 
          severity: 'info',
          metadata: { sessionDuration },
        });
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const checkNetwork = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const start = Date.now();
        const response = await fetch('https://www.google.com/generate_204', {
          method: 'HEAD',
          cache: 'no-cache',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const latency = Date.now() - start;

        setNetworkQuality({
          isOnline: response.ok,
          connectionType: 'unknown',
          latency,
        });
      } catch {
        setNetworkQuality(prev => ({ ...prev, isOnline: false }));
      }
    };

    checkNetwork();
    const interval = setInterval(checkNetwork, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadAuditStats = async () => {
      const stats = await getAuditStats();
      setAuditStats(stats);
    };

    loadAuditStats();
    const interval = setInterval(loadAuditStats, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (networkQuality.isOnline && offlineQueue.length > 0) {
      processOfflineQueue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkQuality.isOnline, offlineQueue.length]);

  const processOfflineQueue = useCallback(async () => {
    if (offlineQueue.length === 0) return;

    console.log(`Processing ${offlineQueue.length} queued operations`);
    const processed: string[] = [];

    for (const operation of offlineQueue) {
      if (operation.retries >= 3) {
        processed.push(operation.id);
        logAuditEvent('API_ERROR', `Failed to sync operation after 3 retries`, {
          severity: 'warning',
          resourceId: operation.id,
          metadata: { type: operation.type, resource: operation.resource },
        });
        continue;
      }

      try {
        console.log(`Syncing queued ${operation.type} for ${operation.resource}`);
        processed.push(operation.id);
      } catch (error) {
        operation.retries++;
        console.error(`Failed to sync operation ${operation.id}:`, error);
      }
    }

    setOfflineQueue(prev => {
      const remaining = prev.filter(op => !processed.includes(op.id));
      AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
      return remaining;
    });
  }, [offlineQueue]);

  const queueOfflineOperation = useCallback((
    type: 'create' | 'update' | 'delete',
    resource: string,
    data: unknown
  ) => {
    const operation: QueuedOperation = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      resource,
      data,
      timestamp: Date.now(),
      retries: 0,
    };

    setOfflineQueue(prev => {
      const updated = [...prev, operation];
      AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
      return updated;
    });

    logAuditEvent('DATA_EXPORT', `Queued ${type} operation for offline sync`, {
      severity: 'info',
      resource,
      metadata: { operationId: operation.id },
    });

    return operation.id;
  }, []);

  const trackApiCall = useCallback((cacheHit: boolean) => {
    apiCallsRef.current++;
    if (cacheHit) {
      cacheHitsRef.current++;
    } else {
      cacheMissesRef.current++;
    }

    const total = cacheHitsRef.current + cacheMissesRef.current;
    const hitRate = total > 0 ? cacheHitsRef.current / total : 0;

    setMetrics(prev => ({
      ...prev,
      apiCallCount: apiCallsRef.current,
      cacheHitRate: hitRate,
    }));
  }, []);

  const trackScreenTransition = useCallback((screenName: string) => {
    setMetrics(prev => ({
      ...prev,
      screenTransitions: prev.screenTransitions + 1,
    }));

    logAuditEvent('NAVIGATION', `Screen transition to ${screenName}`, {
      severity: 'info',
      metadata: { screen: screenName },
    });
  }, []);

  const trackError = useCallback((error: Error, context?: string) => {
    setMetrics(prev => ({
      ...prev,
      errorCount: prev.errorCount + 1,
    }));

    logAuditEvent('API_ERROR', error.message, {
      severity: 'error',
      metadata: { context, stack: error.stack },
    });
  }, []);

  const cachedFetch = useCallback(async <T,>(
    key: string,
    fetcher: () => Promise<T>,
    options?: { ttl?: number; forceRefresh?: boolean }
  ): Promise<T> => {
    const cacheKey = createCacheKey('fetch', key);
    
    return deduplicatedFetch(cacheKey, async () => {
      trackApiCall(false);
      return fetcher();
    }, {
      cacheTtl: options?.ttl,
      forceRefresh: options?.forceRefresh,
    });
  }, [trackApiCall]);

  const prefetch = useCallback(async <T,>(
    keys: string[],
    fetcher: (key: string) => Promise<T>
  ): Promise<void> => {
    console.log(`Prefetching ${keys.length} resources`);
    
    await Promise.all(
      keys.map(key => 
        cachedFetch(key, () => fetcher(key)).catch(err => {
          console.warn(`Prefetch failed for ${key}:`, err);
        })
      )
    );
  }, [cachedFetch]);

  const runAnomalyDetection = useCallback(async () => {
    const result = await detectAnomalies();
    if (result.detected) {
      console.warn('Anomalies detected:', result.anomalies);
    }
    return result;
  }, []);

  const getPerformanceReport = useCallback(() => {
    const sessionDuration = Date.now() - sessionStartRef.current;
    const cacheStats = memoryCache.getStats();

    return {
      metrics: {
        ...metrics,
        currentSessionDuration: sessionDuration,
      },
      cache: cacheStats,
      network: networkQuality,
      offlineQueueSize: offlineQueue.length,
      audit: auditStats,
    };
  }, [metrics, networkQuality, offlineQueue.length, auditStats]);

  const clearCache = useCallback(() => {
    memoryCache.clear();
    logAuditEvent('DATA_EXPORT', 'Cache cleared', { severity: 'info' });
  }, []);

  return {
    metrics,
    networkQuality,
    offlineQueue,
    auditStats,
    isOnline: networkQuality.isOnline,
    queueOfflineOperation,
    trackApiCall,
    trackScreenTransition,
    trackError,
    cachedFetch,
    prefetch,
    runAnomalyDetection,
    getPerformanceReport,
    clearCache,
    processOfflineQueue,
  };
});

export function useCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: { ttl?: number; enabled?: boolean }
) {
  const { cachedFetch } = usePerformance();
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (options?.enabled === false) return;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await cachedFetch(key, fetcher, { ttl: options?.ttl });
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, options?.enabled, options?.ttl]);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await cachedFetch(key, fetcher, { forceRefresh: true });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [key, cachedFetch, fetcher]);

  return { data, isLoading, error, refetch };
}
