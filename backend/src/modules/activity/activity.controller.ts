import { Request, Response } from 'express';
import { activityService } from './activity.service.js';

export const getOrderActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const orderId = parseInt(req.params.orderId as string, 10);
    if (isNaN(orderId)) {
      res.status(400).json({ success: false, error: 'Invalid order ID' });
      return;
    }
    const logs = await activityService.findByOrder(orderId);
    res.json({ success: true, data: logs });
  } catch (error) {
    req.log.error({ err: error }, 'getOrderActivity failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
