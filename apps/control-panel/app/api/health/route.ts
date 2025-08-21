import { NextResponse } from 'next/server';

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  service: string;
  version: string;
  timestamp: string;
  uptime: number;
  environment?: string;
  dependencies?: Record<string, { status: string; message?: string }>;
}

export async function GET() {
  const response: HealthCheckResponse = {
    status: 'healthy',
    service: 'control-panel',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    dependencies: {
      database: {
        status: process.env.DATABASE_URL ? 'healthy' : 'unhealthy',
        message: process.env.DATABASE_URL ? 'Configured' : 'Not configured',
      },
      k6Runner: {
        status: process.env.K6_RUNNER_BASE_URL ? 'healthy' : 'unhealthy',
        message: process.env.K6_RUNNER_BASE_URL ? 'Configured' : 'Not configured',
      },
      mockServer: {
        status: process.env.MOCK_SERVER_URL ? 'healthy' : 'unhealthy',
        message: process.env.MOCK_SERVER_URL ? 'Configured' : 'Not configured',
      },
    },
  };

  return NextResponse.json(response);
}