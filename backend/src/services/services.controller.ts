import { Controller, Get } from '@nestjs/common';
import { ServicesService } from './services.service';

@Controller() // rutas en la raíz
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get('secourity-LA')
  async getSecurityLA() {
    return this.servicesService.getSecurityLA();
  }
}
