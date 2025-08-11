import { Injectable } from '@nestjs/common';
import { ApiResponse } from '../common/types/response.type';

@Injectable()
export class SuccessService {
  constructor() {}

  async getSuccess(): Promise<ApiResponse> {
    return {
      statusCode: 200,
      error: false,
      message: 'ok',
      timestamp: new Date(),
    };
  }
}
