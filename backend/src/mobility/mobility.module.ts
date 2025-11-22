// src/mobility/mobility.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MobilityService } from './mobility.service';
import { MobilityController } from './mobility.controller';

@Module({
  imports: [HttpModule], // ¡Importante para poder hacer llamadas externas!
  providers: [MobilityService],
  controllers: [MobilityController],
})
export class MobilityModule {}