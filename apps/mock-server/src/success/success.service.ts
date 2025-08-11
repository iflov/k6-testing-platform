import { Injectable } from '@nestjs/common';
import { ApiResponse } from '../common/types/response.type';

@Injectable()
export class SuccessService {
  constructor() {}

  async getSuccess(): Promise<ApiResponse> {
    return {
      statusCode: 200,
      error: false,
      message: 'get success',
      timestamp: new Date(),
    };
  }

  async postSuccess(): Promise<ApiResponse> {
    return {
      statusCode: 201,
      error: false,
      message: 'post success',
      timestamp: new Date(),
    };
  }
}
