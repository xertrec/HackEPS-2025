import { Module } from '@nestjs/common';
import { LifestyleService } from './lifestyle.service';
import { LifestyleController } from './lifestyle.controller';

@Module({
  providers: [LifestyleService],
  controllers: [LifestyleController]
})
export class LifestyleModule {}
