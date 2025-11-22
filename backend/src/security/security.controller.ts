import { Controller, Get } from '@nestjs/common';
import { SecurityService } from './security.service';


// USUARIO SOLICITÓ ruta /secourity (notar la ortografía solicitada)
@Controller('secourity')
export class SecurityController {
	constructor(private readonly securityService: SecurityService) {}

	@Get('ranking')
	async getNeighborhoodRanking() {
		return this.securityService.getNeighborhoodRanking();
	}
}
