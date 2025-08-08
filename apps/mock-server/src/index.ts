import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health';
import { apiRouter } from './routes/api';
import { delayMiddleware } from './middleware/delay';
import { errorSimulator } from './middleware/errorSimulator';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Optional delay middleware (can be configured via env)
if (process.env.ENABLE_DELAY === 'true') {
  app.use(delayMiddleware);
}

// Optional error simulation (can be configured via env)
if (process.env.ENABLE_ERROR_SIMULATION === 'true') {
  app.use(errorSimulator);
}

// Routes
app.use('/health', healthRouter);
app.use('/api', apiRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Mock Server for K6 Testing',
    endpoints: [
      '/health - Health check',
      '/api/users - Users endpoint',
      '/api/products - Products endpoint',
      '/api/orders - Orders endpoint',
      '/api/heavy - CPU intensive endpoint',
      '/api/slow - Slow response endpoint'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Mock server running on port ${PORT}`);
  console.log(`Environment settings:`);
  console.log(`  - Delay enabled: ${process.env.ENABLE_DELAY === 'true'}`);
  console.log(`  - Error simulation: ${process.env.ENABLE_ERROR_SIMULATION === 'true'}`);
  console.log(`  - Min delay: ${process.env.MIN_DELAY || 0}ms`);
  console.log(`  - Max delay: ${process.env.MAX_DELAY || 100}ms`);
  console.log(`  - Error rate: ${process.env.ERROR_RATE || 0}%`);
});