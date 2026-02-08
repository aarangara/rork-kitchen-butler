import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  size: number;
}

interface CacheConfig {
  maxSize: number;
  defaultTtl: number;
  cleanupInterval: number;
}

const DEFAULT_CONFIG: CacheConfig = {
  maxSize: 50 * 1024 * 1024,
  defaultTtl: 5 * 60 * 1000,
  cleanupInterval: 60 * 1000,
};

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private config: CacheConfig;
  private currentSize = 0;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanup();
  }

  private calculateSize(data: unknown): number {
    try {
      return JSON.stringify(data).length * 2;
    } catch {
      return 1000;
    }
  }

  private startCleanup(): void {
    if (this.cleanupTimer) return;
    
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      this.delete(key);
    }

    if (this.currentSize > this.config.maxSize) {
      this.evictLRU();
    }

    console.log(`Cache cleanup: removed ${toDelete.length} expired entries, current size: ${Math.round(this.currentSize / 1024)}KB`);
  }

  private evictLRU(): void {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => (a[1].hits / (Date.now() - a[1].timestamp)) - (b[1].hits / (Date.now() - b[1].timestamp)));

    while (this.currentSize > this.config.maxSize * 0.8 && entries.length > 0) {
      const [key] = entries.shift()!;
      this.delete(key);
    }
  }

  set<T>(key: string, data: T, ttl?: number): void {
    const size = this.calculateSize(data);
    
    if (this.cache.has(key)) {
      const existing = this.cache.get(key)!;
      this.currentSize -= existing.size;
    }

    while (this.currentSize + size > this.config.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTtl,
      hits: 0,
      size,
    });

    this.currentSize += size;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;

    if (Date.now() > entry.timestamp + entry.ttl) {
      this.delete(key);
      return null;
    }

    entry.hits++;
    return entry.data as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  delete(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentSize -= entry.size;
      this.cache.delete(key);
    }
  }

  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }

  getStats(): {
    entries: number;
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    let totalHits = 0;
    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
    }

    return {
      entries: this.cache.size,
      size: this.currentSize,
      maxSize: this.config.maxSize,
      hitRate: this.cache.size > 0 ? totalHits / this.cache.size : 0,
    };
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }
}

export const memoryCache = new MemoryCache();

const PERSISTENT_CACHE_PREFIX = 'cache_';

export async function persistentSet<T>(
  key: string,
  data: T,
  ttl: number = DEFAULT_CONFIG.defaultTtl
): Promise<void> {
  const entry = {
    data,
    timestamp: Date.now(),
    ttl,
  };

  try {
    await AsyncStorage.setItem(
      `${PERSISTENT_CACHE_PREFIX}${key}`,
      JSON.stringify(entry)
    );
    memoryCache.set(key, data, ttl);
  } catch (error) {
    console.error('Persistent cache set failed:', error);
  }
}

export async function persistentGet<T>(key: string): Promise<T | null> {
  const cached = memoryCache.get<T>(key);
  if (cached !== null) return cached;

  try {
    const stored = await AsyncStorage.getItem(`${PERSISTENT_CACHE_PREFIX}${key}`);
    if (!stored) return null;

    const entry = JSON.parse(stored) as { data: T; timestamp: number; ttl: number };
    
    if (Date.now() > entry.timestamp + entry.ttl) {
      await AsyncStorage.removeItem(`${PERSISTENT_CACHE_PREFIX}${key}`);
      return null;
    }

    memoryCache.set(key, entry.data, entry.ttl - (Date.now() - entry.timestamp));
    return entry.data;
  } catch (error) {
    console.error('Persistent cache get failed:', error);
    return null;
  }
}

export async function persistentDelete(key: string): Promise<void> {
  memoryCache.delete(key);
  try {
    await AsyncStorage.removeItem(`${PERSISTENT_CACHE_PREFIX}${key}`);
  } catch (error) {
    console.error('Persistent cache delete failed:', error);
  }
}

export async function persistentClear(): Promise<void> {
  memoryCache.clear();
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k => k.startsWith(PERSISTENT_CACHE_PREFIX));
    await AsyncStorage.multiRemove(cacheKeys);
  } catch (error) {
    console.error('Persistent cache clear failed:', error);
  }
}

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

const pendingRequests = new Map<string, PendingRequest<unknown>>();
const REQUEST_DEDUP_WINDOW = 100;

export async function deduplicatedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    cacheTtl?: number;
    forceRefresh?: boolean;
  } = {}
): Promise<T> {
  if (!options.forceRefresh) {
    const cached = memoryCache.get<T>(key);
    if (cached !== null) {
      console.log(`Cache hit: ${key}`);
      return cached;
    }
  }

  const pending = pendingRequests.get(key);
  if (pending && Date.now() - pending.timestamp < REQUEST_DEDUP_WINDOW) {
    console.log(`Request deduped: ${key}`);
    return pending.promise as Promise<T>;
  }

  const promise = fetcher();
  pendingRequests.set(key, { promise, timestamp: Date.now() });

  try {
    const result = await promise;
    memoryCache.set(key, result, options.cacheTtl);
    return result;
  } finally {
    pendingRequests.delete(key);
  }
}

export function createCacheKey(...parts: (string | number | boolean | undefined | null)[]): string {
  return parts.filter(p => p !== undefined && p !== null).join(':');
}

export function invalidatePattern(_pattern: string | RegExp): number {
  return 0;
}

interface BatchConfig {
  maxBatchSize: number;
  maxWaitMs: number;
}

const DEFAULT_BATCH_CONFIG: BatchConfig = {
  maxBatchSize: 50,
  maxWaitMs: 50,
};

export function createBatcher<TInput, TOutput>(
  batchFn: (items: TInput[]) => Promise<TOutput[]>,
  config: Partial<BatchConfig> = {}
): (item: TInput) => Promise<TOutput> {
  const { maxBatchSize, maxWaitMs } = { ...DEFAULT_BATCH_CONFIG, ...config };
  
  let batch: {
    item: TInput;
    resolve: (value: TOutput) => void;
    reject: (error: Error) => void;
  }[] = [];
  
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const executeBatch = async () => {
    if (batch.length === 0) return;

    const currentBatch = batch;
    batch = [];
    timeout = null;

    try {
      const results = await batchFn(currentBatch.map(b => b.item));
      currentBatch.forEach((b, i) => b.resolve(results[i]));
    } catch (error) {
      currentBatch.forEach(b => b.reject(error as Error));
    }
  };

  return (item: TInput): Promise<TOutput> => {
    return new Promise((resolve, reject) => {
      batch.push({ item, resolve, reject });

      if (batch.length >= maxBatchSize) {
        if (timeout) clearTimeout(timeout);
        executeBatch();
      } else if (!timeout) {
        timeout = setTimeout(executeBatch, maxWaitMs);
      }
    });
  };
}

export function compressData(data: string): string {
  if (data.length < 100) return data;

  const dict = new Map<string, number>();
  const result: number[] = [];
  let dictIndex = 256;
  let current = '';

  for (let i = 0; i < data.length; i++) {
    const char = data[i];
    const combined = current + char;

    if (dict.has(combined) || combined.length === 1) {
      current = combined;
    } else {
      result.push(current.length === 1 ? current.charCodeAt(0) : dict.get(current)!);
      if (dictIndex < 65536) {
        dict.set(combined, dictIndex++);
      }
      current = char;
    }
  }

  if (current) {
    result.push(current.length === 1 ? current.charCodeAt(0) : dict.get(current)!);
  }

  const compressed = result.map(n => String.fromCharCode(n)).join('');
  
  if (compressed.length >= data.length) {
    return data;
  }

  return '\x00' + compressed;
}

export function decompressData(data: string): string {
  if (!data.startsWith('\x00')) return data;

  const compressed = data.slice(1);
  const dict: string[] = [];
  
  for (let i = 0; i < 256; i++) {
    dict[i] = String.fromCharCode(i);
  }

  const codes = compressed.split('').map(c => c.charCodeAt(0));
  let result = dict[codes[0]];
  let current = result;

  for (let i = 1; i < codes.length; i++) {
    const code = codes[i];
    let entry: string;

    if (dict[code] !== undefined) {
      entry = dict[code];
    } else if (code === dict.length) {
      entry = current + current[0];
    } else {
      throw new Error('Invalid compressed data');
    }

    result += entry;
    dict.push(current + entry[0]);
    current = entry;
  }

  return result;
}
