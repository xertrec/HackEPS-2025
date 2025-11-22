// src/mobility/mobility.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { Neighborhood } from './neighborhood.entity';
import { MOBILITY_CONFIG } from './mobility.constants';

const C = MOBILITY_CONFIG;

@Injectable()
export class MobilityService {
  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(Neighborhood)
    private neighborhoodRepo: Repository<Neighborhood>,
  ) {}

  // --- 1. GESTIÓN DE LISTA Y CACHÉ ---
  async calculateScoresForList(barrios: Neighborhood[]) {
    console.log(`🔍 Procesando ${barrios.length} barrios...`);
    const resultados: any[] = [];

    for (const barrio of barrios) {
      if (barrio.score !== null && barrio.score !== undefined) {
        console.log(`✅ [CACHE] ${barrio.name}`);
        resultados.push({
            barrio: barrio.name,
            puntuacion_total: barrio.score,
            detalle: JSON.parse(barrio.details || '{}')
        });
        continue;
      }

      console.log(`⚡ [API] Calculando ${barrio.name}...`);
      const calculo = await this.calculateFullScore(barrio.name, Number(barrio.latitude), Number(barrio.longitude));
      
      barrio.score = calculo.puntuacion_total;
      barrio.details = JSON.stringify(calculo.detalle);
      await this.neighborhoodRepo.save(barrio);
      resultados.push(calculo);
    }
    return resultados.sort((a, b) => b.puntuacion_total - a.puntuacion_total);
  }

  // --- 2. CÁLCULO CENTRAL PARALELO ---
  async calculateFullScore(barrio: string, lat: number, lon: number) {
    try {
        // Ejecutamos los 4 grupos de APIs a la vez
        const [parking, transport, traffic, infra] = await Promise.all([
            this.processCategoryGroup(C.DATA_SOURCES.PARKING, lat, lon),
            this.processCategoryGroup(C.DATA_SOURCES.TRANSPORT, lat, lon),
            this.processCategoryGroup(C.DATA_SOURCES.TRAFFIC, lat, lon),
            this.processCategoryGroup(C.DATA_SOURCES.INFRA, lat, lon),
        ]);

        const totalScore = 
            (parking * C.SECTION_WEIGHTS.PARKING) + 
            (transport * C.SECTION_WEIGHTS.TRANSPORT) + 
            (traffic * C.SECTION_WEIGHTS.TRAFFIC) + 
            (infra * C.SECTION_WEIGHTS.INFRA);

        return {
            barrio,
            puntuacion_total: Math.round(totalScore),
            detalle: { parking, transport, traffic, infra }
        };
    } catch (error) {
        console.error(`Error crítico en ${barrio}`, error.message);
        return { barrio, puntuacion_total: 0, error: "Fallo datos", detalle: {} };
    }
  }

  // --- 3. MOTOR GENÉRICO ---
  private async processCategoryGroup(apiList: any[], lat: number, lon: number): Promise<number> {
    if (!apiList || apiList.length === 0) return 0;

    const promises = apiList.map(apiConfig => {
        if (apiConfig.type === 'LACITY') {
            return this.fetchLaCityData(apiConfig.id, lat, lon);
        } else if (apiConfig.type === 'OVERPASS') {
            return this.fetchOverpassData(apiConfig.query, lat, lon);
        }
        return 0;
    });

    const results = await Promise.all(promises);
    const totalItems = results.reduce((sum, count) => sum + count, 0);

    // Normalizar: Si encontramos 'SCORE_DIVISOR' elementos, es un 100.
    return Math.min((totalItems / C.SCORE_DIVISOR) * 100, 100);
  }

  // --- 4. FETCHERS INTELIGENTES ---

  private async fetchLaCityData(id: string, lat: number, lon: number): Promise<number> {
    // Probamos las 3 columnas más comunes de ubicación en Socrata
    // Si una falla, el 'OR' ($OR) no funciona así en URL, así que probamos la más común 'lat_lon'
    // o 'the_geom' o 'location'.
    // Para el hackathon, usaremos 'within_circle' genérico que a veces Socrata infiere.
    
    // Truco: Probamos con 'lat_lon' que es el estándar nuevo, y si falla asumimos 0 para no romper.
    // O usamos una query sin nombre de columna si la API lo soporta.
    const url = `${C.URLS.LACITY_BASE}/${id}.json?$where=within_circle(lat_lon, ${lat}, ${lon}, ${C.RADIUS})&$limit=500`;
    
    try {
        const res = await firstValueFrom(this.httpService.get(url));
        return res.data ? res.data.length : 0;
    } catch (e) {
        // Si falla lat_lon, intentamos silenciosamente un fallback o devolvemos 0
        return 0; 
    }
  }

  private async fetchOverpassData(queryPart: string, lat: number, lon: number): Promise<number> {
    try {
        const fullQuery = `[out:json][timeout:3];(${queryPart}(around:${C.RADIUS},${lat},${lon}););out count;`;
        const url = `${C.URLS.OVERPASS_API}?data=${encodeURIComponent(fullQuery)}`;
        
        const res = await firstValueFrom(this.httpService.get(url));
        return parseInt(res.data?.elements?.[0]?.tags?.total || '0');
    } catch (e) {
        return 0;
    }
  }
}