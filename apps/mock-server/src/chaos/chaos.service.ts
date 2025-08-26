import { Injectable, HttpException, OnModuleDestroy } from '@nestjs/common';
import { ApiResponse } from '../common/types/response.type';

export interface ChaosConfig {
  enabled: boolean;
  errorRate: number; // 0-1 (0-100%)
  statusCodes: number[];
  delayMin?: number;
  delayMax?: number;
}

@Injectable()
export class ChaosService implements OnModuleDestroy {
  private config: ChaosConfig = {
    enabled: false,
    errorRate: 0.1, // 10% 기본값
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

    // 0과 1 사이의 랜덤 숫자 생성
    const random = Math.random();

    // 랜덤 숫자가 에러 비율보다 작으면 에러 발생
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
          chaos: true, // 시뮬레이션된 에러 표시
        },
        statusCode,
      );
    }

    // 설정된 랜덤 지연 적용
    if (this.config.delayMin || this.config.delayMax) {
      const delay =
        Math.random() *
          ((this.config.delayMax || 0) - (this.config.delayMin || 0)) +
        (this.config.delayMin || 0);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // 성공 응답 반환
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

  // 현재 설정에 따라 에러 발생 여부 확인
  shouldTriggerError(): boolean {
    if (!this.config.enabled) return false;
    return Math.random() < this.config.errorRate;
  }

  // 설정에서 랜덤 에러 상태 코드 가져오기
  getRandomErrorCode(): number {
    const codes = this.config.statusCodes;
    return codes[Math.floor(Math.random() * codes.length)];
  }

  async onModuleDestroy() {
    console.log('ChaosService destroyed');
  }

  crashApplication(delay: number = 0): void {
    console.log(`⏱️ Shutdown scheduled in ${delay}ms`);
    console.log(`📍 Current time: ${new Date().toISOString()}`);

    setTimeout(() => {
      console.log('💥 Crashing application NOW!');
      console.log(`📍 Shutdown time: ${new Date().toISOString()}`);
      console.log(`🔴 Process PID: ${process.pid}`);

      // 강제 종료
      process.exit(1);
    }, delay);

    console.log('✅ Shutdown timer set successfully');
  }
}
