import { Router } from 'express';
import { getAuditFiles, getAuditEntries, downloadAuditFile } from './audit.controller.js';

export const auditRouter = Router();

auditRouter.get('/files',    getAuditFiles);
auditRouter.get('/entries',  getAuditEntries);
auditRouter.get('/download', downloadAuditFile);
