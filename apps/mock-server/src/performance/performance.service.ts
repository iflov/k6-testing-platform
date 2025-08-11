import { Injectable } from '@nestjs/common';
import { ApiResponse } from '../common/types/response.type';

@Injectable()
export class PerformanceService {
  private memoryLeakArray: any[] = [];
  private concurrentCounter = 0;

  constructor() {}

  /**
   * 느린 응답 시뮬레이션 (네트워크 지연, DB 쿼리 등)
   */
  async getSlow(delayMs: number = 3000): Promise<ApiResponse> {
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
  async getTimeout(timeoutMs: number = 30000): Promise<ApiResponse> {
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
   * CPU 집약적 작업 시뮬레이션
   */
  async getHeavy(complexity: number = 1000000): Promise<ApiResponse> {
    const startTime = Date.now();
    const initialMemory = process.memoryUsage().heapUsed;

    // CPU 집약적 연산
    let result = 0;
    for (let i = 0; i < complexity; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
      // 가끔 가비지 생성으로 메모리 압박도 시뮬레이션
      if (i % 10000 === 0) {
        // 의도적으로 메모리 할당 후 사용하지 않음 (메모리 압박 시뮬레이션)
        const temp = new Array(100).fill(Math.random());
        void temp; // 의도적으로 사용하지 않음
      }
    }
    // result 변수는 CPU 연산 시뮬레이션용으로 의도적으로 사용하지 않음

    void result;

    const endTime = Date.now();
    const finalMemory = process.memoryUsage().heapUsed;

    return {
      statusCode: 200,
      error: false,
      message: 'Heavy computation completed',
      metrics: {
        duration: endTime - startTime,
        iterations: complexity,
        memoryUsed: Math.round((finalMemory - initialMemory) / 1024 / 1024), // MB
        cpuTime: endTime - startTime,
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
  ): Promise<ApiResponse> {
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
   * 메모리 누수 시뮬레이션
   */
  async getMemoryLeak(sizeKb: number = 1000): Promise<ApiResponse> {
    const startMemory = process.memoryUsage().heapUsed;

    // 메모리 누수 시뮬레이션 - 매번 데이터를 추가하고 해제하지 않음
    const leakData = new Array(sizeKb * 1024).fill('x').join('');
    this.memoryLeakArray.push({
      data: leakData,
      timestamp: new Date(),
    });

    const currentMemory = process.memoryUsage().heapUsed;

    return {
      statusCode: 200,
      error: false,
      message: 'Memory leak simulation',
      metrics: {
        memoryUsed: Math.round((currentMemory - startMemory) / 1024 / 1024), // MB
        iterations: this.memoryLeakArray.length,
      },
      timestamp: new Date(),
    };
  }

  /**
   * 동시성 문제 시뮬레이션
   */
  async getConcurrencyIssue(): Promise<ApiResponse> {
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

  /**
   * 메모리 정리 (테스트용)
   */
  clearMemoryLeak(): void {
    this.memoryLeakArray = [];
    if (global.gc) {
      global.gc(); // 강제 가비지 컬렉션 (--expose-gc 플래그 필요)
    }
  }
}
