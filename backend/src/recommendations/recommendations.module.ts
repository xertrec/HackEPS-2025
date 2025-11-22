import { Module } from '@nestjs/common';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { DatabaseModule } from '../database/database.module';
import { SecurityModule } from '../security/security.module';
import { ServicesModule } from '../services/services.module';

@Module({
  imports: [DatabaseModule, SecurityModule, ServicesModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
})
export class RecommendationsModule {}
