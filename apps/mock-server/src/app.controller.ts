import { Controller, Get } from '@nestjs/common';
import { ApiResponse } from './common/types/response.type';

@Controller()
export class AppController {
  @Get()
  getRoot(): ApiResponse {
    return {
      statusCode: 200,
      error: false,
      message: 'Mock Server is running',
      timestamp: new Date(),
    };
  }

  @Get('health')
  getHealth(): { status: string; service: string; timestamp: Date } {
    return {
      status: 'healthy',
      service: 'mock-server',
      timestamp: new Date(),
    };
  }
}
