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

  describe('root', () => {
    it('should return mock server status', () => {
      const result = appController.getRoot();
      expect(result.statusCode).toBe(200);
      expect(result.error).toBe(false);
      expect(result.message).toBe('Mock Server is running');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('health', () => {
    it('should return health status', () => {
      const result = appController.getHealth();
      expect(result.status).toBe('healthy');
      expect(result.service).toBe('mock-server');
      expect(result.timestamp).toBeDefined();
    });
  });
});
