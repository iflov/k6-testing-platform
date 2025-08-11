import { Injectable } from '@nestjs/common';
import { PerformanceResponse } from '../common/types/response.type';

@Injectable()
export class PerformanceService {
  private concurrentCounter = 0;

  constructor() {}

  /**
   * 느린 응답 시뮬레이션 (네트워크 지연, DB 쿼리 등)
   */
  async getSlow(delayMs: number = 3000): Promise<PerformanceResponse> {
    const startTime = Date.now();

    await this.delay(delayMs);

    return {
      statusCode: 200,
      error: false,
      message: `Slow response completed after ${delayMs}ms`,
      metrics: {
        duration: Date.now() - startTime,
      },
      timestamp: new Date(),
    };
  }

  /**
   * 타임아웃 시뮬레이션 (30초 이상의 긴 작업)
   */
  async getTimeout(timeoutMs: number = 30000): Promise<PerformanceResponse> {
    const startTime = Date.now();

    // 실제로는 이 작업이 완료되기 전에 클라이언트가 타임아웃될 것
    await this.delay(timeoutMs);

    // 만약 여기까지 도달하면 타임아웃은 발생하지 않은 것
    return {
      statusCode: 504,
      error: true,
      message: `Request timeout after ${timeoutMs}ms`,
      metrics: {
        duration: Date.now() - startTime,
      },
      timestamp: new Date(),
    };
  }

  /**
   * 가변 지연 시뮬레이션 (네트워크 jitter 등)
   */
  async getVariableLatency(
    minMs: number = 100,
    maxMs: number = 3000,
  ): Promise<PerformanceResponse> {
    const actualDelay = Math.floor(Math.random() * (maxMs - minMs) + minMs);
    const startTime = Date.now();

    await this.delay(actualDelay);

    return {
      statusCode: 200,
      error: false,
      message: `Variable latency response`,
      metrics: {
        duration: Date.now() - startTime,
      },
      timestamp: new Date(),
    };
  }

  /**
   * 동시성 문제 시뮬레이션
   */
  async getConcurrencyIssue(): Promise<PerformanceResponse> {
    // startValue는 디버깅용으로 남겨둠
    const startValue = this.concurrentCounter;
    void startValue; // 의도적으로 사용하지 않음

    // 의도적으로 race condition 생성
    const temp = this.concurrentCounter;
    await this.delay(Math.random() * 100); // 랜덤 지연
    this.concurrentCounter = temp + 1;

    return {
      statusCode: 200,
      error: false,
      message: 'Concurrency test',
      metrics: {
        iterations: this.concurrentCounter,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Helper: 지연 함수
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
