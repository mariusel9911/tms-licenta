import { Router } from 'express';
import { handleChat, handleGetStatistics, handleGetPredictions, handleGetRevenue, handleGetVehicleFinance } from './ai.controller.js';
import { requireChatbotEnabled, requirePredictionsEnabled } from '../../middleware/ai-toggle.middleware.js';

const router = Router();

// POST /api/ai/chat — send a message to the AI assistant
// Gated by `aiChatbotEnabled` in AppSettings. On the client mini-PC the
// Ollama container is not started, so a missing gate here would hang requests
// for ~2 minutes (axios timeout) before failing. Short-circuit to 503 instead.
router.post('/chat', requireChatbotEnabled, handleChat);

// GET /api/ai/statistics — aggregated order statistics (no AI, pure SQL)
router.get('/statistics', requirePredictionsEnabled, handleGetStatistics);

// GET /api/ai/predictions?timeframe=day|week|month — ML profit forecast (cached, Python)
router.get('/predictions', requirePredictionsEnabled, handleGetPredictions);

// GET /api/ai/revenue?period=day|week|month|year|all — revenue/profit aggregated by period (pure SQL)
router.get('/revenue', requirePredictionsEnabled, handleGetRevenue);

// GET /api/ai/vehicle-finance?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&vehicleIds=1,2,3 — per-vehicle finance (pure SQL)
router.get('/vehicle-finance', requirePredictionsEnabled, handleGetVehicleFinance);

export default router;
