import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type AuditEventType = 
  | 'AUTH_LOGIN'
  | 'AUTH_LOGOUT'
  | 'AUTH_FAILED'
  | 'RECIPE_CREATE'
  | 'RECIPE_UPDATE'
  | 'RECIPE_DELETE'
  | 'PANTRY_UPDATE'
  | 'RATE_LIMIT_HIT'
  | 'VALIDATION_FAILED'
  | 'SECURITY_ALERT'
  | 'DATA_EXPORT'
  | 'DATA_IMPORT'
  | 'SUBSCRIPTION_CHANGE'
  | 'API_ERROR'
  | 'NAVIGATION'
  | 'SYNC_SUCCESS'
  | 'SYNC_ERROR';

export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  severity: AuditSeverity;
  timestamp: string;
  userId?: string;
  sessionId: string;
  action: string;
  resource?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  clientInfo: {
    platform: string;
    version: string | number;
    fingerprint: string;
  };
  outcome: 'success' | 'failure' | 'blocked';
}

const AUDIT_STORAGE_KEY = 'kitchenbutler_audit_log';
const MAX_AUDIT_ENTRIES = 1000;
const SESSION_ID_KEY = 'kitchenbutler_session_id';

let currentSessionId: string | null = null;
let auditCache: AuditEvent[] = [];
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function getSessionId(): Promise<string> {
  if (currentSessionId) return currentSessionId;
  
  try {
    const stored = await AsyncStorage.getItem(SESSION_ID_KEY);
    if (stored) {
      currentSessionId = stored;
      return stored;
    }
  } catch (error) {
    console.error('Failed to get session ID:', error);
  }
  
  currentSessionId = generateId();
  try {
    await AsyncStorage.setItem(SESSION_ID_KEY, currentSessionId);
  } catch (error) {
    console.error('Failed to save session ID:', error);
  }
  
  return currentSessionId;
}

export function generateNewSession(): void {
  currentSessionId = generateId();
  AsyncStorage.setItem(SESSION_ID_KEY, currentSessionId).catch(console.error);
  console.log('Audit: New session created:', currentSessionId);
}

function generateFingerprint(): string {
  const components = [
    Platform.OS,
    Platform.Version,
    new Date().getTimezoneOffset(),
  ];
  
  let hash = 5381;
  const str = components.join('|');
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return Math.abs(hash).toString(16);
}

async function loadAuditCache(): Promise<void> {
  if (auditCache.length > 0) return;
  
  try {
    const stored = await AsyncStorage.getItem(AUDIT_STORAGE_KEY);
    if (stored) {
      auditCache = JSON.parse(stored);
      console.log(`Audit: Loaded ${auditCache.length} events from storage`);
    }
  } catch (error) {
    console.error('Failed to load audit log:', error);
    auditCache = [];
  }
}

async function saveAuditLog(): Promise<void> {
  try {
    const trimmed = auditCache.slice(-MAX_AUDIT_ENTRIES);
    await AsyncStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(trimmed));
    auditCache = trimmed;
  } catch (error) {
    console.error('Failed to save audit log:', error);
  }
}

function scheduleSave(): void {
  if (saveTimeout) return;
  saveTimeout = setTimeout(() => {
    saveAuditLog();
    saveTimeout = null;
  }, 5000);
}

export async function logAuditEvent(
  type: AuditEventType,
  action: string,
  options: {
    severity?: AuditSeverity;
    userId?: string;
    resource?: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    outcome?: 'success' | 'failure' | 'blocked';
  } = {}
): Promise<void> {
  await loadAuditCache();
  const sessionId = await getSessionId();
  
  const event: AuditEvent = {
    id: generateId(),
    type,
    severity: options.severity || 'info',
    timestamp: new Date().toISOString(),
    userId: options.userId,
    sessionId,
    action,
    resource: options.resource,
    resourceId: options.resourceId,
    metadata: options.metadata,
    clientInfo: {
      platform: Platform.OS,
      version: Platform.Version,
      fingerprint: generateFingerprint(),
    },
    outcome: options.outcome || 'success',
  };
  
  auditCache.push(event);
  
  const logLevel = event.severity === 'critical' || event.severity === 'error' 
    ? 'error' 
    : event.severity === 'warning' 
      ? 'warn' 
      : 'log';
  
  console[logLevel](
    `Audit [${event.type}]: ${event.action}`,
    event.resourceId ? `(${event.resourceId})` : '',
    event.outcome !== 'success' ? `- ${event.outcome}` : ''
  );
  
  if (event.severity === 'critical') {
    await saveAuditLog();
  } else {
    scheduleSave();
  }
}

export async function getAuditLog(options: {
  type?: AuditEventType;
  severity?: AuditSeverity;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
} = {}): Promise<AuditEvent[]> {
  await loadAuditCache();
  
  let filtered = [...auditCache];
  
  if (options.type) {
    filtered = filtered.filter(e => e.type === options.type);
  }
  
  if (options.severity) {
    filtered = filtered.filter(e => e.severity === options.severity);
  }
  
  if (options.startDate) {
    filtered = filtered.filter(e => new Date(e.timestamp) >= options.startDate!);
  }
  
  if (options.endDate) {
    filtered = filtered.filter(e => new Date(e.timestamp) <= options.endDate!);
  }
  
  filtered.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  
  if (options.limit) {
    filtered = filtered.slice(0, options.limit);
  }
  
  return filtered;
}

export async function getSecurityAlerts(hours: number = 24): Promise<AuditEvent[]> {
  const startDate = new Date();
  startDate.setHours(startDate.getHours() - hours);
  
  return getAuditLog({
    startDate,
    severity: 'warning',
  }).then(events => 
    events.filter(e => 
      e.severity === 'warning' || 
      e.severity === 'error' || 
      e.severity === 'critical'
    )
  );
}

export async function clearAuditLog(): Promise<void> {
  auditCache = [];
  await AsyncStorage.removeItem(AUDIT_STORAGE_KEY);
  console.log('Audit: Log cleared');
}

interface AnomalyPattern {
  type: AuditEventType;
  threshold: number;
  windowMs: number;
}

const ANOMALY_PATTERNS: AnomalyPattern[] = [
  { type: 'AUTH_FAILED', threshold: 5, windowMs: 300000 },
  { type: 'RATE_LIMIT_HIT', threshold: 10, windowMs: 60000 },
  { type: 'VALIDATION_FAILED', threshold: 20, windowMs: 60000 },
  { type: 'API_ERROR', threshold: 10, windowMs: 60000 },
];

export async function detectAnomalies(): Promise<{
  detected: boolean;
  anomalies: { pattern: AnomalyPattern; count: number }[];
}> {
  await loadAuditCache();
  const now = Date.now();
  const anomalies: { pattern: AnomalyPattern; count: number }[] = [];
  
  for (const pattern of ANOMALY_PATTERNS) {
    const windowStart = now - pattern.windowMs;
    const count = auditCache.filter(e => 
      e.type === pattern.type && 
      new Date(e.timestamp).getTime() >= windowStart
    ).length;
    
    if (count >= pattern.threshold) {
      anomalies.push({ pattern, count });
    }
  }
  
  if (anomalies.length > 0) {
    await logAuditEvent('SECURITY_ALERT', 'Anomaly detected', {
      severity: 'critical',
      metadata: { anomalies: anomalies.map(a => ({ type: a.pattern.type, count: a.count })) },
    });
  }
  
  return {
    detected: anomalies.length > 0,
    anomalies,
  };
}

export interface AuditStats {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  recentAlerts: number;
  anomaliesDetected: boolean;
}

export async function getAuditStats(): Promise<AuditStats> {
  await loadAuditCache();
  
  const eventsByType: Record<string, number> = {};
  const eventsBySeverity: Record<string, number> = {};
  
  for (const event of auditCache) {
    eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
    eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
  }
  
  const alerts = await getSecurityAlerts(24);
  const anomalyResult = await detectAnomalies();
  
  return {
    totalEvents: auditCache.length,
    eventsByType,
    eventsBySeverity,
    recentAlerts: alerts.length,
    anomaliesDetected: anomalyResult.detected,
  };
}
