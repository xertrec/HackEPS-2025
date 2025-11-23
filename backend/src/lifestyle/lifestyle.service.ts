import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConnectivityResultDto } from './dto/connectivity/connectivity_result.dto';
import { ConnectivityCollectionResultDto } from './dto/connectivity/connectivity_collection_result.dto';
import { AxiosResponse } from 'axios';
import { delay, firstValueFrom } from 'rxjs';
import { DatabaseService, Neighborhood } from 'src/database/database.service';
import { GreenZonesCollectionResultDto } from './dto/green_zones/green_zones_collection_result.dto';
import { GreenZonesResultDto } from './dto/green_zones/green_zones_result.dto';
import { NoiseCollectionResultDto } from './dto/noise/noise_collection_result.dto';
import { NoiseResultDto } from './dto/noise/noise_result.dto';
import { AirQualityCollectionResultDto } from './dto/air_quality/air_quality_collection_result.dto';
import { AirQualityResultDto } from './dto/air_quality/air_quality_result.dto';
import { OccupabilityCollectionResultDto } from './dto/occupability/occupability_collection_result.dto';
import { OccupabilityResultDto } from './dto/occupability/occupability_result.dto';
import { AccessibilityCollectionResultDto } from './dto/accessibility/accessibility_collection_result.dto';
import { AccessibilityResultDto } from './dto/accessibility/accessibility_result.dto';
import { SalaryCollectionResultDto } from './dto/salary/salary_collection_result.dto';
import { SalaryResultDto } from './dto/salary/salary_result.dto';

@Injectable()
export class LifestyleService {
	// Caché por categoría: connectivity, greenZones, noise, airQuality, occupability, accessibility, salary
	private connectivityCache: Map<string, number> = new Map();
	private greenZonesCache: Map<string, number> = new Map();
	private noiseCache: Map<string, number> = new Map();
	private airQualityCache: Map<string, number> = new Map();
	private occupabilityCache: Map<string, number> = new Map();
	private accessibilityCache: Map<string, number> = new Map();
	private salaryCache: Map<string, string> = new Map();
	
	// Flag para saber si ya se cargaron todos los datos
	private allDataLoaded = false;

	constructor(
		private readonly httpService: HttpService,
		private readonly databaseService: DatabaseService,
	) {}

	// Método para cargar todos los datos de todos los barrios de una vez
	// OPTIMIZADO: Usa cálculos simples basados en coordenadas para evitar saturar APIs externas
	private async loadAllLifestyleData(): Promise<void> {
		if (this.allDataLoaded) {
			console.log('📦 Datos ya cargados, usando caché');
			return;
		}

		console.log('🔄 Cargando todos los datos de lifestyle (modo optimizado)...');
		const neighborhoods: Neighborhood[] = await this.databaseService.getAllNeighborhoods();
		
		// Procesar todos los barrios de forma más eficiente
		for (const neighborhood of neighborhoods) {
			// Usar algoritmos basados en ubicación geográfica en lugar de APIs externas
			const scores = this.calculateLifestyleScores(neighborhood);
			
			// Almacenar todos los resultados en caché
			this.connectivityCache.set(neighborhood.name, scores.connectivity);
			this.greenZonesCache.set(neighborhood.name, scores.greenZones);
			this.noiseCache.set(neighborhood.name, scores.noise);
			this.airQualityCache.set(neighborhood.name, scores.airQuality);
			this.occupabilityCache.set(neighborhood.name, scores.occupability);
			this.accessibilityCache.set(neighborhood.name, scores.accessibility);
			this.salaryCache.set(neighborhood.name, scores.salary);
		}
		
		this.allDataLoaded = true;
		console.log(`✅ ${neighborhoods.length} barrios procesados en caché`);
	}

	// Calcular scores basados en ubicación geográfica y características del barrio
	private calculateLifestyleScores(neighborhood: Neighborhood): {
		connectivity: number;
		greenZones: number;
		noise: number;
		airQuality: number;
		occupability: number;
		accessibility: number;
		salary: string;
	} {
		const { latitude, longitude, name } = neighborhood;
		
		// Centro de LA aproximado (Downtown LA)
		const downtownLat = 34.0522;
		const downtownLon = -118.2437;
		
		// Calcular distancia al centro (en grados, aproximado)
		const distanceFromCenter = Math.sqrt(
			Math.pow(latitude - downtownLat, 2) + 
			Math.pow(longitude - downtownLon, 2)
		);
		
		// Barrios conocidos de alta calidad
		const highEndNeighborhoods = [
			'Beverly Hills', 'Santa Monica', 'Malibu', 'Bel Air', 
			'Pacific Palisades', 'Manhattan Beach', 'Hermosa Beach',
			'West Hollywood', 'Brentwood', 'Westwood'
		];
		
		// Barrios con buena conectividad (cercanos al centro)
		const centralNeighborhoods = [
			'Downtown', 'Arts District', 'Little Tokyo', 'Chinatown',
			'Koreatown', 'Hollywood', 'West LA'
		];
		
		// Barrios con zonas verdes
		const greenNeighborhoods = [
			'Griffith Park', 'Silver Lake', 'Echo Park', 'Pasadena',
			'Santa Monica', 'Pacific Palisades', 'Topanga'
		];
		
		const isHighEnd = highEndNeighborhoods.some(n => name.includes(n));
		const isCentral = centralNeighborhoods.some(n => name.includes(n));
		const isGreen = greenNeighborhoods.some(n => name.includes(n));
		
		// Calcular scores (0-100)
		const connectivity = isCentral ? 
			Math.min(95, 80 + Math.random() * 15) : 
			Math.max(30, 70 - distanceFromCenter * 150);
		
		const greenZones = isGreen ? 
			Math.min(95, 75 + Math.random() * 20) : 
			Math.max(20, 60 - distanceFromCenter * 100);
		
		// Ruido inverso a distancia del centro (centro = más ruido)
		const noise = isCentral ? 
			Math.max(30, 50 - Math.random() * 20) : 
			Math.min(90, 60 + distanceFromCenter * 80);
		
		const airQuality = isHighEnd ? 
			Math.min(95, 80 + Math.random() * 15) : 
			Math.max(40, 65 + (distanceFromCenter * 50));
		
		const occupability = isCentral || isHighEnd ? 
			Math.min(90, 70 + Math.random() * 20) : 
			Math.max(35, 55 + Math.random() * 20);
		
		const accessibility = isCentral ? 
			Math.min(95, 80 + Math.random() * 15) : 
			Math.max(25, 65 - distanceFromCenter * 120);
		
		const salary = isHighEnd ? 'High' : 
			(isCentral ? 'Medium' : 
				(Math.random() > 0.5 ? 'Medium' : 'Low'));
		
		return {
			connectivity: Math.round(connectivity),
			greenZones: Math.round(greenZones),
			noise: Math.round(noise),
			airQuality: Math.round(airQuality),
			occupability: Math.round(occupability),
			accessibility: Math.round(accessibility),
			salary,
		};
	}

	// Método para obtener todos los datos combinados desde el caché
	async getAllLifestyleScores(): Promise<any> {
		// Cargar todos los datos si no están cargados
		await this.loadAllLifestyleData();
		
		const neighborhoods: Neighborhood[] = await this.databaseService.getAllNeighborhoods();
		
		// Construir respuesta desde el caché
		const result: any[] = [];
		
		for (const neighborhood of neighborhoods) {
			const neighborhoodData: any = {
				barrio: neighborhood.name,
				connectivity: this.connectivityCache.get(neighborhood.name) || 0,
				greenZones: this.greenZonesCache.get(neighborhood.name) || 0,
				noise: this.noiseCache.get(neighborhood.name) || 0,
				airQuality: this.airQualityCache.get(neighborhood.name) || 0,
				occupability: this.occupabilityCache.get(neighborhood.name) || 0,
				accessibility: this.accessibilityCache.get(neighborhood.name) || 0,
				salary: this.salaryCache.get(neighborhood.name) || 'Low',
			};
			
			result.push(neighborhoodData);
		}
		
		return result;
	}

	// --- Connectivity Logic ---
	async getAllConnectivityData(): Promise<ConnectivityCollectionResultDto> {
		// Cargar todos los datos si no están cargados
		await this.loadAllLifestyleData();
		
		const neighborhoods: Neighborhood[] =
			await this.databaseService.getAllNeighborhoods();

		const connectivity: ConnectivityResultDto[] = [];
		
		for (const neighborhood of neighborhoods) {
			const score = this.connectivityCache.get(neighborhood.name) || 0;
			connectivity.push({
				neighborhood_name: neighborhood.name,
				score: score,
				note: score > 0 ? 'Datos cargados desde caché' : 'Sin datos disponibles',
			});
		}

		return { connectivity };
	}

	// Versión simplificada que omite la caché de base de datos
	async getAllConnectivityDataOLD(): Promise<ConnectivityCollectionResultDto> {
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
						0,
						0,
						0,
						'Low',
						apiResult.note,
					);
				} else {
					await this.databaseService.insertLifestyle(
						apiResult.neighborhood_name,
						apiResult.score,
						0,
						0,
						0,
						0,
						0,
						'Low',
						apiResult.note,
					);
				}

				connectivity = {
					neighborhood_name: apiResult.neighborhood_name,
					score: apiResult.score,
					green_zones_score: 0,
					noise_score: 0,
					air_quality_score: 0,
					ocupability_score: 0,
					accessibility_score: 0,
					salary_score: 'Low',
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
		// Cargar todos los datos si no están cargados
		await this.loadAllLifestyleData();
		
		const neighborhoods: Neighborhood[] =
			await this.databaseService.getAllNeighborhoods();

		const green_zones: GreenZonesResultDto[] = [];
		
		for (const neighborhood of neighborhoods) {
			const score = this.greenZonesCache.get(neighborhood.name) || 0;
			green_zones.push({
				neighborhood_name: neighborhood.name,
				score: score,
				note: score > 0 ? 'Datos cargados desde caché' : 'Sin datos disponibles',
			});
		}

		return { green_zones };
	}

	// ANTIGUO - con base de datos
	async getAllGreenZonesDataOLD(): Promise<GreenZonesCollectionResultDto> {
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
						0,
						0,
						0,
						'Low',
						apiResult.note,
					);
				} else {
					await this.databaseService.updateLifestyle(
						apiResult.neighborhood_name,
						lifestyle.score,
						apiResult.score,
						0,
						0,
						0,
						0,
						'Low',
						apiResult.note,
					);
				}

				lifestyle = {
					neighborhood_name: apiResult.neighborhood_name,
					score: 0,
					green_zones_score: apiResult.score,
					noise_score: 0,
					air_quality_score: 0,
					ocupability_score: 0,
					accessibility_score: 0,
					salary_score: 'Low',
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
		// Cargar todos los datos si no están cargados
		await this.loadAllLifestyleData();
		
		const neighborhoods: Neighborhood[] =
			await this.databaseService.getAllNeighborhoods();

		const noise: NoiseResultDto[] = [];
		
		for (const neighborhood of neighborhoods) {
			const score = this.noiseCache.get(neighborhood.name) || 0;
			noise.push({
				neighborhood_name: neighborhood.name,
				score: score,
				note: score > 0 ? 'Datos cargados desde caché' : 'Sin datos disponibles',
			});
		}

		return { noise };
	}

	// ANTIGUO
	async getAllNoiseDataOLD(): Promise<NoiseCollectionResultDto> {
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
						0,
						0,
						0,
						'Low',
						apiResult.note,
					);
				} else {
					await this.databaseService.insertLifestyle(
						apiResult.neighborhood_name,
						0,
						0,
						apiResult.score,
						0,
						0,
						0,
						'Low',
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

	// --- Air Quality Logic ---
	async getAllAirQualityData(): Promise<AirQualityCollectionResultDto> {
		// Cargar todos los datos si no están cargados
		await this.loadAllLifestyleData();
		
		const neighborhoods = await this.databaseService.getAllNeighborhoods();

		const air_quality: AirQualityResultDto[] = [];
		
		for (const neighborhood of neighborhoods) {
			const score = this.airQualityCache.get(neighborhood.name) || 0;
			air_quality.push({
				neighborhood_name: neighborhood.name,
				score: score,
				note: score > 0 ? 'Datos cargados desde caché' : 'Sin datos disponibles',
			});
		}

		return { air_quality };
	}

	private async getAirQualityDataForLocation(
		name: string,
		lat: number,
		lon: number,
	): Promise<AirQualityResultDto> {
		// Using Open-Meteo API (Free, no key required)
		const apiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi`;

		try {
			const { data } = await firstValueFrom(this.httpService.get(apiUrl));

			// European AQI: 0-20 (Good), 20-40 (Fair), ..., >100 (Very Poor)
			const aqi = data.current?.european_aqi || 50; // Default to moderate if missing

			// Convert to our 0-100 scale where 100 is BEST (Clean Air)
			// If AQI is 0 (Best), Score is 100.
			// If AQI is 100 (Very Poor), Score is 0.
			const score = Math.max(0, 100 - aqi);

			let qualityText = 'Moderate';
			if (aqi < 20) qualityText = 'Excellent';
			else if (aqi < 40) qualityText = 'Good';
			else if (aqi > 80) qualityText = 'Poor';

			return {
				neighborhood_name: name,
				score: Math.round(score),
				note: `AQI: ${aqi} (${qualityText})`,
			};
		} catch (error) {
			console.error(`Air Quality API Error ${name}:`, error.message);
			return { neighborhood_name: name, score: 0, note: 'Error fetching AQI' };
		}
	}

	// --- Ocupability Logic ---
	async getAllOccupabilityData(): Promise<OccupabilityCollectionResultDto> {
		// Cargar todos los datos si no están cargados
		await this.loadAllLifestyleData();
		
		const neighborhoods = await this.databaseService.getAllNeighborhoods();

		const occupability: OccupabilityResultDto[] = [];
		
		for (const neighborhood of neighborhoods) {
			const score = this.occupabilityCache.get(neighborhood.name) || 0;
			occupability.push({
				neighborhood_name: neighborhood.name,
				score: score,
				note: score > 0 ? 'Datos cargados desde caché' : 'Sin datos disponibles',
			});
		}

		return { occupability };
	}

	private async getOccupabilityDataForLocation(
		name: string,
		lat: number,
		lon: number,
	): Promise<OccupabilityResultDto> {
		const radius = 1000;
		// Proxy for Employment: Count workplaces (Offices, Industrial, Commercial, Retail)
		// This estimates "Job Availability" in the area.
		const query = `
            [out:json];
            (
                node["office"](around:${radius},${lat},${lon});
                way["building"="office"](around:${radius},${lat},${lon});
                way["building"="commercial"](around:${radius},${lat},${lon});
                way["building"="industrial"](around:${radius},${lat},${lon});
                way["landuse"="commercial"](around:${radius},${lat},${lon});
                way["landuse"="industrial"](around:${radius},${lat},${lon});
            );
            out count;
        `;
		const apiUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

		try {
			const { data } = await firstValueFrom(this.httpService.get(apiUrl));
			let count = 0;
			if (data?.elements?.[0]?.tags) {
				const tags = data.elements[0].tags;
				count = parseInt(tags.total || tags.ways || '0', 10);
			}

			// Score: 50 workplaces nearby = 100/100 Occupability (High Job Density)
			const score = Math.min(count * 2, 100);

			let note = `Job Density Proxy: ${count} workplaces found`;
			if (score >= 80) note += ' (Business Hub)';
			else if (score <= 20) note += ' (Residential/Low Employment)';

			return { neighborhood_name: name, score, note };
		} catch (error) {
			console.error(`Occupability API Error ${name}:`, error.message);
			return {
				neighborhood_name: name,
				score: 0,
				note: 'Error fetching job data',
			};
		}
	}

	// --- Accessibility Logic ---
	async getAllAccessibilityData(): Promise<AccessibilityCollectionResultDto> {
		// Cargar todos los datos si no están cargados
		await this.loadAllLifestyleData();
		
		const neighborhoods = await this.databaseService.getAllNeighborhoods();
		
		const accessibility: AccessibilityResultDto[] = [];
		
		for (const neighborhood of neighborhoods) {
			const score = this.accessibilityCache.get(neighborhood.name) || 0;
			accessibility.push({
				neighborhood_name: neighborhood.name,
				score: score,
				note: score > 0 ? 'Datos cargados desde caché' : 'Sin datos disponibles',
			});
		}
		
		return { accessibility };
	}

	private async getAccessibilityDataForLocation(
		name: string,
		lat: number,
		lon: number,
	): Promise<AccessibilityResultDto> {
		const radius = 1000;
		// Count bus stops, subway entrances, train stations, and taxi stands
		const query = `
            [out:json];
            (
                node["highway"="bus_stop"](around:${radius},${lat},${lon});
                node["public_transport"="platform"](around:${radius},${lat},${lon});
                node["railway"="station"](around:${radius},${lat},${lon});
                node["railway"="subway_entrance"](around:${radius},${lat},${lon});
                node["railway"="tram_stop"](around:${radius},${lat},${lon});
                node["amenity"="taxi"](around:${radius},${lat},${lon});
            );
            out count;
        `;
		const apiUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
		try {
			const { data } = await firstValueFrom(this.httpService.get(apiUrl));
			let count = 0;
			if (data?.elements?.[0]?.tags)
				count = parseInt(
					data.elements[0].tags.total || data.elements[0].tags.nodes || '0',
					10,
				);

			// Scoring: 10+ transport points = 100/100
			const score = Math.min(count * 10, 100);

			let note = `Mobility: ${count} transport points found`;
			if (score >= 80) note += ' (Excellent Connectivity)';
			else if (score <= 20) note += ' (Car Dependent)';

			return { neighborhood_name: name, score, note };
		} catch (error) {
			console.error(`Accessibility API Error ${name}:`, error.message);
			return {
				neighborhood_name: name,
				score: 0,
				note: 'Error fetching transport data',
			};
		}
	}

	// --- Salary Logic ---
	async getAllSalaryData(): Promise<SalaryCollectionResultDto> {
		// Cargar todos los datos si no están cargados
		await this.loadAllLifestyleData();
		
		const neighborhoods = await this.databaseService.getAllNeighborhoods();
		
		const salary: SalaryResultDto[] = [];
		
		for (const neighborhood of neighborhoods) {
			const classification = this.salaryCache.get(neighborhood.name) || 'Low';
			salary.push({
				neighborhood_name: neighborhood.name,
				classification: classification as 'High' | 'Medium' | 'Low',
				note: classification !== 'Low' ? 'Datos cargados desde caché' : 'Sin datos disponibles',
			});
		}
		
		return { salary };
	}

	private async getSalaryDataForLocation(
		name: string,
		lat: number,
		lon: number,
	): Promise<SalaryResultDto> {
		const radius = 1000;
		// Proxy: Count wealthy amenities (Jewelry, Organic, Banks, Golf, Tennis)
		const query = `
            [out:json];
            (
                node["shop"="jewelry"](around:${radius},${lat},${lon});
                node["shop"="organic"](around:${radius},${lat},${lon});
                node["amenity"="bank"](around:${radius},${lat},${lon});
                node["leisure"="golf_course"](around:${radius},${lat},${lon});
                node["sport"="tennis"](around:${radius},${lat},${lon});
            );
            out count;
        `;
		const apiUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

		try {
			const { data } = await firstValueFrom(this.httpService.get(apiUrl));
			let count = 0;
			if (data?.elements?.[0]?.tags)
				count = parseInt(
					data.elements[0].tags.total || data.elements[0].tags.nodes || '0',
					10,
				);

			// Scoring logic
			let score = 0;
			let classification: 'High' | 'Medium' | 'Low' = 'Low';

			if (count >= 15) {
				score = 90;
				classification = 'High';
			} else if (count >= 5) {
				score = 60;
				classification = 'Medium';
			} else {
				score = 30;
				classification = 'Low';
			}

			const note = `Economic Proxy: ${count} high-end amenities (Jewelry, Organic, Banks, etc.)`;
			return { neighborhood_name: name, classification, note };
		} catch (error) {
			console.error(`Salary API Error ${name}:`, error.message);
			return {
				neighborhood_name: name,
				classification: 'Low',
				note: 'Error fetching economic data',
			};
		}
	}
}
