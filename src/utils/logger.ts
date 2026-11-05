/**
 * OBLIVION - Safe Structured Logger
 *
 * Formats logs with timestamps and levels.
 * Automatically sanitizes sensitive credentials and secrets.
 * Outputs machine-parseable single-line JSON in production mode (or when LOG_FORMAT=json).
 * Supports error monitoring listeners (e.g. APM / Sentry / OpenTelemetry).
 */

const SENSITIVE_KEYS = [
  'password',
  'passwordhash',
  'token',
  'authorization',
  'secret',
  'jwt',
  'apikey',
  'resend_api_key',
  'svix',
  'private_key',
];

type ErrorListener = (error: Error, context?: any) => void;
const errorListeners: ErrorListener[] = [];

function sanitizeString(str: string): string {
  return str
    .replace(/re_[a-zA-Z0-9_-]{16,}/gi, 're_[REDACTED]')
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED]')
    .replace(/(api[_-]?key\s*[:=]\s*)[^\s,]+/gi, '$1[REDACTED]')
    .replace(/(secret\s*[:=]\s*)[^\s,]+/gi, '$1[REDACTED]');
}

function sanitize(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') return sanitizeString(data);
  if (typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitize);

  const copy: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k))) {
      copy[key] = '[REDACTED]';
    } else if (typeof val === 'object') {
      copy[key] = sanitize(val);
    } else if (typeof val === 'string') {
      copy[key] = sanitizeString(val);
    } else {
      copy[key] = val;
    }
  }
  return copy;
}

function outputLog(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, meta?: any) {
  const timestamp = new Date().toISOString();
  const isProd = process.env.NODE_ENV === 'production' || process.env.LOG_FORMAT === 'json';
  const cleanMessage = sanitizeString(message);

  if (isProd) {
    const payload: Record<string, any> = {
      timestamp,
      level: level.toLowerCase(),
      message: cleanMessage,
    };
    if (meta !== undefined) {
      payload.context = sanitize(meta);
    }
    const logLine = JSON.stringify(payload);
    if (level === 'ERROR') {
      console.error(logLine);
    } else if (level === 'WARN') {
      console.warn(logLine);
    } else if (level === 'DEBUG') {
      console.debug(logLine);
    } else {
      console.log(logLine);
    }
    return;
  }

  // Development / Test mode: Human-readable output
  const metaStr = meta ? ` ${JSON.stringify(sanitize(meta))}` : '';
  if (level === 'ERROR') {
    console.error(`[${timestamp}] [ERROR] ${cleanMessage}${metaStr}`);
  } else if (level === 'WARN') {
    console.warn(`[${timestamp}] [WARN] ${cleanMessage}${metaStr}`);
  } else if (level === 'DEBUG') {
    console.debug(`[${timestamp}] [DEBUG] ${cleanMessage}${metaStr}`);
  } else {
    console.log(`[${timestamp}] [INFO] ${cleanMessage}${metaStr}`);
  }
}

export const logger = {
  info: (message: string, meta?: any) => {
    outputLog('INFO', message, meta);
  },
  warn: (message: string, meta?: any) => {
    outputLog('WARN', message, meta);
  },
  error: (message: string, error?: any) => {
    const errorDetails =
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : error;
    outputLog('ERROR', message, errorDetails);

    // Dispatch to registered error monitoring listeners
    if (error instanceof Error) {
      errorListeners.forEach((listener) => {
        try {
          listener(error, { message });
        } catch {
          // Prevent listener failures from crashing the application
        }
      });
    }
  },
  debug: (message: string, meta?: any) => {
    if (process.env.NODE_ENV === 'development') {
      outputLog('DEBUG', message, meta);
    }
  },
  /**
   * Registers an external error monitoring handler (e.g. Sentry / Datadog / OpenTelemetry)
   */
  onError: (listener: ErrorListener) => {
    errorListeners.push(listener);
  },
};
