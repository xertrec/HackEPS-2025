import { Controller, Get, Param } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ServicesService } from './services.service';

@Controller('services')
export class ServicesController {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly servicesService: ServicesService,
  ) {}

  // Endpoint de prueba
  @Get('test')
  test() {
    return { status: 'OK', message: 'Controller funcionando' };
  }

  // Endpoint para limpiar el caché
  @Get('clear-cache')
  clearCache() {
    this.servicesService.clearCache();
    return { status: 'OK', message: 'Caché limpiado correctamente' };
  }

  // Endpoint principal que devuelve barrios con todos los servicios
  @Get()
  async getServices() {
    try {
      const neighborhoods = await this.databaseService.getAllNeighborhoods();
      
      // Obtener todos los porcentajes para cada barrio
      const result = await Promise.all(
        neighborhoods.map(async (neighborhood) => {
          const [botigues, escoles, hospitals, comissaries, bombers, ociNocturno, ociDiurno] = await Promise.all([
            this.servicesService.calculateShopsPercentage(
              neighborhood.name,
              neighborhood.latitude,
              neighborhood.longitude,
            ),
            this.servicesService.calculateSchoolsPercentage(
              neighborhood.name,
              neighborhood.latitude,
              neighborhood.longitude,
            ),
            this.servicesService.calculateHospitalsPercentage(
              neighborhood.name,
              neighborhood.latitude,
              neighborhood.longitude,
            ),
            this.servicesService.calculatePoliceStationsPercentage(
              neighborhood.name,
              neighborhood.latitude,
              neighborhood.longitude,
            ),
            this.servicesService.calculateFireStationsPercentage(
              neighborhood.name,
              neighborhood.latitude,
              neighborhood.longitude,
            ),
            this.servicesService.calculateNightlifePercentage(
              neighborhood.name,
              neighborhood.latitude,
              neighborhood.longitude,
            ),
            this.servicesService.calculateDayLeisurePercentage(
              neighborhood.name,
              neighborhood.latitude,
              neighborhood.longitude,
            ),
          ]);
          
          return {
            name: neighborhood.name,
            botigues,
            escoles,
            hospitals,
            comissaries,
            bombers,
            ociNocturno,
            ociDiurno,
          };
        }),
      );
      
      return result;
    } catch (error) {
      return {
        error: 'Error al obtener servicios',
        message: error.message,
      };
    }
  }

  // Endpoint para obtener todos los barrios
  @Get('neighborhoods')
  async getAllNeighborhoods() {
    try {
      const neighborhoods = await this.databaseService.getAllNeighborhoods();
      
      // Agregar el porcentaje de tiendas (botigues) a cada barrio
      const neighborhoodsWithShops = await Promise.all(
        neighborhoods.map(async (neighborhood) => {
          const botigues = await this.servicesService.calculateShopsPercentage(
            neighborhood.name,
            neighborhood.latitude,
            neighborhood.longitude,
          );
          
          return {
            ...neighborhood,
            botigues,
          };
        }),
      );
      
      return {
        total: neighborhoodsWithShops.length,
        neighborhoods: neighborhoodsWithShops,
      };
    } catch (error) {
      return {
        error: 'Error al obtener barrios',
        message: error.message,
        stack: error.stack
      };
    }
  }

  // Endpoint para obtener un barrio específico
  @Get('neighborhoods/:name')
  async getNeighborhood(@Param('name') name: string) {
    const neighborhood = await this.databaseService.getNeighborhoodByName(name);
    if (!neighborhood) {
      return {
        error: 'Barrio no encontrado',
        name
      };
    }
    
    // Agregar el porcentaje de tiendas (botigues)
    const botigues = await this.servicesService.calculateShopsPercentage(
      neighborhood.name,
      neighborhood.latitude,
      neighborhood.longitude,
    );
    
    return {
      ...neighborhood,
      botigues,
    };
  }

  // Endpoint para obtener los mejores barrios
  @Get('neighborhoods/top/:limit')
  async getTopNeighborhoods(@Param('limit') limit: string) {
    const neighborhoods = await this.databaseService.getTopNeighborhoods(parseInt(limit, 10));
    
    // Agregar el porcentaje de tiendas (botigues) a cada barrio
    const neighborhoodsWithShops = await Promise.all(
      neighborhoods.map(async (neighborhood) => {
        const botigues = await this.servicesService.calculateShopsPercentage(
          neighborhood.name,
          neighborhood.latitude,
          neighborhood.longitude,
        );
        
        return {
          ...neighborhood,
          botigues,
        };
      }),
    );
    
    return {
      total: neighborhoodsWithShops.length,
      neighborhoods: neighborhoodsWithShops,
    };
  }
}
