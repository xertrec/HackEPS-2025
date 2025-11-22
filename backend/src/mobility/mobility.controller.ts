import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MobilityService } from './mobility.service';
import { Neighborhood } from './neighborhood.entity';

@Controller('mobility')
export class MobilityController {
  constructor(
    private readonly mobilityService: MobilityService,
    @InjectRepository(Neighborhood)
    private neighborhoodRepo: Repository<Neighborhood>,
  ) {}

  @Get('all')
  async getAllScores() {
    const barrios = await this.neighborhoodRepo.find();
    
    if (!barrios.length) return { msg: "La BBDD está vacía o no se lee." };

    const lista = barrios.map(b => ({
        name: b.name,
        lat: b.latitude,
        lon: b.longitude
    }));

    return this.mobilityService.calculateScoresForList(lista);
  }
}