import { ChildProcess } from 'child_process';
import { ProcessManagerService } from './process-manager.service';
import { ConfigService } from '../config/config.service';
import { CurrentTest } from '../../types/test.types';

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn(),
  exec: jest.fn((_cmd, callback) => {
    if (callback) callback(null, { stdout: '', stderr: '' });
  }),
}));

// Mock fs/promises
jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue('mock file content'),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockResolvedValue(undefined),
}));

// Mock util
jest.mock('util', () => ({
  promisify: jest.fn(() => jest.fn().mockResolvedValue({ stdout: '', stderr: '' })),
}));

describe('ProcessManagerService', () => {
  let processManagerService: ProcessManagerService;
  let configService: ConfigService;
  let mockProcess: Partial<ChildProcess>;

  beforeEach(() => {
    // Suppress console warnings during tests
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    
    // Mock ConfigService
    configService = {
      getInfluxDbUrl: jest.fn().mockReturnValue('http://localhost:8181'),
      getK6DashboardPort: jest.fn().mockReturnValue('5665'),
      getK6DashboardHost: jest.fn().mockReturnValue('0.0.0.0'),
      getK6DashboardPeriod: jest.fn().mockReturnValue('1s'),
      getInfluxDbConfig: jest.fn().mockReturnValue({
        url: 'http://localhost:8181',
        token: 'test-token',
        org: 'test-org',
        bucket: 'test-bucket',
      }),
    } as unknown as ConfigService;

    // Mock ChildProcess
    mockProcess = {
      stdout: {
        on: jest.fn(),
      },
      stderr: {
        on: jest.fn(),
      },
      on: jest.fn(),
      kill: jest.fn(),
      killed: false,
      pid: 12345,
    } as unknown as ChildProcess;

    processManagerService = new ProcessManagerService(configService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('spawnProcess', () => {
    it('should spawn a k6 process with correct arguments', async () => {
      const { spawn } = jest.requireMock('child_process');
      spawn.mockReturnValue(mockProcess);

      const { promisify } = jest.requireMock('util');
      const execAsync = jest.fn().mockResolvedValue({ stdout: '' });
      promisify.mockReturnValue(execAsync);

      const params = {
        targetUrl: 'http://localhost:3000',
        scriptPath: '/tmp/test.js',
        enableDashboard: false,
        testId: 'test-123',
        scenario: 'load',
        httpMethod: 'GET',
      };

      const result = await processManagerService.spawnProcess(params);

      expect(spawn).toHaveBeenCalledWith(
        'k6',
        expect.arrayContaining(['run', '--out', expect.stringContaining('influxdb=')]),
        expect.objectContaining({
          env: expect.objectContaining({
            TARGET_URL: 'http://localhost:3000',
          }),
        }),
      );

      expect(result.process).toBe(mockProcess);
      expect(result.dashboardEnabled).toBe(false);
    });

    it('should enable dashboard when requested and port is available', async () => {
      const { spawn } = jest.requireMock('child_process');
      spawn.mockReturnValue(mockProcess);

      const { promisify } = jest.requireMock('util');
      const execAsync = jest.fn().mockResolvedValue({ stdout: '' });
      promisify.mockReturnValue(execAsync);

      const params = {
        targetUrl: 'http://localhost:3000',
        scriptPath: '/tmp/test.js',
        enableDashboard: true,
        testId: 'test-123',
        scenario: 'load',
        httpMethod: 'GET',
      };

      const result = await processManagerService.spawnProcess(params);

      expect(result.dashboardEnabled).toBe(true);
      expect(spawn).toHaveBeenCalledWith(
        'k6',
        expect.arrayContaining(['--out', expect.stringContaining('dashboard')]),
        expect.objectContaining({
          env: expect.objectContaining({
            K6_DASHBOARD: 'true',
          }),
        }),
      );
    });
  });

  describe('handleProcessOutput', () => {
    it('should handle stdout data and parse progress', () => {
      const testId = 'test-123';
      const currentTest: CurrentTest = {
        testId,
        process: mockProcess as ChildProcess,
        startTime: new Date(),
        config: {},
        vus: 10,
        duration: '30s',
        executionMode: 'duration',
        targetUrl: 'http://localhost:3000',
        scenario: 'load',
      };

      processManagerService.handleProcessOutput(mockProcess as ChildProcess, testId, currentTest);

      // Simulate stdout data
      const stdoutOn = (mockProcess.stdout as unknown as Record<string, unknown>).on as jest.Mock;
      const stdoutCallback = stdoutOn.mock.calls[0][1];
      stdoutCallback(Buffer.from('running (10s), 5/10 VUs'));

      const progress = processManagerService.getProgress(testId);
      expect(progress).toBeDefined();
      expect(progress?.currentVUs).toBe(5);
      expect(progress?.totalVUs).toBe(10);
    });
  });

  describe('setupTimeout', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should set up timeout for test execution', () => {
      const testId = 'test-123';
      const currentTest: CurrentTest = {
        testId,
        process: mockProcess as ChildProcess,
        startTime: new Date(),
        config: {},
        vus: 10,
        duration: '30s',
        executionMode: 'duration',
        targetUrl: 'http://localhost:3000',
        scenario: 'load',
      };

      const timeoutId = processManagerService.setupTimeout({
        k6Process: mockProcess as ChildProcess,
        testId,
        duration: '30s',
        currentTest,
      });

      expect(timeoutId).toBeDefined();

      // Fast-forward time
      jest.advanceTimersByTime(60000); // 60 seconds (30s + buffer)

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });
  });

  describe('getProgress', () => {
    it('should return test progress', () => {
      const testId = 'test-123';

      // Initially no progress
      expect(processManagerService.getProgress(testId)).toBeNull();

      // Simulate adding progress
      const currentTest: CurrentTest = {
        testId,
        process: mockProcess as ChildProcess,
        startTime: new Date(),
        config: {},
        vus: 10,
        duration: '30s',
        executionMode: 'duration',
        targetUrl: 'http://localhost:3000',
        scenario: 'load',
      };

      processManagerService.handleProcessOutput(mockProcess as ChildProcess, testId, currentTest);

      // Simulate progress update
      const stdoutOn = (mockProcess.stdout as unknown as Record<string, unknown>).on as jest.Mock;
      const stdoutCallback = stdoutOn.mock.calls[0][1];
      stdoutCallback(Buffer.from('running (10s), 5/10 VUs'));

      const progress = processManagerService.getProgress(testId);
      expect(progress).toBeDefined();
      expect(progress?.status).toBe('running');
    });
  });

  describe('cleanupTest', () => {
    it('should clean up test resources', async () => {
      const testId = 'test-123';
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await processManagerService.cleanupTest(testId);

      expect(consoleSpy).toHaveBeenCalledWith(`Test ${testId} cleanup completed`);
      expect(processManagerService.getProgress(testId)).toBeNull();

      consoleSpy.mockRestore();
    });
  });
});
