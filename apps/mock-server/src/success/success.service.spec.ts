import { Test, TestingModule } from '@nestjs/testing';
import { SuccessService } from './success.service';

describe('SuccessService', () => {
  let service: SuccessService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SuccessService],
    }).compile();

    service = module.get<SuccessService>(SuccessService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should be return Success with 200 status code', async () => {
    const result = await service.getSuccess();
    expect(result.statusCode).toBe(200);
    expect(result.error).toBe(false);
    expect(result.message).toBe('ok');
    expect(result.timestamp).toBeDefined();
  });
});
