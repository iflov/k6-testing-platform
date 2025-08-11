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
});
