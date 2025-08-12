/**
 * 환경변수 설정 관리 클래스
 * 개발 환경에서는 기본값 제공, 프로덕션에서는 필수 검증
 */
class Config {
  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.isDevelopment = this.environment === 'development';
    this.isProduction = this.environment === 'production';
    
    // 설정 초기화
    this.initializeConfig();
    
    // 설정 로깅
    this.logConfiguration();
  }
  
  initializeConfig() {
    if (this.isDevelopment) {
      // 개발 환경: 기본값 제공
      // EKS를 고려한 외부 네트워크 통신 설정
      this.port = process.env.PORT || '3002';
      this.influxdbUrl = process.env.INFLUXDB_URL || 'http://host.docker.internal:8086';
      this.mockServerUrl = process.env.MOCK_SERVER_URL || 'http://host.docker.internal:3001';
      this.k6DashboardPort = process.env.K6_DASHBOARD_PORT || '5665';
      this.k6DashboardHost = process.env.K6_DASHBOARD_HOST || '0.0.0.0';
    } else {
      // 프로덕션 환경: 필수 검증
      this.validateRequiredEnvVars();
      
      this.port = process.env.PORT;
      this.influxdbUrl = process.env.INFLUXDB_URL;
      this.mockServerUrl = process.env.MOCK_SERVER_URL;
      this.k6DashboardPort = process.env.K6_DASHBOARD_PORT;
      this.k6DashboardHost = process.env.K6_DASHBOARD_HOST;
    }
    
    // 파생 설정
    this.influxdbK6Url = `${this.influxdbUrl}/k6`;
  }
  
  validateRequiredEnvVars() {
    const required = [
      'PORT',
      'INFLUXDB_URL',
      'MOCK_SERVER_URL'
    ];
    
    const missing = [];
    
    for (const envVar of required) {
      if (!process.env[envVar]) {
        missing.push(envVar);
      }
    }
    
    if (missing.length > 0) {
      const errorMessage = `Missing required environment variables in ${this.environment}: ${missing.join(', ')}`;
      console.error(`[Config Error] ${errorMessage}`);
      throw new Error(errorMessage);
    }
  }
  
  logConfiguration() {
    console.log('[Config] K6 Runner initialized with:', {
      environment: this.environment,
      port: this.port,
      influxdbUrl: this.maskUrl(this.influxdbUrl),
      mockServerUrl: this.maskUrl(this.mockServerUrl),
      dashboardPort: this.k6DashboardPort,
      isDevelopment: this.isDevelopment,
      isProduction: this.isProduction
    });
  }
  
  maskUrl(url) {
    if (this.isDevelopment) {
      // 개발 환경에서는 전체 URL 표시
      return url;
    }
    
    try {
      const u = new URL(url);
      return `${u.protocol}//*****${u.pathname}`;
    } catch {
      return '*****';
    }
  }
  
  /**
   * 현재 설정 정보 반환 (디버깅용)
   */
  getConfigInfo() {
    return {
      environment: this.environment,
      isDevelopment: this.isDevelopment,
      isProduction: this.isProduction,
      port: this.port,
      urls: {
        influxdb: this.maskUrl(this.influxdbUrl),
        mockServer: this.maskUrl(this.mockServerUrl)
      },
      dashboard: {
        host: this.k6DashboardHost,
        port: this.k6DashboardPort
      }
    };
  }
  
  /**
   * 헬스체크용 응답
   */
  getHealthInfo() {
    return {
      status: 'healthy',
      environment: this.environment,
      uptime: process.uptime(),
      config: {
        influxdbConfigured: !!this.influxdbUrl,
        mockServerConfigured: !!this.mockServerUrl,
        dashboardEnabled: !!this.k6DashboardPort
      }
    };
  }
}

// 싱글톤 인스턴스 생성 및 export
const config = new Config();
module.exports = config;