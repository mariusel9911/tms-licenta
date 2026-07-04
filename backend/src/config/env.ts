import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SERVER_URL: z.string().url().default('http://localhost:3001'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  SEED_USER_EMAIL: z.string().email().default('admin@tms.ro'),
  SEED_USER_PASSWORD: z.string().min(8, 'SEED_USER_PASSWORD must be at least 8 characters'),
  // Set to 'true' in production to enable brute-force protection on auth endpoints.
  // Leave unset (or 'false') in development and during load/stress tests.
  RATE_LIMIT_ENABLED: z.string().optional().transform((v) => v === 'true'),
  // WebAuthn (Passkeys) — must match the public domain + HTTPS in production
  WEBAUTHN_RP_ID: z.string().default('localhost'),
  WEBAUTHN_RP_NAME: z.string().default('TMS Transport'),
  WEBAUTHN_ORIGIN: z.string().default('http://localhost:5173'),
  // AI services (diploma branch — M26)
  OLLAMA_URL: z.string().url().default('http://localhost:11434'),
  // Ollama model to use (e.g., 'llama3.2:3b', 'llama3.1:8b', 'gemma2:9b')
  OLLAMA_MODEL: z.string().default('llama3.2:3b'),
  PYTHON_API_URL: z.string().url().default('http://localhost:8000'),
  // Shared secret between Express backend and Python API
  PYTHON_API_SECRET: z.string().min(16).default('dev-python-api-secret-change-me'),
  // Primary AI provider: 'ollama' (local, slow on CPU) | 'gemini' (fast cloud)
  AI_PRIMARY_PROVIDER: z.enum(['ollama', 'gemini']).default('ollama'),
  // Cloud LLM fallback: 'gemini' | 'openai' | 'none'
  AI_FALLBACK_PROVIDER: z.enum(['gemini', 'openai', 'none']).default('none'),
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  // PostgreSQL client tool paths — override on Windows if pg_dump/psql are not in PATH
  // Example: PG_DUMP_PATH=C:\Program Files\PostgreSQL\16\bin\pg_dump.exe
  PG_DUMP_PATH: z.string().default('pg_dump'),
  PSQL_PATH:    z.string().default('psql'),
  // Remote Backup Storage (S3-compatible — Cloudflare R2 / Backblaze B2 / MinIO / AWS S3)
  // All five must be set to enable remote backups. Leave unset for local-only.
  BACKUP_S3_ENDPOINT:   z.string().url().optional(),
  BACKUP_S3_BUCKET:     z.string().min(1).optional(),
  BACKUP_S3_REGION:     z.string().min(1).optional(),
  BACKUP_S3_ACCESS_KEY: z.string().min(1).optional(),
  BACKUP_S3_SECRET_KEY: z.string().min(1).optional(),
  // When true, backup creation throws if S3 is not configured — prevents
  // accidental local-only backups on the production mini-PC.
  BACKUP_REMOTE_REQUIRED: z.string().optional().transform((v) => v === 'true'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
