import { ConfigService } from './config.service';

describe('ConfigService', () => {
  // 원본 환경변수 백업
  const originalEnv = process.env;

  beforeEach(() => {
    // 각 테스트 전에 깨끗한 환경변수로 시작
    jest.resetModules();
    process.env = { ...originalEnv };
    // 테스트 환경으로 설정
    process.env.NODE_ENV = 'test';
    // 싱글톤 인스턴스 리셋
    ConfigService.resetInstance();
    // console.log를 mock하여 테스트 중 출력 방지
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    // 테스트 후 원래대로 복원
    process.env = originalEnv;
    jest.clearAllMocks();
    jest.restoreAllMocks();
    // 싱글톤 인스턴스 리셋
    ConfigService.resetInstance();
  });

  it('should be defined', () => {
    process.env.NODE_ENV = 'development';
    const service = ConfigService.getInstance();
    expect(service).toBeDefined();
  });

  it('should return the same instance', () => {
    process.env.NODE_ENV = 'development';
    const instance1 = ConfigService.getInstance();
    const instance2 = ConfigService.getInstance();
    expect(instance1).toBe(instance2);
  });

  describe('Development environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      // 환경변수 초기화 (기본값 사용하도록)
      delete process.env.PORT;
      delete process.env.INFLUXDB_URL;
      delete process.env.MOCK_SERVER_URL;
      delete process.env.K6_DASHBOARD_PORT;
      delete process.env.K6_DASHBOARD_HOST;
    });

    it('should set development flags correctly', () => {
      const service = ConfigService.getInstance();

      // constructor에서 설정
      expect(service.environment).toBe('development');
      expect(service.isDevelopment).toBe(true);
      expect(service.isProduction).toBe(false);
    });

    it('should use default values in initializeConfig', () => {
      const service = ConfigService.getInstance();

      // initializeConfig()에서 설정한 기본값
      expect(service.port).toBe('3002');
      expect(service.influxdbUrl).toBe('http://host.docker.internal:8086');
      expect(service.mockServerUrl).toBe('http://host.docker.internal:3001');
      expect(service.k6DashboardPort).toBe('5665');
      expect(service.k6DashboardHost).toBe('0.0.0.0');
    });

    it('should override defaults with environment variables', () => {
      process.env.PORT = '4000';
      process.env.INFLUXDB_URL = 'http://custom-influx:8086';

      const service = ConfigService.getInstance();

      expect(service.port).toBe('4000');
      expect(service.influxdbUrl).toBe('http://custom-influx:8086');
    });
  });

  describe('Production environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      // Production 필수 환경변수 설정
      process.env.PORT = '8080';
      process.env.INFLUXDB_URL = 'http://prod-influx:8086';
      process.env.MOCK_SERVER_URL = 'http://prod-mock:3001';
      process.env.K6_DASHBOARD_PORT = '5665';
      process.env.K6_DASHBOARD_HOST = '0.0.0.0';
    });

    it('should set production flags correctly', () => {
      const service = ConfigService.getInstance();

      // constructor에서 설정
      expect(service.environment).toBe('production');
      expect(service.isDevelopment).toBe(false);
      expect(service.isProduction).toBe(true);
    });

    it('should use environment variables in initializeConfig', () => {
      const service = ConfigService.getInstance();

      // initializeConfig()에서 환경변수 사용
      expect(service.port).toBe('8080');
      expect(service.influxdbUrl).toBe('http://prod-influx:8086');
      expect(service.mockServerUrl).toBe('http://prod-mock:3001');
      expect(service.k6DashboardPort).toBe('5665');
      expect(service.k6DashboardHost).toBe('0.0.0.0');
    });

    it('should throw error when required env vars are missing', () => {
      delete process.env.PORT;
      delete process.env.INFLUXDB_URL;
      delete process.env.MOCK_SERVER_URL;

      expect(() => ConfigService.getInstance()).toThrow('Missing required environment variable in production: PORT');
    });

    it('should identify missing environment variables correctly', () => {
      delete process.env.INFLUXDB_URL;

      try {
        ConfigService.getInstance();
      } catch (error) {
        expect((error as Error).message).toBe('Missing required environment variable in production: INFLUXDB_URL');
      }
    });
  });

  describe('Default environment', () => {
    it('should use development as default when NODE_ENV is not set', () => {
      delete process.env.NODE_ENV;

      const service = ConfigService.getInstance();

      expect(service.environment).toBe('development');
      expect(service.isDevelopment).toBe(true);
      expect(service.isProduction).toBe(false);
    });
  });

  describe('Method calls', () => {
    it('should call initializeConfig during construction', () => {
      process.env.NODE_ENV = 'development';
      // TypeScript에서 private 메서드를 테스트하기 위해 'any' 타입 캐스팅 사용
      const initSpy = jest.spyOn(ConfigService.prototype as any, 'initializeConfig');

      ConfigService.getInstance();

      expect(initSpy).toHaveBeenCalledTimes(1);

      initSpy.mockRestore();
    });

    it('should call logConfiguration during construction', () => {
      process.env.NODE_ENV = 'development';
      // TypeScript에서 private 메서드를 테스트하기 위해 'any' 타입 캐스팅 사용
      const logSpy = jest.spyOn(ConfigService.prototype as any, 'logConfiguration');

      ConfigService.getInstance();

      expect(logSpy).toHaveBeenCalledTimes(1);

      logSpy.mockRestore();
    });

    it('should log configuration with correct format', () => {
      // 이미 beforeEach에서 mock되어 있으므로 호출만 확인
      process.env.NODE_ENV = 'development';

      ConfigService.getInstance();

      expect(console.log).toHaveBeenCalledWith(
        '[Config] K6 Runner initialized with:',
        expect.objectContaining({
          environment: 'development',
          isDevelopment: true,
          isProduction: false,
        }),
      );
    });
  });

  describe('Configuration validation', () => {
    it('should have all required properties after initialization', () => {
      process.env.NODE_ENV = 'development';
      const service = ConfigService.getInstance();

      const requiredProps: (keyof ConfigService)[] = [
        'environment',
        'isDevelopment',
        'isProduction',
        'port',
        'influxdbUrl',
        'mockServerUrl',
        'k6DashboardPort',
        'k6DashboardHost',
      ];

      requiredProps.forEach((prop) => {
        expect(service[prop]).toBeDefined();
        expect(service[prop]).not.toBeNull();
      });
    });

    it('should validate port is a valid number string', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3002';

      const service = ConfigService.getInstance();
      const port = parseInt(service.port);

      expect(port).toBeGreaterThan(0);
      expect(port).toBeLessThanOrEqual(65535);
    });

    it('should validate URLs are valid format', () => {
      process.env.NODE_ENV = 'development';
      const service = ConfigService.getInstance();

      // URL 형식 검증
      expect(() => new URL(service.influxdbUrl)).not.toThrow();
      expect(() => new URL(service.mockServerUrl)).not.toThrow();
    });
  });

  describe('assertEnvVar', () => {
    it('should return value when env var exists', () => {
      process.env.NODE_ENV = 'development';
      process.env.TEST_VAR = 'test-value';
      const service = ConfigService.getInstance();

      expect(service.assertEnvVar('TEST_VAR')).toBe('test-value');
    });

    it('should throw when env var is missing', () => {
      process.env.NODE_ENV = 'development';
      const service = ConfigService.getInstance();

      expect(() => service.assertEnvVar('MISSING_VAR')).toThrow('Missing required environment variable in development: MISSING_VAR');
    });
  });
});
