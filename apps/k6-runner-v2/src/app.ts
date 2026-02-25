import express, { Request, Response } from 'express';
import cors from 'cors';

import { maskUrl } from './utils';
import testRouter from './routes/route';
import { container } from './container/container';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(express.json());
const ALLOWED_ORIGINS = [
  process.env.CONTROL_PANEL_URL || 'http://localhost:3000',
  'http://control-panel:3000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  }),
);

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  service: string;
  version: string;
  timestamp: string;
  uptime: number;
  environment?: string;
  dependencies?: Record<string, { status: string; message?: string }>;
}

app.get('/health', (_req: Request, res: Response) => {
  const response: HealthCheckResponse = {
    status: 'healthy',
    service: 'k6-runner-v2',
    version: process.env.npm_package_version || '2.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    dependencies: {
      influxdb: {
        status: process.env.INFLUXDB_URL ? 'healthy' : 'unhealthy',
        message: process.env.INFLUXDB_URL ? 'Configured' : 'Not configured',
      },
      mockServer: {
        status: process.env.MOCK_SERVER_URL ? 'healthy' : 'unhealthy',
        message: process.env.MOCK_SERVER_URL ? 'Configured' : 'Not configured',
      },
      dashboard: {
        status: process.env.K6_DASHBOARD_PORT ? 'healthy' : 'unhealthy',
        message: process.env.K6_DASHBOARD_PORT ? 'Enabled' : 'Disabled',
      },
    },
  };
  res.status(200).json(response);
});

app.get('/ready', async (_req: Request, res: Response) => {
  // 실제 의존성 확인
  let influxReady = false;
  let mockServerReady = false;

  // InfluxDB 연결 확인
  if (process.env.INFLUXDB_URL) {
    try {
      const influxResponse = await fetch(`${process.env.INFLUXDB_URL}/ping`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      influxReady = influxResponse.ok;
    } catch (error) {
      console.error('InfluxDB health check failed:', error);
    }
  }

  // Mock Server 연결 확인
  if (process.env.MOCK_SERVER_URL) {
    try {
      const mockResponse = await fetch(`${process.env.MOCK_SERVER_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      mockServerReady = mockResponse.ok;
    } catch (error) {
      console.error('Mock Server health check failed:', error);
    }
  }

  const isReady =
    (!process.env.INFLUXDB_URL || influxReady) && (!process.env.MOCK_SERVER_URL || mockServerReady);

  const response: HealthCheckResponse = {
    status: isReady ? 'healthy' : 'unhealthy',
    service: 'k6-runner-v2',
    version: process.env.npm_package_version || '2.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    dependencies: {
      influxdb: {
        status: influxReady ? 'healthy' : 'unhealthy',
        message: influxReady ? 'Connected' : 'Connection failed',
      },
      mockServer: {
        status: mockServerReady ? 'healthy' : 'unhealthy',
        message: mockServerReady ? 'Connected' : 'Connection failed',
      },
    },
  };

  const statusCode = isReady ? 200 : 503;
  res.status(statusCode).json(response);
});

app.get('/config', (_req: Request, res: Response) => {
  res.status(200).json({
    environment: process.env.NODE_ENV,
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    port: process.env.PORT,
    urls: {
      influxdb: maskUrl(process.env.INFLUXDB_URL || ''),
      mockServer: maskUrl(process.env.MOCK_SERVER_URL || ''),
      dashboard: {
        host: process.env.K6_DASHBOARD_HOST,
        port: process.env.K6_DASHBOARD_PORT,
      },
    },
  });
});

app.use('/api', testRouter);

const server = app.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`🚀 Server is running on ${PORT} port`);
});

// 그레이스풀 다운 처리
let isShuttingDown = false;

const gracefulShutdown = (signal: string) => {
  if (isShuttingDown) return;

  console.log(`\n${signal} received: starting graceful shutdown`);
  isShuttingDown = true;

  // 새로운 요청 수락 중단
  server.close(() => {
    console.log('HTTP server closed');

    // 활성 K6 프로세스 정리
    const { testService } = container;

    // 실행 중인 테스트 중단
    if (testService) {
      console.log('Stopping active K6 processes...');
      testService.stopTest();
    }

    console.log('Graceful shutdown completed');
    process.exit(0);
  });

  // 30초 후 강제 종료
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

// 종료 신호 수신 대기
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
