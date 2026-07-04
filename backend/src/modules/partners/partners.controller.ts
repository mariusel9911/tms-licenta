import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { PartnerType } from '../../generated/client.js';
import { CreatePartnerDto, UpdatePartnerDto, FindAllPartnersDto } from './partners.dto.js';
import { partnersService } from './partners.service.js';
import { lookupVies } from './vies.service.js';

export const getPartners = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = FindAllPartnersDto.parse(req.query);
    const result = await partnersService.findAll(
      query.page,
      query.limit,
      query.search,
      query.partnerType as PartnerType | undefined,
    );
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, error: error.issues });
      return;
    }
    req.log.error({ err: error }, 'getPartners failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const getPartner = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid partner ID' });
      return;
    }
    const partner = await partnersService.findOne(id);
    res.json({ success: true, data: partner });
  } catch (error) {
    if (error instanceof Error && error.message === 'Partner not found') {
      res.status(404).json({ success: false, error: 'Partner not found' });
      return;
    }
    req.log.error({ err: error }, 'getPartner failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const createPartner = async (req: Request, res: Response): Promise<void> => {
  try {
    const dto = CreatePartnerDto.parse(req.body);
    const partner = await partnersService.create(dto);
    res.status(201).json({ success: true, data: partner });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, error: error.issues });
      return;
    }
    if (error instanceof Error && error.message === 'A partner with this fiscal code already exists') {
      res.status(409).json({ success: false, error: error.message });
      return;
    }
    req.log.error({ err: error }, 'createPartner failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const updatePartner = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid partner ID' });
      return;
    }
    const dto = UpdatePartnerDto.parse(req.body);
    const partner = await partnersService.update(id, dto);
    res.json({ success: true, data: partner });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, error: error.issues });
      return;
    }
    if (error instanceof Error && error.message === 'Partner not found') {
      res.status(404).json({ success: false, error: 'Partner not found' });
      return;
    }
    if (error instanceof Error && error.message === 'A partner with this fiscal code already exists') {
      res.status(409).json({ success: false, error: error.message });
      return;
    }
    req.log.error({ err: error }, 'updatePartner failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const deletePartner = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid partner ID' });
      return;
    }
    await partnersService.remove(id);
    res.json({ success: true, data: null });
  } catch (error) {
    if (error instanceof Error && error.message === 'Partner not found') {
      res.status(404).json({ success: false, error: 'Partner not found' });
      return;
    }
    req.log.error({ err: error }, 'deletePartner failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const viesLookup = async (req: Request, res: Response): Promise<void> => {
  try {
    const vat = req.query.vat as string;
    if (!vat) {
      res.status(400).json({ success: false, error: 'vat query parameter is required' });
      return;
    }

    const result = await lookupVies(vat);

    if (!result) {
      res.json({ success: false, error: 'VIES unavailable or VAT number not found' });
      return;
    }

    res.json({ success: true, data: result });
  } catch (error) {
    req.log.error({ err: error }, 'viesLookup failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
