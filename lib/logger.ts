// Thin logger that writes to console. In production, swap the console calls
// for your preferred sink (Axiom, Sentry, etc.) via env-gated initialization.

export type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  source: string;
  message: string;
  data?: unknown;
}

function log(entry: LogEntry) {
  const prefix = `[rva-james:${entry.source}]`;
  const msg = `${prefix} ${entry.message}`;
  if (entry.level === 'error') {
    console.error(msg, entry.data ?? '');
  } else if (entry.level === 'warn') {
    console.warn(msg, entry.data ?? '');
  } else {
    console.log(msg, entry.data ?? '');
  }
}

export const logger = {
  info: (source: string, message: string, data?: unknown) =>
    log({ level: 'info', source, message, data }),
  warn: (source: string, message: string, data?: unknown) =>
    log({ level: 'warn', source, message, data }),
  error: (source: string, message: string, data?: unknown) =>
    log({ level: 'error', source, message, data }),
};
