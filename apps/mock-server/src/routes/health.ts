import { Router } from 'express';

export const healthRouter = Router();

let requestCount = 0;
const startTime = Date.now();

healthRouter.get('/', (req, res) => {
  requestCount++;
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  
  res.json({
    status: 'healthy',
    uptime: `${uptime}s`,
    requestCount,
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
  });
});

healthRouter.get('/ready', (req, res) => {
  res.status(200).send('Ready');
});

healthRouter.get('/live', (req, res) => {
  res.status(200).send('Live');
});