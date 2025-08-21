import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return health status with standard format', () => {
      const result = appController.getHealth();
      expect(result.status).toBe('healthy');
      expect(result.service).toBe('mock-server');
      expect(result.version).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(result.environment).toBeDefined();
    });
  });

  describe('ready', () => {
    it('should return readiness status', () => {
      const result = appController.getReady();
      expect(result.status).toBe('healthy');
      expect(result.service).toBe('mock-server');
      expect(result.dependencies).toBeDefined();
      expect(result.dependencies.memory).toBeDefined();
      expect(result.dependencies.memory.status).toBe('healthy');
    });
  });
});
