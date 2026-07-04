import { Router } from 'express';
import {
  getVehicles,
  getVehicle,
  createVehicle,
  updateVehicle,
  deleteVehicle,
} from './vehicles.controller.js';
import { requireAdmin } from '../../middleware/role.middleware.js';

export const vehiclesRouter = Router();

vehiclesRouter.get('/', getVehicles);
vehiclesRouter.get('/:id', getVehicle);
vehiclesRouter.post('/', createVehicle);
vehiclesRouter.put('/:id', updateVehicle);
vehiclesRouter.delete('/:id', requireAdmin, deleteVehicle);
