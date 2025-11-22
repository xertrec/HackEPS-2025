import { Controller, Get, Param } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Controller('services')
export class ServicesController {
  constructor(private readonly databaseService: DatabaseService) {}

  // Endpoint de prueba
  @Get('test')
  test() {
    return { status: 'OK', message: 'Controller funcionando' };
  }

  // Endpoint para obtener todos los barrios
  @Get('neighborhoods')
  async getAllNeighborhoods() {
    try {
      const neighborhoods = await this.databaseService.getAllNeighborhoods();
      return {
        total: neighborhoods.length,
        neighborhoods
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
    return neighborhood;
  }

  // Endpoint para obtener los mejores barrios
  @Get('neighborhoods/top/:limit')
  async getTopNeighborhoods(@Param('limit') limit: string) {
    const neighborhoods = await this.databaseService.getTopNeighborhoods(parseInt(limit, 10));
    return {
      total: neighborhoods.length,
      neighborhoods
    };

  }
}
