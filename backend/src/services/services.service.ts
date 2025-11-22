import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as fs from 'fs';

interface LABusinessData {
  location_account: string;
  business_name: string;
  dba_name: string;
  street_address: string;
  city: string;
  zip_code: string;
  location_description: string;
  mailing_address: string;
  mailing_city: string;
  mailing_zip_code: string;
  naics: string;
  primary_naics_description: string;
  council_district: string;
  location_start_date: string;
  location_end_date: string;
  location_1?: {
    latitude: string;
    longitude: string;
  };
}

interface Hospital {
  FACNAME: string;
  CITY: string;
  LATITUDE: number;
  LONGITUDE: number;
}

interface PoliceStation {
  division: string;
  location: string;
  latitude: number;
  longitude: number;
}

interface FireStation {
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  organization: string;
}

interface OverpassElement {
  type: string;
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

@Injectable()
export class ServicesService {
  private readonly LA_OPEN_DATA_API = 'https://data.lacity.org/resource/6rrh-rzua.json';
  private businessCache: Map<string, number> = new Map();
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 3600000; // 1 hora en milisegundos
  private readonly OVERPASS_API = 'https://overpass-api.de/api/interpreter';
  private hospitalsDb: sqlite3.Database;
  private hospitalsData: Hospital[] | null = null;
  private policeStationsData: PoliceStation[] | null = null;
  private fireStationsData: FireStation[] | null = null;
  private nightlifeData: OverpassElement[] | null = null;
  private dayLeisureData: OverpassElement[] | null = null;
  private allShopsData: LABusinessData[] | null = null;
  private allSchoolsData: LABusinessData[] | null = null;
  private dataLoadPromise: Promise<void> | null = null;

  /**
   * Carga todos los datos de LA Open Data una sola vez al inicio
   */
  private async loadAllLAOpenData(): Promise<void> {
    if (this.dataLoadPromise) {
      return this.dataLoadPromise;
    }

    this.dataLoadPromise = (async () => {
      console.log('🔄 Cargando todos los datos de LA Open Data...');
      
      try {
        // Cargar todas las tiendas (NAICS 44* y 45*)
        if (!this.allShopsData) {
          console.log('  📦 Descargando datos de tiendas...');
          const shopsResponse = await axios.get(this.LA_OPEN_DATA_API, {
            params: {
              $limit: 50000,
              $where: `location_1.latitude IS NOT NULL AND 
                       location_1.longitude IS NOT NULL AND
                       (naics LIKE '44%' OR naics LIKE '45%')`,
            },
            timeout: 30000,
          });
          this.allShopsData = shopsResponse.data;
          console.log(`  ✓ ${this.allShopsData?.length || 0} tiendas cargadas`);
        }

        // Esperar 2 segundos para evitar rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Cargar todas las escuelas (NAICS 611*)
        if (!this.allSchoolsData) {
          console.log('  🏫 Descargando datos de escuelas...');
          const schoolsResponse = await axios.get(this.LA_OPEN_DATA_API, {
            params: {
              $limit: 50000,
              $where: `location_1.latitude IS NOT NULL AND 
                       location_1.longitude IS NOT NULL AND
                       naics LIKE '611%'`,
            },
            timeout: 30000,
          });
          this.allSchoolsData = schoolsResponse.data;
          console.log(`  ✓ ${this.allSchoolsData?.length || 0} escuelas cargadas`);
        }

        console.log('✅ Todos los datos de LA Open Data cargados correctamente');
      } catch (error) {
        console.error('❌ Error al cargar datos de LA Open Data:', error.message);
        this.dataLoadPromise = null; // Resetear para reintentar
        throw error;
      }
    })();

    return this.dataLoadPromise;
  }

  /**
   * Calcula el porcentaje de tiendas en un barrio específico
   * @param neighborhoodName Nombre del barrio
   * @param latitude Latitud del centro del barrio
   * @param longitude Longitud del centro del barrio
   * @returns Porcentaje de tiendas (0-100)
   */
  async calculateShopsPercentage(
    neighborhoodName: string,
    latitude: number,
    longitude: number,
  ): Promise<number> {
    try {
      // Verificar si tenemos datos en caché
      const cacheKey = `shops_${neighborhoodName}`;
      const now = Date.now();
      if (this.businessCache.has(cacheKey) && 
          (now - this.cacheTimestamp) < this.CACHE_DURATION) {
        return this.businessCache.get(cacheKey) || 0;
      }

      // Cargar todos los datos si no están cargados
      await this.loadAllLAOpenData();

      if (!this.allShopsData) {
        console.error('No se pudieron cargar los datos de tiendas');
        return 0;
      }

      // Radio de búsqueda: 2 km
      const searchRadius = 2.0; // en km

      // Filtrar negocios dentro del radio REAL del barrio (circular)
      const businessesInNeighborhood = this.allShopsData.filter((business) => {
        if (!business.location_1) return false;
        
        const bizLat = parseFloat(business.location_1.latitude);
        const bizLon = parseFloat(business.location_1.longitude);
        
        const distance = this.calculateDistance(latitude, longitude, bizLat, bizLon);
        return distance <= searchRadius;
      });

      // Calcular el porcentaje basado en densidad realista
      // Koreatown/Downtown tienen 600-800 tiendas
      // Barrios comerciales tienen 300-500 tiendas
      // Barrios mixtos tienen 100-200 tiendas
      // Barrios residenciales tienen 20-80 tiendas
      // Normalizamos: 600+ tiendas = 100%
      const shopsCount = businessesInNeighborhood.length;
      const percentage = Math.min(Math.round((shopsCount / 600) * 100), 100);

      // Guardar en caché
      this.businessCache.set(cacheKey, percentage);
      this.cacheTimestamp = now;

      return percentage;
    } catch (error) {
      console.error(`Error al calcular porcentaje de tiendas para ${neighborhoodName}:`, error.message);
      // En caso de error, retornar 0
      return 0;
    }
  }

  /**
   * Calcula el porcentaje de escuelas en un barrio específico
   * @param neighborhoodName Nombre del barrio
   * @param latitude Latitud del centro del barrio
   * @param longitude Longitud del centro del barrio
   * @returns Porcentaje de escuelas (0-100)
   */
  async calculateSchoolsPercentage(
    neighborhoodName: string,
    latitude: number,
    longitude: number,
  ): Promise<number> {
    try {
      // Verificar si tenemos datos en caché
      const cacheKey = `schools_${neighborhoodName}`;
      const now = Date.now();
      if (this.businessCache.has(cacheKey) && 
          (now - this.cacheTimestamp) < this.CACHE_DURATION) {
        return this.businessCache.get(cacheKey) || 0;
      }

      // Cargar todos los datos si no están cargados
      await this.loadAllLAOpenData();

      if (!this.allSchoolsData) {
        console.error('No se pudieron cargar los datos de escuelas');
        return 0;
      }

      // Radio de búsqueda: 2 km
      const searchRadius = 2.0; // en km

      // Filtrar escuelas dentro del radio REAL del barrio (circular)
      const schoolsInNeighborhood = this.allSchoolsData.filter((school) => {
        if (!school.location_1) return false;
        
        const schoolLat = parseFloat(school.location_1.latitude);
        const schoolLon = parseFloat(school.location_1.longitude);
        
        const distance = this.calculateDistance(latitude, longitude, schoolLat, schoolLon);
        return distance <= searchRadius;
      });

      // Calcular el porcentaje basado en densidad realista
      // Barrios grandes tienen 40-60 establecimientos educativos (incluye academias, centros de formación)
      // Barrios típicos tienen 20-30
      // Barrios pequeños tienen 5-15
      // Normalizamos: 50+ escuelas/centros educativos = 100%
      const schoolsCount = schoolsInNeighborhood.length;
      const percentage = Math.min(Math.round((schoolsCount / 50) * 100), 100);

      // Guardar en caché
      this.businessCache.set(cacheKey, percentage);
      this.cacheTimestamp = now;

      return percentage;
    } catch (error) {
      console.error(`Error al calcular porcentaje de escuelas para ${neighborhoodName}:`, error.message);
      // En caso de error, retornar 0
      return 0;
    }
  }

  /**
   * Carga los datos de hospitales desde la geodatabase
   */
  private async loadHospitalsData(): Promise<Hospital[]> {
    if (this.hospitalsData) {
      return this.hospitalsData;
    }

    return new Promise((resolve, reject) => {
      const dbPath = path.join(process.cwd(), 'Points_of_Interest_7829132718955710567.geodatabase');
      this.hospitalsDb = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          console.error('Error al abrir la geodatabase de hospitales:', err);
          reject(err);
          return;
        }

        this.hospitalsDb.all(
          'SELECT FACNAME, CITY, LATITUDE, LONGITUDE FROM Hospitals WHERE LATITUDE IS NOT NULL AND LONGITUDE IS NOT NULL',
          (err, rows: Hospital[]) => {
            if (err) {
              console.error('Error al leer hospitales:', err);
              reject(err);
            } else {
              this.hospitalsData = rows;
              console.log(`✓ ${rows.length} hospitales cargados desde la geodatabase`);
              resolve(rows);
            }
          }
        );
      });
    });
  }

  /**
   * Calcula la distancia en km entre dos puntos (fórmula de Haversine simplificada)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calcula el porcentaje de accesibilidad a hospitales para un barrio
   * @param neighborhoodName Nombre del barrio
   * @param latitude Latitud del centro del barrio
   * @param longitude Longitud del centro del barrio
   * @returns Porcentaje de accesibilidad a hospitales (0-100)
   */
  async calculateHospitalsPercentage(
    neighborhoodName: string,
    latitude: number,
    longitude: number,
  ): Promise<number> {
    try {
      // Verificar si tenemos datos en caché
      const cacheKey = `hospitals_${neighborhoodName}`;
      const now = Date.now();
      if (this.businessCache.has(cacheKey) && 
          (now - this.cacheTimestamp) < this.CACHE_DURATION) {
        return this.businessCache.get(cacheKey) || 0;
      }

      // Cargar datos de hospitales si no están cargados
      const hospitals = await this.loadHospitalsData();

      // Calcular distancias a todos los hospitales
      const hospitalsWithDistance = hospitals.map(hospital => ({
        ...hospital,
        distance: this.calculateDistance(
          latitude,
          longitude,
          hospital.LATITUDE,
          hospital.LONGITUDE
        )
      })).sort((a, b) => a.distance - b.distance);

      // Encontrar el hospital más cercano
      const nearestHospital = hospitalsWithDistance[0];
      
      if (!nearestHospital) {
        return 0;
      }

      // Calcular porcentaje basado en accesibilidad a hospitales
      // Tiempo promedio de ambulancia en LA: 8-15 minutos
      // Distancia equivalente: 3-8 km
      
      const distance = nearestHospital.distance;
      
      // Escala realista:
      // - 0-2 km = Excelente (85-100%) - Hospital muy cercano
      // - 2-5 km = Bueno (65-85%) - Buena accesibilidad
      // - 5-10 km = Aceptable (40-65%) - Distancia razonable
      // - 10-15 km = Bajo (20-40%) - Lejos
      // - 15+ km = Muy bajo (0-20%) - Muy lejos
      
      let percentage: number;
      if (distance <= 2) {
        percentage = Math.round(85 + (15 * (2 - distance) / 2));
      } else if (distance <= 5) {
        percentage = Math.round(65 + (20 * (5 - distance) / 3));
      } else if (distance <= 10) {
        percentage = Math.round(40 + (25 * (10 - distance) / 5));
      } else if (distance <= 15) {
        percentage = Math.round(20 + (20 * (15 - distance) / 5));
      } else {
        percentage = Math.round(Math.max(0, 20 * (25 - distance) / 10));
      }

      // Guardar en caché
      this.businessCache.set(cacheKey, percentage);
      this.cacheTimestamp = now;

      return percentage;
    } catch (error) {
      console.error(`Error al calcular porcentaje de hospitales para ${neighborhoodName}:`, error.message);
      // En caso de error, retornar 0
      return 0;
    }
  }

  /**
   * Carga los datos de comisarías desde el archivo JSON
   */
  private async loadPoliceStationsData(): Promise<PoliceStation[]> {
    if (this.policeStationsData) {
      return this.policeStationsData;
    }

    return new Promise((resolve, reject) => {
      const filePath = path.join(process.cwd(), 'police_stations.json');
      const fs = require('fs');
      
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          console.error('Error al leer police_stations.json:', err);
          reject(err);
          return;
        }

        try {
          const parsedData: PoliceStation[] = JSON.parse(data);
          this.policeStationsData = parsedData;
          console.log(`✓ ${parsedData.length} comisarías cargadas desde police_stations.json`);
          resolve(parsedData);
        } catch (error) {
          console.error('Error al parsear police_stations.json:', error);
          reject(error);
        }
      });
    });
  }

  /**
   * Calcula el porcentaje de seguridad/accesibilidad a comisarías para un barrio
   * @param neighborhoodName Nombre del barrio
   * @param latitude Latitud del centro del barrio
   * @param longitude Longitud del centro del barrio
   * @returns Porcentaje de accesibilidad a comisarías (0-100)
   */
  async calculatePoliceStationsPercentage(
    neighborhoodName: string,
    latitude: number,
    longitude: number,
  ): Promise<number> {
    try {
      // Verificar si tenemos datos en caché
      const cacheKey = `police_${neighborhoodName}`;
      const now = Date.now();
      if (this.businessCache.has(cacheKey) && 
          (now - this.cacheTimestamp) < this.CACHE_DURATION) {
        return this.businessCache.get(cacheKey) || 0;
      }

      // Cargar datos de comisarías si no están cargados
      const policeStations = await this.loadPoliceStationsData();

      // Calcular distancias a todas las comisarías
      const stationsWithDistance = policeStations.map(station => ({
        ...station,
        distance: this.calculateDistance(
          latitude,
          longitude,
          station.latitude,
          station.longitude
        )
      })).sort((a, b) => a.distance - b.distance);

      // Encontrar la comisaría más cercana
      const nearestStation = stationsWithDistance[0];
      
      if (!nearestStation) {
        return 0;
      }

      // Calcular porcentaje basado en accesibilidad realista:
      // - Distancia a la comisaría más cercana es el factor principal
      // - En LA hay 21 comisarías para ~4 millones de personas
      // - La distancia promedio debería ser ~5-8km
      
      const distance = nearestStation.distance;
      
      // Escala realista:
      // - 0-3 km = Excelente (80-100%)
      // - 3-6 km = Bueno (60-80%)
      // - 6-10 km = Aceptable (40-60%)
      // - 10-15 km = Bajo (20-40%)
      // - 15+ km = Muy bajo (0-20%)
      
      let percentage: number;
      if (distance <= 3) {
        percentage = Math.round(80 + (20 * (3 - distance) / 3));
      } else if (distance <= 6) {
        percentage = Math.round(60 + (20 * (6 - distance) / 3));
      } else if (distance <= 10) {
        percentage = Math.round(40 + (20 * (10 - distance) / 4));
      } else if (distance <= 15) {
        percentage = Math.round(20 + (20 * (15 - distance) / 5));
      } else {
        percentage = Math.round(Math.max(0, 20 * (25 - distance) / 10));
      }

      // Guardar en caché
      this.businessCache.set(cacheKey, percentage);
      this.cacheTimestamp = now;

      return percentage;
    } catch (error) {
      console.error(`Error al calcular porcentaje de comisarías para ${neighborhoodName}:`, error.message);
      // En caso de error, retornar 0
      return 0;
    }
  }

  /**
   * Carga los datos de estaciones de bomberos desde el archivo JSON
   */
  private async loadFireStationsData(): Promise<FireStation[]> {
    if (this.fireStationsData) {
      return this.fireStationsData;
    }

    return new Promise((resolve, reject) => {
      const filePath = path.join(process.cwd(), 'fire_stations.json');
      const fs = require('fs');
      
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          console.error('Error al leer fire_stations.json:', err);
          reject(err);
          return;
        }

        try {
          const parsedData: FireStation[] = JSON.parse(data);
          this.fireStationsData = parsedData;
          console.log(`✓ ${parsedData.length} estaciones de bomberos cargadas desde fire_stations.json`);
          resolve(parsedData);
        } catch (error) {
          console.error('Error al parsear fire_stations.json:', error);
          reject(error);
        }
      });
    });
  }

  /**
   * Calcula el porcentaje de seguridad/accesibilidad a estaciones de bomberos para un barrio
   * @param neighborhoodName Nombre del barrio
   * @param latitude Latitud del centro del barrio
   * @param longitude Longitud del centro del barrio
   * @returns Porcentaje de accesibilidad a estaciones de bomberos (0-100)
   */
  async calculateFireStationsPercentage(
    neighborhoodName: string,
    latitude: number,
    longitude: number,
  ): Promise<number> {
    try {
      // Verificar si tenemos datos en caché
      const cacheKey = `fire_${neighborhoodName}`;
      const now = Date.now();
      if (this.businessCache.has(cacheKey) && 
          (now - this.cacheTimestamp) < this.CACHE_DURATION) {
        return this.businessCache.get(cacheKey) || 0;
      }

      // Cargar datos de estaciones de bomberos si no están cargados
      const fireStations = await this.loadFireStationsData();

      // Calcular distancias a todas las estaciones de bomberos
      const stationsWithDistance = fireStations.map(station => ({
        ...station,
        distance: this.calculateDistance(
          latitude,
          longitude,
          station.latitude,
          station.longitude
        )
      })).sort((a, b) => a.distance - b.distance);

      // Encontrar la estación más cercana
      const nearestStation = stationsWithDistance[0];
      
      if (!nearestStation) {
        return 0;
      }

      // Calcular porcentaje basado en distancia a la estación más cercana
      // Los bomberos tienen tiempos de respuesta objetivo de 4-6 minutos
      // Esto equivale a ~2-3 km en áreas urbanas
      
      const distance = nearestStation.distance;
      
      // Escala realista basada en estándares NFPA:
      // - 0-2 km = Excelente (90-100%) - Respuesta <5 min
      // - 2-4 km = Bueno (70-90%) - Respuesta 5-8 min
      // - 4-6 km = Aceptable (50-70%) - Respuesta 8-12 min
      // - 6-10 km = Bajo (25-50%) - Respuesta 12-20 min
      // - 10+ km = Muy bajo (0-25%) - Respuesta >20 min
      
      let percentage: number;
      if (distance <= 2) {
        percentage = Math.round(90 + (10 * (2 - distance) / 2));
      } else if (distance <= 4) {
        percentage = Math.round(70 + (20 * (4 - distance) / 2));
      } else if (distance <= 6) {
        percentage = Math.round(50 + (20 * (6 - distance) / 2));
      } else if (distance <= 10) {
        percentage = Math.round(25 + (25 * (10 - distance) / 4));
      } else {
        percentage = Math.round(Math.max(0, 25 * (15 - distance) / 5));
      }

      // Guardar en caché
      this.businessCache.set(cacheKey, percentage);
      this.cacheTimestamp = now;

      return percentage;
    } catch (error) {
      console.error(`Error al calcular porcentaje de estaciones de bomberos para ${neighborhoodName}:`, error.message);
      // En caso de error, retornar 0
      return 0;
    }
  }

  /**
   * Carga datos de ocio nocturno desde archivo local
   */
  private loadNightlifeData(): void {
    if (this.nightlifeData !== null) {
      return; // Ya cargado
    }

    try {
      // Buscar siempre en la raíz del proyecto
      const filePath = path.join(process.cwd(), 'nightlife_data.json');
      
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      this.nightlifeData = JSON.parse(fileContent);
      if (this.nightlifeData) {
        console.log(`✓ Cargados ${this.nightlifeData.length} lugares de ocio nocturno`);
      }
    } catch (error) {
      console.error('Error al cargar datos de ocio nocturno:', error.message);
      console.error(`Ruta buscada: ${path.join(process.cwd(), 'nightlife_data.json')}`);
      console.error('Ejecuta: npm run fetch-leisure para descargar los datos');
      this.nightlifeData = [];
    }
  }

  /**
   * Carga datos de ocio diurno desde archivo local
   */
  private loadDayLeisureData(): void {
    if (this.dayLeisureData !== null) {
      return; // Ya cargado
    }

    try {
      // Buscar siempre en la raíz del proyecto
      const filePath = path.join(process.cwd(), 'dayleisure_data.json');
      
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      this.dayLeisureData = JSON.parse(fileContent);
      if (this.dayLeisureData) {
        console.log(`✓ Cargados ${this.dayLeisureData.length} lugares de ocio diurno`);
      }
    } catch (error) {
      console.error('Error al cargar datos de ocio diurno:', error.message);
      console.error(`Ruta buscada: ${path.join(process.cwd(), 'dayleisure_data.json')}`);
      console.error('Ejecuta: npm run fetch-leisure para descargar los datos');
      this.dayLeisureData = [];
    }
  }

  /**
   * Filtra lugares dentro de un radio específico
   */
  private filterByRadius(
    elements: OverpassElement[],
    centerLat: number,
    centerLon: number,
    radiusMeters: number,
  ): OverpassElement[] {
    const radiusKm = radiusMeters / 1000; // Convertir metros a km
    return elements.filter(element => {
      const distanceKm = this.calculateDistance(
        centerLat,
        centerLon,
        element.lat,
        element.lon,
      );
      return distanceKm <= radiusKm;
    });
  }

  /**
   * Calcula el porcentaje de ocio nocturno para un barrio
   */
  async calculateNightlifePercentage(
    neighborhoodName: string,
    latitude: number,
    longitude: number,
  ): Promise<number> {
    try {
      const cacheKey = `nightlife_${neighborhoodName}`;
      const now = Date.now();
      if (this.businessCache.has(cacheKey) && 
          (now - this.cacheTimestamp) < this.CACHE_DURATION) {
        return this.businessCache.get(cacheKey) || 0;
      }

      // Cargar datos si no están cargados
      this.loadNightlifeData();

      // Filtrar lugares de ocio nocturno en un radio de 2km
      const nightlifeSpots = this.filterByRadius(
        this.nightlifeData || [],
        latitude,
        longitude,
        2000,
      );

      // Normalización realista:
      // - Hollywood/DTLA tienen 25-30+ locales nocturnos en 2km
      // - Barrios de ocio (West Hollywood, Silver Lake) tienen 15-20
      // - Barrios residenciales tienen 0-5
      // - Barrios comerciales tienen 5-10
      // Escala: 50+ lugares = 100%
      const percentage = Math.min(Math.round((nightlifeSpots.length / 50) * 100), 100);

      this.businessCache.set(cacheKey, percentage);
      this.cacheTimestamp = now;

      return percentage;
    } catch (error) {
      console.error(`Error al calcular ocio nocturno para ${neighborhoodName}:`, error.message);
      return 0;
    }
  }

  /**
   * Calcula el porcentaje de ocio diurno para un barrio
   */
  async calculateDayLeisurePercentage(
    neighborhoodName: string,
    latitude: number,
    longitude: number,
  ): Promise<number> {
    try {
      const cacheKey = `dayleisure_${neighborhoodName}`;
      const now = Date.now();
      if (this.businessCache.has(cacheKey) && 
          (now - this.cacheTimestamp) < this.CACHE_DURATION) {
        return this.businessCache.get(cacheKey) || 0;
      }

      // Cargar datos si no están cargados
      this.loadDayLeisureData();

      // Filtrar lugares de ocio diurno en un radio de 2km
      const leisureSpots = this.filterByRadius(
        this.dayLeisureData || [],
        latitude,
        longitude,
        2000,
      );

      // Normalización realista:
      // - Barrios turísticos/culturales (Santa Monica, Hollywood) tienen 80-100+ lugares
      // - Barrios comerciales tienen 40-60 lugares
      // - Barrios residenciales tienen 10-20 lugares
      // Nota: Incluye cafeterías que son muy comunes en LA (994 en total)
      // Escala: 100+ lugares = 100%
      const percentage = Math.min(Math.round((leisureSpots.length / 100) * 100), 100);

      this.businessCache.set(cacheKey, percentage);
      this.cacheTimestamp = now;

      return percentage;
    } catch (error) {
      console.error(`Error al calcular ocio diurno para ${neighborhoodName}:`, error.message);
      return 0;
    }
  }

  /**
   * Limpia el caché de negocios
   */
  clearCache(): void {
    this.businessCache.clear();
    this.cacheTimestamp = 0;
  }
}
