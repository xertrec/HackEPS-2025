// src/mobility/mobility.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm'; // <--- Nuevo
import { Repository } from 'typeorm';               // <--- Nuevo
import { firstValueFrom } from 'rxjs';
import { Neighborhood } from './neighborhood.entity'; // <--- Nuevo

@Injectable()
export class MobilityService {
  constructor(
    private readonly httpService: HttpService,
    
    // Inyectamos la BBDD en el servicio para poder GUARDAR
    @InjectRepository(Neighborhood)
    private neighborhoodRepo: Repository<Neighborhood>,
  ) {}

  // --- 1. LÓGICA INTELIGENTE (Cache) ---
  async calculateScoresForList(barrios: Neighborhood[]) {
    // Ya no necesitamos slice(0,5) porque si ya están calculados, irá rápido.
    // Pero mantenemos un log para ver qué pasa.
    console.log(`🔍 Revisando ${barrios.length} barrios...`);

    const resultados: any[] = [];

    // Procesamos uno a uno (o en paralelo)
    for (const barrio of barrios) {
        
      // CASO A: ¿YA TIENE NOTA? -> DEVOLVERLO DIRECTO
      if (barrio.score !== null && barrio.score !== undefined) {
        console.log(`✅ [CACHE] Barrio ${barrio.name} ya calculado: ${barrio.score}`);
        resultados.push({
            barrio: barrio.name,
            puntuacion_total: barrio.score,
            detalle: JSON.parse(barrio.details || '{}') // Convertimos texto a JSON
        });
        continue; // Pasamos al siguiente sin llamar a API externa
      }

      // CASO B: NO TIENE NOTA -> CALCULAR Y GUARDAR
      console.log(`⚡ [API] Calculando ${barrio.name} desde cero...`);
      
      const calculo = await this.calculateFullScore(
        barrio.name, 
        barrio.latitude, 
        barrio.longitude
      );

      // --- GUARDAR EN BBDD ---
      barrio.score = calculo.puntuacion_total;
      barrio.details = JSON.stringify(calculo.detalle); // Guardamos el JSON como texto string
      await this.neighborhoodRepo.save(barrio);

      resultados.push(calculo);
    }

    // Ordenar por nota
    return resultados.sort((a, b) => b.puntuacion_total - a.puntuacion_total);
  }

  // --- 2. CÁLCULO INDIVIDUAL (Igual que antes) ---
  async calculateFullScore(barrio: string, lat: number, lon: number) {
    const RADIUS = 800; 
    try {
        const [parking, transport, traffic, infra] = await Promise.all([
            this.analyzeParking(lat, lon, RADIUS),      
            this.analyzeTransport(lat, lon, RADIUS),    
            this.analyzeTraffic(lat, lon, RADIUS),      
            this.analyzeInfrastructure(lat, lon, RADIUS) 
        ]);

        const totalScore = (parking.score * 0.15) + (transport.score * 0.35) + (traffic.score * 0.20) + (infra.score * 0.30);

        return {
            barrio,
            puntuacion_total: Math.round(totalScore),
            detalle: { parking, transport, traffic, infra }
        };
    } catch (error) {
        console.error(`Error en ${barrio}`, error.message);
        return { barrio, puntuacion_total: 0, error: "Fallo datos", detalle: {} };
    }
  }

  // --- HELPERS PRIVADOS (Igual que antes) ---
  private async analyzeParking(lat: number, lon: number, r: number) {
    try {
      const urlA = `https://data.lacity.org/resource/s49e-q6j2.json?$where=within_circle(lat_lon, ${lat}, ${lon}, ${r})&$limit=500`;
      const qB = `[out:json][timeout:4];(node["amenity"="parking"](around:${r},${lat},${lon}););out count;`;
      
      const [resA, resB] = await Promise.all([
         firstValueFrom(this.httpService.get(urlA)).catch(() => ({ data: [] })),
         firstValueFrom(this.httpService.get(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(qB)}`)).catch(() => ({ data: {} }))
      ]);

      const countA = resA.data.length || 0;
      const countB = parseInt(resB.data?.elements?.[0]?.tags?.total || '0');
      return { score: Math.min((countB*10) + (countA*0.2), 100) };
    } catch (e) { return { score: 0 }; }
  }

  private async analyzeTransport(lat: number, lon: number, r: number) {
    try {
      const q = `[out:json][timeout:4];(node["highway"="bus_stop"](around:${r},${lat},${lon});node["railway"="subway_entrance"](around:${r},${lat},${lon}););out body;`;
      const res = await firstValueFrom(this.httpService.get(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`));
      const els = res.data.elements || [];
      const bus = els.filter(e => e.tags.highway === 'bus_stop').length;
      const metro = els.filter(e => e.tags.railway === 'subway_entrance').length;
      return { score: Math.min((metro * 30) + (bus * 2), 100) };
    } catch (e) { return { score: 0 }; }
  }

  private async analyzeTraffic(lat: number, lon: number, r: number) {
     return { score: 50 }; 
  }

  private async analyzeInfrastructure(lat: number, lon: number, r: number) {
    try {
      const q = `[out:json][timeout:4];(way["highway"="cycleway"](around:${r},${lat},${lon}););out body;`;
      const res = await firstValueFrom(this.httpService.get(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`));
      const cycle = res.data.elements ? res.data.elements.length : 0;
      return { score: Math.min(cycle * 10, 100) };
    } catch (e) { return { score: 0 }; }
  }
}