import { Module } from '@nestjs/common';
import { MobilityService } from './mobility.service';

@Module({
  providers: [MobilityService]
})
export class MobilityModule {}
