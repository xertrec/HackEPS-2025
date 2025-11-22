import { Controller, Get } from '@nestjs/common';
import { ConnectivityCollectionResultDto } from './dto/connectivity_collection_result.dto';
import { LifestyleService } from './lifestyle.service';

@Controller('lifestyle')
export class LifestyleController {
	constructor(private readonly lifestyleService: LifestyleService) {}

	@Get('connectivity')
	async getConnectivity(): Promise<ConnectivityCollectionResultDto> {
		return this.lifestyleService.getAllConnectivityData();
	}
}
