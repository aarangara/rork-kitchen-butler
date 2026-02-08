import AsyncStorage from '@react-native-async-storage/async-storage';

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char)
    .trim()
    .slice(0, 10000);
}

export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string') return '';
  
  const trimmed = url.trim();
  
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:')) {
    console.warn('Security: Blocked potentially malicious URL');
    return '';
  }
  
  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }
    return parsed.href;
  } catch {
    return '';
  }
}

export function sanitizeNumber(value: unknown, min: number, max: number, defaultValue: number): number {
  const num = Number(value);
  if (isNaN(num)) return defaultValue;
  return Math.max(min, Math.min(max, Math.floor(num)));
}

export function sanitizeArray<T>(arr: unknown, maxLength: number = 100): T[] {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, maxLength) as T[];
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitCache: Map<string, RateLimitEntry> = new Map();

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export function checkRateLimit(key: string, config: RateLimitConfig): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = rateLimitCache.get(key);
  
  if (!entry || now > entry.resetTime) {
    rateLimitCache.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return { allowed: true, remaining: config.maxRequests - 1, resetIn: config.windowMs };
  }
  
  if (entry.count >= config.maxRequests) {
    const resetIn = entry.resetTime - now;
    return { allowed: false, remaining: 0, resetIn };
  }
  
  entry.count++;
  return { allowed: true, remaining: config.maxRequests - entry.count, resetIn: entry.resetTime - now };
}

export const RATE_LIMITS = {
  AI_PARSE: { maxRequests: 10, windowMs: 60 * 1000 },
  RECIPE_CREATE: { maxRequests: 20, windowMs: 60 * 1000 },
  PANTRY_UPDATE: { maxRequests: 50, windowMs: 60 * 1000 },
} as const;

const STORAGE_PREFIX = 'helpmecook_secure_';

export async function secureStore(key: string, data: unknown): Promise<void> {
  try {
    const jsonData = JSON.stringify(data);
    const encoded = btoa(encodeURIComponent(jsonData));
    await AsyncStorage.setItem(`${STORAGE_PREFIX}${key}`, encoded);
  } catch (error) {
    console.error('SecureStore: Failed to store data', error);
    throw new Error('Failed to store data securely');
  }
}

export async function secureRetrieve<T>(key: string): Promise<T | null> {
  try {
    const encoded = await AsyncStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!encoded) return null;
    
    const jsonData = decodeURIComponent(atob(encoded));
    return JSON.parse(jsonData) as T;
  } catch (error) {
    console.error('SecureStore: Failed to retrieve data', error);
    return null;
  }
}

export async function secureRemove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${STORAGE_PREFIX}${key}`);
  } catch (error) {
    console.error('SecureStore: Failed to remove data', error);
  }
}

export function generateSecureId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  const randomPart2 = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${randomPart}-${randomPart2}`;
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (data.length <= visibleChars) return '*'.repeat(data.length);
  return data.slice(0, visibleChars) + '*'.repeat(data.length - visibleChars);
}
