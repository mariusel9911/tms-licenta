import type { Request, Response } from 'express';
import { ChatDto, PredictionsQueryDto, RevenueQueryDto, VehicleFinanceQueryDto } from './ai.dto.js';
import * as aiService from './ai.service.js';

export async function handleChat(req: Request, res: Response): Promise<void> {
  const parsed = ChatDto.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Invalid request body' });
    return;
  }

  const userId = (req as Request & { user?: { id: number } }).user?.id;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  try {
    const result = await aiService.chat(parsed.data.message, userId);
    res.json({ success: true, data: result });
  } catch (err) {
    req.log.error({ err }, 'handleChat failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function handleGetStatistics(req: Request, res: Response): Promise<void> {
  try {
    const data = await aiService.getStatistics();
    res.json({ success: true, data });
  } catch (err) {
    req.log.error({ err }, 'handleGetStatistics failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function handleGetPredictions(req: Request, res: Response): Promise<void> {
  const parsed = PredictionsQueryDto.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Invalid timeframe. Use: day, week, or month' });
    return;
  }

  try {
    const skipCache = req.query.refresh === 'true';
    const data = await aiService.getPredictions(parsed.data.timeframe, skipCache);
    res.json({ success: true, data });
  } catch (err) {
    req.log.error({ err }, 'handleGetPredictions failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function handleGetRevenue(req: Request, res: Response): Promise<void> {
  const parsed = RevenueQueryDto.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Invalid period. Use: day, week, month, year, or all' });
    return;
  }

  try {
    const data = await aiService.getRevenue(parsed.data.period);
    res.json({ success: true, data });
  } catch (err) {
    req.log.error({ err }, 'handleGetRevenue failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function handleGetVehicleFinance(req: Request, res: Response): Promise<void> {
  const parsed = VehicleFinanceQueryDto.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'Invalid params. Requires startDate and endDate (YYYY-MM-DD). Optional: vehicleIds (comma-separated integers).',
    });
    return;
  }

  try {
    const data = await aiService.getVehicleFinance(parsed.data);
    res.json({ success: true, data });
  } catch (err) {
    req.log.error({ err }, 'handleGetVehicleFinance failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
