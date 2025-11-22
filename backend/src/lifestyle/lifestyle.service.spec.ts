import { Test, TestingModule } from '@nestjs/testing';
import { LifestyleService } from './lifestyle.service';

describe('LifestyleService', () => {
  let service: LifestyleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LifestyleService],
    }).compile();

    service = module.get<LifestyleService>(LifestyleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
