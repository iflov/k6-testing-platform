/**
 * 환경변수 설정 관리 클래스
 * 개발 환경에서는 기본값 제공, 프로덕션에서는 필수 검증
 */
export class Config {
  private static instance: Config;

  // K6 Runner 관련 설정
  public readonly k6RunnerBaseUrl: string;
  public readonly k6RunnerTestStartUrl: string;
  public readonly k6RunnerTestStopUrl: string;
  public readonly k6RunnerTestStatusUrl: string;

  // Dashboard 및 Mock Server 설정
  public readonly k6DashboardUrl: string;
  public readonly mockServerUrl: string;

  // 환경 설정
  public readonly isDevelopment: boolean;
  public readonly isProduction: boolean;
  public readonly environment: string;

  private constructor() {
    this.environment = process.env.NODE_ENV || "development";
    this.isDevelopment = this.environment === "development";
    this.isProduction = this.environment === "production";

    // 설정 초기화
    if (this.isDevelopment) {
      // 개발 환경: 기본값 제공
      // control-panel(서버) -> k6-runner: Docker 네트워크 내부 통신
      // k6-runner -> mock-server: 외부 네트워크 통신 (EKS 고려)
      this.k6RunnerBaseUrl =
        process.env.K6_RUNNER_BASE_URL || "http://k6-runner:3002";
      this.mockServerUrl =
        process.env.MOCK_SERVER_URL || "http://host.docker.internal:3001";
      this.k6DashboardUrl =
        process.env.K6_DASHBOARD_URL || "http://localhost:5665";
    } else {
      // 프로덕션 환경: 필수 검증
      this.validateRequiredEnvVars();

      this.k6RunnerBaseUrl = process.env.K6_RUNNER_BASE_URL!;
      this.mockServerUrl = process.env.MOCK_SERVER_URL!;
      this.k6DashboardUrl = process.env.K6_DASHBOARD_URL!;
    }

    // 파생 URL 설정
    this.k6RunnerTestStartUrl = `${this.k6RunnerBaseUrl}/api/test/start`;
    this.k6RunnerTestStopUrl = `${this.k6RunnerBaseUrl}/api/test/stop`;
    this.k6RunnerTestStatusUrl = `${this.k6RunnerBaseUrl}/api/test/status`;

    // 설정 로깅
    this.logConfiguration();
  }

  private validateRequiredEnvVars(): void {
    const required = [
      "K6_RUNNER_BASE_URL",
      "MOCK_SERVER_URL",
      "K6_DASHBOARD_URL",
    ];

    const missing: string[] = [];

    for (const envVar of required) {
      if (!process.env[envVar]) {
        missing.push(envVar);
      }
    }

    if (missing.length > 0) {
      const errorMessage = `Missing required environment variables in ${
        this.environment
      }: ${missing.join(", ")}`;
      console.error(`[Config Error] ${errorMessage}`);
      throw new Error(errorMessage);
    }
  }

  private logConfiguration(): void {
    console.log("[Config] Initialized with:", {
      environment: this.environment,
      k6RunnerBaseUrl: this.maskUrl(this.k6RunnerBaseUrl),
      mockServerUrl: this.maskUrl(this.mockServerUrl),
      dashboardUrl: this.maskUrl(this.k6DashboardUrl),
      isDevelopment: this.isDevelopment,
      isProduction: this.isProduction,
    });
  }

  private maskUrl(url: string): string {
    if (this.isDevelopment) {
      // 개발 환경에서는 전체 URL 표시
      return url;
    }

    try {
      const u = new URL(url);
      return `${u.protocol}//*****${u.pathname}`;
    } catch {
      return "*****";
    }
  }

  /**
   * Config 싱글톤 인스턴스 반환
   */
  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  /**
   * 현재 설정 정보 반환 (디버깅용)
   */
  public getConfigInfo(): Record<string, any> {
    return {
      environment: this.environment,
      isDevelopment: this.isDevelopment,
      isProduction: this.isProduction,
      urls: {
        k6Runner: this.maskUrl(this.k6RunnerBaseUrl),
        mockServer: this.maskUrl(this.mockServerUrl),
        dashboard: this.maskUrl(this.k6DashboardUrl),
      },
    };
  }

  /**
   * 설정 검증 (헬스체크용)
   */
  public async validateConnections(): Promise<{
    k6Runner: boolean;
    mockServer: boolean;
  }> {
    const results = {
      k6Runner: false,
      mockServer: false,
    };

    try {
      // K6 Runner 연결 확인
      const k6Response = await fetch(`${this.k6RunnerBaseUrl}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      }).catch(() => null);

      results.k6Runner = k6Response?.ok || false;
    } catch (error) {
      console.error("[Config] K6 Runner health check failed:", error);
    }

    try {
      // Mock Server 연결 확인
      const mockResponse = await fetch(`${this.mockServerUrl}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      }).catch(() => null);

      results.mockServer = mockResponse?.ok || false;
    } catch (error) {
      console.error("[Config] Mock Server health check failed:", error);
    }

    return results;
  }
}

// 기본 export로 싱글톤 인스턴스 제공
export default Config.getInstance();
