import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as sqlite3 from 'sqlite3';
import * as path from 'path';

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

@Injectable()
export class ServicesService {
  private readonly LA_OPEN_DATA_API = 'https://data.lacity.org/resource/6rrh-rzua.json';
  private businessCache: Map<string, number> = new Map();
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 3600000; // 1 hora en milisegundos
  private hospitalsDb: sqlite3.Database;
  private hospitalsData: Hospital[] | null = null;
  private policeStationsData: PoliceStation[] | null = null;
  private fireStationsData: FireStation[] | null = null;

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

      // Radio de búsqueda en grados (aproximadamente 1-2 km)
      const radiusDegrees = 0.015;

      // Consultar la API de Los Angeles Open Data
      // Filtramos por negocios de retail/tiendas según el código NAICS
      const response = await axios.get(this.LA_OPEN_DATA_API, {
        params: {
          $limit: 5000,
          $where: `location_1.latitude IS NOT NULL AND 
                   location_1.longitude IS NOT NULL AND
                   naics LIKE '44%' OR naics LIKE '45%'`, // Códigos NAICS para retail
        },
        timeout: 10000,
      });

      const businesses: LABusinessData[] = response.data;

      // Filtrar negocios dentro del radio del barrio
      const businessesInNeighborhood = businesses.filter((business) => {
        if (!business.location_1) return false;
        
        const bizLat = parseFloat(business.location_1.latitude);
        const bizLon = parseFloat(business.location_1.longitude);
        
        const latDiff = Math.abs(bizLat - latitude);
        const lonDiff = Math.abs(bizLon - longitude);
        
        return latDiff <= radiusDegrees && lonDiff <= radiusDegrees;
      });

      // Calcular el porcentaje basado en la densidad de tiendas
      // Normalizamos considerando que 100+ tiendas = 100%
      const shopsCount = businessesInNeighborhood.length;
      const percentage = Math.min(Math.round((shopsCount / 100) * 100), 100);

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

      // Radio de búsqueda en grados (aproximadamente 1-2 km)
      const radiusDegrees = 0.015;

      // Consultar la API de Los Angeles Open Data para escuelas
      // NAICS 611 corresponde a servicios educativos
      const response = await axios.get(this.LA_OPEN_DATA_API, {
        params: {
          $limit: 5000,
          $where: `location_1.latitude IS NOT NULL AND 
                   location_1.longitude IS NOT NULL AND
                   naics LIKE '611%'`, // Código NAICS para servicios educativos
        },
        timeout: 10000,
      });

      const schools: LABusinessData[] = response.data;

      // Filtrar escuelas dentro del radio del barrio
      const schoolsInNeighborhood = schools.filter((school) => {
        if (!school.location_1) return false;
        
        const schoolLat = parseFloat(school.location_1.latitude);
        const schoolLon = parseFloat(school.location_1.longitude);
        
        const latDiff = Math.abs(schoolLat - latitude);
        const lonDiff = Math.abs(schoolLon - longitude);
        
        return latDiff <= radiusDegrees && lonDiff <= radiusDegrees;
      });

      // Calcular el porcentaje basado en la densidad de escuelas
      // Normalizamos considerando que 50+ escuelas = 100%
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

      // Calcular porcentaje basado en:
      // 1. Distancia al hospital más cercano (peso 60%)
      // 2. Cantidad de hospitales en un radio de 5km (peso 40%)
      
      // Porcentaje por distancia (100% si está a menos de 1km, 0% si está a más de 10km)
      const distanceScore = Math.max(0, Math.min(100, 100 - (nearestHospital.distance - 1) * 11.11));
      
      // Contar hospitales en un radio de 5km
      const hospitalsNearby = hospitalsWithDistance.filter(h => h.distance <= 5).length;
      // Porcentaje por cantidad (100% si hay 5 o más hospitales cerca)
      const quantityScore = Math.min(100, (hospitalsNearby / 5) * 100);
      
      // Combinación ponderada
      const percentage = Math.round((distanceScore * 0.6) + (quantityScore * 0.4));

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

      // Calcular porcentaje basado en:
      // 1. Distancia a la comisaría más cercana (peso 70%)
      // 2. Cantidad de comisarías en un radio de 10km (peso 30%)
      
      // Porcentaje por distancia (100% si está a menos de 2km, 0% si está a más de 15km)
      const distanceScore = Math.max(0, Math.min(100, 100 - ((nearestStation.distance - 2) / 13) * 100));
      
      // Contar comisarías en un radio de 10km
      const stationsNearby = stationsWithDistance.filter(s => s.distance <= 10).length;
      // Porcentaje por cantidad (100% si hay 3 o más comisarías cerca)
      const quantityScore = Math.min(100, (stationsNearby / 3) * 100);
      
      // Combinación ponderada
      const percentage = Math.round((distanceScore * 0.7) + (quantityScore * 0.3));

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

      // Calcular porcentaje basado en:
      // 1. Distancia a la estación más cercana (peso 70%)
      // 2. Cantidad de estaciones en un radio de 8km (peso 30%)
      
      // Porcentaje por distancia (100% si está a menos de 1.5km, 0% si está a más de 12km)
      const distanceScore = Math.max(0, Math.min(100, 100 - ((nearestStation.distance - 1.5) / 10.5) * 100));
      
      // Contar estaciones en un radio de 8km
      const stationsNearby = stationsWithDistance.filter(s => s.distance <= 8).length;
      // Porcentaje por cantidad (100% si hay 4 o más estaciones cerca)
      const quantityScore = Math.min(100, (stationsNearby / 4) * 100);
      
      // Combinación ponderada
      const percentage = Math.round((distanceScore * 0.7) + (quantityScore * 0.3));

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
   * Limpia el caché de negocios
   */
  clearCache(): void {
    this.businessCache.clear();
    this.cacheTimestamp = 0;
  }
}
