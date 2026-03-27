import { Context, Next } from 'hono';

interface SecurityConfig {
  enableCSP: boolean;
  enableRateLimit: boolean;
  enableRequestLogging: boolean;
  maxRequestSize: number;
  trustedOrigins: string[];
}

const defaultConfig: SecurityConfig = {
  enableCSP: true,
  enableRateLimit: true,
  enableRequestLogging: true,
  maxRequestSize: 10 * 1024 * 1024,
  trustedOrigins: ['*'],
};

interface RequestLog {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  clientIp: string;
  userAgent: string;
  duration?: number;
  statusCode?: number;
  error?: string;
}

const requestLogs: RequestLog[] = [];
const MAX_LOGS = 10000;

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function logRequest(log: RequestLog): void {
  requestLogs.push(log);
  if (requestLogs.length > MAX_LOGS) {
    requestLogs.shift();
  }
  
  const logLevel = log.error ? 'error' : log.statusCode && log.statusCode >= 400 ? 'warn' : 'log';
  console[logLevel](
    `[${log.timestamp}] ${log.method} ${log.path} - ${log.statusCode || 'pending'} - ${log.duration || 0}ms - ${log.clientIp}`
  );
}

export function getRequestLogs(options: {
  limit?: number;
  path?: string;
  method?: string;
  hasError?: boolean;
} = {}): RequestLog[] {
  let filtered = [...requestLogs];
  
  if (options.path) {
    filtered = filtered.filter(l => l.path.includes(options.path!));
  }
  if (options.method) {
    filtered = filtered.filter(l => l.method === options.method);
  }
  if (options.hasError !== undefined) {
    filtered = filtered.filter(l => options.hasError ? !!l.error : !l.error);
  }
  
  filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  return filtered.slice(0, options.limit || 100);
}

export function securityHeaders(config: Partial<SecurityConfig> = {}) {
  const cfg = { ...defaultConfig, ...config };
  
  return async (c: Context, next: Next) => {
    if (cfg.enableCSP) {
      c.res.headers.set('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https: blob:",
        "font-src 'self' data:",
        "connect-src 'self' https: wss:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '));
      
      c.res.headers.set('X-Content-Type-Options', 'nosniff');
      c.res.headers.set('X-Frame-Options', 'DENY');
      c.res.headers.set('X-XSS-Protection', '1; mode=block');
      c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      c.res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    }
    
    await next();
  };
}

export function requestLogger() {
  return async (c: Context, next: Next) => {
    const requestId = generateRequestId();
    const startTime = Date.now();
    
    const clientIp = c.req.header('x-forwarded-for') || 
                     c.req.header('x-real-ip') || 
                     'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    c.set('requestId', requestId);
    
    const log: RequestLog = {
      id: requestId,
      timestamp: new Date().toISOString(),
      method: c.req.method,
      path: c.req.path,
      clientIp,
      userAgent,
    };
    
    try {
      await next();
      log.duration = Date.now() - startTime;
      log.statusCode = c.res.status;
    } catch (error) {
      log.duration = Date.now() - startTime;
      log.statusCode = 500;
      log.error = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    } finally {
      logRequest(log);
    }
  };
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  blocked: boolean;
}

const ipRateLimits = new Map<string, RateLimitEntry>();
const pathRateLimits = new Map<string, Map<string, RateLimitEntry>>();

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  blockDurationMs: number;
  keyGenerator?: (c: Context) => string;
}

const defaultRateLimitConfig: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 100,
  blockDurationMs: 5 * 60 * 1000,
};

export function rateLimit(config: Partial<RateLimitConfig> = {}) {
  const cfg = { ...defaultRateLimitConfig, ...config };
  
  return async (c: Context, next: Next) => {
    const key = cfg.keyGenerator 
      ? cfg.keyGenerator(c) 
      : c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    
    const now = Date.now();
    let entry = ipRateLimits.get(key);
    
    if (entry?.blocked && now < entry.resetTime) {
      c.res.headers.set('Retry-After', String(Math.ceil((entry.resetTime - now) / 1000)));
      return c.json({
        error: 'Too many requests',
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      }, 429);
    }
    
    if (!entry || now > entry.resetTime) {
      entry = { count: 1, resetTime: now + cfg.windowMs, blocked: false };
      ipRateLimits.set(key, entry);
    } else {
      entry.count++;
      
      if (entry.count > cfg.maxRequests) {
        entry.blocked = true;
        entry.resetTime = now + cfg.blockDurationMs;
        
        console.warn(`Rate limit exceeded for ${key}, blocked for ${cfg.blockDurationMs / 1000}s`);
        
        c.res.headers.set('Retry-After', String(Math.ceil(cfg.blockDurationMs / 1000)));
        return c.json({
          error: 'Too many requests',
          retryAfter: Math.ceil(cfg.blockDurationMs / 1000),
        }, 429);
      }
    }
    
    c.res.headers.set('X-RateLimit-Limit', String(cfg.maxRequests));
    c.res.headers.set('X-RateLimit-Remaining', String(Math.max(0, cfg.maxRequests - entry.count)));
    c.res.headers.set('X-RateLimit-Reset', String(Math.ceil(entry.resetTime / 1000)));
    
    await next();
  };
}

export function pathRateLimit(path: string, config: Partial<RateLimitConfig> = {}) {
  const cfg = { ...defaultRateLimitConfig, ...config };
  
  if (!pathRateLimits.has(path)) {
    pathRateLimits.set(path, new Map());
  }
  
  return async (c: Context, next: Next) => {
    if (!c.req.path.startsWith(path)) {
      return next();
    }
    
    const key = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    const pathLimits = pathRateLimits.get(path)!;
    const now = Date.now();
    let entry = pathLimits.get(key);
    
    if (!entry || now > entry.resetTime) {
      entry = { count: 1, resetTime: now + cfg.windowMs, blocked: false };
      pathLimits.set(key, entry);
    } else {
      entry.count++;
      
      if (entry.count > cfg.maxRequests) {
        return c.json({ error: 'Rate limit exceeded for this endpoint' }, 429);
      }
    }
    
    await next();
  };
}

export function validateContentType(allowedTypes: string[] = ['application/json']) {
  return async (c: Context, next: Next) => {
    if (['POST', 'PUT', 'PATCH'].includes(c.req.method)) {
      const contentType = c.req.header('content-type');
      
      if (!contentType || !allowedTypes.some(t => contentType.includes(t))) {
        return c.json({
          error: 'Invalid content type',
          allowed: allowedTypes,
        }, 415);
      }
    }
    
    await next();
  };
}

export function requestSizeLimit(maxSize: number = 10 * 1024 * 1024) {
  return async (c: Context, next: Next) => {
    const contentLength = c.req.header('content-length');
    
    if (contentLength && parseInt(contentLength, 10) > maxSize) {
      return c.json({
        error: 'Request too large',
        maxSize,
      }, 413);
    }
    
    await next();
  };
}

const suspiciousPatterns = [
  /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
  /((\%3C)|<)((\%2F)|\/)*[a-z0-9\%]+((\%3E)|>)/i,
  /((\%3C)|<)((\%69)|i|(\%49))((\%6D)|m|(\%4D))((\%67)|g|(\%47))[^\n]+((\%3E)|>)/i,
  /(\%00)/i,
  /(\.\.\/|\.\.\\)/i,
];

export function inputSanitization() {
  return async (c: Context, next: Next) => {
    const url = c.req.url;
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(url)) {
        console.warn(`Suspicious request blocked: ${url}`);
        return c.json({ error: 'Invalid request' }, 400);
      }
    }
    
    await next();
  };
}

setInterval(() => {
  const now = Date.now();
  
  for (const [key, entry] of ipRateLimits.entries()) {
    if (now > entry.resetTime && !entry.blocked) {
      ipRateLimits.delete(key);
    }
  }
  
  for (const [, limits] of pathRateLimits.entries()) {
    for (const [key, entry] of limits.entries()) {
      if (now > entry.resetTime) {
        limits.delete(key);
      }
    }
  }
}, 60 * 1000);

export interface SecurityStats {
  totalRequests: number;
  blockedRequests: number;
  rateLimitedIPs: number;
  recentErrors: number;
}

export function getSecurityStats(): SecurityStats {
  const recentLogs = requestLogs.filter(l => 
    Date.now() - new Date(l.timestamp).getTime() < 3600000
  );
  
  return {
    totalRequests: recentLogs.length,
    blockedRequests: recentLogs.filter(l => l.statusCode === 429 || l.statusCode === 403).length,
    rateLimitedIPs: Array.from(ipRateLimits.values()).filter(e => e.blocked).length,
    recentErrors: recentLogs.filter(l => l.error).length,
  };
}
