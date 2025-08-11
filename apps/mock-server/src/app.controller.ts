import { Controller, Get } from '@nestjs/common';
import { ApiResponse } from './common/types/response.type';

@Controller()
export class AppController {
  @Get('health')
  getRoot(): ApiResponse {
    return {
      statusCode: 200,
      error: false,
      message: 'Mock Server is running',
      timestamp: new Date(),
    };
  }
}
