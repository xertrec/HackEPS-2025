import { Controller, Get } from '@nestjs/common';
import { ConnectivityCollectionResultDto } from './dto/connectivity_collection_result.dto';
import { LifestyleService } from './lifestyle.service';
import { GreenZonesCollectionResultDto } from './dto/green_zones_collection_result.dto';

@Controller('lifestyle')
export class LifestyleController {
	constructor(private readonly lifestyleService: LifestyleService) {}

	@Get('connectivity')
	async getConnectivity(): Promise<ConnectivityCollectionResultDto> {
		return this.lifestyleService.getAllConnectivityData();
	}

	@Get('green-zones')
	async getGreenZones(): Promise<GreenZonesCollectionResultDto> {
		return this.lifestyleService.getAllGreenZonesData();
	}
}
