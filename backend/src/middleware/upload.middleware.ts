import multer from 'multer';
import fs from 'fs';
import type { Request } from 'express';
import { LOGOS_DIR, STAMPS_DIR, BACKUPS_DIR } from '../config/paths.js';

// Ensure upload directory exists at startup
if (!fs.existsSync(LOGOS_DIR)) {
  fs.mkdirSync(LOGOS_DIR, { recursive: true });
}

const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, LOGOS_DIR);
  },
  filename: (_req, file, cb) => {
    // MED-F: derive extension from MIME type whitelist, not from client originalname
    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
    };
    const ext = mimeToExt[file.mimetype] ?? '.bin';
    cb(null, `company-logo${ext}`);
  },
});

const logoFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, png, gif, webp)'));
  }
};

export const uploadLogoMiddleware = multer({
  storage: logoStorage,
  fileFilter: logoFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
}).single('logo');

// ─── Stamp upload ─────────────────────────────────────────────────────────────

if (!fs.existsSync(STAMPS_DIR)) {
  fs.mkdirSync(STAMPS_DIR, { recursive: true });
}

const stampStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, STAMPS_DIR);
  },
  filename: (_req, file, cb) => {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
    };
    const ext = mimeToExt[file.mimetype] ?? '.bin';
    cb(null, `company-stamp${ext}`);
  },
});

const stampFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, png, gif, webp)'));
  }
};

export const uploadStampMiddleware = multer({
  storage: stampStorage,
  fileFilter: stampFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
}).single('stamp');

// ─── Backup upload ────────────────────────────────────────────────────────────

if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// Accepts both current (.tar.gz) and legacy (.sql.gz) backup filenames.
const BACKUP_FILENAME_REGEX = /^tms-backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.(tar\.gz|sql\.gz)$/;

const backupStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, BACKUPS_DIR),
  filename:    (_req, file, cb) => cb(null, file.originalname),
});

const backupFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  if (BACKUP_FILENAME_REGEX.test(file.originalname)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid filename. Expected format: tms-backup-YYYY-MM-DD_HH-MM-SS.tar.gz'));
  }
};

export const uploadBackupMiddleware = multer({
  storage:    backupStorage,
  fileFilter: backupFileFilter,
  limits:     { fileSize: 500 * 1024 * 1024 }, // 500 MB
}).single('backup');
