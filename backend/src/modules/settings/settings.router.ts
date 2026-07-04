import { Router, RequestHandler } from 'express';
import multer from 'multer';
import { requireAdmin } from '../../middleware/role.middleware.js';
import { uploadLogoMiddleware, uploadStampMiddleware } from '../../middleware/upload.middleware.js';
import { getSettings, updateSettings, uploadLogo, deleteLogo, testSmtpConnection, uploadStamp, deleteStamp, getSystemInfo } from './settings.controller.js';

export const settingsRouter = Router();

/**
 * Wraps a multer middleware so that MulterError (e.g. LIMIT_FILE_SIZE) is returned
 * as a 400 JSON response instead of propagating as an unhandled 500.
 */
function withUploadErrorHandling(middleware: RequestHandler): RequestHandler {
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ success: false, error: 'File too large. Maximum allowed size is 5 MB.' });
          return;
        }
        res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
        return;
      }
      next(err);
    });
  };
}

settingsRouter.get('/', getSettings);
settingsRouter.put('/', requireAdmin, updateSettings);
settingsRouter.post('/logo', requireAdmin, withUploadErrorHandling(uploadLogoMiddleware), uploadLogo);
settingsRouter.delete('/logo', requireAdmin, deleteLogo);
settingsRouter.post('/stamp', requireAdmin, withUploadErrorHandling(uploadStampMiddleware), uploadStamp);
settingsRouter.delete('/stamp', requireAdmin, deleteStamp);
settingsRouter.post('/smtp/test', requireAdmin, testSmtpConnection);
settingsRouter.get('/system-info', requireAdmin, getSystemInfo);
