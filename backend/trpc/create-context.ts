import { initTRPC, TRPCError } from "@trpc/server";
import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import superjson from "superjson";
import { z } from "zod";

interface RateLimitEntry {
  count: number;
  resetTime: number;
  blocked: boolean;
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  clientIp: string;
  path: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const auditLog: AuditLogEntry[] = [];
const MAX_AUDIT_ENTRIES = 5000;

function logAudit(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
  const log: AuditLogEntry = {
    ...entry,
    id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
  };
  
  auditLog.push(log);
  if (auditLog.length > MAX_AUDIT_ENTRIES) {
    auditLog.shift();
  }
  
  const level = entry.success ? 'log' : 'warn';
  console[level](`[Audit] ${entry.action} from ${entry.clientIp} - ${entry.success ? 'success' : 'failed'}`);
}

export function getAuditLogs(limit: number = 100): AuditLogEntry[] {
  return auditLog.slice(-limit).reverse();
}

export const createContext = async (opts: FetchCreateContextFnOptions) => {
  const clientIp = opts.req.headers.get("x-forwarded-for") || 
                   opts.req.headers.get("x-real-ip") || 
                   "unknown";
  
  const userAgent = opts.req.headers.get("user-agent") || "unknown";
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    req: opts.req,
    clientIp,
    userAgent,
    requestId,
    logAudit: (action: string, success: boolean, metadata?: Record<string, unknown>, error?: string) => {
      logAudit({
        action,
        clientIp,
        path: new URL(opts.req.url).pathname,
        success,
        error,
        metadata,
      });
    },
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const defaultRateLimit: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60 * 1000,
};

export const rateLimitedProcedure = (config: RateLimitConfig = defaultRateLimit) => {
  return t.procedure.use(async ({ ctx, next, path }) => {
    const key = `${ctx.clientIp}:${path}`;
    const now = Date.now();
    let entry = rateLimitStore.get(key);

    if (entry?.blocked && now < entry.resetTime) {
      ctx.logAudit(`RATE_LIMIT_BLOCKED:${path}`, false, { remaining: entry.resetTime - now });
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Rate limit exceeded. Try again in ${Math.ceil((entry.resetTime - now) / 1000)} seconds.`,
      });
    }

    if (!entry || now > entry.resetTime) {
      entry = {
        count: 1,
        resetTime: now + config.windowMs,
        blocked: false,
      };
      rateLimitStore.set(key, entry);
    } else if (entry.count >= config.maxRequests) {
      entry.blocked = true;
      entry.resetTime = now + config.windowMs * 5;
      ctx.logAudit(`RATE_LIMIT_EXCEEDED:${path}`, false, { count: entry.count });
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Rate limit exceeded. Try again in ${Math.ceil((entry.resetTime - now) / 1000)} seconds.`,
      });
    } else {
      entry.count++;
    }

    const startTime = Date.now();
    try {
      const result = await next();
      ctx.logAudit(path, true, { duration: Date.now() - startTime });
      return result;
    } catch (error) {
      ctx.logAudit(path, false, { duration: Date.now() - startTime }, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  });
};

export const validatedProcedure = <T extends z.ZodTypeAny>(schema: T) => {
  return t.procedure.input(schema).use(async ({ ctx, next, input, path }) => {
    ctx.logAudit(`VALIDATE:${path}`, true, { inputKeys: Object.keys(input as object) });
    return next();
  });
};

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000);
