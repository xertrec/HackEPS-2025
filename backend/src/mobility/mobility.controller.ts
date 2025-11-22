// src/mobility/mobility.controller.ts
import { Controller, Get } from '@nestjs/common';
import { MobilityService } from './mobility.service';

@Controller('mobility')
export class MobilityController {
  constructor(private readonly mobilityService: MobilityService) {}

  @Get('parking')
  async getParking() {
    return this.mobilityService.getParkingData();
  }

  @Get('airport')
  async getAirport() {
    return this.mobilityService.getAirportData();
  }

  @Get('traffic')
  async getTraffic() {
    return this.mobilityService.getTrafficCounts();
  }

  // BONUS: ¡Un endpoint que trae TODO junto!
  // Ideal para tu Frontend del Hackathon
  @Get('all-sources')
  async getAll() {
    const [parking, airport, traffic] = await Promise.all([
      this.mobilityService.getParkingData(),
      this.mobilityService.getAirportData(),
      this.mobilityService.getTrafficCounts(),
    ]);

    return {
      summary: 'Mobility Data Aggregation',
      sources: {
        parking,
        airport,
        traffic
      }
    };
  }
}