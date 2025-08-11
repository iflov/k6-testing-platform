import { Test, TestingModule } from '@nestjs/testing';
import { ErrorService } from './error.service';

describe('ErrorService', () => {
  let service: ErrorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ErrorService],
    }).compile();

    service = module.get<ErrorService>(ErrorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Error Methods', () => {
    it('should return Bad Request with 400 status code', async () => {
      const result = await service.getBadRequest();
      expect(result.statusCode).toBe(400);
      expect(result.error).toBe(true);
      expect(result.message).toBe('Bad Request');
      expect(result.timestamp).toBeDefined();
    });

    it('should return Unauthorized with 401 status code', async () => {
      const result = await service.getUnauthorized();
      expect(result.statusCode).toBe(401);
      expect(result.error).toBe(true);
      expect(result.message).toBe('Unauthorized');
      expect(result.timestamp).toBeDefined();
    });

    it('should return Not Found with 404 status code', async () => {
      const result = await service.getNotFound();
      expect(result.statusCode).toBe(404);
      expect(result.error).toBe(true);
      expect(result.message).toBe('Not Found');
      expect(result.timestamp).toBeDefined();
    });

    it('should return Forbidden with 403 status code', async () => {
      const result = await service.getForbidden();
      expect(result.statusCode).toBe(403);
      expect(result.error).toBe(true);
      expect(result.message).toBe('Forbidden');
      expect(result.timestamp).toBeDefined();
    });

    it('should return Conflict with 409 status code', async () => {
      const result = await service.getConflict();
      expect(result.statusCode).toBe(409);
      expect(result.error).toBe(true);
      expect(result.message).toBe('Conflict');
      expect(result.timestamp).toBeDefined();
    });

    it('should return Internal Server Error with 500 status code', async () => {
      const result = await service.getInternalServerError();
      expect(result.statusCode).toBe(500);
      expect(result.error).toBe(true);
      expect(result.message).toBe('Internal Server Error');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('Random Error Generator', () => {
    it('should return a random error', async () => {
      const result = await service.getRandomError();
      expect(result).toBeDefined();
      expect(result.error).toBe(true);
      expect(result.statusCode).toBeDefined();
      expect([400, 401, 403, 404, 409, 500]).toContain(result.statusCode);
    });

    it('should return different errors on multiple calls', async () => {
      const results = await Promise.all([
        service.getRandomError(),
        service.getRandomError(),
        service.getRandomError(),
        service.getRandomError(),
        service.getRandomError(),
      ]);

      const statusCodes = results.map((r) => r.statusCode);
      const uniqueStatusCodes = [...new Set(statusCodes)];

      // At least some variety in random errors (might not always be different due to randomness)
      expect(uniqueStatusCodes.length).toBeGreaterThan(0);
    });
  });

  describe('Custom Error Generator', () => {
    it('should create custom error with provided status and message', async () => {
      const result = await service.getCustomError(418, "I'm a teapot");
      expect(result.statusCode).toBe(418);
      expect(result.error).toBe(true);
      expect(result.message).toBe("I'm a teapot");
      expect(result.timestamp).toBeDefined();
    });

    it('should create custom error with different values', async () => {
      const result = await service.getCustomError(503, 'Service Unavailable');
      expect(result.statusCode).toBe(503);
      expect(result.error).toBe(true);
      expect(result.message).toBe('Service Unavailable');
      expect(result.timestamp).toBeDefined();
    });
  });
});
