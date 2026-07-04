import { Router } from 'express';
import { getOrderActivity } from './activity.controller.js';

// mergeParams: true is REQUIRED — the :orderId param lives on the parent
// mount path (/api/orders/:orderId/activity). Without mergeParams,
// req.params.orderId would be undefined inside this router.
export const activityRouter = Router({ mergeParams: true });

activityRouter.get('/', getOrderActivity);
