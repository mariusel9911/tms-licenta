import pino from 'pino';
import { env } from './env.js';

// At debug level show req/res details; at info+ keep lines compact
const prettyIgnore = env.LOG_LEVEL === 'debug'
  ? 'pid,hostname'
  : 'pid,hostname,req,res,responseTime';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  ...(env.NODE_ENV !== 'test' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
        ignore: prettyIgnore,
      },
    },
  }),
});
