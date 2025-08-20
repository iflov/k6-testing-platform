import { ChildProcess } from 'child_process';
import { TestService } from './test.service';
import { ScenarioService } from '../scenarios/scenario.service';
import { ConfigService } from '../config/config.service';
import { ProcessManagerService } from '../process-manager/process-manager.service';
import { TestConfig } from '../../types/test.types';

// Mock fs/promises
jest.mock('fs/promises', () => ({
  writeFile: jest.fn(),
  unlink: jest.fn(),
}));

describe('TestService', () => {
  let testService: TestService;
  let scenarioService: ScenarioService;
  let configService: ConfigService;
  let processManagerService: ProcessManagerService;
  let mockProcess: Partial<ChildProcess>;

  beforeEach(() => {
    // Mock services
    scenarioService = {
      getExecutorConfig: jest.fn().mockReturnValue({
        scenarios: {
          test_scenario: {
            executor: 'constant-vus',
            vus: 10,
            duration: '30s',
          },
        },
      }),
      buildUrl: jest.fn().mockReturnValue('http://localhost:3000/test'),
      generateK6Script: jest.fn().mockReturnValue('k6 script content'),
    } as unknown as ScenarioService;

    configService = {
      getMockServerUrl: jest.fn().mockReturnValue('http://localhost:3001'),
    } as unknown as ConfigService;

    // Mock ChildProcess
    mockProcess = {
      on: jest.fn(),
      kill: jest.fn(),
      killed: false,
      pid: 12345,
    } as unknown as ChildProcess;

    processManagerService = {
      spawnProcess: jest.fn().mockResolvedValue({
        process: mockProcess,
        dashboardEnabled: false,
      }),
      handleProcessOutput: jest.fn(),
      setupTimeout: jest.fn().mockReturnValue(123), // Return a mock timeout ID
      getProgress: jest.fn().mockReturnValue({
        status: 'running',
        percentage: 50,
      }),
      cleanupTest: jest.fn(),
    } as unknown as ProcessManagerService;

    testService = new TestService(scenarioService, configService, processManagerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('startTest', () => {
    it('should start a test successfully', async () => {
      const testConfig: TestConfig = {
        vus: 10,
        duration: '30s',
        targetUrl: 'http://localhost:3000',
        scenario: 'load',
        httpMethod: 'GET',
      };

      const result = await testService.startTest(testConfig);

      expect(result).toMatchObject({
        status: 'started',
        scenario: 'load',
        message: 'Test started successfully',
      });
      expect(result.testId).toBeDefined();

      expect(scenarioService.getExecutorConfig).toHaveBeenCalled();
      expect(scenarioService.generateK6Script).toHaveBeenCalled();
      expect(processManagerService.spawnProcess).toHaveBeenCalled();
      expect(processManagerService.handleProcessOutput).toHaveBeenCalled();
      expect(processManagerService.setupTimeout).toHaveBeenCalled();
    });

    it('should throw error if another test is already running', async () => {
      const testConfig: TestConfig = {
        vus: 10,
        duration: '30s',
      };

      // Start first test
      await testService.startTest(testConfig);

      // Try to start second test
      await expect(testService.startTest(testConfig)).rejects.toThrow(
        'Another test is already running',
      );
    });

    it('should use default values when not provided', async () => {
      const testConfig: TestConfig = {};

      await testService.startTest(testConfig);

      expect(scenarioService.getExecutorConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          vus: 10, // DEFAULT_VUS
          duration: '30s', // DEFAULT_DURATION
          scenario: 'custom',
          executionMode: 'duration', // DEFAULT_EXECUTION_MODE
          testId: expect.any(String),
          urlPath: '',
        }),
      );
    });

    it('should handle dashboard enablement', async () => {
      const testConfig: TestConfig = {
        enableDashboard: true,
      };

      processManagerService.spawnProcess = jest.fn().mockResolvedValue({
        process: mockProcess,
        dashboardEnabled: true,
      });

      await testService.startTest(testConfig);

      expect(processManagerService.spawnProcess).toHaveBeenCalledWith(
        expect.objectContaining({
          enableDashboard: true,
        }),
      );

      const currentTest = testService.getCurrentTest();
      expect(currentTest?.dashboardEnabled).toBe(true);
    });
  });

  describe('stopTest', () => {
    it('should stop a running test', async () => {
      const testConfig: TestConfig = {
        vus: 10,
        duration: '30s',
      };

      // Start a test first
      await testService.startTest(testConfig);
      const currentTest = testService.getCurrentTest();
      const testId = currentTest?.testId;

      // Stop the test
      const result = await testService.stopTest();

      expect(result).toMatchObject({
        status: 'stopped',
        testId,
        message: 'Test stopped successfully',
      });

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(testService.getCurrentTest()).toBeNull();
    });

    it('should throw error if no test is running', async () => {
      await expect(testService.stopTest()).rejects.toThrow('No test is currently running');
    });

    it('should force kill if process does not respond to SIGTERM', async () => {
      jest.useFakeTimers();

      const testConfig: TestConfig = {};
      await testService.startTest(testConfig);

      // Mock process as not killed after SIGTERM
      (mockProcess as Record<string, unknown>).killed = false;

      const stopPromise = testService.stopTest();

      // Fast-forward time
      jest.advanceTimersByTime(5000);

      await stopPromise;

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');

      jest.useRealTimers();
    });
  });

  describe('getStatus', () => {
    it('should return running status when test is active', async () => {
      const testConfig: TestConfig = {
        vus: 10,
        duration: '30s',
        scenario: 'load',
      };

      await testService.startTest(testConfig);

      const status = await testService.getStatus();

      expect(status.running).toBe(true);
      expect(status.details).toBeDefined();
      expect(status.details?.vus).toBe(10);
      expect(status.details?.duration).toBe('30s');
      expect(status.details?.scenario).toBe('load');
      expect(status.progress).toBeDefined();
    });

    it('should return not running status when no test is active', async () => {
      const status = await testService.getStatus();

      expect(status.running).toBe(false);
      expect(status.details).toBeNull();
      expect(status.progress).toBeNull();
    });
  });

  describe('getProgress', () => {
    it('should return progress when test is running', async () => {
      const testConfig: TestConfig = {};

      await testService.startTest(testConfig);
      const currentTest = testService.getCurrentTest();

      const progress = await testService.getProgress();

      expect(progress.running).toBe(true);
      expect(progress.testId).toBe(currentTest?.testId);
      expect((progress as Record<string, unknown>).status).toBe('running');
      expect((progress as Record<string, unknown>).percentage).toBe(50);
    });

    it('should return not running when no test is active', async () => {
      const progress = await testService.getProgress();

      expect(progress.running).toBe(false);
      expect(progress.message).toBe('No test is currently running');
    });

    it('should handle case when progress data is not available', async () => {
      processManagerService.getProgress = jest.fn().mockReturnValue(null);

      const testConfig: TestConfig = {};
      await testService.startTest(testConfig);
      const currentTest = testService.getCurrentTest();

      const progress = await testService.getProgress();

      expect(progress.running).toBe(true);
      expect(progress.testId).toBe(currentTest?.testId);
      expect(progress.message).toBe('Test is running but progress data not yet available');
    });
  });

  describe('getCurrentTest', () => {
    it('should return current test when running', async () => {
      const testConfig: TestConfig = {
        vus: 20,
        duration: '60s',
      };

      await testService.startTest(testConfig);

      const currentTest = testService.getCurrentTest();

      expect(currentTest).toBeDefined();
      expect(currentTest?.vus).toBe(20);
      expect(currentTest?.duration).toBe('60s');
    });

    it('should return null when no test is running', () => {
      const currentTest = testService.getCurrentTest();
      expect(currentTest).toBeNull();
    });
  });

  describe('process exit handling', () => {
    it('should clean up resources when process exits', async () => {
      const fs = jest.requireMock('fs/promises');
      fs.unlink = jest.fn().mockResolvedValue(undefined);

      const testConfig: TestConfig = {};
      await testService.startTest(testConfig);

      // Get the exit handler
      const exitHandler = (mockProcess.on as jest.Mock).mock.calls.find(
        (call: unknown[]) => call[0] === 'exit',
      )?.[1];

      // Simulate process exit
      await exitHandler();

      expect(processManagerService.cleanupTest).toHaveBeenCalled();
      expect(fs.unlink).toHaveBeenCalled();
      expect(testService.getCurrentTest()).toBeNull();
    });

    it('should handle script file deletion error gracefully', async () => {
      const fs = jest.requireMock('fs/promises');
      fs.unlink = jest.fn().mockRejectedValue(new Error('File not found'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const testConfig: TestConfig = {};
      await testService.startTest(testConfig);

      // Get the exit handler
      const exitHandler = (mockProcess.on as jest.Mock).mock.calls.find(
        (call: unknown[]) => call[0] === 'exit',
      )?.[1];

      // Simulate process exit
      await exitHandler();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete script file'),
      );

      consoleSpy.mockRestore();
    });
  });
});
