import { Controller, Get } from '@nestjs/common';
import { ApiResponse } from './common/types/response.type';

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  service: string;
  version: string;
  timestamp: string;
  uptime: number;
  environment?: string;
  dependencies?: Record<string, { status: string; message?: string }>;
}

@Controller()
export class AppController {
  @Get('health')
  getHealth(): HealthCheckResponse {
    return {
      status: 'healthy',
      service: 'mock-server',
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };
  }

  @Get('ready')
  getReady(): HealthCheckResponse {
    // Mock server는 외부 의존성이 없으므로 항상 ready
    return {
      status: 'healthy',
      service: 'mock-server',
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      dependencies: {
        memory: {
          status: 'healthy',
          message: 'In-memory storage active',
        },
      },
    };
  }
}
