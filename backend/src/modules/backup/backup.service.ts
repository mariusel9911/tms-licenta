import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { spawn } from 'child_process';
import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../../config/env.js';
import { BACKUPS_DIR, UPLOADS_DIR } from '../../config/paths.js';
import { logger } from '../../config/logger.js';
import { prisma } from '../../config/database.js';
import { recordAuditEvent, AuditCategory, AuditSeverity } from '../audit/audit.service.js';
import type { AuditActor } from '../audit/audit.types.js';

// Accepts both current (.tar.gz) and legacy (.sql.gz) backup filenames.
export const BACKUP_FILENAME_REGEX =
  /^tms-backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.(tar\.gz|sql\.gz)$/;

export interface BackupMetadata {
  filename:  string;
  sizeBytes: number;
  createdAt: Date;
  storage:   'local' | 'remote' | 'both';
}

export interface BackupVerification {
  valid:    boolean;
  manifest?: BackupManifest;
  errors:   string[];
}

export interface BackupManifest {
  createdAt:          string;
  format:             string;
  includesUploads:    boolean;
  prismaMigrations:   string[];
  prismaSchemaHash?:  string;
}

export interface BackupCompatibility {
  status:                'ok' | 'older' | 'newer';
  missing:               string[];
  extra:                 string[];
  backupMigrationCount:  number;
  currentMigrationCount: number;
  backupLastMigration?:  string;
  currentLastMigration?: string;
}

export class BackupIncompatibleError extends Error {
  constructor(public readonly compat: BackupCompatibility) {
    super(
      `Backup is incompatible with current code (${compat.status}). ` +
      (compat.missing.length > 0
        ? `Missing migrations: ${compat.missing.join(', ')}. `
        : '') +
      (compat.extra.length > 0
        ? `Extra migrations in backup: ${compat.extra.join(', ')}. `
        : '') +
      'Pass force=true to override (code rollback may be required).',
    );
    this.name = 'BackupIncompatibleError';
  }
}

interface DbConnectionParams {
  host:     string;
  port:     string;
  user:     string;
  password: string;
  database: string;
}

function parseDatabaseUrl(databaseUrl: string): DbConnectionParams {
  const url = new URL(databaseUrl);
  return {
    host:     url.hostname,
    port:     url.port || '5432',
    user:     decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
  };
}

function buildFilename(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `tms-backup-${date}_${time}.tar.gz`;
}

function parseFilenameDate(filename: string): Date | null {
  const match = filename.match(/tms-backup-(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return new Date(`${match[1]}T${match[2]}:${match[3]}:${match[4]}`);
}


// ── Low-level helpers ────────────────────────────────────────────────────────

/**
 * Convert a Windows absolute path to MSYS2 / Git-for-Windows format so that
 * the tar binary (which is typically a MinGW/MSYS2 build on Windows dev machines)
 * does not interpret the drive letter as a remote hostname.
 *
 * Examples:
 *   D:\TMS_APP\backups\foo.tar.gz → /d/TMS_APP/backups/foo.tar.gz
 *   C:\Users\foo\AppData\…       → /c/Users/foo/AppData/…
 *
 * On Linux/macOS the path is returned unchanged.
 */
function toTarPath(p: string): string {
  if (process.platform !== 'win32') return p;
  return p
    .replace(/^([A-Za-z]):[/\\]/, (_, d: string) => `/${d.toLowerCase()}/`)
    .replace(/\\/g, '/');
}

function runPgDump(params: DbConnectionParams, destPath: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const args = [
      '-h', params.host,
      '-p', params.port,
      '-U', params.user,
      '-d', params.database,
      '--no-password',
      '--format=plain',
    ];

    const pgDump = spawn(env.PG_DUMP_PATH, args, {
      env: { ...process.env, PGPASSWORD: params.password },
    });

    const gzip   = zlib.createGzip();
    const output = fs.createWriteStream(destPath);

    pgDump.on('error', (err) => {
      output.destroy();
      try { fs.rmSync(destPath, { force: true }); } catch { /* ignore */ }
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        reject(new Error('pg_dump not found. Ensure PostgreSQL client tools are installed.'));
      } else {
        reject(err);
      }
    });

    pgDump.stdout.pipe(gzip).pipe(output);

    let stderrBuf = '';
    pgDump.stderr.on('data', (chunk: Buffer) => { stderrBuf += chunk.toString(); });

    pgDump.on('close', (code) => {
      if (code !== 0) {
        output.destroy();
        try { fs.rmSync(destPath, { force: true }); } catch { /* ignore */ }
        reject(new Error(`pg_dump exited with code ${code}: ${stderrBuf.trim()}`));
      } else {
        resolve();
      }
    });

    output.on('error', (err) => {
      pgDump.kill();
      reject(err);
    });
  });
}

function runTarCreate(archivePath: string, sourceDir: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const tar = spawn('tar', ['-czf', toTarPath(archivePath), '-C', toTarPath(sourceDir), '.']);
    let stderrBuf = '';
    tar.stderr.on('data', (chunk: Buffer) => { stderrBuf += chunk.toString(); });
    tar.on('error', reject);
    tar.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`tar exited with code ${code}: ${stderrBuf.trim()}`));
      } else {
        resolve();
      }
    });
  });
}

// DA-3: reject archives whose gzip ISIZE trailer exceeds this limit (mod-2^32; catches files < 4 GB).
const MAX_UNCOMPRESSED_BYTES = 2 * 1024 * 1024 * 1024;

async function readGzipIsize(filePath: string): Promise<number> {
  const { size } = await fs.promises.stat(filePath);
  const fd = await fs.promises.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(4);
    await fd.read(buf, 0, 4, size - 4);
    return buf.readUInt32LE(0);
  } finally {
    await fd.close();
  }
}

// DA-1: list entries and reject any that escape the destination directory.
function validateTarEntries(archivePath: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const tar = spawn('tar', ['-tzf', toTarPath(archivePath)]);
    let stdout = '';
    let stderr = '';
    tar.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    tar.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    tar.on('error', reject);
    tar.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`tar -tzf failed (exit ${code}): ${stderr.trim()}`));
        return;
      }
      for (const name of stdout.split('\n').filter(Boolean)) {
        if (path.posix.isAbsolute(name)) {
          reject(new Error(`Archive contains absolute path entry: ${name}`));
          return;
        }
        if (path.posix.normalize(name).startsWith('..')) {
          reject(new Error(`Archive contains path traversal entry: ${name}`));
          return;
        }
      }
      resolve();
    });
  });
}

async function checkTarSafety(archivePath: string): Promise<void> {
  const isize = await readGzipIsize(archivePath);
  if (isize > MAX_UNCOMPRESSED_BYTES) {
    const mb = Math.round(isize / 1024 / 1024);
    throw new Error(`Archive uncompressed size (~${mb} MB) exceeds the 2 GB safety limit`);
  }
  await validateTarEntries(archivePath);
}

async function runTarExtract(archivePath: string, destDir: string): Promise<void> {
  await checkTarSafety(archivePath);
  return new Promise<void>((resolve, reject) => {
    const tar = spawn('tar', ['-xzf', toTarPath(archivePath), '-C', toTarPath(destDir)]);
    let stderrBuf = '';
    tar.stderr.on('data', (chunk: Buffer) => { stderrBuf += chunk.toString(); });
    tar.on('error', reject);
    tar.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`tar extract exited with code ${code}: ${stderrBuf.trim()}`));
      } else {
        resolve();
      }
    });
  });
}

async function restoreSqlGzToDb(sqlGzPath: string, params: DbConnectionParams): Promise<void> {
  // Wipe the public schema before restoring
  await new Promise<void>((resolve, reject) => {
    const psqlWipe = spawn(env.PSQL_PATH, [
      '-h', params.host,
      '-p', params.port,
      '-U', params.user,
      '-d', params.database,
      '--no-password',
      '-v', 'ON_ERROR_STOP=1',
      '-c', 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;',
    ], {
      env: { ...process.env, PGPASSWORD: params.password },
    });
    let stderrWipe = '';
    psqlWipe.stderr.on('data', (chunk: Buffer) => { stderrWipe += chunk.toString(); });
    psqlWipe.on('error', reject);
    psqlWipe.on('close', (code) => {
      if (code !== 0) reject(new Error(`Schema wipe failed (exit ${code}): ${stderrWipe.trim()}`));
      else resolve();
    });
  });

  await new Promise<void>((resolve, reject) => {
    const psql = spawn(env.PSQL_PATH, [
      '-h', params.host,
      '-p', params.port,
      '-U', params.user,
      '-d', params.database,
      '--no-password',
      '-v', 'ON_ERROR_STOP=1',
    ], {
      env: { ...process.env, PGPASSWORD: params.password },
    });

    const input  = fs.createReadStream(sqlGzPath);
    const gunzip = zlib.createGunzip();

    psql.on('error', (err) => {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        reject(new Error('psql not found. Ensure PostgreSQL client tools are installed.'));
      } else {
        reject(err);
      }
    });

    // EPIPE is expected when psql exits early (ON_ERROR_STOP triggered).
    psql.stdin.on('error', () => { /* suppress EPIPE */ });
    gunzip.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code !== 'EPIPE') reject(err);
    });

    input.pipe(gunzip).pipe(psql.stdin);

    let stderrBuf = '';
    psql.stderr.on('data', (chunk: Buffer) => { stderrBuf += chunk.toString(); });

    psql.on('close', (code) => {
      input.destroy();
      gunzip.destroy();
      if (code !== 0) {
        reject(new Error(`psql exited with code ${code}: ${stderrBuf.trim()}`));
      } else {
        resolve();
      }
    });
  });
}

// ── Migration helpers ─────────────────────────────────────────────────────────

async function getCurrentMigrations(): Promise<string[]> {
  try {
    const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM _prisma_migrations
      WHERE finished_at IS NOT NULL
      ORDER BY started_at
    `;
    return rows.map(r => r.migration_name);
  } catch {
    // Table may not exist in very old backups; treat as empty
    return [];
  }
}

function schemaHash(): string {
  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
  try {
    const content = fs.readFileSync(schemaPath, 'utf8');
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  } catch {
    return '';
  }
}

export function checkBackupCompatibility(manifest: BackupManifest, currentMigrations: string[]): BackupCompatibility {
  const backupSet   = new Set(manifest.prismaMigrations ?? []);
  const currentSet  = new Set(currentMigrations);

  const missing = currentMigrations.filter(m => !backupSet.has(m));
  const extra   = (manifest.prismaMigrations ?? []).filter(m => !currentSet.has(m));

  let status: BackupCompatibility['status'] = 'ok';
  if (missing.length > 0) status = 'older';
  else if (extra.length > 0) status = 'newer';

  const backupMigs   = manifest.prismaMigrations ?? [];
  const currentMigs  = currentMigrations;
  return {
    status,
    missing,
    extra,
    backupMigrationCount:  backupMigs.length,
    currentMigrationCount: currentMigs.length,
    backupLastMigration:   backupMigs.at(-1),
    currentLastMigration:  currentMigs.at(-1),
  };
}

// ── Service ──────────────────────────────────────────────────────────────────

export const backupService = {
  isS3Configured(): boolean {
    return !!(
      env.BACKUP_S3_ENDPOINT &&
      env.BACKUP_S3_BUCKET &&
      env.BACKUP_S3_REGION &&
      env.BACKUP_S3_ACCESS_KEY &&
      env.BACKUP_S3_SECRET_KEY
    );
  },

  getS3Client(): S3Client | null {
    if (!this.isS3Configured()) return null;
    return new S3Client({
      endpoint:        env.BACKUP_S3_ENDPOINT!,
      region:          env.BACKUP_S3_REGION!,
      credentials: {
        accessKeyId:     env.BACKUP_S3_ACCESS_KEY!,
        secretAccessKey: env.BACKUP_S3_SECRET_KEY!,
      },
      forcePathStyle: true, // required for Cloudflare R2, MinIO, Backblaze B2
    });
  },

  /**
   * Creates a tar.gz bundle containing:
   *   dump.sql.gz    — pg_dump output
   *   uploads/       — logos, stamps, any uploaded files
   *   manifest.json  — metadata for restore validation
   */
  async createBackup(destination: 'local' | 'remote' | 'both' = 'both', actor: AuditActor = {}): Promise<BackupMetadata> {
    if (env.BACKUP_REMOTE_REQUIRED && !this.isS3Configured()) {
      throw new Error(
        'BACKUP_REMOTE_REQUIRED is set but S3 is not configured. ' +
        'Configure BACKUP_S3_* env vars or unset BACKUP_REMOTE_REQUIRED.',
      );
    }

    const params   = parseDatabaseUrl(env.DATABASE_URL);
    const filename = buildFilename();
    const destPath = path.join(BACKUPS_DIR, filename);

    fs.mkdirSync(BACKUPS_DIR, { recursive: true });

    const tmpDir = path.join(os.tmpdir(), `tms-backup-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    try {
      // 1. pg_dump → tmpDir/dump.sql.gz
      await runPgDump(params, path.join(tmpDir, 'dump.sql.gz'));

      // 2. Copy uploads/ → tmpDir/uploads/
      const tmpUploads = path.join(tmpDir, 'uploads');
      if (fs.existsSync(UPLOADS_DIR)) {
        fs.cpSync(UPLOADS_DIR, tmpUploads, { recursive: true });
      } else {
        fs.mkdirSync(tmpUploads, { recursive: true });
      }

      // 3. Embed current migration list + schema hash in manifest
      const [migrations] = await Promise.all([getCurrentMigrations()]);
      const manifest: BackupManifest = {
        createdAt:        new Date().toISOString(),
        format:           'tar.gz',
        includesUploads:  true,
        prismaMigrations: migrations,
        prismaSchemaHash: schemaHash(),
      };
      fs.writeFileSync(path.join(tmpDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

      // 4. Bundle → BACKUPS_DIR/tms-backup-….tar.gz
      await runTarCreate(destPath, tmpDir);
    } catch (err) {
      await recordAuditEvent({
        category: AuditCategory.BACKUP,
        action:   'BACKUP_CREATE_FAIL',
        actor,
        severity: AuditSeverity.ERROR,
        details:  { destination, error: String(err) },
      });
      throw err;
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    const stat = fs.statSync(destPath);
    const effectiveStorage: BackupMetadata['storage'] =
      (destination === 'remote' || destination === 'both') && !this.isS3Configured()
        ? 'local'
        : destination;

    const metadata: BackupMetadata = {
      filename,
      sizeBytes: stat.size,
      createdAt: new Date(),
      storage:   effectiveStorage,
    };

    await recordAuditEvent({
      category: AuditCategory.BACKUP,
      action:   'BACKUP_CREATE',
      actor,
      severity: AuditSeverity.INFO,
      details:  { filename, destination, sizeBytes: stat.size },
    });

    return metadata;
  },

  listLocalBackups(): BackupMetadata[] {
    if (!fs.existsSync(BACKUPS_DIR)) return [];

    return fs.readdirSync(BACKUPS_DIR)
      .filter(f => BACKUP_FILENAME_REGEX.test(f))
      .map(filename => {
        const stat = fs.statSync(path.join(BACKUPS_DIR, filename));
        const createdAt = parseFilenameDate(filename) ?? new Date(stat.mtime);
        return { filename, sizeBytes: stat.size, createdAt, storage: 'local' as const };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  async listRemoteBackups(): Promise<BackupMetadata[]> {
    const client = this.getS3Client();
    if (!client) return [];

    const response = await client.send(new ListObjectsV2Command({
      Bucket: env.BACKUP_S3_BUCKET!,
      Prefix: 'tms-backup-',
    }));

    return (response.Contents ?? [])
      .filter(obj => obj.Key && BACKUP_FILENAME_REGEX.test(obj.Key))
      .map(obj => ({
        filename:  obj.Key!,
        sizeBytes: obj.Size ?? 0,
        createdAt: parseFilenameDate(obj.Key!) ?? obj.LastModified ?? new Date(),
        storage:   'remote' as const,
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  async listAllBackups(): Promise<BackupMetadata[]> {
    const [local, remote] = await Promise.all([
      this.listLocalBackups(),
      this.isS3Configured() ? this.listRemoteBackups() : Promise.resolve([]),
    ]);

    const map = new Map<string, BackupMetadata>();
    for (const entry of local)  map.set(entry.filename, entry);
    for (const entry of remote) {
      const existing = map.get(entry.filename);
      if (existing) {
        map.set(entry.filename, { ...existing, storage: 'both' });
      } else {
        map.set(entry.filename, entry);
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  async getCompatAll(): Promise<Array<{ filename: string; compat: BackupCompatibility | null }>> {
    const local = this.listLocalBackups();
    const currentMigrations = await getCurrentMigrations();

    const results = await Promise.all(
      local.map(async ({ filename }) => {
        if (!filename.endsWith('.tar.gz')) return { filename, compat: null };
        const verification = await this.verifyBackup(filename);
        const manifest = verification.manifest;
        if (!manifest || manifest.prismaMigrations === undefined) {
          return { filename, compat: null };
        }
        return { filename, compat: checkBackupCompatibility(manifest, currentMigrations) };
      }),
    );
    return results;
  },

  deleteLocalBackup(filename: string): void {
    if (!BACKUP_FILENAME_REGEX.test(filename)) throw new Error('Invalid backup filename');
    const filePath = path.join(BACKUPS_DIR, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  },

  async deleteFromS3(filename: string): Promise<void> {
    const client = this.getS3Client();
    if (!client) return;
    await client.send(new DeleteObjectCommand({
      Bucket: env.BACKUP_S3_BUCKET!,
      Key:    filename,
    }));
  },

  /**
   * Unified retention prune — always inspects BOTH stores regardless of the
   * destination of the triggering backup run.  This prevents stale files
   * from accumulating when a user switches between local/remote/both over time.
   *
   * Identity is keyed by filename.  For each filename older than retainCount
   * the entry is deleted from every store where it exists.
   */
  async pruneRetention(retainCount: number, actor: AuditActor = {}): Promise<{ deletedLocal: string[]; deletedRemote: string[] }> {
    const all = await this.listAllBackups();
    const toDelete = all.slice(retainCount);

    const deletedLocal:  string[] = [];
    const deletedRemote: string[] = [];

    for (const entry of toDelete) {
      const locations: string[] = [];

      if (entry.storage === 'local' || entry.storage === 'both') {
        try {
          this.deleteLocalBackup(entry.filename);
          deletedLocal.push(entry.filename);
          locations.push('local');
        } catch (err) {
          logger.warn({ err, filename: entry.filename }, 'backup: failed to delete old local backup');
        }
      }

      if ((entry.storage === 'remote' || entry.storage === 'both') && this.isS3Configured()) {
        try {
          await this.deleteFromS3(entry.filename);
          deletedRemote.push(entry.filename);
          locations.push('remote');
        } catch (err) {
          logger.warn({ err, filename: entry.filename }, 'backup: failed to delete old remote backup');
        }
      }

      if (locations.length > 0) {
        await recordAuditEvent({
          category: AuditCategory.BACKUP,
          action:   'BACKUP_PRUNE',
          actor,
          severity: AuditSeverity.INFO,
          details:  { filename: entry.filename, locations },
        });
      }
    }

    return { deletedLocal, deletedRemote };
  },

  async uploadToS3(filename: string, actor: AuditActor = {}): Promise<void> {
    const client = this.getS3Client();
    if (!client) throw new Error('S3 not configured');

    const filePath = path.join(BACKUPS_DIR, filename);
    const stat     = fs.statSync(filePath);
    const fileStream = fs.createReadStream(filePath);

    try {
      await client.send(new PutObjectCommand({
        Bucket:        env.BACKUP_S3_BUCKET!,
        Key:           filename,
        Body:          fileStream,
        ContentLength: stat.size,
        ContentType:   'application/gzip',
      }));
      await recordAuditEvent({
        category: AuditCategory.BACKUP,
        action:   'BACKUP_REMOTE_UPLOAD',
        actor,
        severity: AuditSeverity.INFO,
        details:  { filename },
      });
    } catch (err) {
      await recordAuditEvent({
        category: AuditCategory.BACKUP,
        action:   'BACKUP_REMOTE_UPLOAD_FAIL',
        actor,
        severity: AuditSeverity.ERROR,
        details:  { filename, error: String(err) },
      });
      throw err;
    }
  },

  async downloadFromS3(filename: string, destPath: string): Promise<void> {
    const client = this.getS3Client();
    if (!client) throw new Error('S3 not configured');

    const response = await client.send(new GetObjectCommand({
      Bucket: env.BACKUP_S3_BUCKET!,
      Key:    filename,
    }));

    await new Promise<void>((resolve, reject) => {
      const writeStream = fs.createWriteStream(destPath);
      const body = response.Body as NodeJS.ReadableStream;
      body.pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  },

  /**
   * Verifies a backup archive without applying it.
   * For .tar.gz: checks dump.sql.gz exists + is gzip, uploads/ exists, manifest parses.
   * For legacy .sql.gz: checks gzip magic bytes only.
   */
  async verifyBackup(filename: string): Promise<BackupVerification> {
    if (!BACKUP_FILENAME_REGEX.test(filename)) {
      return { valid: false, errors: ['Invalid backup filename'] };
    }

    const filePath = path.join(BACKUPS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return { valid: false, errors: ['File not found locally — download from S3 first if remote-only'] };
    }

    // Legacy .sql.gz — just verify gzip magic bytes
    if (filename.endsWith('.sql.gz')) {
      const header = Buffer.alloc(2);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, header, 0, 2, 0);
      fs.closeSync(fd);
      const isGzip = header[0] === 0x1f && header[1] === 0x8b;
      return {
        valid:  isGzip,
        errors: isGzip ? [] : ['Not a valid gzip file'],
      };
    }

    // New .tar.gz format — extract to tmp and inspect
    const tmpDir = path.join(os.tmpdir(), `tms-verify-${crypto.randomUUID()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    try {
      await runTarExtract(filePath, tmpDir);

      const errors: string[] = [];

      const dumpPath = path.join(tmpDir, 'dump.sql.gz');
      if (!fs.existsSync(dumpPath)) {
        errors.push('Missing dump.sql.gz in archive');
      } else {
        const header = Buffer.alloc(2);
        const fd = fs.openSync(dumpPath, 'r');
        fs.readSync(fd, header, 0, 2, 0);
        fs.closeSync(fd);
        if (header[0] !== 0x1f || header[1] !== 0x8b) {
          errors.push('dump.sql.gz is not a valid gzip file');
        }
      }

      if (!fs.existsSync(path.join(tmpDir, 'uploads'))) {
        errors.push('Missing uploads/ directory in archive');
      }

      let manifest: BackupManifest | undefined;
      const manifestPath = path.join(tmpDir, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        try {
          manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as BackupManifest;
        } catch {
          errors.push('manifest.json is not valid JSON');
        }
      } else {
        errors.push('Missing manifest.json in archive');
      }

      return { valid: errors.length === 0, manifest, errors };
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  },

  /**
   * Restores a backup.
   * - dryRun=true: runs verifyBackup() + compat check — safe to call without destroying data.
   * - dryRun=false: checks compatibility (throws BackupIncompatibleError unless force=true),
   *   then wipes the DB schema, restores the dump, then restores uploads/.
   * Supports both .tar.gz (current) and .sql.gz (legacy) formats.
   */
  async restoreFromBackup(
    filename: string,
    dryRun  = false,
    force   = false,
    actor: AuditActor = {},
  ): Promise<{ dryRun: boolean; compatibility?: BackupCompatibility; manifest?: BackupManifest }> {
    if (!BACKUP_FILENAME_REGEX.test(filename)) throw new Error('Invalid backup filename');

    const filePath = path.join(BACKUPS_DIR, filename);

    // Download from S3 if not available locally
    if (!fs.existsSync(filePath)) {
      if (!this.isS3Configured()) {
        throw new Error('Backup file not found locally and S3 is not configured');
      }
      logger.info({ filename }, 'backup: downloading from S3 for restore');
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
      await this.downloadFromS3(filename, filePath);
    }

    // Always extract manifest for compat check (tar.gz only; legacy skips)
    let manifest: BackupManifest | undefined;
    let compatibility: BackupCompatibility | undefined;

    if (filename.endsWith('.tar.gz')) {
      const verification = await this.verifyBackup(filename);
      manifest = verification.manifest;

      if (manifest?.prismaMigrations !== undefined) {
        const currentMigrations = await getCurrentMigrations();
        compatibility = checkBackupCompatibility(manifest, currentMigrations);
      }
    }

    if (dryRun) {
      if (filename.endsWith('.tar.gz')) {
        const result = await this.verifyBackup(filename);
        if (!result.valid) {
          throw new Error(`Backup verification failed: ${result.errors.join('; ')}`);
        }
        logger.info({ filename, manifest: result.manifest }, 'backup: dry-run verification passed');
      }
      return { dryRun: true, compatibility, manifest };
    }

    // Compat gate
    if (compatibility && compatibility.status !== 'ok' && !force) {
      await recordAuditEvent({
        category: AuditCategory.BACKUP,
        action:   'RESTORE_BLOCKED_INCOMPAT',
        actor,
        severity: AuditSeverity.WARN,
        details:  { filename, compatibility },
      });
      throw new BackupIncompatibleError(compatibility);
    }

    await recordAuditEvent({
      category: AuditCategory.BACKUP,
      action:   'RESTORE_START',
      actor,
      severity: force ? AuditSeverity.ERROR : AuditSeverity.WARN,
      details:  { filename, force, compatibility: compatibility ?? null },
    });

    const params = parseDatabaseUrl(env.DATABASE_URL);
    logger.warn({ filename, force }, 'backup: starting restore — all current data will be overwritten');

    try {
      if (filename.endsWith('.sql.gz')) {
        // Legacy format — restore DB only (no uploads in archive)
        await restoreSqlGzToDb(filePath, params);
        logger.info({ filename }, 'backup: legacy restore complete (no uploads restored)');
      } else {
        // Current .tar.gz format
        const tmpDir = path.join(os.tmpdir(), `tms-restore-${Date.now()}`);
        fs.mkdirSync(tmpDir, { recursive: true });
        try {
          await runTarExtract(filePath, tmpDir);

          const dumpPath = path.join(tmpDir, 'dump.sql.gz');
          if (!fs.existsSync(dumpPath)) {
            throw new Error('Archive is missing dump.sql.gz — cannot restore');
          }
          await restoreSqlGzToDb(dumpPath, params);

          const uploadsInArchive = path.join(tmpDir, 'uploads');
          if (fs.existsSync(uploadsInArchive)) {
            logger.info({ src: uploadsInArchive, dest: UPLOADS_DIR }, 'backup: restoring uploads directory');
            fs.mkdirSync(UPLOADS_DIR, { recursive: true });
            fs.cpSync(uploadsInArchive, UPLOADS_DIR, { recursive: true });
          }
        } finally {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }
        logger.info({ filename }, 'backup: restore complete (DB + uploads)');
      }
    } catch (err) {
      await recordAuditEvent({
        category: AuditCategory.BACKUP,
        action:   'RESTORE_FAIL',
        actor,
        severity: AuditSeverity.ERROR,
        details:  { filename, error: String(err) },
      });
      throw err;
    }

    await recordAuditEvent({
      category: AuditCategory.BACKUP,
      action:   'RESTORE_SUCCESS',
      actor,
      severity: force ? AuditSeverity.WARN : AuditSeverity.INFO,
      details:  { filename, force, compatibility: compatibility ?? null },
    });

    return { dryRun: false, compatibility, manifest };
  },
};
