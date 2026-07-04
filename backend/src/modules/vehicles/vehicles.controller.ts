import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { VehicleStatus } from '../../generated/client.js';
import { CreateVehicleDto, UpdateVehicleDto, FindAllVehiclesDto } from './vehicles.dto.js';
import { vehiclesService } from './vehicles.service.js';

export const getVehicles = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = FindAllVehiclesDto.parse(req.query);
    const result = await vehiclesService.findAll(
      query.page,
      query.limit,
      query.search,
      query.status as VehicleStatus | undefined,
    );
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, error: error.issues });
      return;
    }
    req.log.error({ err: error }, 'getVehicles failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const getVehicle = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid vehicle ID' });
      return;
    }
    const vehicle = await vehiclesService.findOne(id);
    res.json({ success: true, data: vehicle });
  } catch (error) {
    if (error instanceof Error && error.message === 'Vehicle not found') {
      res.status(404).json({ success: false, error: 'Vehicle not found' });
      return;
    }
    req.log.error({ err: error }, 'getVehicle failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const createVehicle = async (req: Request, res: Response): Promise<void> => {
  try {
    const dto = CreateVehicleDto.parse(req.body);
    const vehicle = await vehiclesService.create(dto);
    res.status(201).json({ success: true, data: vehicle });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, error: error.issues });
      return;
    }
    if (
      error instanceof Error &&
      (error.message === 'A vehicle with this license plate already exists' ||
        error.message === 'A vehicle with this VIN already exists')
    ) {
      res.status(409).json({ success: false, error: error.message });
      return;
    }
    req.log.error({ err: error }, 'createVehicle failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const updateVehicle = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid vehicle ID' });
      return;
    }
    const dto = UpdateVehicleDto.parse(req.body);
    const vehicle = await vehiclesService.update(id, dto);
    res.json({ success: true, data: vehicle });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, error: error.issues });
      return;
    }
    if (error instanceof Error && error.message === 'Vehicle not found') {
      res.status(404).json({ success: false, error: 'Vehicle not found' });
      return;
    }
    if (
      error instanceof Error &&
      (error.message === 'A vehicle with this license plate already exists' ||
        error.message === 'A vehicle with this VIN already exists')
    ) {
      res.status(409).json({ success: false, error: error.message });
      return;
    }
    if (error instanceof Error && error.message.startsWith('Cannot deactivate vehicle')) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    req.log.error({ err: error }, 'updateVehicle failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const deleteVehicle = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid vehicle ID' });
      return;
    }
    await vehiclesService.remove(id);
    res.json({ success: true, data: null });
  } catch (error) {
    if (error instanceof Error && error.message === 'Vehicle not found') {
      res.status(404).json({ success: false, error: 'Vehicle not found' });
      return;
    }
    if (error instanceof Error && error.message.startsWith('Cannot deactivate vehicle')) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    req.log.error({ err: error }, 'deleteVehicle failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
