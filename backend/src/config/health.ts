import axios from 'axios';
import { prisma } from './database.js';
import { env } from './env.js';

type ServiceStatus = 'ok' | 'unreachable';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, ServiceStatus>;
  uptime: number;
}

export async function checkHealth(): Promise<{ httpStatus: number; body: HealthCheckResult }> {
  const [dbResult, ollamaResult, pythonResult] = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    axios.get(`${env.OLLAMA_URL}/api/tags`, { timeout: 3000 }),
    axios.get(`${env.PYTHON_API_URL}/health`, { timeout: 3000 }),
  ]);

  const services: Record<string, ServiceStatus> = {
    database: dbResult.status === 'fulfilled' ? 'ok' : 'unreachable',
    ollama: ollamaResult.status === 'fulfilled' ? 'ok' : 'unreachable',
    pythonApi: pythonResult.status === 'fulfilled' ? 'ok' : 'unreachable',
  };

  const dbHealthy = services.database === 'ok';
  const allHealthy = Object.values(services).every((s) => s === 'ok');

  return {
    httpStatus: dbHealthy ? 200 : 503,
    body: {
      status: allHealthy ? 'healthy' : dbHealthy ? 'degraded' : 'unhealthy',
      services,
      uptime: Math.round(process.uptime()),
    },
  };
}
