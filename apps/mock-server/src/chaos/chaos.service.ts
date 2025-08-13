import { Injectable, HttpException } from '@nestjs/common';
import { ApiResponse } from '../common/types/response.type';

export interface ChaosConfig {
  enabled: boolean;
  errorRate: number; // 0-1 (0-100%)
  statusCodes: number[];
  delayMin?: number;
  delayMax?: number;
}

@Injectable()
export class ChaosService {
  private config: ChaosConfig = {
    enabled: false,
    errorRate: 0.1, // 10% default
    statusCodes: [400, 500, 503],
    delayMin: 0,
    delayMax: 0,
  };

  async maybeThrowError(
    errorRate?: number,
    statusCodes?: number[],
    body?: any,
  ): Promise<ApiResponse> {
    const rate = errorRate ?? this.config.errorRate;
    const codes = statusCodes ?? this.config.statusCodes;

    // Generate random number between 0 and 1
    const random = Math.random();

    // If random is less than error rate, throw an error
    if (random < rate) {
      const statusCode = codes[Math.floor(Math.random() * codes.length)];
      const errorMessages = {
        400: 'Bad Request - Simulated Error',
        401: 'Unauthorized - Simulated Error',
        403: 'Forbidden - Simulated Error',
        404: 'Not Found - Simulated Error',
        429: 'Too Many Requests - Simulated Error',
        500: 'Internal Server Error - Simulated Error',
        502: 'Bad Gateway - Simulated Error',
        503: 'Service Unavailable - Simulated Error',
      };

      throw new HttpException(
        {
          statusCode,
          error: true,
          message:
            errorMessages[statusCode] || `Error ${statusCode} - Simulated`,
          timestamp: new Date(),
          chaos: true, // Flag to indicate this is a simulated error
        },
        statusCode,
      );
    }

    // Apply random delay if configured
    if (this.config.delayMin || this.config.delayMax) {
      const delay =
        Math.random() *
          ((this.config.delayMax || 0) - (this.config.delayMin || 0)) +
        (this.config.delayMin || 0);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // Return success response
    return {
      statusCode: 200,
      error: false,
      message: 'Success - No chaos triggered',
      timestamp: new Date(),
      ...(body && { data: body }),
    };
  }

  getConfig(): ChaosConfig {
    return this.config;
  }

  setConfig(config: Partial<ChaosConfig>): ChaosConfig {
    this.config = { ...this.config, ...config };
    return this.config;
  }

  // Check if error should be triggered based on current config
  shouldTriggerError(): boolean {
    if (!this.config.enabled) return false;
    return Math.random() < this.config.errorRate;
  }

  // Get random error status code from config
  getRandomErrorCode(): number {
    const codes = this.config.statusCodes;
    return codes[Math.floor(Math.random() * codes.length)];
  }
}
