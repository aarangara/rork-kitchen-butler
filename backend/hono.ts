import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { compress } from "hono/compress";

import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import { 
  securityHeaders, 
  requestLogger, 
  rateLimit, 
  inputSanitization,
  requestSizeLimit,
  getSecurityStats,
  getRequestLogs,
} from "./middleware/security";

const app = new Hono();

app.use("*", cors());
app.use("*", compress());
app.use("*", securityHeaders());
app.use("*", requestLogger());
app.use("*", inputSanitization());
app.use("*", requestSizeLimit(10 * 1024 * 1024));
app.use("/trpc/*", rateLimit({ maxRequests: 100, windowMs: 60000 }));

app.use(
  "/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
  }),
);

app.get("/", (c) => {
  return c.json({ status: "ok", message: "HelpMeCook API is running" });
});

app.get("/health", (c) => {
  const stats = getSecurityStats();
  return c.json({ 
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    security: {
      totalRequests: stats.totalRequests,
      blockedRequests: stats.blockedRequests,
      rateLimitedIPs: stats.rateLimitedIPs,
    },
  });
});

app.get("/api/stats", (c) => {
  const stats = getSecurityStats();
  const logs = getRequestLogs({ limit: 50 });
  return c.json({
    security: stats,
    recentRequests: logs.length,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/logs", (c) => {
  const limit = parseInt(c.req.query("limit") || "100", 10);
  const path = c.req.query("path");
  const hasError = c.req.query("errors") === "true";
  
  const logs = getRequestLogs({ 
    limit: Math.min(limit, 500),
    path: path || undefined,
    hasError: c.req.query("errors") ? hasError : undefined,
  });
  
  return c.json({ logs, count: logs.length });
});

export default app;
