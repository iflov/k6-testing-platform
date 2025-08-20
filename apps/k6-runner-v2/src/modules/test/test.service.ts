import { v4 as uuidv4 } from 'uuid';
import { writeFile } from 'fs/promises';

import { CONSTANTS } from '../../utils/constants';
import { CurrentTest, TestConfig } from '../../types/test.types';
import { ScenarioService } from '../scenarios/scenario.service';
import { ConfigService } from '../config/config.service';
import { ProcessManagerService } from '../process-manager/process-manager.service';

export class TestService {
  private currentTest: CurrentTest | null = null;

  constructor(
    private readonly scenarioService: ScenarioService,
    private readonly configService: ConfigService,
    private readonly processManagerService: ProcessManagerService,
  ) {}

  async startTest(body: TestConfig) {
    if (this.currentTest != null) {
      throw new Error('Another test is already running');
    }

    const testId: string = uuidv4();
    let scriptPath: string = '';

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
      useHeaderForChaos = false,
    } = body;

    // K6 옵션 생성
    const options = this.scenarioService.getExecutorConfig({
      scenario,
      vus,
      duration,
      iterations,
      executionMode,
      testId,
      urlPath,
    });

    // URL 빌드
    const baseUrl = targetUrl || this.configService.getMockServerUrl();
    
    // 헤더 기반 chaos를 사용하는 경우 URL에 쿼리 파라미터를 추가하지 않음
    const fullUrl = useHeaderForChaos 
      ? (urlPath ? `${baseUrl}${urlPath}` : baseUrl)
      : this.scenarioService.buildUrl(
          baseUrl,
          urlPath,
          enableErrorSimulation,
          errorRate,
          errorTypes,
        );

    // K6 스크립트 생성
    const script = this.scenarioService.generateK6Script({
      fullUrl,
      httpMethod,
      requestBody: requestBody || undefined,
      urlPath,
      options,
      useHeaderForChaos,
      chaosHeaders: useHeaderForChaos && enableErrorSimulation ? {
        enabled: true,
        errorRate: errorRate || CONSTANTS.DEFAULT_ERROR_RATE,
        statusCodes: Object.entries(errorTypes || {})
          .filter(([, enabled]) => enabled)
          .map(([code]) => code)
          .join(',') || '400,500,503',
      } : undefined,
    });

    // 스크립트 파일 저장
    scriptPath = `/tmp/k6-test-${testId}.js`;
    await writeFile(scriptPath, script);

    // K6 프로세스 실행
    const { process: k6Process, dashboardEnabled } = await this.processManagerService.spawnProcess({
      targetUrl: fullUrl,
      scriptPath,
      enableDashboard,
      testId,
      scenario,
      httpMethod,
    });

    // 프로세스 종료 시 currentTest 정리
    k6Process.on('exit', async () => {
      if (this.currentTest?.testId === testId) {
        console.warn(`Test ${testId} process exited, clearing currentTest`);
        
        // timeout 정리
        if (this.currentTest.timeoutId) {
          clearTimeout(this.currentTest.timeoutId);
        }
        
        // 스크립트 파일 삭제
        if (this.currentTest.scriptPath) {
          try {
            const fs = await import('fs/promises');
            await fs.unlink(this.currentTest.scriptPath);
            console.warn(`Deleted script file: ${this.currentTest.scriptPath}`);
          } catch (error) {
            console.error(`Failed to delete script file: ${error}`);
          }
        }
        
        // ProcessManagerService 정리
        await this.processManagerService.cleanupTest(testId);
        
        // 대시보드 포트 해제 대기
        if (this.currentTest.dashboardEnabled) {
          console.warn('Dashboard was enabled, waiting for port release...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // currentTest 정리
        this.currentTest = null;
      }
    });

    // 현재 테스트 저장 (handleProcessOutput 호출 전에 설정)
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
      dashboardEnabled: dashboardEnabled,
      timeoutId: undefined, // 나중에 설정
      config: body,
    };

    // 프로세스 출력 처리 설정
    this.processManagerService.handleProcessOutput(k6Process, testId, this.currentTest);

    const timeoutId = this.processManagerService.setupTimeout({
      k6Process,
      testId,
      duration,
      currentTest: this.currentTest,
    });

    // timeoutId 업데이트
    this.currentTest.timeoutId = timeoutId;

    return {
      status: 'started',
      testId,
      scenario,
      message: 'Test started successfully',
    };
  }
  async stopTest() {
    if (!this.currentTest) {
      throw new Error('No test is currently running');
    }

    const { process: k6Process, testId, timeoutId } = this.currentTest;

    // Timeout 클리어
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // 프로세스 종료
    if (k6Process && !k6Process.killed) {
      console.warn(`Stopping test ${testId}`);
      k6Process.kill('SIGTERM');

      // SIGTERM이 안 되면 SIGKILL
      setTimeout(() => {
        if (!k6Process.killed) {
          console.error(`Test ${testId} not responding to SIGTERM, forcing SIGKILL`);
          k6Process.kill('SIGKILL');
        }
      }, 5000);
    }

    const stoppedTest = this.currentTest;
    this.currentTest = null;

    return {
      status: 'stopped',
      testId: stoppedTest.testId,
      message: 'Test stopped successfully',
    };
  }
  async getStatus() {
    const isRunning = this.currentTest !== null;
    const progress = this.currentTest ? this.processManagerService.getProgress(this.currentTest.testId) : null;

    return {
      running: isRunning,
      details: this.currentTest ? {
        testId: this.currentTest.testId,
        startTime: this.currentTest.startTime,
        vus: this.currentTest.vus,
        duration: this.currentTest.duration,
        iterations: this.currentTest.iterations,
        executionMode: this.currentTest.executionMode,
        targetUrl: this.currentTest.targetUrl,
        scenario: this.currentTest.scenario,
        dashboardEnabled: this.currentTest.dashboardEnabled,
      } : null,
      progress,
    };
  }
  async getProgress() {
    if (!this.currentTest) {
      return {
        running: false,
        message: 'No test is currently running',
      };
    }

    const progress = this.processManagerService.getProgress(this.currentTest.testId);

    if (!progress) {
      return {
        running: true,
        testId: this.currentTest.testId,
        message: 'Test is running but progress data not yet available',
      };
    }

    return {
      running: true,
      testId: this.currentTest.testId,
      ...progress,
    };
  }
  getCurrentTest(): CurrentTest | null {
    return this.currentTest;
  }

  getProgressById(testId: string) {
    return this.processManagerService.getProgress(testId);
  }
}
