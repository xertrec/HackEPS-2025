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

interface UniversityData {
  id: number;
  name: string;
  lat: number;
  lon: number;
  type: string;
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
  private universitiesData: UniversityData[] | null = null;
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

      // Radio de búsqueda: 3 km (aumentado para capturar mejor la densidad real)
      const searchRadius = 3.0; // en km

      // Filtrar negocios dentro del radio REAL del barrio (circular)
      const businessesInNeighborhood = this.allShopsData.filter((business) => {
        if (!business.location_1) return false;
        
        const bizLat = parseFloat(business.location_1.latitude);
        const bizLon = parseFloat(business.location_1.longitude);
        
        const distance = this.calculateDistance(latitude, longitude, bizLat, bizLon);
        return distance <= searchRadius;
      });

      // Normalización realista basada en densidad comercial de LA (radio 3km):
      // Con radio de 3km, esperamos ~2.25x más negocios que con 2km
      // - Downtown/Koreatown: 1500-2500+ tiendas (distritos comerciales densos)
      // - Beverly Hills/Westwood: 800-1200 tiendas (comercio de lujo/universitario)
      // - Barrios comerciales: 400-800 tiendas
      // - Barrios residenciales densos: 200-400 tiendas
      // - Barrios residenciales dispersos: 50-200 tiendas
      // - Áreas industriales/periféricas: 0-50 tiendas
      // 
      // Escala logarítmica para evitar que todo sea 100:
      // 1500+ tiendas = 100%, 800 = 75%, 400 = 50%, 100 = 25%, 20 = 10%
      const shopsCount = businessesInNeighborhood.length;
      let percentage: number;
      
      if (shopsCount >= 1500) {
        percentage = 100;
      } else if (shopsCount >= 800) {
        // 800-1500: 75-100%
        percentage = Math.round(75 + (25 * (shopsCount - 800) / 700));
      } else if (shopsCount >= 400) {
        // 400-800: 50-75%
        percentage = Math.round(50 + (25 * (shopsCount - 400) / 400));
      } else if (shopsCount >= 100) {
        // 100-400: 25-50%
        percentage = Math.round(25 + (25 * (shopsCount - 100) / 300));
      } else if (shopsCount >= 20) {
        // 20-100: 10-25%
        percentage = Math.round(10 + (15 * (shopsCount - 20) / 80));
      } else {
        // 0-20: 0-10%
        percentage = Math.round((shopsCount / 20) * 10);
      }

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

      // Radio de búsqueda: 3 km (aumentado para capturar mejor la densidad real)
      const searchRadius = 3.0; // en km

      // Filtrar escuelas dentro del radio REAL del barrio (circular)
      const schoolsInNeighborhood = this.allSchoolsData.filter((school) => {
        if (!school.location_1) return false;
        
        const schoolLat = parseFloat(school.location_1.latitude);
        const schoolLon = parseFloat(school.location_1.longitude);
        
        const distance = this.calculateDistance(latitude, longitude, schoolLat, schoolLon);
        return distance <= searchRadius;
      });

      // Normalización realista para servicios educativos (radio 3km):
      // NAICS 611 incluye: escuelas públicas/privadas, universidades, academias,
      // centros de formación, tutorías, etc.
      // Con radio de 3km, esperamos ~2.25x más establecimientos
      // 
      // - Barrios universitarios (Westwood): 150-200+ establecimientos
      // - Barrios densos con escuelas (Koreatown): 80-150
      // - Barrios típicos: 40-80
      // - Barrios residenciales: 20-40
      // - Áreas periféricas: 0-20
      //
      // Escala: 150+ = 100%, 80 = 50%, 30 = 25%
      const schoolsCount = schoolsInNeighborhood.length;
      let percentage: number;
      
      if (schoolsCount >= 150) {
        percentage = 100;
      } else if (schoolsCount >= 80) {
        // 80-150: 50-100%
        percentage = Math.round(50 + (50 * (schoolsCount - 80) / 70));
      } else if (schoolsCount >= 30) {
        // 30-80: 25-50%
        percentage = Math.round(25 + (25 * (schoolsCount - 30) / 50));
      } else if (schoolsCount >= 10) {
        // 10-30: 10-25%
        percentage = Math.round(10 + (15 * (schoolsCount - 10) / 20));
      } else {
        // 0-10: 0-10%
        percentage = Math.round((schoolsCount / 10) * 10);
      }

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
   * Carga datos de universidades desde archivo local
   */
  private loadUniversitiesData(): void {
    if (this.universitiesData !== null) {
      return; // Ya cargado
    }

    try {
      // Buscar siempre en la raíz del proyecto
      const filePath = path.join(process.cwd(), 'universities_data.json');
      
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      this.universitiesData = JSON.parse(fileContent);
      if (this.universitiesData) {
        console.log(`✓ Cargadas ${this.universitiesData.length} universidades/colleges`);
      }
    } catch (error) {
      console.error('Error al cargar datos de universidades:', error.message);
      console.error(`Ruta buscada: ${path.join(process.cwd(), 'universities_data.json')}`);
      console.error('Ejecuta: npm run fetch-universities para descargar los datos');
      this.universitiesData = [];
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

      // Filtrar lugares de ocio nocturno en un radio de 3km (aumentado para mejor cobertura)
      const nightlifeSpots = this.filterByRadius(
        this.nightlifeData || [],
        latitude,
        longitude,
        3000,
      );

      // Normalización realista basada en densidad de ocio nocturno en LA (radio 3km):
      // Con radio de 3km, esperamos ~2.25x más locales que con 2km
      // - Downtown/Arts District/Hollywood: 80-120+ locales (epicentros nocturnos)
      // - West Hollywood/Koreatown/Santa Monica: 40-80 locales
      // - Silver Lake/Echo Park/Venice: 20-40 locales
      // - Barrios residenciales con algo de ocio: 10-20 locales
      // - Barrios residenciales tranquilos: 0-10 locales
      //
      // Escala: 100+ = 100%, 50 = 60%, 20 = 30%, 8 = 15%
      const count = nightlifeSpots.length;
      let percentage: number;
      
      if (count >= 100) {
        percentage = 100;
      } else if (count >= 50) {
        // 50-100: 60-100%
        percentage = Math.round(60 + (40 * (count - 50) / 50));
      } else if (count >= 20) {
        // 20-50: 30-60%
        percentage = Math.round(30 + (30 * (count - 20) / 30));
      } else if (count >= 8) {
        // 8-20: 15-30%
        percentage = Math.round(15 + (15 * (count - 8) / 12));
      } else {
        // 0-8: 0-15%
        percentage = Math.round((count / 8) * 15);
      }

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

      // Filtrar lugares de ocio diurno en un radio de 3km (aumentado para mejor cobertura)
      const leisureSpots = this.filterByRadius(
        this.dayLeisureData || [],
        latitude,
        longitude,
        3000,
      );

      // Normalización realista para ocio diurno en LA (radio 3km):
      // Incluye: cines, teatros, museos, parques, cafés, centros de arte/deportes
      // Nota: Las cafeterías son MUY comunes en LA (994 en total en la ciudad)
      // Con radio de 3km, esperamos ~2.25x más lugares
      //
      // - Barrios culturales/turísticos (DTLA, Santa Monica, Hollywood): 300-400+ lugares
      // - Barrios comerciales densos (Westwood, Koreatown, Venice): 150-300
      // - Barrios mixtos con vida (Silver Lake, Culver City): 80-150
      // - Barrios residenciales con servicios: 40-80
      // - Barrios residenciales tranquilos: 10-40
      // - Áreas industriales/periféricas: 0-10
      //
      // Escala: 350+ = 100%, 200 = 60%, 80 = 35%, 30 = 20%
      const count = leisureSpots.length;
      let percentage: number;
      
      if (count >= 350) {
        percentage = 100;
      } else if (count >= 200) {
        // 200-350: 60-100%
        percentage = Math.round(60 + (40 * (count - 200) / 150));
      } else if (count >= 80) {
        // 80-200: 35-60%
        percentage = Math.round(35 + (25 * (count - 80) / 120));
      } else if (count >= 30) {
        // 30-80: 20-35%
        percentage = Math.round(20 + (15 * (count - 30) / 50));
      } else if (count >= 10) {
        // 10-30: 10-20%
        percentage = Math.round(10 + (10 * (count - 10) / 20));
      } else {
        // 0-10: 0-10%
        percentage = Math.round((count / 10) * 10);
      }

      this.businessCache.set(cacheKey, percentage);
      this.cacheTimestamp = now;

      return percentage;
    } catch (error) {
      console.error(`Error al calcular ocio diurno para ${neighborhoodName}:`, error.message);
      return 0;
    }
  }

  /**
   * Filtra universidades dentro de un radio específico
   */
  private filterUniversitiesByRadius(
    universities: UniversityData[],
    centerLat: number,
    centerLon: number,
    radiusMeters: number,
  ): UniversityData[] {
    const radiusKm = radiusMeters / 1000; // Convertir metros a km
    return universities.filter(university => {
      const distanceKm = this.calculateDistance(
        centerLat,
        centerLon,
        university.lat,
        university.lon,
      );
      return distanceKm <= radiusKm;
    });
  }

  /**
   * Calcula el porcentaje de acceso a universidades para un barrio
   * @param neighborhoodName Nombre del barrio
   * @param latitude Latitud del centro del barrio
   * @param longitude Longitud del centro del barrio
   * @returns Porcentaje de acceso a universidades (0-100)
   */
  async calculateUniversitiesPercentage(
    neighborhoodName: string,
    latitude: number,
    longitude: number,
  ): Promise<number> {
    try {
      const cacheKey = `universities_${neighborhoodName}`;
      const now = Date.now();
      if (this.businessCache.has(cacheKey) && 
          (now - this.cacheTimestamp) < this.CACHE_DURATION) {
        return this.businessCache.get(cacheKey) || 0;
      }

      // Cargar datos si no están cargados
      this.loadUniversitiesData();

      // Filtrar universidades en un radio de 4km (balanceado para capturar acceso real)
      const nearbyUniversities = this.filterUniversitiesByRadius(
        this.universitiesData || [],
        latitude,
        longitude,
        4000, // 4km de radio - captura acceso razonable en LA
      );

      // Calcular puntuación ponderada por tipo y distancia
      // Las universidades grandes (university) pesan más que colleges/extensions
      let weightedScore = 0;
      for (const uni of nearbyUniversities) {
        const distance = this.calculateDistance(latitude, longitude, uni.lat, uni.lon);
        
        // Factor de peso por tipo
        let typeWeight = 1.0;
        if (uni.type === 'university') {
          // Universidades principales pesan más
          typeWeight = 1.5;
        } else {
          // Colleges, extensions, etc. pesan menos
          typeWeight = 0.9;
        }
        
        // Factor de distancia (más cerca = más puntos, decae exponencialmente)
        // 0-1km: 1.0x, 1-2km: 0.7x, 2-3km: 0.4x, 3-4km: 0.2x
        let distanceWeight = 1.0;
        if (distance > 3.0) {
          distanceWeight = 0.2;
        } else if (distance > 2.0) {
          distanceWeight = 0.4;
        } else if (distance > 1.0) {
          distanceWeight = 0.7;
        }
        
        weightedScore += typeWeight * distanceWeight;
      }

      // Normalización basada en puntuación ponderada (radio 4km con decay):
      // - Barrios universitarios principales (Westwood/UCLA, USC, Pasadena): 3.0+ puntos
      // - Barrios con campus importantes (DTLA, Santa Monica, El Sereno): 2.0-3.0 puntos
      // - Barrios con acceso bueno (Van Nuys, Hollywood): 1.0-2.0 puntos
      // - Barrios con acceso básico: 0.3-1.0 puntos
      // - Sin acceso cercano: 0-0.3 puntos
      //
      // Escala: 3.0+ = 100%, 2.0 = 75%, 1.0 = 50%, 0.3 = 20%
      let percentage: number;
      
      if (weightedScore >= 3.0) {
        percentage = 100;
      } else if (weightedScore >= 2.0) {
        // 2.0-3.0: 75-100%
        percentage = Math.round(75 + (25 * (weightedScore - 2.0) / 1.0));
      } else if (weightedScore >= 1.0) {
        // 1.0-2.0: 50-75%
        percentage = Math.round(50 + (25 * (weightedScore - 1.0) / 1.0));
      } else if (weightedScore >= 0.3) {
        // 0.3-1.0: 20-50%
        percentage = Math.round(20 + (30 * (weightedScore - 0.3) / 0.7));
      } else if (weightedScore > 0) {
        // 0-0.3: 0-20%
        percentage = Math.round((weightedScore / 0.3) * 20);
      } else {
        percentage = 0;
      }

      this.businessCache.set(cacheKey, percentage);
      this.cacheTimestamp = now;

      return percentage;
    } catch (error) {
      console.error(`Error al calcular universidades para ${neighborhoodName}:`, error.message);
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
