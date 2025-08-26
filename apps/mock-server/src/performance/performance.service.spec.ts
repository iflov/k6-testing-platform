import { Test, TestingModule } from '@nestjs/testing';
import { PerformanceService } from './performance.service';

describe('PerformanceService', () => {
  let service: PerformanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PerformanceService],
    }).compile();

    service = module.get<PerformanceService>(PerformanceService);
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSlow', () => {
    it('should delay for default time (3000ms)', async () => {
      jest.useFakeTimers();

      const promise = service.getSlow();

      // 시간을 3초 앞으로
      jest.advanceTimersByTime(3000);

      const result = await promise;

      expect(result.error).toBe(false);
      expect(result.statusCode).toBe(200);
      expect(result.message).toContain('3000ms');
      expect(result.timestamp).toBeDefined();
    });

    it('should delay for specified time', async () => {
      jest.useFakeTimers();

      const promise = service.getSlow(1000);

      jest.advanceTimersByTime(1000);

      const result = await promise;

      expect(result.message).toContain('1000ms');
      expect(result.metrics.duration).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('getTimeout', () => {
    it('should handle timeout scenario', async () => {
      jest.useFakeTimers();

      // 테스트를 위해 짧은 타임아웃 사용
      const promise = service.getTimeout(100);

      jest.advanceTimersByTime(100);

      const result = await promise;

      expect(result.statusCode).toBe(504);
      expect(result.error).toBe(true);
      expect(result.message).toContain('timeout');
      expect(result.timestamp).toBeDefined();
    });

    it('should use default timeout of 30000ms', async () => {
      jest.useFakeTimers();

      const promise = service.getTimeout();

      jest.advanceTimersByTime(30000);

      const result = await promise;

      expect(result.message).toContain('30000ms');
    });
  });

  describe('getVariableLatency', () => {
    it('should produce delays within default range', async () => {
      jest.useFakeTimers();

      const promise = service.getVariableLatency();
      jest.runAllTimers();

      const result = await promise;

      expect(result.statusCode).toBe(200);
      expect(result.error).toBe(false);
      expect(result.message).toBe('Variable latency response');
      expect(result.metrics.duration).toBeDefined();
    });

    it('should respect custom min and max delays', async () => {
      jest.useFakeTimers();

      const results = [];
      for (let i = 0; i < 5; i++) {
        const promise = service.getVariableLatency(100, 200);
        jest.runAllTimers();
        results.push(await promise);
      }

      // 모든 지연 시간이 범위 내에 있어야 함 (타이머 정밀도 고려)
      results.forEach((result) => {
        expect(result.metrics.duration).toBeGreaterThanOrEqual(100);
        expect(result.metrics.duration).toBeLessThanOrEqual(200);
      });
    });
  });

  describe('getConcurrencyIssue', () => {
    it('should demonstrate race condition', async () => {
      jest.useFakeTimers();

      // 동시에 여러 요청 실행 (race condition 테스트)
      const promises = Array(5)
        .fill(null)
        .map(() => {
          const promise = service.getConcurrencyIssue();
          jest.runAllTimers();
          return promise;
        });

      const results = await Promise.all(promises);

      // 마지막 요청의 반복 횟수가 증가해야 함
      const lastResult = results[results.length - 1];
      expect(lastResult.metrics.iterations).toBeGreaterThan(0);
      expect(lastResult.statusCode).toBe(200);
      expect(lastResult.error).toBe(false);
    });

    it('should increment iterations on each call', async () => {
      jest.useFakeTimers();

      const first = service.getConcurrencyIssue();
      jest.runAllTimers();
      const firstResult = await first;

      const second = service.getConcurrencyIssue();
      jest.runAllTimers();
      const secondResult = await second;

      expect(secondResult.metrics.iterations).toBeGreaterThan(
        firstResult.metrics.iterations,
      );
    });
  });
});
