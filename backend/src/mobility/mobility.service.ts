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

interface TaxiStop {
  lat: number;
  lon: number;
  name?: string;
  operator?: string;
}

interface BikeLane {
  id: number;
  lat: number;
  lon: number;
  type: string;
  name?: string;
}

interface Footpath {
  id: number;
  lat: number;
  lon: number;
  type: string;
  name?: string;
  surface?: string;
}

interface ParkingSpot {
  id: number;
  lat: number;
  lon: number;
  type: string;
  name?: string;
  capacity?: number;
}

@Injectable()
export class MobilityService {
  private transportData: TransportStop[] = [];
  private taxiData: TaxiStop[] = [];
  private bikeLaneData: BikeLane[] = [];
  private footpathData: Footpath[] = [];
  private parkingData: ParkingSpot[] = [];
  private spatialIndex: Map<string, TransportStop[]> = new Map();
  private taxiSpatialIndex: Map<string, TaxiStop[]> = new Map();
  private bikeLaneSpatialIndex: Map<string, BikeLane[]> = new Map();
  private footpathSpatialIndex: Map<string, Footpath[]> = new Map();
  private parkingSpatialIndex: Map<string, ParkingSpot[]> = new Map();
  private readonly GRID_SIZE = 0.01; // ~1km de precisión

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(Neighborhood)
    private neighborhoodRepo: Repository<Neighborhood>,
  ) {
    // Cargar todos los datos al iniciar el servicio
    this.loadTransportData();
    this.loadTaxiData();
    this.loadBikeLaneData();
    this.loadFootpathData();
    this.loadParkingData();
  }

  private loadTransportData() {
    try {
      // Intentar primero desde la raíz del proyecto (cuando está compilado)
      let dataPath = path.join(process.cwd(), 'transport_data.json');
      
      // Si no existe, intentar desde el código fuente
      if (!fs.existsSync(dataPath)) {
        dataPath = path.join(__dirname, '..', '..', 'transport_data.json');
      }
      
      if (fs.existsSync(dataPath)) {
        console.log(`📂 Cargando datos de transporte desde: ${dataPath}`);
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

  private loadTaxiData() {
    try {
      // Intentar primero desde la raíz del proyecto
      let dataPath = path.join(process.cwd(), 'taxi_data.json');
      
      // Si no existe, intentar desde el código fuente
      if (!fs.existsSync(dataPath)) {
        dataPath = path.join(__dirname, '..', '..', 'taxi_data.json');
      }
      
      if (fs.existsSync(dataPath)) {
        console.log(`📂 Cargando datos de taxis desde: ${dataPath}`);
        const data = fs.readFileSync(dataPath, 'utf-8');
        this.taxiData = JSON.parse(data);
        console.log(`✅ Cargados ${this.taxiData.length} paradas de taxi desde caché local`);
        
        // Crear índice espacial para búsquedas rápidas
        this.buildTaxiSpatialIndex();
        console.log(`✅ Índice espacial de taxis creado con ${this.taxiSpatialIndex.size} celdas`);
      } else {
        console.warn('⚠️ No se encontró taxi_data.json. Ejecuta: npx ts-node scripts/download-taxi-data.ts');
      }
    } catch (e) {
      console.error('❌ Error cargando datos de taxis:', e.message);
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

  private buildTaxiSpatialIndex() {
    for (const taxi of this.taxiData) {
      const key = this.getGridKey(taxi.lat, taxi.lon);
      if (!this.taxiSpatialIndex.has(key)) {
        this.taxiSpatialIndex.set(key, []);
      }
      this.taxiSpatialIndex.get(key)!.push(taxi);
    }
  }

  private loadBikeLaneData() {
    try {
      // Intentar primero desde la raíz del proyecto
      let dataPath = path.join(process.cwd(), 'bike_lanes_data.json');
      
      // Si no existe, intentar desde el código fuente
      if (!fs.existsSync(dataPath)) {
        dataPath = path.join(__dirname, '..', '..', 'bike_lanes_data.json');
      }
      
      if (fs.existsSync(dataPath)) {
        console.log(`📂 Cargando datos de carriles bici desde: ${dataPath}`);
        const data = fs.readFileSync(dataPath, 'utf-8');
        this.bikeLaneData = JSON.parse(data);
        console.log(`✅ Cargados ${this.bikeLaneData.length} carriles bici desde caché local`);
        
        // Crear índice espacial para búsquedas rápidas
        this.buildBikeLaneSpatialIndex();
        console.log(`✅ Índice espacial de carriles bici creado con ${this.bikeLaneSpatialIndex.size} celdas`);
      } else {
        console.warn('⚠️ No se encontró bike_lanes_data.json. Ejecuta: npx ts-node scripts/download-bike-lanes-data.ts');
      }
    } catch (e) {
      console.error('❌ Error cargando datos de carriles bici:', e.message);
    }
  }

  private buildBikeLaneSpatialIndex() {
    for (const lane of this.bikeLaneData) {
      const key = this.getGridKey(lane.lat, lane.lon);
      if (!this.bikeLaneSpatialIndex.has(key)) {
        this.bikeLaneSpatialIndex.set(key, []);
      }
      this.bikeLaneSpatialIndex.get(key)!.push(lane);
    }
  }

  private loadFootpathData() {
    try {
      // Intentar primero desde la raíz del proyecto
      let dataPath = path.join(process.cwd(), 'footpaths_data.json');
      
      // Si no existe, intentar desde el código fuente
      if (!fs.existsSync(dataPath)) {
        dataPath = path.join(__dirname, '..', '..', 'footpaths_data.json');
      }
      
      if (fs.existsSync(dataPath)) {
        console.log(`📂 Cargando datos de caminos peatonales desde: ${dataPath}`);
        const data = fs.readFileSync(dataPath, 'utf-8');
        this.footpathData = JSON.parse(data);
        console.log(`✅ Cargados ${this.footpathData.length} caminos peatonales desde caché local`);
        
        // Crear índice espacial para búsquedas rápidas
        this.buildFootpathSpatialIndex();
        console.log(`✅ Índice espacial de caminos peatonales creado con ${this.footpathSpatialIndex.size} celdas`);
      } else {
        console.warn('⚠️ No se encontró footpaths_data.json. Ejecuta: npx ts-node scripts/download-footpaths-data.ts');
      }
    } catch (e) {
      console.error('❌ Error cargando datos de caminos peatonales:', e.message);
    }
  }

  private buildFootpathSpatialIndex() {
    for (const path of this.footpathData) {
      const key = this.getGridKey(path.lat, path.lon);
      if (!this.footpathSpatialIndex.has(key)) {
        this.footpathSpatialIndex.set(key, []);
      }
      this.footpathSpatialIndex.get(key)!.push(path);
    }
  }

  private loadParkingData() {
    try {
      // Intentar primero desde la raíz del proyecto
      let dataPath = path.join(process.cwd(), 'parking_data.json');
      
      // Si no existe, intentar desde el código fuente
      if (!fs.existsSync(dataPath)) {
        dataPath = path.join(__dirname, '..', '..', 'parking_data.json');
      }
      
      if (fs.existsSync(dataPath)) {
        console.log(`📂 Cargando datos de parkings desde: ${dataPath}`);
        const data = fs.readFileSync(dataPath, 'utf-8');
        this.parkingData = JSON.parse(data);
        console.log(`✅ Cargados ${this.parkingData.length} parkings desde caché local`);
        
        // Crear índice espacial para búsquedas rápidas
        this.buildParkingSpatialIndex();
        console.log(`✅ Índice espacial de parkings creado con ${this.parkingSpatialIndex.size} celdas`);
      } else {
        console.warn('⚠️ No se encontró parking_data.json. Ejecuta: npx ts-node scripts/download-parking-data.ts');
      }
    } catch (e) {
      console.error('❌ Error cargando datos de parkings:', e.message);
    }
  }

  private buildParkingSpatialIndex() {
    for (const parking of this.parkingData) {
      const key = this.getGridKey(parking.lat, parking.lon);
      if (!this.parkingSpatialIndex.has(key)) {
        this.parkingSpatialIndex.set(key, []);
      }
      this.parkingSpatialIndex.get(key)!.push(parking);
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
      if (barrio.details) {
        console.log(`✅ [CACHE] ${barrio.name}`);
        resultados.push({
            barrio: barrio.name,
            detalle: JSON.parse(barrio.details || '{}')
        });
        continue;
      }

      console.log(`⚡ [API] Calculando ${barrio.name}...`);
      const calculo = await this.calculateFullScore(barrio.name, Number(barrio.latitude), Number(barrio.longitude));
      
      // Guardamos solo los detalles (no hay score total)
      barrio.details = JSON.stringify(calculo.detalle);
      await this.neighborhoodRepo.save(barrio);
      resultados.push(calculo);
    }
    // Ordenar por transporte público (métrica principal)
    return resultados.sort((a, b) => (b.detalle?.transport || 0) - (a.detalle?.transport || 0));
  }

  // --- 2. CÁLCULO CENTRAL PARALELO ---
  async calculateFullScore(barrio: string, lat: number, lon: number) {
    try {
        // Ejecutamos todos los grupos a la vez, pasando el tipo de categoría
        const [parking, transport, taxis, bikeLanes, footpaths, traffic, infra] = await Promise.all([
            this.processCategoryGroup(C.DATA_SOURCES.PARKING, lat, lon, 'PARKING'),
            this.processCategoryGroup(C.DATA_SOURCES.TRANSPORT, lat, lon, 'TRANSPORT'),
            this.processCategoryGroup(C.DATA_SOURCES.TAXIS, lat, lon, 'TAXIS'),
            this.processCategoryGroup(C.DATA_SOURCES.BIKE_LANES, lat, lon, 'BIKE_LANES'),
            this.processCategoryGroup(C.DATA_SOURCES.FOOTPATHS, lat, lon, 'FOOTPATHS'),
            this.processCategoryGroup(C.DATA_SOURCES.TRAFFIC, lat, lon, 'TRAFFIC'),
            this.processCategoryGroup(C.DATA_SOURCES.INFRA, lat, lon, 'INFRA'),
        ]);

        // No calculamos puntuación total - cada métrica es independiente
        return {
            barrio,
            detalle: { 
              parking,
              transport, 
              taxis,
              bike_lanes: bikeLanes,
              footpaths,
            }
        };
    } catch (error) {
        console.error(`Error crítico en ${barrio}`, error.message);
        return { barrio, error: "Fallo datos", detalle: {} };
    }
  }

  // --- 3. MOTOR GENÉRICO ---
  private async processCategoryGroup(apiList: any[], lat: number, lon: number, categoryType?: string): Promise<number> {
    if (!apiList || apiList.length === 0) return 0;

    const promises = apiList.map(apiConfig => {
        if (apiConfig.type === 'LACITY') {
            return this.fetchLaCityData(apiConfig.id, lat, lon);
        } else if (apiConfig.type === 'OVERPASS') {
            return this.fetchOverpassData(apiConfig.query, lat, lon);
        } else if (apiConfig.type === 'METRO_GTFS') {
            return this.fetchMetroGTFSData(apiConfig.url, lat, lon);
        } else if (apiConfig.type === 'LOCAL_TAXI') {
            return Promise.resolve(this.countNearbyTaxis(lat, lon));
        } else if (apiConfig.type === 'LOCAL_BIKE_LANE') {
            return Promise.resolve(this.countNearbyBikeLanes(lat, lon));
        } else if (apiConfig.type === 'LOCAL_FOOTPATH') {
            return Promise.resolve(this.countNearbyFootpaths(lat, lon));
        } else if (apiConfig.type === 'LOCAL_PARKING') {
            return Promise.resolve(this.countNearbyParkings(lat, lon));
        }
        return 0;
    });

    const results = await Promise.all(promises);
    const totalItems = results.reduce((sum, count) => sum + count, 0);

    // Normalizar con divisor específico según la categoría
    let divisor = 21; // default
    if (categoryType === 'TRANSPORT') {
      divisor = C.SCORE_DIVISORS.TRANSPORT;
    } else if (categoryType === 'TAXIS') {
      divisor = C.SCORE_DIVISORS.TAXIS;
    } else if (categoryType === 'BIKE_LANES') {
      divisor = C.SCORE_DIVISORS.BIKE_LANES;
    } else if (categoryType === 'FOOTPATHS') {
      divisor = C.SCORE_DIVISORS.FOOTPATHS;
    } else if (categoryType === 'PARKING') {
      divisor = C.SCORE_DIVISORS.PARKING;
    }

    // Calcular score normalizado entre 0-100
    const score = Math.min((totalItems / divisor) * 100, 100);
    return Math.round(score * 10) / 10; // Redondear a 1 decimal
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

  private countNearbyTaxis(lat: number, lon: number): number {
    let count = 0;
    
    // Usar índice espacial para reducir búsqueda
    const nearbyCells = this.getNearbyCells(lat, lon);
    
    for (const cellKey of nearbyCells) {
      const taxis = this.taxiSpatialIndex.get(cellKey);
      if (!taxis) continue;
      
      for (const taxi of taxis) {
        const distance = this.calculateDistance(lat, lon, taxi.lat, taxi.lon);
        if (distance <= C.RADIUS) {
          count++;
        }
      }
    }
    return count;
  }

  private countNearbyBikeLanes(lat: number, lon: number): number {
    let count = 0;
    
    // Usar índice espacial para reducir búsqueda
    const nearbyCells = this.getNearbyCells(lat, lon);
    
    for (const cellKey of nearbyCells) {
      const lanes = this.bikeLaneSpatialIndex.get(cellKey);
      if (!lanes) continue;
      
      for (const lane of lanes) {
        const distance = this.calculateDistance(lat, lon, lane.lat, lane.lon);
        if (distance <= C.RADIUS) {
          count++;
        }
      }
    }
    return count;
  }

  private countNearbyFootpaths(lat: number, lon: number): number {
    let count = 0;
    
    // Usar índice espacial para reducir búsqueda
    const nearbyCells = this.getNearbyCells(lat, lon);
    
    for (const cellKey of nearbyCells) {
      const paths = this.footpathSpatialIndex.get(cellKey);
      if (!paths) continue;
      
      for (const path of paths) {
        const distance = this.calculateDistance(lat, lon, path.lat, path.lon);
        if (distance <= C.RADIUS) {
          count++;
        }
      }
    }
    return count;
  }

  private countNearbyParkings(lat: number, lon: number): number {
    let count = 0;
    
    // Usar índice espacial para reducir búsqueda
    const nearbyCells = this.getNearbyCells(lat, lon);
    
    for (const cellKey of nearbyCells) {
      const parkings = this.parkingSpatialIndex.get(cellKey);
      if (!parkings) continue;
      
      for (const parking of parkings) {
        const distance = this.calculateDistance(lat, lon, parking.lat, parking.lon);
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