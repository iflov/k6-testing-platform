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
      delete process.env.INFLUXDB_TOKEN;
      delete process.env.INFLUXDB_ORG;
      delete process.env.INFLUXDB_BUCKET;
      delete process.env.MOCK_SERVER_URL;
      delete process.env.K6_DASHBOARD_PORT;
      delete process.env.K6_DASHBOARD_HOST;
      delete process.env.K6_DASHBOARD_PERIOD;
    });

    it('should use default values in development', () => {
      const service = ConfigService.getInstance();
      expect(service.getInfluxDbUrl()).toContain('influxdb:8181');
      expect(service.getMockServerUrl()).toContain('mock-server:3001');
      expect(service.getK6DashboardPort()).toBe('5665');
      expect(service.getK6DashboardHost()).toBe('0.0.0.0');
      expect(service.getK6DashboardPeriod()).toBe('1s');
      expect(service.getInfluxDbOrg()).toBe('k6org');
      expect(service.getInfluxDbBucket()).toBe('k6');
    });

    it('should use custom values from environment variables', () => {
      process.env.PORT = '4000';
      process.env.INFLUXDB_URL = 'http://custom-influx:8181';
      process.env.INFLUXDB_TOKEN = 'custom-token';
      process.env.INFLUXDB_ORG = 'custom-org';
      process.env.INFLUXDB_BUCKET = 'custom-bucket';
      process.env.MOCK_SERVER_URL = 'http://custom-mock:3001';
      process.env.K6_DASHBOARD_PORT = '6000';
      process.env.K6_DASHBOARD_HOST = '127.0.0.1';
      process.env.K6_DASHBOARD_PERIOD = '5s';

      const service = ConfigService.getInstance();
      expect(service.getInfluxDbUrl()).toBe('http://custom-influx:8181');
      expect(service.getInfluxDbOrg()).toBe('custom-org');
      expect(service.getInfluxDbBucket()).toBe('custom-bucket');
      expect(service.getMockServerUrl()).toBe('http://custom-mock:3001');
      expect(service.getK6DashboardPort()).toBe('6000');
      expect(service.getK6DashboardHost()).toBe('127.0.0.1');
      expect(service.getK6DashboardPeriod()).toBe('5s');
    });

    it('should detect Kubernetes environment', () => {
      process.env.KUBERNETES_SERVICE_HOST = 'kubernetes.default';
      const service = ConfigService.getInstance();
      expect(service.getInfluxDbUrl()).toContain('influxdb-service:8181');
      expect(service.getMockServerUrl()).toContain('mock-server-service:3001');
    });
  });

  describe('Production environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should throw error when required environment variables are missing', () => {
      // 필수 환경변수 제거
      delete process.env.PORT;
      delete process.env.INFLUXDB_URL;
      delete process.env.INFLUXDB_TOKEN;
      delete process.env.MOCK_SERVER_URL;
      delete process.env.K6_DASHBOARD_PORT;
      delete process.env.K6_DASHBOARD_HOST;
      delete process.env.K6_DASHBOARD_PERIOD;

      expect(() => ConfigService.getInstance()).toThrow();
    });

    it('should use provided environment variables in production', () => {
      process.env.PORT = '5000';
      process.env.INFLUXDB_URL = 'https://prod-influx.example.com';
      process.env.INFLUXDB_TOKEN = 'prod-token';
      process.env.INFLUXDB_ORG = 'prod-org';
      process.env.INFLUXDB_BUCKET = 'prod-bucket';
      process.env.MOCK_SERVER_URL = 'https://prod-mock.example.com';
      process.env.K6_DASHBOARD_PORT = '7000';
      process.env.K6_DASHBOARD_HOST = '0.0.0.0';
      process.env.K6_DASHBOARD_PERIOD = '10s';

      const service = ConfigService.getInstance();
      expect(service.getInfluxDbUrl()).toBe('https://prod-influx.example.com');
      expect(service.getInfluxDbOrg()).toBe('prod-org');
      expect(service.getInfluxDbBucket()).toBe('prod-bucket');
      expect(service.getMockServerUrl()).toBe('https://prod-mock.example.com');
      expect(service.getK6DashboardPort()).toBe('7000');
      expect(service.getK6DashboardHost()).toBe('0.0.0.0');
      expect(service.getK6DashboardPeriod()).toBe('10s');
    });
  });

  describe('InfluxDB 3.x configuration', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should return InfluxDB 3.x configuration', () => {
      process.env.INFLUXDB_TOKEN = 'test-token';
      process.env.INFLUXDB_ORG = 'test-org';
      process.env.INFLUXDB_BUCKET = 'test-bucket';
      process.env.INFLUXDB_URL = 'http://test-influx:8181';

      const service = ConfigService.getInstance();
      const config = service.getInfluxDbConfig();

      expect(config).toHaveProperty('token', 'test-token');
      expect(config).toHaveProperty('org', 'test-org');
      expect(config).toHaveProperty('bucket', 'test-bucket');
      expect(config).toHaveProperty('url', 'http://test-influx:8181');
    });

    it('should use default values for InfluxDB 3.x configuration', () => {
      delete process.env.INFLUXDB_TOKEN;
      delete process.env.INFLUXDB_ORG;
      delete process.env.INFLUXDB_BUCKET;
      delete process.env.INFLUXDB_URL;

      const service = ConfigService.getInstance();
      const config = service.getInfluxDbConfig();

      expect(config).toHaveProperty('token', 'dev-token-for-testing');
      expect(config).toHaveProperty('org', 'k6org');
      expect(config).toHaveProperty('bucket', 'k6');
      expect(config.url).toContain('influxdb:8181');
    });
  });

  describe('Environment detection', () => {
    it('should correctly identify development environment', () => {
      process.env.NODE_ENV = 'development';
      const service = ConfigService.getInstance();
      expect(service.getIsDevelopment()).toBe(true);
      expect(service.getIsProduction()).toBe(false);
    });

    it('should correctly identify production environment', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '5000';
      process.env.INFLUXDB_URL = 'https://prod-influx.example.com';
      process.env.INFLUXDB_TOKEN = 'prod-token';
      process.env.MOCK_SERVER_URL = 'https://prod-mock.example.com';
      process.env.K6_DASHBOARD_PORT = '7000';
      process.env.K6_DASHBOARD_HOST = '0.0.0.0';
      process.env.K6_DASHBOARD_PERIOD = '10s';

      const service = ConfigService.getInstance();
      expect(service.getIsDevelopment()).toBe(false);
      expect(service.getIsProduction()).toBe(true);
    });
  });
});
