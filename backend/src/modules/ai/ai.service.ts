import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Prisma } from '../../generated/client.js';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { loadKnowledgeBase, retrieveContext, type KnowledgeChunk } from './knowledge-loader.js';

// Load knowledge base at module init
loadKnowledgeBase();

// ── Boundary source detection ────────────────────────────────────────────────

const BOUNDARY_SOURCES = new Set(['boundaries']);

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ChatResponse {
  response: string;
}

export interface StatisticsData {
  totalOrders: number;
  ordersThisMonth: number;
  ordersThisWeek: number;
  revenueByStatus: Record<string, number>;
  monthlyRevenue: Array<{ month: string; revenue: number; profit: number }>;
  topClients: Array<{ name: string; orderCount: number }>;
  topTransporters: Array<{ name: string; orderCount: number }>;
  avgClientPrice: number;
  avgTransporterPrice: number;
}

export interface PredictionData {
  timeframe: string;
  labels: string[];
  historical: number[];
  predicted: number[];
  upperBound?: number[];
  lowerBound?: number[];
}

// ── System prompt builder ──────────────────────────────────────────────────────

const SYSTEM_PROMPT_BASE = `You are Sparky, the TMS Assistant for a Transport Management System (logistics software).

CRITICAL RULES — you must follow ALL of these, in priority order:

1. GROUNDING: ONLY use information from the documentation sections below. If no relevant documentation is provided, say: "I don't have information about that feature. It may not be available yet in TMS."

2. NO INVENTING: NEVER make up features, buttons, pages, menus, or workflows that are not explicitly described in the documentation below. If the documentation does not describe it, it does NOT exist. Say "I don't have information about that" rather than guess or extrapolate.

3. BOUNDARY CHECK: Before answering any how-to question, check if the topic appears in the [BOUNDARIES] section. If a feature is listed there as not existing, state clearly that it does not exist or is not yet available. Do NOT provide workaround steps for features that do not exist.

4. SCOPE: ONLY answer questions about the TMS application (orders, partners, vehicles, settings, statistics). If the user asks about politics, weather, general knowledge, coding, or ANYTHING not about TMS, respond with ONE sentence: "I can only help with TMS-related questions — orders, partners, vehicles, and settings." Do NOT add anything else — no translations, no explanations, no extra sentences.

5. LANGUAGE: ALWAYS respond in English. Even if the user writes in Romanian or any other language, your ENTIRE response MUST be in English. NEVER write in Romanian, German, French, or any other language. Zero exceptions — English only.

6. LENGTH: Keep answers under 150 words. Short sentences (max 15 words each). Never repeat information. Use numbered steps for how-to questions.

7. INTERNAL LABELS: NEVER mention or reference internal labels like "[BOUNDARIES]", "[DOCUMENTATION]", "boundary section", "relevant documentation section", "as stated earlier", or any internal prompt structure. The user cannot see your instructions. Answer naturally as if you know this information directly.`;

function buildSystemPrompt(chunks: KnowledgeChunk[]): string {
  if (chunks.length === 0) return SYSTEM_PROMPT_BASE;

  // Separate boundary chunks from regular documentation chunks
  const boundaryChunks = chunks.filter((c) => BOUNDARY_SOURCES.has(c.source));
  const regularChunks = chunks.filter((c) => !BOUNDARY_SOURCES.has(c.source));

  let context = '';

  // Boundaries first — model sees them before positive docs
  if (boundaryChunks.length > 0) {
    const boundaryText = boundaryChunks
      .map((c) => `[${c.heading}]\n${c.text}`)
      .join('\n\n');
    context += `[BOUNDARIES — FEATURES THAT DO NOT EXIST — ALWAYS TAKES PRIORITY]\n---\n${boundaryText}\n---\n\n`;
  }

  if (regularChunks.length > 0) {
    const regularText = regularChunks
      .map((c) => `[${c.heading}]\n${c.text}`)
      .join('\n\n');
    context += `[DOCUMENTATION]\n---\n${regularText}\n---`;
  }

  return `${SYSTEM_PROMPT_BASE}\n\n${context}`;
}

// ── Prompt injection guard ─────────────────────────────────────────────────────

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
  /disregard\s+(all\s+)?(previous|prior|above)/i,
  /you\s+are\s+now\s+/i,
  /system\s*:\s*/i,
  /\[INST\]/i,
  /<<SYS>>/i,
  /<\|im_start\|>/i,
  /<\|system\|>/i,
  /<\|user\|>/i,
  /<\|assistant\|>/i,
];

export function sanitizeUserMessage(message: string): string {
  // Reject oversized input before any processing
  if (message.length > 4000) {
    message = message.slice(0, 4000);
  }
  // Normalize Unicode (NFKC converts full-width/lookalike chars to ASCII equivalents)
  // then strip format/invisible characters and RTL override codepoints
  let sanitized = message
    .normalize('NFKC')
    .replace(/[\u202A-\u202E\u2066-\u2069\p{Cf}]/gu, '');
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[filtered]');
  }
  return sanitized.slice(0, 2000);
}

// ── Ollama chat message type ──────────────────────────────────────────────────

interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ── Ollama integration (using /api/chat for proper template handling) ─────────

async function callOllama(
  systemPrompt: string,
  userMessage: string,
  history: OllamaChatMessage[] = [],
): Promise<string> {
  const sanitized = sanitizeUserMessage(userMessage);

  const messages: OllamaChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: sanitized },
  ];

  const res = await axios.post<{ message?: { content: string } }>(
    `${env.OLLAMA_URL}/api/chat`,
    {
      model: env.OLLAMA_MODEL,
      messages,
      stream: false,
      options: {
        temperature: 0.1,
        num_predict: 250,
      },
    },
    { timeout: 120000 },
  );

  const text = res.data?.message?.content?.trim();
  if (!text) throw new Error('Empty response from Ollama');
  return text;
}

// ── Gemini fallback ────────────────────────────────────────────────────────────

async function callGemini(
  systemPrompt: string,
  userMessage: string,
  history: OllamaChatMessage[] = [],
): Promise<string> {
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: systemPrompt,
  });

  // Build Gemini chat history from prior messages
  const geminiHistory = history.map((m) => ({
    role: m.role === 'assistant' ? 'model' as const : 'user' as const,
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({ history: geminiHistory });
  const result = await chat.sendMessage(sanitizeUserMessage(userMessage));
  const text = result.response.text().trim();
  if (!text) throw new Error('Empty response from Gemini');
  return text;
}

// ── Static fallback ────────────────────────────────────────────────────────────

const STATIC_FALLBACK =
  'I\'m having trouble connecting to the AI service right now. ' +
  'Please try again in a moment, or contact your system administrator for help.';

// ── Chat ───────────────────────────────────────────────────────────────────────

export async function chat(message: string, userId: number): Promise<ChatResponse> {
  // 1. Retrieve relevant knowledge chunks
  const knowledgeChunks = retrieveContext(message, 5);

  // 2. Build system prompt (boundary chunks labeled separately from docs)
  const systemPrompt = buildSystemPrompt(knowledgeChunks);

  // 3. Fetch recent conversation history for context (last 6 messages = 3 exchanges)
  let history: OllamaChatMessage[] = [];
  try {
    const recentMessages = await prisma.aiChatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { role: true, content: true },
    });
    history = recentMessages
      .reverse()
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
  } catch {
    logger.warn('Failed to fetch chat history — proceeding without context');
  }

  // 4. Try primary → fallback → static
  //    AI_PRIMARY_PROVIDER controls which LLM is tried first.
  let responseText: string;
  let providerUsed = 'static';
  const primary = env.AI_PRIMARY_PROVIDER;

  if (primary === 'gemini') {
    // Gemini-first: try Gemini → Ollama → static
    try {
      responseText = await callGemini(systemPrompt, message, history);
      providerUsed = 'gemini';
    } catch (geminiErr) {
      logger.warn({ err: geminiErr }, 'Gemini (primary) unavailable — falling back to Ollama');
      try {
        responseText = await callOllama(systemPrompt, message, history);
        providerUsed = 'ollama';
      } catch (ollamaErr) {
        logger.warn({ err: ollamaErr }, 'Ollama fallback also failed');
        responseText = STATIC_FALLBACK;
      }
    }
  } else {
    // Ollama-first (default): try Ollama → Gemini (if configured) → static
    try {
      responseText = await callOllama(systemPrompt, message, history);
      providerUsed = 'ollama';
    } catch (ollamaErr) {
      logger.warn({ err: ollamaErr }, 'Ollama unavailable');

      if (env.AI_FALLBACK_PROVIDER === 'gemini') {
        try {
          responseText = await callGemini(systemPrompt, message, history);
          providerUsed = 'gemini';
        } catch (geminiErr) {
          logger.warn({ err: geminiErr }, 'Gemini fallback failed');
          responseText = STATIC_FALLBACK;
        }
      } else {
        responseText = STATIC_FALLBACK;
      }
    }
  }

  logger.info({ provider: providerUsed, userId }, 'Chat response generated');

  // 4. Persist messages to DB (non-critical — don't crash if DB write fails)
  try {
    await prisma.aiChatMessage.create({ data: { userId, role: 'user', content: message } });
    await prisma.aiChatMessage.create({ data: { userId, role: 'assistant', content: responseText } });

    // 5. Keep only last 10 messages per user (atomic sliding window)
    await prisma.$executeRaw`
      DELETE FROM ai_chat_messages
      WHERE "userId" = ${userId}
        AND id NOT IN (
          SELECT id FROM ai_chat_messages
          WHERE "userId" = ${userId}
          ORDER BY "createdAt" DESC
          LIMIT 10
        )
    `;
  } catch (dbErr) {
    logger.error({ err: dbErr }, 'Failed to persist chat messages');
  }

  return { response: responseText };
}

// ── Statistics ─────────────────────────────────────────────────────────────────

export async function getStatistics(): Promise<StatisticsData> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  type RevenueByStatusRow = { status: string; revenue: string };
  type MonthlyRow = { month: string; revenue: string; profit: string };
  type TopRow = { name: string; orderCount: string };
  type AvgRow = { avgClientPrice: string; avgTransporterPrice: string };

  const [
    totalOrders,
    ordersThisMonth,
    ordersThisWeek,
    revenueByStatusRaw,
    monthlyRevenueRaw,
    topClientsRaw,
    topTransportersRaw,
    avgPricesRaw,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { documentDate: { gte: startOfMonth } } }),
    prisma.order.count({ where: { documentDate: { gte: startOfWeek } } }),

    prisma.$queryRaw<RevenueByStatusRow[]>`
      SELECT status::text, COALESCE(SUM("clientPrice"), 0)::text AS revenue
      FROM orders
      GROUP BY status
    `,

    prisma.$queryRaw<MonthlyRow[]>`
      SELECT
        TO_CHAR("documentDate", 'YYYY-MM') AS month,
        COALESCE(SUM("clientPrice"), 0)::text AS revenue,
        COALESCE(
          SUM("clientPrice") - SUM(COALESCE("transporterPrice", 0)),
          0
        )::text AS profit
      FROM orders
      WHERE "documentDate" >= NOW() - INTERVAL '12 months'
      GROUP BY TO_CHAR("documentDate", 'YYYY-MM')
      ORDER BY TO_CHAR("documentDate", 'YYYY-MM') ASC
    `,

    prisma.$queryRaw<TopRow[]>`
      SELECT p.name, COUNT(o.id)::text AS "orderCount"
      FROM orders o
      JOIN partners p ON o."clientId" = p.id
      GROUP BY p.id, p.name
      ORDER BY COUNT(o.id) DESC
      LIMIT 5
    `,

    prisma.$queryRaw<TopRow[]>`
      SELECT p.name, COUNT(o.id)::text AS "orderCount"
      FROM orders o
      JOIN partners p ON o."transporterId" = p.id
      WHERE o."transporterId" IS NOT NULL
      GROUP BY p.id, p.name
      ORDER BY COUNT(o.id) DESC
      LIMIT 5
    `,

    prisma.$queryRaw<AvgRow[]>`
      SELECT
        COALESCE(AVG("clientPrice"), 0)::text AS "avgClientPrice",
        COALESCE(AVG("transporterPrice"), 0)::text AS "avgTransporterPrice"
      FROM orders
      WHERE "clientPrice" IS NOT NULL
    `,
  ]);

  const revenueByStatus: Record<string, number> = {};
  for (const row of revenueByStatusRaw) {
    revenueByStatus[row.status] = parseFloat(row.revenue);
  }

  const monthlyRevenue = monthlyRevenueRaw.map((row) => ({
    month: row.month,
    revenue: parseFloat(row.revenue),
    profit: parseFloat(row.profit),
  }));

  const topClients = topClientsRaw.map((row) => ({
    name: row.name,
    orderCount: parseInt(row.orderCount, 10),
  }));

  const topTransporters = topTransportersRaw.map((row) => ({
    name: row.name,
    orderCount: parseInt(row.orderCount, 10),
  }));

  const avgClientPrice = avgPricesRaw[0] ? parseFloat(avgPricesRaw[0].avgClientPrice) : 0;
  const avgTransporterPrice = avgPricesRaw[0] ? parseFloat(avgPricesRaw[0].avgTransporterPrice) : 0;

  return {
    totalOrders,
    ordersThisMonth,
    ordersThisWeek,
    revenueByStatus,
    monthlyRevenue,
    topClients,
    topTransporters,
    avgClientPrice,
    avgTransporterPrice,
  };
}

// ── Revenue by period (no Python needed) ──────────────────────────────────────

export interface RevenueDataPoint {
  label: string;
  revenue: number;
  profit: number;
}

export async function getRevenue(
  period: 'day' | 'week' | 'month' | 'year' | 'all',
): Promise<RevenueDataPoint[]> {
  type Row = { label: string; revenue: string; profit: string };
  let rows: Row[];

  // documentDate is stored as TIMESTAMP WITHOUT TIME ZONE containing UTC values (Prisma default).
  // To group by local Romanian date: first cast to UTC timestamptz, then convert to Bucharest local time.
  // Single AT TIME ZONE on a TIMESTAMP does local→UTC (wrong); double does UTC→local (correct).

  if (period === 'day') {
    // Last 7 days, daily — labels like "Mar 18", "Mar 19" (Bucharest local dates)
    rows = await prisma.$queryRaw<Row[]>`
      SELECT
        TO_CHAR(DATE_TRUNC('day', "documentDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Bucharest'), 'Mon DD') AS label,
        COALESCE(SUM("clientPrice"), 0)::text AS revenue,
        COALESCE(SUM("clientPrice") - SUM(COALESCE("transporterPrice", 0)), 0)::text AS profit
      FROM orders
      WHERE "documentDate" >= NOW() - INTERVAL '7 days'
        AND "clientPrice" IS NOT NULL
      GROUP BY DATE_TRUNC('day', "documentDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Bucharest')
      ORDER BY DATE_TRUNC('day', "documentDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Bucharest') ASC
    `;
  } else if (period === 'week') {
    // Last 30 days, weekly — label shows END of week (Sunday) e.g. "Mar 29" not "Mar 23"
    rows = await prisma.$queryRaw<Row[]>`
      SELECT
        TO_CHAR(
          DATE_TRUNC('week', "documentDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Bucharest') + INTERVAL '6 days',
          'Mon DD'
        ) AS label,
        COALESCE(SUM("clientPrice"), 0)::text AS revenue,
        COALESCE(SUM("clientPrice") - SUM(COALESCE("transporterPrice", 0)), 0)::text AS profit
      FROM orders
      WHERE "documentDate" >= NOW() - INTERVAL '30 days'
        AND "clientPrice" IS NOT NULL
      GROUP BY DATE_TRUNC('week', "documentDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Bucharest')
      ORDER BY DATE_TRUNC('week', "documentDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Bucharest') ASC
    `;
  } else if (period === 'year') {
    // Last 12 months, monthly — labels like "Apr 2025", "Mar 2026"
    rows = await prisma.$queryRaw<Row[]>`
      SELECT
        TO_CHAR(DATE_TRUNC('month', "documentDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Bucharest'), 'Mon YYYY') AS label,
        COALESCE(SUM("clientPrice"), 0)::text AS revenue,
        COALESCE(SUM("clientPrice") - SUM(COALESCE("transporterPrice", 0)), 0)::text AS profit
      FROM orders
      WHERE "documentDate" >= NOW() - INTERVAL '12 months'
        AND "clientPrice" IS NOT NULL
      GROUP BY DATE_TRUNC('month', "documentDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Bucharest')
      ORDER BY DATE_TRUNC('month', "documentDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Bucharest') ASC
    `;
  } else if (period === 'all') {
    // All time, quarterly — labels like "Q1 2025", "Q2 2025"
    rows = await prisma.$queryRaw<Row[]>`
      SELECT
        'Q' || EXTRACT(QUARTER FROM DATE_TRUNC('quarter', "documentDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Bucharest'))::int
          || ' ' || EXTRACT(YEAR FROM DATE_TRUNC('quarter', "documentDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Bucharest'))::int AS label,
        COALESCE(SUM("clientPrice"), 0)::text AS revenue,
        COALESCE(SUM("clientPrice") - SUM(COALESCE("transporterPrice", 0)), 0)::text AS profit
      FROM orders
      WHERE "clientPrice" IS NOT NULL
      GROUP BY DATE_TRUNC('quarter', "documentDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Bucharest')
      ORDER BY DATE_TRUNC('quarter', "documentDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Bucharest') ASC
    `;
  } else {
    // month — last 90 days, monthly — labels like "Jan 2026", "Feb 2026"
    rows = await prisma.$queryRaw<Row[]>`
      SELECT
        TO_CHAR(DATE_TRUNC('month', "documentDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Bucharest'), 'Mon YYYY') AS label,
        COALESCE(SUM("clientPrice"), 0)::text AS revenue,
        COALESCE(SUM("clientPrice") - SUM(COALESCE("transporterPrice", 0)), 0)::text AS profit
      FROM orders
      WHERE "documentDate" >= NOW() - INTERVAL '90 days'
        AND "clientPrice" IS NOT NULL
      GROUP BY DATE_TRUNC('month', "documentDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Bucharest')
      ORDER BY DATE_TRUNC('month', "documentDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Bucharest') ASC
    `;
  }

  return rows.map((r) => ({
    label: r.label,
    revenue: parseFloat(r.revenue),
    profit: parseFloat(r.profit),
  }));
}

// ── Predictions (Python only) ──────────────────────────────────────────────────

export async function getPredictions(timeframe: 'day' | 'week' | 'month', skipCache = false): Promise<PredictionData> {
  const cacheKey = `profit_${timeframe}`;

  // Get current ordersVersion
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  const currentVersion = settings?.ordersVersion ?? 0;

  // Check cache (skip when user explicitly refreshes)
  if (!skipCache) {
    const cached = await prisma.aiPredictionCache.findUnique({ where: { cacheKey } });
    if (cached && cached.ordersVersion === currentVersion) {
      const parsed = JSON.parse(cached.result) as PredictionData;
      // Only serve cache if it has real data (not an empty stub from a prior Python failure)
      if (parsed.historical.length > 0) {
        return parsed;
      }
    }
  }

  // Call Python service
  let result: PredictionData;
  try {
    type PythonResponse = Omit<PredictionData, 'upperBound' | 'lowerBound'> & {
      upper_bound?: number[];
      lower_bound?: number[];
    };
    const res = await axios.post<PythonResponse>(
      `${env.PYTHON_API_URL}/predict`,
      { timeframe },
      { timeout: 30000, headers: { 'X-API-Key': env.PYTHON_API_SECRET } },
    );
    const raw = res.data;
    result = {
      timeframe: raw.timeframe,
      labels: raw.labels,
      historical: raw.historical,
      predicted: raw.predicted,
      upperBound: raw.upper_bound,
      lowerBound: raw.lower_bound,
    };
  } catch (pythonErr) {
    // Python service unavailable — try serving stale cache as fallback
    const stale = await prisma.aiPredictionCache.findUnique({ where: { cacheKey } });
    if (stale) {
      const parsed = JSON.parse(stale.result) as PredictionData;
      // Only use cached data if it actually has content (not an empty stub from a prior failure)
      if (parsed.historical.length > 0) {
        return parsed;
      }
    }
    // No usable cache — let the controller return 500 so the frontend shows "service offline"
    throw pythonErr;
  }

  // Upsert cache
  await prisma.aiPredictionCache.upsert({
    where: { cacheKey },
    create: { cacheKey, ordersVersion: currentVersion, result: JSON.stringify(result) },
    update: { ordersVersion: currentVersion, result: JSON.stringify(result), computedAt: new Date() },
  });

  return result;
}

// ── Helper: increment ordersVersion ───────────────────────────────────────────

export async function incrementOrdersVersion(): Promise<void> {
  await prisma.appSettings.upsert({
    where: { id: 1 },
    update: { ordersVersion: { increment: 1 } },
    create: { id: 1, ordersVersion: 1 },
  });
}

// ── Vehicle Finance ────────────────────────────────────────────────────────────

export interface VehicleFinanceDataPoint {
  label: string;
  clientPrice: number;      // revenue received from the client
  transporterPrice: number; // cost paid to the transporter
  profit: number;           // clientPrice - transporterPrice
}

export async function getVehicleFinance(params: {
  startDate: string;
  endDate: string;
  vehicleIds?: string;
}): Promise<VehicleFinanceDataPoint[]> {
  const start = new Date(`${params.startDate}T00:00:00Z`);
  const end = new Date(`${params.endDate}T23:59:59Z`);

  const vehicleIds = params.vehicleIds
    ? params.vehicleIds.split(',').map(Number).filter((n) => Number.isFinite(n) && n > 0)
    : [];

  const diffDays = Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
  const bucket = diffDays <= 14 ? 'day' : diffDays <= 90 ? 'week' : 'month';
  const fmt = bucket === 'month' ? 'Mon YYYY' : 'DD Mon YYYY';

  // Use Prisma.raw() so bucket/fmt are inlined as literals (not parameters).
  // If they were parameterized, each ${bucket} occurrence gets a different $N,
  // making SELECT's DATE_TRUNC($1,col) and GROUP BY's DATE_TRUNC($4,col) look
  // like different expressions to PostgreSQL, causing grouping errors.
  const bucketSql = Prisma.raw(`'${bucket}'`);
  const fmtSql = Prisma.raw(`'${fmt}'`);

  type RawRow = { label: string; transporter_price: string; client_price: string; profit: string };

  let rows: RawRow[];

  if (vehicleIds.length > 0) {
    rows = await prisma.$queryRaw<RawRow[]>`
      SELECT
        TO_CHAR(DATE_TRUNC(${bucketSql}, o."documentDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Bucharest'), ${fmtSql}) AS label,
        COALESCE(SUM(o."transporterPrice"), 0)::text AS transporter_price,
        COALESCE(SUM(o."clientPrice"), 0)::text AS client_price,
        COALESCE(SUM(COALESCE(o."clientPrice", 0)) - SUM(COALESCE(o."transporterPrice", 0)), 0)::text AS profit
      FROM orders o
      WHERE o."documentDate" >= ${start}
        AND o."documentDate" <= ${end}
        AND o."vehicleId" = ANY(ARRAY[${Prisma.join(vehicleIds)}]::int[])
      GROUP BY DATE_TRUNC(${bucketSql}, o."documentDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Bucharest')
      ORDER BY DATE_TRUNC(${bucketSql}, o."documentDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Bucharest') ASC
    `;
  } else {
    rows = await prisma.$queryRaw<RawRow[]>`
      SELECT
        TO_CHAR(DATE_TRUNC(${bucketSql}, o."documentDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Bucharest'), ${fmtSql}) AS label,
        COALESCE(SUM(o."transporterPrice"), 0)::text AS transporter_price,
        COALESCE(SUM(o."clientPrice"), 0)::text AS client_price,
        COALESCE(SUM(COALESCE(o."clientPrice", 0)) - SUM(COALESCE(o."transporterPrice", 0)), 0)::text AS profit
      FROM orders o
      WHERE o."documentDate" >= ${start}
        AND o."documentDate" <= ${end}
      GROUP BY DATE_TRUNC(${bucketSql}, o."documentDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Bucharest')
      ORDER BY DATE_TRUNC(${bucketSql}, o."documentDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Bucharest') ASC
    `;
  }

  return rows.map((r) => ({
    label: r.label,
    transporterPrice: parseFloat(r.transporter_price),
    clientPrice: parseFloat(r.client_price),
    profit: parseFloat(r.profit),
  }));
}
