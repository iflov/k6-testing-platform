import { Test, TestingModule } from '@nestjs/testing';
import { SuccessController } from './success.controller';

describe('SuccessController', () => {
  let controller: SuccessController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SuccessController],
    }).compile();

    controller = module.get<SuccessController>(SuccessController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
