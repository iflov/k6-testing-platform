export interface BaseResponse {
  statusCode: number;
  error: boolean;
  message: string;
  timestamp: Date;
  path?: string;
}

export interface MetricsData {
  duration?: number;
  iterations?: number;
  memoryUsed?: number;
  cpuTime?: number;
}

// Success와 Error 서비스용 기본 응답
export type ApiResponse = BaseResponse;

// Performance 서비스용 메트릭 포함 응답
export interface PerformanceResponse extends BaseResponse {
  metrics?: MetricsData;
}
