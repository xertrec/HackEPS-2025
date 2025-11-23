import { Module } from '@nestjs/common';
import { LifestyleService } from './lifestyle.service';
import { LifestyleController } from './lifestyle.controller';
import { HttpModule } from '@nestjs/axios';
import { DatabaseModule } from '../database/database.module';

@Module({
	imports: [HttpModule, DatabaseModule],
	controllers: [LifestyleController],
	providers: [LifestyleService],
	exports: [LifestyleService],
})
export class LifestyleModule {}
