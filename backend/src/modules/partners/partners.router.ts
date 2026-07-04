import { Router } from 'express';
import {
  getPartners,
  getPartner,
  createPartner,
  updatePartner,
  deletePartner,
  viesLookup,
} from './partners.controller.js';
import { requireAdmin } from '../../middleware/role.middleware.js';

export const partnersRouter = Router();

// IMPORTANT: /vies must be defined before /:id to avoid Express matching "vies" as a param
partnersRouter.get('/vies', viesLookup);
partnersRouter.get('/', getPartners);
partnersRouter.get('/:id', getPartner);
partnersRouter.post('/', createPartner);
partnersRouter.put('/:id', updatePartner);
partnersRouter.delete('/:id', requireAdmin, deletePartner);
