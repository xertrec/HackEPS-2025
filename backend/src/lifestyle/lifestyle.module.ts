import { Module } from '@nestjs/common';
import { LifestyleService } from './lifestyle.service';
import { LifestyleController } from './lifestyle.controller';
import { HttpModule } from '@nestjs/axios';

@Module({
	imports: [HttpModule],
	controllers: [LifestyleController],
	providers: [LifestyleService],
})
export class LifestyleModule {}
