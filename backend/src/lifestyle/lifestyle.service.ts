import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConnectivityResultDto } from './dto/connectivity_result.dto';
import { ConnectivityCollectionResultDto } from './dto/connectivity_collection_result.dto';
import { AxiosResponse } from 'axios';
import { delay, firstValueFrom } from 'rxjs';
import { DatabaseService, Neighborhood } from 'src/database/database.service';
import { GreenZonesCollectionResultDto } from './dto/green_zones_collection_result.dto';
import { GreenZonesResultDto } from './dto/green_zones_result.dto';
import { NoiseCollectionResultDto } from './dto/noise_collection_result.dto';
import { NoiseResultDto } from './dto/noise_result.dto';

@Injectable()
export class LifestyleService {
	constructor(
		private readonly httpService: HttpService,
		private readonly databaseService: DatabaseService,
	) {}

	// --- Connectivity Logic ---
	async getAllConnectivityData(): Promise<ConnectivityCollectionResultDto> {
		const neighborhoods: Neighborhood[] =
			await this.databaseService.getAllNeighborhoods();

		const connectivityPromises = neighborhoods.map(async (neighborhood) => {
			let connectivity =
				await this.databaseService.getLifestyleByNeighborhoodName(
					neighborhood.name,
				);

			if (!connectivity || connectivity.score == 0) {
				const apiResult = await this.getConnectivityDataForLocation(
					neighborhood.name,
					neighborhood.latitude,
					neighborhood.longitude,
				);
				await new Promise((r) => setTimeout(r, 15000)); // Rate limiting

				if (connectivity?.score == 0) {
					await this.databaseService.updateLifestyle(
						apiResult.neighborhood_name,
						apiResult.score,
						0,
                        0,
						apiResult.note,
					);
				} else {
					await this.databaseService.insertLifestyle(
						apiResult.neighborhood_name,
						apiResult.score,
                        0,
                        0,
						apiResult.note,
					);
				}

				connectivity = {
					neighborhood_name: apiResult.neighborhood_name,
					score: apiResult.score,
					green_zones_score: 0,
                    noise_score: 0,
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
				`Connectivity API Error ${neighborhood_name}:`,
				error.message,
			);
			return { neighborhood_name, score: 0, note: 'Error fetching data' };
		}
	}

	// --- Green Zones Logic ---
	async getAllGreenZonesData(): Promise<GreenZonesCollectionResultDto> {
		const neighborhoods: Neighborhood[] =
			await this.databaseService.getAllNeighborhoods();

		for (const neighborhood of neighborhoods) {
			// Fetch the single unified row
			let lifestyle = await this.databaseService.getLifestyleByNeighborhoodName(
				neighborhood.name,
			);

			// Check specifically for green_zones_score
			if (!lifestyle || lifestyle.green_zones_score == 0) {
				const apiResult = await this.getGreenZoneDataForLocation(
					neighborhood.name,
					neighborhood.latitude,
					neighborhood.longitude,
				);

				await new Promise((r) => setTimeout(r, 3000)); // Rate limiting

				if (!lifestyle) {
					await this.databaseService.insertLifestyle(
						apiResult.neighborhood_name,
						0,
						apiResult.score,
                        0,
						apiResult.note,
					);
				} else {
					await this.databaseService.updateLifestyle(
						apiResult.neighborhood_name,
						lifestyle.score,
						apiResult.score,
                        0,
						apiResult.note,
					);
				}

				lifestyle = {
					neighborhood_name: apiResult.neighborhood_name,
					score: 0,
					green_zones_score: apiResult.score,
                    noise_score: 0,
					note: apiResult.note,
				};
			}
		}

		const results: GreenZonesResultDto[] = [];
		for (const neighborhood of neighborhoods) {
			const data = await this.databaseService.getLifestyleByNeighborhoodName(
				neighborhood.name,
			);
			if (data) {
				results.push({
					neighborhood_name: data.neighborhood_name,
					score: data.green_zones_score,
					note: data.note,
				});
			}
		}

		return { green_zones: results };
	}

	private async getGreenZoneDataForLocation(
		neighborhood_name: string,
		lat: number,
		lon: number,
	): Promise<GreenZonesResultDto> {
		// Query for parks, gardens, forests, and woods within 1km
		const radius = 1000;
		const query = `
            [out:json];
            (
                way["leisure"="park"](around:${radius},${lat},${lon});
                way["leisure"="garden"](around:${radius},${lat},${lon});
                way["landuse"="forest"](around:${radius},${lat},${lon});
                way["natural"="wood"](around:${radius},${lat},${lon});
                relation["leisure"="park"](around:${radius},${lat},${lon});
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
				const tags = data.elements[0].tags;
				if (tags) count = parseInt(tags.total || tags.ways || '0', 10);
			}

			// Scoring: 5 substantial green areas = 100/100
			const score = Math.min(count * 20, 100);

			let note = `Nature Density: ${count} green areas found`;
			if (score >= 80) note += ' (Very Green Area)';

			return { neighborhood_name, score, note };
		} catch (error) {
			console.error(
				`Green Zones API Error ${neighborhood_name}:`,
				error.message,
			);
			return { neighborhood_name, score: 0, note: 'Error fetching green data' };
		}
	}

	// --- Noise Logic ---
	async getAllNoiseData(): Promise<NoiseCollectionResultDto> {
		const neighborhoods: Neighborhood[] =
			await this.databaseService.getAllNeighborhoods();

		for (const neighborhood of neighborhoods) {
			let lifestyle = await this.databaseService.getLifestyleByNeighborhoodName(
				neighborhood.name,
			);

			// Only fetch if data is missing or noiseScore is 0
            // Note: A score of 0 might actually be valid (very noisy), but we assume 0 means uninitialized for this logic. 
            // Ideally, use a separate flag or -1 for uninitialized.
			if (!lifestyle || lifestyle.noise_score === 0) {
				const apiResult = await this.getNoiseDataForLocation(
					neighborhood.name,
					neighborhood.latitude,
					neighborhood.longitude,
				);

				await new Promise((r) => setTimeout(r, 2000));

				if (lifestyle) {
					await this.databaseService.updateLifestyle(
						apiResult.neighborhood_name,
						lifestyle.score, 
						lifestyle.green_zones_score, 
                        apiResult.score, // UPDATE NOISE
						apiResult.note,
					);
				} else {
					await this.databaseService.insertLifestyle(
						apiResult.neighborhood_name,
						0,
						0,
                        apiResult.score,
						apiResult.note,
					);
				}
			}
		}

		const results: NoiseResultDto[] = [];
		for (const neighborhood of neighborhoods) {
			const data = await this.databaseService.getLifestyleByNeighborhoodName(
				neighborhood.name,
			);
			if (data) {
				results.push({
					neighborhood_name: data.neighborhood_name,
					score: data.noise_score,
					note: data.note,
				});
			}
		}
		return { noise: results };
	}

    private async getNoiseDataForLocation(
		neighborhood_name: string,
		lat: number,
		lon: number,
	): Promise<NoiseResultDto> {
        // Proxy for Noise: Count Bars, Nightclubs, and Major Roads.
        // Higher Count = MORE NOISE = LOWER SCORE.
		const radius = 1000;
		const query = `
            [out:json];
            (
                way["highway"="primary"](around:${radius},${lat},${lon});
                way["highway"="secondary"](around:${radius},${lat},${lon});
                node["amenity"="bar"](around:${radius},${lat},${lon});
                node["amenity"="pub"](around:${radius},${lat},${lon});
                node["amenity"="nightclub"](around:${radius},${lat},${lon});
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
				const tags = data.elements[0].tags;
                // Sum up nodes and ways
				if (tags) count = parseInt(tags.total || tags.nodes || '0', 10);
			}

			// Scoring Logic: INVERTED. 
            // 0 noise sources = 100 Score (Peaceful).
            // 50+ noise sources = 0 Score (Noisy).
			const rawScore = Math.min(count * 2, 100); // Cap noise penalty at 100
            const score = 100 - rawScore;
			
			let note = `Noise Sources: ${count} (bars, main roads) found`;
			if (score >= 80) note += ' (Very Tranquil)';
            else if (score <= 40) note += ' (High Ambient Noise)';

			return { neighborhood_name, score, note };
		} catch (error) {
			console.error(`Noise API Error ${neighborhood_name}:`, error.message);
			return { neighborhood_name, score: 0, note: 'Error fetching noise data' };
		}
	}
}
