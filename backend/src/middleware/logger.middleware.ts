import { pinoHttp } from 'pino-http';
import crypto from 'crypto';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

const isDev = env.NODE_ENV === 'development';

const COLORS: Record<string, string> = {
  GET:    '\x1b[36m',  // cyan
  POST:   '\x1b[32m',  // green
  PUT:    '\x1b[33m',  // yellow
  PATCH:  '\x1b[33m',  // yellow
  DELETE: '\x1b[31m',  // red
};
const RESET = '\x1b[0m';
const GRAY  = '\x1b[90m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED   = '\x1b[31m';

function c(color: string, text: string): string {
  return isDev ? `${color}${text}${RESET}` : text;
}

function colorMethod(method: string): string {
  return c(COLORS[method] ?? '', method);
}

function colorStatus(code: number): string {
  if (code < 300) return c(GREEN, String(code));
  if (code < 400) return c(GRAY, String(code));
  if (code < 500) return c(YELLOW, String(code));
  return c(RED, String(code));
}

function colorTime(ms: number): string {
  if (Number.isNaN(ms)) return c(GRAY, '-');
  const text = `${ms}ms`;
  if (ms < 100) return c(GREEN, text);
  if (ms < 500) return c(YELLOW, text);
  return c(RED, text);
}

function formatMessage(method: string, url: string, statusCode: number, responseTime: unknown): string {
  const ms = typeof responseTime === 'number' ? responseTime : parseFloat(String(responseTime));
  return `${colorMethod(method)} ${url} ${colorStatus(statusCode)} ${colorTime(ms)}`;
}

export const httpLogger = pinoHttp({
  logger,
  autoLogging: {
    // Suppress health-check and maintenance-status polling from logs to reduce noise
    ignore: (req) =>
      req.url === '/api/health' ||
      req.url === '/api/maintenance/status',
  },
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
  genReqId: (req, res) => {
    const existing = req.headers['x-request-id'];
    if (existing) {
      res.setHeader('x-request-id', existing);
      return existing as string;
    }
    const id = crypto.randomUUID();
    res.setHeader('x-request-id', id);
    return id;
  },
  customSuccessMessage: (req, res, responseTime) =>
    formatMessage(req.method!, req.url!, (res as { statusCode: number }).statusCode, responseTime),
  customErrorMessage: (req, res, _error) =>
    formatMessage(req.method!, req.url!, (res as { statusCode: number }).statusCode, undefined),
});
