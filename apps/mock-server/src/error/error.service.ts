import { Injectable } from '@nestjs/common';
import { ApiResponse } from '../common/types/response.type';

@Injectable()
export class ErrorService {
  constructor() {}

  async getBadRequest(): Promise<ApiResponse> {
    return {
      statusCode: 400,
      error: true,
      message: 'Bad Request',
      timestamp: new Date(),
    };
  }

  async getUnauthorized(): Promise<ApiResponse> {
    return {
      statusCode: 401,
      error: true,
      message: 'Unauthorized',
      timestamp: new Date(),
    };
  }

  async getNotFound(): Promise<ApiResponse> {
    return {
      statusCode: 404,
      error: true,
      message: 'Not Found',
      timestamp: new Date(),
    };
  }

  async getForbidden(): Promise<ApiResponse> {
    return {
      statusCode: 403,
      error: true,
      message: 'Forbidden',
      timestamp: new Date(),
    };
  }

  async getConflict(): Promise<ApiResponse> {
    return {
      statusCode: 409,
      error: true,
      message: 'Conflict',
      timestamp: new Date(),
    };
  }

  async getInternalServerError(): Promise<ApiResponse> {
    return {
      statusCode: 500,
      error: true,
      message: 'Internal Server Error',
      timestamp: new Date(),
    };
  }

  /**
   * Random error generator for testing error handling
   */
  async getRandomError(): Promise<ApiResponse> {
    const errors = [
      this.getBadRequest(),
      this.getUnauthorized(),
      this.getNotFound(),
      this.getForbidden(),
      this.getConflict(),
      this.getInternalServerError(),
    ];

    const randomIndex = Math.floor(Math.random() * errors.length);
    return errors[randomIndex];
  }

  /**
   * Custom error generator
   */
  async getCustomError(
    statusCode: number,
    message: string,
  ): Promise<ApiResponse> {
    return {
      statusCode,
      error: true,
      message,
      timestamp: new Date(),
    };
  }
}
