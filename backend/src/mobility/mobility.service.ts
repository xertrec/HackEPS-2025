// src/mobility/mobility.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { Neighborhood } from './neighborhood.entity';
import { MOBILITY_CONFIG } from './mobility.constants';
import * as fs from 'fs';
import * as path from 'path';

const C = MOBILITY_CONFIG;

interface TransportStop {
  lat: number;
  lon: number;
  type: string;
  name?: string;
}

@Injectable()
export class MobilityService {
  private transportData: TransportStop[] = [];
  private spatialIndex: Map<string, TransportStop[]> = new Map();
  private readonly GRID_SIZE = 0.01; // ~1km de precisión

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(Neighborhood)
    private neighborhoodRepo: Repository<Neighborhood>,
  ) {
    // Cargar datos de transporte al iniciar el servicio
    this.loadTransportData();
  }

  private loadTransportData() {
    try {
      const dataPath = path.join(__dirname, '..', '..', 'transport_data.json');
      if (fs.existsSync(dataPath)) {
        const data = fs.readFileSync(dataPath, 'utf-8');
        this.transportData = JSON.parse(data);
        console.log(`✅ Cargados ${this.transportData.length} paradas de transporte desde caché local`);
        
        // Crear índice espacial para búsquedas rápidas
        this.buildSpatialIndex();
        console.log(`✅ Índice espacial creado con ${this.spatialIndex.size} celdas`);
      } else {
        console.warn('⚠️ No se encontró transport_data.json. Ejecuta: npx ts-node scripts/download-transport-data.ts');
      }
    } catch (e) {
      console.error('❌ Error cargando datos de transporte:', e.message);
    }
  }

  private buildSpatialIndex() {
    for (const stop of this.transportData) {
      const key = this.getGridKey(stop.lat, stop.lon);
      if (!this.spatialIndex.has(key)) {
        this.spatialIndex.set(key, []);
      }
      this.spatialIndex.get(key)!.push(stop);
    }
  }

  private getGridKey(lat: number, lon: number): string {
    const gridLat = Math.floor(lat / this.GRID_SIZE);
    const gridLon = Math.floor(lon / this.GRID_SIZE);
    return `${gridLat},${gridLon}`;
  }

  private getNearbyCells(lat: number, lon: number): string[] {
    const keys: string[] = [];
    const centerLat = Math.floor(lat / this.GRID_SIZE);
    const centerLon = Math.floor(lon / this.GRID_SIZE);
    
    // Buscar en la celda actual y las 8 celdas vecinas
    for (let dLat = -1; dLat <= 1; dLat++) {
      for (let dLon = -1; dLon <= 1; dLon++) {
        keys.push(`${centerLat + dLat},${centerLon + dLon}`);
      }
    }
    return keys;
  }

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
        } else if (apiConfig.type === 'METRO_GTFS') {
            return this.fetchMetroGTFSData(apiConfig.url, lat, lon);
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
    // Si tenemos datos locales de transporte y estamos buscando paradas de bus, usar caché
    if (queryPart.includes('bus_stop') && this.transportData.length > 0) {
      return this.countNearbyStops(lat, lon, 'bus_stop');
    }
    
    // Si no hay caché, hacer petición a API (fallback)
    try {
        const fullQuery = `[out:json][timeout:3];(${queryPart}(around:${C.RADIUS},${lat},${lon}););out count;`;
        const url = `${C.URLS.OVERPASS_API}?data=${encodeURIComponent(fullQuery)}`;
        
        const res = await firstValueFrom(this.httpService.get(url));
        return parseInt(res.data?.elements?.[0]?.tags?.total || '0');
    } catch (e) {
        return 0;
    }
  }

  private countNearbyStops(lat: number, lon: number, type?: string): number {
    let count = 0;
    
    // Usar índice espacial para reducir búsqueda
    const nearbyCells = this.getNearbyCells(lat, lon);
    
    for (const cellKey of nearbyCells) {
      const stops = this.spatialIndex.get(cellKey);
      if (!stops) continue;
      
      for (const stop of stops) {
        if (type && stop.type !== type) continue;
        
        const distance = this.calculateDistance(lat, lon, stop.lat, stop.lon);
        if (distance <= C.RADIUS) {
          count++;
        }
      }
    }
    return count;
  }

  private async fetchMetroGTFSData(url: string, lat: number, lon: number): Promise<number> {
    try {
        const res = await firstValueFrom(this.httpService.get(url, { responseType: 'text' }));
        const lines = res.data.split('\n');
        
        if (lines.length < 2) return 0;
        
        // Parsear el header para encontrar las columnas
        const header = lines[0].split(',');
        const latIdx = header.findIndex(h => h.trim().toLowerCase() === 'stop_lat');
        const lonIdx = header.findIndex(h => h.trim().toLowerCase() === 'stop_lon');
        
        if (latIdx === -1 || lonIdx === -1) return 0;
        
        // Contar paradas dentro del radio
        let count = 0;
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',');
            if (cols.length <= Math.max(latIdx, lonIdx)) continue;
            
            const stopLat = parseFloat(cols[latIdx]);
            const stopLon = parseFloat(cols[lonIdx]);
            
            if (isNaN(stopLat) || isNaN(stopLon)) continue;
            
            // Calcular distancia en metros (aproximación simple)
            const distance = this.calculateDistance(lat, lon, stopLat, stopLon);
            if (distance <= C.RADIUS) {
                count++;
            }
        }
        
        return count;
    } catch (e) {
        console.error(`Error fetching GTFS from ${url}:`, e.message);
        return 0;
    }
  }

  // Calcular distancia en metros entre dos coordenadas (fórmula Haversine simplificada)
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Radio de la Tierra en metros
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}