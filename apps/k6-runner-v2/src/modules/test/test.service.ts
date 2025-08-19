import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';
import { writeFile } from 'fs/promises';

import { CONSTANTS } from '../../utils/constants';
import { CurrentTest, TestProgress, TestConfig } from '../../types/test.types';
import { ScenarioService } from '../scenarios/scenario.service';
import { ConfigService } from '../config/config.service';

export class TestService {
  private currentTest: CurrentTest | null = null;
  private testProgress: Map<string, TestProgress> = new Map();

  constructor(
    private readonly scenarioService: ScenarioService,
    private readonly configService: ConfigService
  ) {}

  async startTest(body: TestConfig) {
    if (this.currentTest != null) {
      throw new Error('Another test is already running');
    }

    const testId: string = uuidv4();
    let scriptPath: string = '';

    try {
      const {
        vus = CONSTANTS.DEFAULT_VUS,
        duration = CONSTANTS.DEFAULT_DURATION,
        iterations,
        executionMode = CONSTANTS.DEFAULT_EXECUTION_MODE,
        targetUrl,
        urlPath = '',
        enableDashboard = false,
        scenario = 'custom',
        httpMethod = CONSTANTS.DEFAULT_HTTP_METHOD,
        requestBody = null,
        enableErrorSimulation = false,
        errorRate = CONSTANTS.DEFAULT_ERROR_RATE,
        errorTypes = {},
      } = body;

      // K6 옵션 생성
      const options = this.scenarioService.getExecutorConfig({
        scenario,
        vus,
        duration,
        iterations,
        executionMode,
        testId,
        urlPath
      });

      // URL 빌드
      const baseUrl = targetUrl || this.configService.getMockServerUrl();
      const fullUrl = this.scenarioService.buildUrl(
        baseUrl,
        urlPath,
        enableErrorSimulation,
        errorRate,
        errorTypes
      );

      // K6 스크립트 생성
      const script = this.scenarioService.generateK6Script({
        fullUrl,
        httpMethod,
        requestBody: requestBody || undefined,
        urlPath,
        testId,
        scenario,
        options
      });

      // 스크립트 파일 저장
      scriptPath = `/tmp/k6-test-${testId}.js`;
      await writeFile(scriptPath, script);

      // K6 프로세스 실행
      const k6Args = ['run', '--out', `influxdb=${this.configService.getInfluxDbUrl()}`];
      const k6Process = spawn('k6', [...k6Args, scriptPath]);

      // 현재 테스트 저장
      this.currentTest = {
        process: k6Process,
        testId,
        startTime: new Date(),
        vus,
        duration,
        iterations,
        executionMode,
        targetUrl: fullUrl,
        scriptPath,
        scenario,
        dashboardEnabled: enableDashboard,
        config: body
      };

      return {
        status: 'started',
        testId,
        scenario,
        message: 'Test started successfully'
      };
    } catch (error: any) {
      throw error;
    }
  }
  async stopTest() {}
  async getStatus() {}
  async getProgress() {}
  getCurrentTest(): CurrentTest | null {
    return this.currentTest;
  }
}
