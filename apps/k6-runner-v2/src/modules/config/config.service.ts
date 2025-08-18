export class ConfigService {
  private static instance: ConfigService;

  environment: string;
  isDevelopment: boolean;
  isProduction: boolean;
  port!: string;
  influxdbUrl!: string;
  mockServerUrl!: string;
  k6DashboardPort!: string;
  k6DashboardHost!: string;

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  // 테스트를 위한 인스턴스 리셋 메서드
  static resetInstance(): void {
    ConfigService.instance = undefined as unknown as ConfigService;
  }

  private constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.isDevelopment = this.environment === 'development';
    this.isProduction = this.environment === 'production';

    this.initializeConfig();
    this.logConfiguration();
  }

  public assertEnvVar(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Missing required environment variable in ${this.environment}: ${key}`);
    }
    return value;
  }

  private initializeConfig() {
    if (this.isDevelopment) {
      this.port = process.env.PORT || '3002';
      this.influxdbUrl = process.env.INFLUXDB_URL || 'http://host.docker.internal:8086';
      this.mockServerUrl = process.env.MOCK_SERVER_URL || 'http://host.docker.internal:3001';
      this.k6DashboardPort = process.env.K6_DASHBOARD_PORT || '5665';
      this.k6DashboardHost = process.env.K6_DASHBOARD_HOST || '0.0.0.0';
    } else {
      this.port = this.assertEnvVar('PORT');
      this.influxdbUrl = this.assertEnvVar('INFLUXDB_URL');
      this.mockServerUrl = this.assertEnvVar('MOCK_SERVER_URL');
      this.k6DashboardPort = this.assertEnvVar('K6_DASHBOARD_PORT');
      this.k6DashboardHost = this.assertEnvVar('K6_DASHBOARD_HOST');
    }
  }

  private logConfiguration() {
    // eslint-disable-next-line no-console
    console.log(`[Config] K6 Runner initialized with:`, {
      environment: this.environment,
      isDevelopment: this.isDevelopment,
      isProduction: this.isProduction,
    });
  }
}
