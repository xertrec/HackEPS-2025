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
  @Get('reset')
  async resetScores() {
    // Ejecutamos SQL directo para poner las notas a NULL
    await this.neighborhoodRepo.query(`UPDATE neighborhoods SET score = NULL, details = NULL`);
    
    console.log('🗑️ Caché borrada. Los barrios siguen ahí, pero sin nota.');
    return "✅ Caché reseteada. Ahora ve a /mobility/all para recalcular con las nuevas APIs.";
  }
}