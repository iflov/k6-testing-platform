export class ConfigService {
  private static instance: ConfigService;

  environment: string;
  isDevelopment: boolean;
  isProduction: boolean;
  port!: string;
  influxdbUrl!: string;
  influxdbUsername?: string;
  influxdbPassword?: string;
  mockServerUrl!: string;
  k6DashboardPort!: string;
  k6DashboardHost!: string;
  k6DashboardPeriod!: string;

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
      this.influxdbUsername = process.env.INFLUXDB_USERNAME;
      this.influxdbPassword = process.env.INFLUXDB_PASSWORD;
      this.mockServerUrl = process.env.MOCK_SERVER_URL || 'http://host.docker.internal:3001';
      this.k6DashboardPort = process.env.K6_DASHBOARD_PORT || '5665';
      this.k6DashboardHost = process.env.K6_DASHBOARD_HOST || '0.0.0.0';
      this.k6DashboardPeriod = process.env.K6_DASHBOARD_PERIOD || '1s';
    } else {
      this.port = this.assertEnvVar('PORT');
      this.influxdbUrl = this.assertEnvVar('INFLUXDB_URL');
      // InfluxDB 인증은 선택사항 (프로덕션에서도)
      this.influxdbUsername = process.env.INFLUXDB_USERNAME;
      this.influxdbPassword = process.env.INFLUXDB_PASSWORD;
      this.mockServerUrl = this.assertEnvVar('MOCK_SERVER_URL');
      this.k6DashboardPort = this.assertEnvVar('K6_DASHBOARD_PORT');
      this.k6DashboardHost = this.assertEnvVar('K6_DASHBOARD_HOST');
      this.k6DashboardPeriod = this.assertEnvVar('K6_DASHBOARD_PERIOD');
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

  // Getter methods
  getMockServerUrl(): string {
    return this.mockServerUrl;
  }

  getInfluxDbUrl(): string {
    return this.influxdbUrl;
  }

  getK6DashboardHost(): string {
    return this.k6DashboardHost;
  }

  getK6DashboardPort(): string {
    return this.k6DashboardPort;
  }

  getK6DashboardPeriod(): string {
    return this.k6DashboardPeriod;
  }

  getInfluxDbUsername(): string | undefined {
    return this.influxdbUsername;
  }

  getInfluxDbPassword(): string | undefined {
    return this.influxdbPassword;
  }
}
