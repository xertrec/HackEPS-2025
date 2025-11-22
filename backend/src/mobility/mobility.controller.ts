// src/mobility/mobility.controller.ts
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
    // 1. Obtener TODOS los barrios de la BBDD
    const barrios = await this.neighborhoodRepo.find();

    if (!barrios.length) return { msg: "BBDD vacía." };
    
    // 2. Pasamos la lista completa al servicio.
    // Él se encargará de ver cuál necesita cálculo y cuál no.
    return this.mobilityService.calculateScoresForList(barrios);
  }
}