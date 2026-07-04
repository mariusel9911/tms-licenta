import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { listBackups, createBackup, restoreBackup, deleteBackup, downloadBackup, uploadBackup, getCompatAll } from './backup.controller.js';
import { uploadBackupMiddleware } from '../../middleware/upload.middleware.js';

export const backupRouter = Router();

function withUploadErrorHandling(middleware: RequestHandler): RequestHandler {
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ success: false, error: 'File too large (max 500 MB)' });
          return;
        }
        res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
        return;
      }
      if (err instanceof Error) {
        res.status(400).json({ success: false, error: err.message });
        return;
      }
      next(err);
    });
  };
}

// Static routes before dynamic /:filename routes
backupRouter.post('/restore', restoreBackup);
backupRouter.post('/upload', withUploadErrorHandling(uploadBackupMiddleware), uploadBackup);
backupRouter.get('/compat', getCompatAll);

backupRouter.get('/', listBackups);
backupRouter.post('/', createBackup);
backupRouter.delete('/:filename', deleteBackup);
backupRouter.get('/:filename/download', downloadBackup);
