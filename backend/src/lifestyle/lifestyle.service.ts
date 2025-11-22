import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConnectivityResultDto } from './dto/connectivity_result.dto';
import { ConnectivityCollectionResultDto } from './dto/connectivity_collection_result.dto';
import { AxiosResponse } from 'axios';
import { delay, firstValueFrom } from 'rxjs';
import { DatabaseService, Neighborhood } from 'src/database/database.service';

@Injectable()
export class LifestyleService {
	constructor(
		private readonly httpService: HttpService,
		private readonly databaseService: DatabaseService,
	) {}

	async getAllConnectivityData(): Promise<ConnectivityCollectionResultDto> {
		const neighborhoods: Neighborhood[] =
			await this.databaseService.getAllNeighborhoods();

		const connectivityPromises = neighborhoods.map(async (neighborhood) => {
            let connectivity = await this.databaseService.getLifestyleByNeighborhoodName(
                neighborhood.name
            );

            if (!connectivity || connectivity.score == 0) {
                const apiResult = await this.getConnectivityDataForLocation(
                    neighborhood.name,
                    neighborhood.latitude,
                    neighborhood.longitude,
                );
                delay(30000); // To avoid hitting Overpass API rate limits

                if (connectivity?.score == 0) {
                    await this.databaseService.updateLifestyle(
                        apiResult.neighborhood_name,
                        apiResult.score,
                        apiResult.note
                    );
                } else {
                    await this.databaseService.insertLifestyle(
                        apiResult.neighborhood_name,
                        apiResult.score,
                        apiResult.note
                    );
                }
                
                connectivity = {
                    neighborhood_name: apiResult.neighborhood_name,
                    score: apiResult.score,
                    note: apiResult.note,
                };
            }

			return connectivity;
		});

		const results = await Promise.all(connectivityPromises);
		return {
			connectivity: results,
		};
	}

	private async getConnectivityDataForLocation(
		neighborhood_name: string,
		lat: number,
		lon: number,
	): Promise<ConnectivityResultDto> {
		// Query for telecom towers, masts, and antennas within 1000 meters
		const radius = 1000;
		const query = `
            [out:json];
            (
                node["man_made"="mast"](around:${radius},${lat},${lon});
                node["man_made"="antenna"](around:${radius},${lat},${lon});
                node["communication:mobile_phone"](around:${radius},${lat},${lon});
                node["tower:type"="communication"](around:${radius},${lat},${lon});
            );
            out count;
        `;

		const apiUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

		try {
			const { data }: AxiosResponse = await firstValueFrom(
				this.httpService.get(apiUrl),
			);
            
			let count = 0;
			if (data?.elements && data.elements.length > 0) {
				// 'out count' usually returns { type: 'count', tags: { nodes: 'X', ways: 'Y', relations: 'Z', total: 'T' } }
				const tags = data.elements[0].tags;
				if (tags) {
					count = parseInt(tags.total || tags.nodes || '0', 10);
				}
			}

			// Logic: 5+ nodes nearby = 100/100 score
			const score = Math.min(count * 20, 100);

			let note = `Infrastructure Density: ${count} nodes found via OpenStreetMap`;
			if (score === 100) note += ' (Excellent Coverage)';
			else if (score === 0) note += ' (Limited Infrastructure detected)';

			return {
				neighborhood_name: neighborhood_name,
				score: score,
				note: note,
			};
		} catch (error) {
			console.error(
				`Overpass API Error for ${neighborhood_name}:`,
				error.message,
			);

			// Fallback to Deterministic Simulation
			const simulated = this.getSimulatedConnectivity(lat, lon);
			return {
				neighborhood_name: neighborhood_name,
				score: 0, //simulated.score,
				note: simulated.note,
			};
		}
	}

	private getSimulatedConnectivity(lat: number, lon: number): any {
		// Create a pseudo-random number based on coordinates
		const hash = Math.sin(lat * 1000) + Math.cos(lon * 1000);
		const normalized = Math.abs(hash); // 0 to 1ish

		let score = 0;
		let note = '';

		if (normalized > 0.7) {
			score = 100;
			note = 'Fiber Optic (Simulated High Speed)';
		} else if (normalized > 0.4) {
			score = 70;
			note = 'Cable/4G (Simulated Medium Speed)';
		} else {
			score = 40;
			note = 'DSL (Simulated Low Speed)';
		}

		return { score, note };
	}
}
