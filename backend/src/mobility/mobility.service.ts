// src/mobility/mobility.service.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class MobilityService {
  constructor(private readonly httpService: HttpService) {}

  // 1. API DE PARKING (Original)
  async getParkingData() {
    // ID: s3st-6nwi
    // Útil para: Analizar disponibilidad de estacionamiento
    return this.fetchFromLaCity('s3st-6nwi', { $limit: 5 });
  }

  // 2. API DE AEROPUERTO (Passenger Traffic)
  async getAirportData() {
    // ID: g3qu-7q2u
    // Útil para: Calcular ruido extremo (Bran Stark odiaría esto)
    return this.fetchFromLaCity('g3qu-7q2u', { 
      $limit: 5,
      $order: 'report_period DESC' // Traer los datos más recientes primero
    });
  }

  // 3. API DE TRÁFICO (Traffic Counts)
  async getTrafficCounts() {
    // ID: 94wu-3ps3
    // Útil para: Medir congestión y flujo vehicular
    return this.fetchFromLaCity('94wu-3ps3', { 
      $limit: 5 
    });
  }

  // 4. API DE PAQUíMETRO (Metered Parking Inventory)
  async getMeteredParkingInventory() {
    // ID: s49e-q6j2
    // Útil para: Inventario y políticas de estacionamiento medido
    return this.fetchFromLaCity('s49e-q6j2', { 
      $limit: 5 
    });
  }



  // --- MÉTODO PRIVADO (EL MOTOR GENÉRICO) ---
  // Este método maneja la conexión y los errores para todos los demás
  private async fetchFromLaCity(datasetId: string, customParams: any) {
    const baseUrl = `https://data.lacity.org/resource/${datasetId}.json`;

    try {
      console.log(`📡 Conectando a Dataset: ${datasetId}...`);
      
      const response = await firstValueFrom(
        this.httpService.get(baseUrl, { params: customParams })
      );
      
      return {
        dataset_id: datasetId,
        count: response.data.length,
        data: response.data
      };

    } catch (error) {
      console.error(`❌ Error en Dataset ${datasetId}:`);
      
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
      } else {
        console.error(`Error: ${error.message}`);
      }

      // No lanzamos error fatal, devolvemos un objeto vacío para que la app siga viva
      return { 
        dataset_id: datasetId, 
        error: 'Data unavailable', 
        data: [] 
      };
    }
  }
}