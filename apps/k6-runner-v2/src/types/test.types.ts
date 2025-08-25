import { ChildProcess } from 'child_process';

export interface TestConfig {
  vus?: number;
  duration?: string;
  iterations?: number;
  executionMode?: string;
  targetUrl?: string;
  urlPath?: string;
  enableDashboard?: boolean;
  scenario?: string;
  httpMethod?: string;
  requestBody?: string | null;
  enableErrorSimulation?: boolean;
  errorRate?: number;
  errorTypes?: Record<string, boolean>;
  useHeaderForChaos?: boolean; // 헤더로 chaos 파라미터 전송 여부
}

export interface CurrentTest {
  testId: string;
  process: ChildProcess;
  startTime: Date;
  config: TestConfig;
  vus: number;
  duration: string;
  iterations?: number;
  executionMode: string;
  targetUrl: string;
  scenario: string;
  scriptPath?: string;
  dashboardEnabled?: boolean;
  timeoutId?: ReturnType<typeof setTimeout>;
}

export interface TestProgress {
  startTime: Date;
  currentTime: string;
  currentVUs: number;
  totalVUs: number;
  completedIterations: number;
  interruptedIterations: number;
  percentage: number;
  status: 'starting' | 'running' | 'completed' | 'stopped' | 'failed';
}

export interface TestResponse {
  testId: string;
  status: string;
  message?: string;
  dashboardUrl?: string;
  dashboardEnabled?: boolean;
  scenario?: string;
  note?: string;
}

export interface TestStatus {
  running: boolean;
  details: CurrentTest | null;
  progress: TestProgress | null;
}
