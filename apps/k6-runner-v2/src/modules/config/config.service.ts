export class ConfigService {
  private static instance: ConfigService;

  // 현재 애플리케이션 환경
  private environment: string;
  private isDevelopment: boolean;
  private isProduction: boolean;
  // InfluxDB 3.x 설정
  private influxdbUrl!: string;
  private influxdbToken!: string;
  private influxdbOrg!: string;
  private influxdbBucket!: string;
  // Mock Server 설정
  private mockServerUrl!: string;
  // Control Panel 설정
  private controlPanelUrl!: string;
  // K6 Dashboard 설정
  private k6DashboardPort!: string;
  private k6DashboardHost!: string;
  // K6 Dashboard 주기
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
    // 환경 감지
    const isK8s = process.env.KUBERNETES_SERVICE_HOST !== undefined;

    if (this.isDevelopment) {
      // 환경에 따라 동적 URL 설정
      this.influxdbUrl =
        process.env.INFLUXDB_URL ||
        (isK8s ? 'http://influxdb-service:8181' : 'http://influxdb:8181');
      // InfluxDB 3.x 인증 (필수)
      this.influxdbToken = process.env.INFLUXDB_TOKEN || 'dev-token-for-testing';
      this.influxdbOrg = process.env.INFLUXDB_ORG || 'k6org';
      this.influxdbBucket = process.env.INFLUXDB_BUCKET || 'k6';
      this.mockServerUrl =
        process.env.MOCK_SERVER_URL ||
        (isK8s ? 'http://mock-server-service:3001' : 'http://mock-server:3001');
      this.controlPanelUrl =
        process.env.CONTROL_PANEL_URL ||
        (isK8s ? 'http://control-panel:3000' : 'http://control-panel:3000');
      this.k6DashboardPort = process.env.K6_DASHBOARD_PORT || '5665';
      this.k6DashboardHost = process.env.K6_DASHBOARD_HOST || '0.0.0.0';
      this.k6DashboardPeriod = process.env.K6_DASHBOARD_PERIOD || '1s';
    } else {
      this.influxdbUrl = this.assertEnvVar('INFLUXDB_URL');
      this.influxdbToken = this.assertEnvVar('INFLUXDB_TOKEN');
      this.influxdbOrg = process.env.INFLUXDB_ORG || 'k6org';
      this.influxdbBucket = process.env.INFLUXDB_BUCKET || 'k6';
      this.mockServerUrl = this.assertEnvVar('MOCK_SERVER_URL');
      this.controlPanelUrl = this.assertEnvVar('CONTROL_PANEL_URL');
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

  // 민감하지 않은 설정 가져오기
  getMockServerUrl(): string {
    return this.mockServerUrl;
  }

  getControlPanelUrl(): string {
    return this.controlPanelUrl;
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

  // InfluxDB 작업을 위한 토큰 가져오기
  // 보안상 공개하지 않음
  getInfluxDbConfig(): { token: string; org: string; bucket: string; url: string } {
    return {
      token: this.influxdbToken,
      org: this.influxdbOrg,
      bucket: this.influxdbBucket,
      url: this.influxdbUrl,
    };
  }

  // 환경 확인
  getIsDevelopment(): boolean {
    return this.isDevelopment;
  }

  getIsProduction(): boolean {
    return this.isProduction;
  }
}
