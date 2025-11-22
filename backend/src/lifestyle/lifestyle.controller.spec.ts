import { Test, TestingModule } from '@nestjs/testing';
import { LifestyleController } from './lifestyle.controller';

describe('LifestyleController', () => {
  let controller: LifestyleController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LifestyleController],
    }).compile();

    controller = module.get<LifestyleController>(LifestyleController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
