export class ConfigService {
  private static instance: ConfigService;

  private environment: string;
  private isDevelopment: boolean;
  private isProduction: boolean;
  private influxdbUrl!: string;
  // InfluxDB 3.x authentication only
  private influxdbToken!: string;
  private influxdbOrg!: string;
  private influxdbBucket!: string;
  private mockServerUrl!: string;
  private k6DashboardPort!: string;
  private k6DashboardHost!: string;
  private k6DashboardPeriod!: string;

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
    // Detect environment
    const isK8s = process.env.KUBERNETES_SERVICE_HOST !== undefined;
    
    if (this.isDevelopment) {
      // Dynamic URL based on environment
      this.influxdbUrl = process.env.INFLUXDB_URL || 
        (isK8s ? 'http://influxdb-service:8086' : 'http://influxdb:8086');
      // InfluxDB 3.x authentication (required)
      this.influxdbToken = process.env.INFLUXDB_TOKEN || 'dev-token-for-testing';
      this.influxdbOrg = process.env.INFLUXDB_ORG || 'k6org';
      this.influxdbBucket = process.env.INFLUXDB_BUCKET || 'k6';
      this.mockServerUrl = process.env.MOCK_SERVER_URL || 
        (isK8s ? 'http://mock-server-service:3001' : 'http://mock-server:3001');
      this.k6DashboardPort = process.env.K6_DASHBOARD_PORT || '5665';
      this.k6DashboardHost = process.env.K6_DASHBOARD_HOST || '0.0.0.0';
      this.k6DashboardPeriod = process.env.K6_DASHBOARD_PERIOD || '1s';
    } else {
      // In production, URL must be provided via environment variable
      this.influxdbUrl = this.assertEnvVar('INFLUXDB_URL');
      // InfluxDB 3.x authentication (required in production)
      this.influxdbToken = this.assertEnvVar('INFLUXDB_TOKEN');
      this.influxdbOrg = process.env.INFLUXDB_ORG || 'k6org';
      this.influxdbBucket = process.env.INFLUXDB_BUCKET || 'k6';
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
      influxDb3: {
        url: this.influxdbUrl,
        org: this.influxdbOrg,
        bucket: this.influxdbBucket,
        tokenConfigured: !!this.influxdbToken,
      },
    });
  }

  // Public getters for non-sensitive configs
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

  getInfluxDbOrg(): string {
    return this.influxdbOrg;
  }

  getInfluxDbBucket(): string {
    return this.influxdbBucket;
  }

  // Internal method to get token for InfluxDB operations
  // Not exposed publicly for security
  getInfluxDbConfig(): { token: string; org: string; bucket: string; url: string } {
    return {
      token: this.influxdbToken,
      org: this.influxdbOrg,
      bucket: this.influxdbBucket,
      url: this.influxdbUrl,
    };
  }

  // Check environment
  getIsDevelopment(): boolean {
    return this.isDevelopment;
  }

  getIsProduction(): boolean {
    return this.isProduction;
  }
}
