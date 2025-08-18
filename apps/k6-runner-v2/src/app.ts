import express, { Request, Response } from 'express';
import cors from 'cors';

import { maskUrl } from './utils/maskURL';
import testRouter from './routes/route';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(express.json());
app.use(
  cors({
    origin: '*', // Control Panel에서 접근
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  }),
);

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
    config: {
      influxdbConfigured: !!process.env.INFLUXDB_URL,
      mockServerConfigured: !!process.env.MOCK_SERVER_URL,
      dashboardEnabled: !!process.env.K6_DASHBOARD_PORT,
    },
  });
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

app.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`🚀 Server is running on ${PORT} port`);
});
