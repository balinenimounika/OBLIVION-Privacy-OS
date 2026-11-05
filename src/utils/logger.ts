/**
 * OBLIVION - Safe Structured Logger
 *
 * Formats logs with timestamps and levels.
 * Automatically sanitizes sensitive credentials and secrets.
 */

const SENSITIVE_KEYS = ['password', 'passwordHash', 'token', 'authorization', 'secret', 'jwt'];

function sanitize(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitize);

  const copy: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k))) {
      copy[key] = '[REDACTED]';
    } else if (typeof val === 'object') {
      copy[key] = sanitize(val);
    } else {
      copy[key] = val;
    }
  }
  return copy;
}

export const logger = {
  info: (message: string, meta?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [INFO] ${message}`, meta ? JSON.stringify(sanitize(meta)) : '');
  },
  warn: (message: string, meta?: any) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [WARN] ${message}`, meta ? JSON.stringify(sanitize(meta)) : '');
  },
  error: (message: string, error?: any) => {
    const timestamp = new Date().toISOString();
    const errorDetails = error instanceof Error ? { message: error.message, stack: error.stack } : error;
    console.error(`[${timestamp}] [ERROR] ${message}`, errorDetails ? JSON.stringify(sanitize(errorDetails)) : '');
  },
  debug: (message: string, meta?: any) => {
    if (process.env.NODE_ENV === 'development') {
      const timestamp = new Date().toISOString();
      console.debug(`[${timestamp}] [DEBUG] ${message}`, meta ? JSON.stringify(sanitize(meta)) : '');
    }
  },
};
