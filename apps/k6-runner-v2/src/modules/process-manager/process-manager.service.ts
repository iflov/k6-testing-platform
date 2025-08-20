import { ChildProcess, exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

import { CurrentTest, TestProgress } from '../../types/test.types';
import { ConfigService } from '../config/config.service';
import { parseDuration, parseTimeString } from '../../utils/time';
import { CONSTANTS } from '../../utils/constants';

export class ProcessManagerService {
  private testProgress: Map<string, TestProgress> = new Map();
  private errorBuffers: Map<string, string> = new Map();
  private k6Process: ChildProcess | null = null;

  constructor(private readonly configService: ConfigService) {}

  // * child process 생성 - 테스트 실행하는 프로세스 생성
  spawnProcess = async ({
    targetUrl,
    scriptPath,
    enableDashboard,
    testId,
    scenario,
    httpMethod,
  }: {
    targetUrl: string;
    scriptPath: string;
    enableDashboard: boolean;
    testId: string;
    scenario: string;
    httpMethod: string;
  }): Promise<{ process: ChildProcess; dashboardEnabled: boolean }> => {
    this.errorBuffers.set(testId, '');

    // Use local variables for each test to avoid conflicts
    const k6Args = ['run', '--out', `influxdb=${this.configService.getInfluxDbUrl()}`];

    const k6Env = {
      ...process.env,
      TARGET_URL: targetUrl,
    };

    const dashboardActuallyEnabled = await this.setupDashboard(enableDashboard, k6Args, k6Env);
    k6Args.push(scriptPath);

    console.warn(`K6 command: k6 ${k6Args.join(' ')}`);
    this.k6Process = spawn('k6', k6Args, { env: k6Env });

    this.k6Process.stderr?.on('data', (data) => {
      const current = this.errorBuffers.get(testId) || '';
      this.errorBuffers.set(testId, current + data.toString());
      console.error(`k6 stderr: ${data.toString()}`);
    });

    this.k6Process.stdout?.on('data', (data) => {
      const output = data.toString();
      console.warn(`k6 stdout: ${output}`);
    });

    this.k6Process.on('exit', async (code, signal) => {
      console.warn(`k6 process exited with code ${code} and signal ${signal}`);
      const errorBuffer = this.errorBuffers.get(testId) || '';

      await this.handleProcessExit({
        code,
        signal,
        testId,
        scenario,
        httpMethod,
        fullUrl: targetUrl,
        errorBuffer,
        scriptPath,
      });

      // 정리
      this.errorBuffers.delete(testId);
    });

    return {
      process: this.k6Process,
      dashboardEnabled: dashboardActuallyEnabled,
    };
  };

  // * k6 web dashboard 설정
  setupDashboard = async (
    enableDashboard: boolean,
    k6Args: string[],
    k6Env: Record<string, string>,
  ) => {
    if (!enableDashboard) return false;

    const portInUse = await this.isPortInUse(this.configService.getK6DashboardPort());

    if (portInUse) {
      console.warn(
        `Dashboard port ${this.configService.getK6DashboardPort()} is already in use. Running test without dashboard.`,
      );
      return false;
    }

    k6Args.push(
      '--out',
      `web-dashboard=host=${this.configService.getK6DashboardHost()}&port=${this.configService.getK6DashboardPort()}&period=${this.configService.getK6DashboardPeriod()}`,
    );

    k6Env.K6_DASHBOARD = 'true';
    k6Env.K6_DASHBOARD_HOST = this.configService.getK6DashboardHost();
    k6Env.K6_DASHBOARD_PORT = this.configService.getK6DashboardPort();

    return true;
  };

  // * k6 프로세스 출력 처리
  handleProcessOutput = (k6Process: ChildProcess, testId: string, currentTest: CurrentTest) => {
    let outputBuffer = '';
    let errorBuffer = '';

    k6Process.stdout?.on('data', (data) => {
      const output = data.toString();
      outputBuffer += output;
      console.warn(`k6 stdout: ${output}`);
      this.parseK6Progress(output, testId, currentTest);
    });

    k6Process.stderr?.on('data', (data) => {
      const errorMessage = data.toString();
      errorBuffer += errorMessage;
      console.error(`k6 stderr: ${errorMessage}`);
      this.parseK6Progress(errorMessage, testId, currentTest);

      if (errorMessage.includes('bind: address already in use') && errorMessage.includes('5665')) {
        console.warn(
          'Dashboard port 5665 is already in use. Test will continue without dashboard.',
        );
      }

      if (
        errorMessage.includes('SyntaxError') ||
        errorMessage.includes('ReferenceError') ||
        errorMessage.includes('TypeError')
      ) {
        console.error('K6 Script Error Detected!');
        console.error('Full error:', errorMessage);
      }
    });

    return { outputBuffer, errorBuffer };
  };
  // * k6 timeout 설정
  setupTimeout = ({
    k6Process,
    testId,
    duration,
    currentTest,
  }: {
    k6Process: ChildProcess;
    testId: string;
    duration: string;
    currentTest: CurrentTest;
  }) => {
    const durationInSeconds = parseDuration(duration);
    const maxExecutionTime = (durationInSeconds + CONSTANTS.PROCESS_TIMEOUT_BUFFER) * 1000;

    return setTimeout(() => {
      if (currentTest && currentTest.process === k6Process && !k6Process.killed) {
        console.warn(
          `Test ${testId} exceeded maximum execution time (${maxExecutionTime / 1000}s), forcing termination`,
        );
        k6Process.kill('SIGTERM');

        setTimeout(() => {
          if (!k6Process.killed) {
            console.error(`Test ${testId} not responding to SIGTERM, forcing SIGKILL`);
            k6Process.kill('SIGKILL');
          }
        }, CONSTANTS.FORCE_KILL_TIMEOUT);
      }
    }, maxExecutionTime);
  };
  // * k6 프로세스 종료 처리
  // * k6 테스트 종료 처리
  // * k6 테스트 진행도 처리

  // * port 사용 여부 확인
  private async isPortInUse(port: string): Promise<boolean> {
    const execAsync = promisify(exec);
    try {
      const result = await execAsync(`lsof -i :${port}`);
      return result.stdout.length > 0;
    } catch {
      return false; // lsof 명령이 실패하면 포트 사용 안 함
    }
  }

  // * k6 progress parse
  private parseK6Progress = (output: string, testId: string, currentTest: CurrentTest) => {
    const runningPattern = /running \(([0-9hms.]+)\), (\d+)\/(\d+) VUs/;
    const runningMatch = output.match(runningPattern);

    const iterationPattern = /(\d+) complete and (\d+) interrupted iterations/;
    const iterationMatch = output.match(iterationPattern);

    const percentPattern = /\[(=*)>?\s*\]\s*(\d+)%/;
    const percentMatch = output.match(percentPattern);

    const altPercentPattern = /(\d+)%\s+\[/;
    const altPercentMatch = output.match(altPercentPattern);

    if (runningMatch || iterationMatch || percentMatch || altPercentMatch) {
      // 초기화
      if (!this.testProgress.has(testId)) {
        this.testProgress.set(testId, {
          startTime: new Date(),
          currentTime: '0s',
          currentVUs: 0,
          totalVUs: 0,
          completedIterations: 0,
          interruptedIterations: 0,
          percentage: 0,
          status: 'running',
        });
      }

      const progress = this.testProgress.get(testId)!;

      if (runningMatch) {
        progress.currentTime = runningMatch[1];
        progress.currentVUs = parseInt(runningMatch[2]);
        progress.totalVUs = parseInt(runningMatch[3]);
      }

      if (iterationMatch) {
        progress.completedIterations = parseInt(iterationMatch[1]);
        progress.interruptedIterations = parseInt(iterationMatch[2]);
      }

      if (percentMatch) {
        progress.percentage = parseInt(percentMatch[2]);
      } else if (altPercentMatch) {
        progress.percentage = parseInt(altPercentMatch[1]);
      }

      if (!percentMatch && !altPercentMatch && currentTest?.duration) {
        const durationSeconds = parseDuration(currentTest.duration);
        const currentSeconds = parseTimeString(progress.currentTime);
        if (durationSeconds > 0) {
          progress.percentage = Math.min(100, Math.round((currentSeconds / durationSeconds) * 100));
        }
      }

      if (output.includes('✓') || output.includes('✗') || output.includes('done')) {
        progress.status = 'completed';
        progress.percentage = 100;
      }
    }
  };

  // * 진행 상태 조회
  getProgress = (testId: string): TestProgress | null => {
    return this.testProgress.get(testId) || null;
  };

  // * 테스트 정리
  cleanupTest = async (testId: string) => {
    // 진행 상태 정리
    this.testProgress.delete(testId);

    // 에러 버퍼 정리
    this.errorBuffers.delete(testId);

    console.warn(`Test ${testId} cleanup completed`);
  };

  private handleProcessExit = async ({
    code,
    signal,
    testId,
    scenario,
    httpMethod,
    fullUrl,
    errorBuffer,
    scriptPath,
  }: {
    code: number | null;
    signal: string | null;
    testId: string;
    scenario: string;
    httpMethod: string;
    fullUrl: string;
    errorBuffer: string;
    scriptPath: string;
  }) => {
    if (code !== 0) {
      console.error('K6 Test Failed!', {
        exitCode: code,
        signal,
        testId,
        scenario,
        httpMethod,
        targetUrl: fullUrl,
      });

      if (errorBuffer) {
        console.error('Last errors:', errorBuffer.slice(-CONSTANTS.LOG_BUFFER_SIZE));
      }

      try {
        const scriptContent = await fs.readFile(scriptPath, 'utf8');
        console.error('Script preview:', scriptContent.substring(0, CONSTANTS.SCRIPT_PREVIEW_SIZE));
      } catch (error) {
        console.error('Could not read script file:', error);
      }
    }
  };
}
