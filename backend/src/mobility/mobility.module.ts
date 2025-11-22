import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { MobilityService } from './mobility.service';
import { MobilityController } from './mobility.controller';
import { Neighborhood } from './neighborhood.entity';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([Neighborhood])
  ],
  controllers: [MobilityController],
  providers: [MobilityService],
  exports: [MobilityService]
})
export class MobilityModule {}