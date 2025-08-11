export interface BaseResponse {
  statusCode: number;
  error: boolean;
  message: string;
  timestamp: Date;
}

export interface MetricsData {
  duration?: number;
  iterations?: number;
  memoryUsed?: number;
  cpuTime?: number;
}

export interface ApiResponse extends BaseResponse {
  metrics?: MetricsData;
  path?: string;
}
