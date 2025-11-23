import { Controller, Get } from '@nestjs/common';
import { ConnectivityCollectionResultDto } from './dto/connectivity/connectivity_collection_result.dto';
import { LifestyleService } from './lifestyle.service';
import { GreenZonesCollectionResultDto } from './dto/green_zones/green_zones_collection_result.dto';
import { NoiseCollectionResultDto } from './dto/noise/noise_collection_result.dto';
import { AirQualityCollectionResultDto } from './dto/air_quality/air_quality_collection_result.dto';
import { OccupabilityCollectionResultDto } from './dto/occupability/occupability_collection_result.dto';
import { AccessibilityCollectionResultDto } from './dto/accessibility/accessibility_collection_result.dto';
import { SalaryCollectionResultDto } from './dto/salary/salary_collection_result.dto';

@Controller('lifestyle')
export class LifestyleController {
	constructor(private readonly lifestyleService: LifestyleService) {}

	@Get()
	async getAllLifestyleData() {
		return this.lifestyleService.getAllLifestyleScores();
	}

	@Get('full')
	async getAllLifestyleDataFull() {
		// Obtener todos los datos de todas las categorías
		const [
			connectivity,
			greenZones,
			noise,
			airQuality,
			occupability,
			accessibility,
			salary,
		] = await Promise.all([
			this.lifestyleService.getAllConnectivityData(),
			this.lifestyleService.getAllGreenZonesData(),
			this.lifestyleService.getAllNoiseData(),
			this.lifestyleService.getAllAirQualityData(),
			this.lifestyleService.getAllOccupabilityData(),
			this.lifestyleService.getAllAccessibilityData(),
			this.lifestyleService.getAllSalaryData(),
		]);

		// Crear un mapa de barrios con todos sus datos
		const neighborhoodsMap = new Map();

		// Procesar connectivity
		connectivity.connectivity?.forEach(item => {
			if (!neighborhoodsMap.has(item.neighborhood_name)) {
				neighborhoodsMap.set(item.neighborhood_name, {
					barrio: item.neighborhood_name,
				});
			}
			neighborhoodsMap.get(item.neighborhood_name).conectividad = item.score;
		});

		// Procesar green zones
		greenZones.green_zones?.forEach(item => {
			if (!neighborhoodsMap.has(item.neighborhood_name)) {
				neighborhoodsMap.set(item.neighborhood_name, {
					barrio: item.neighborhood_name,
				});
			}
			neighborhoodsMap.get(item.neighborhood_name).zonas_verdes = item.score;
		});

		// Procesar noise
		noise.noise?.forEach(item => {
			if (!neighborhoodsMap.has(item.neighborhood_name)) {
				neighborhoodsMap.set(item.neighborhood_name, {
					barrio: item.neighborhood_name,
				});
			}
			neighborhoodsMap.get(item.neighborhood_name).ruido = item.score;
		});

		// Procesar air quality
		airQuality.air_quality?.forEach(item => {
			if (!neighborhoodsMap.has(item.neighborhood_name)) {
				neighborhoodsMap.set(item.neighborhood_name, {
					barrio: item.neighborhood_name,
				});
			}
			neighborhoodsMap.get(item.neighborhood_name).calidad_aire = item.score;
		});

		// Procesar occupability
		occupability.occupability?.forEach(item => {
			if (!neighborhoodsMap.has(item.neighborhood_name)) {
				neighborhoodsMap.set(item.neighborhood_name, {
					barrio: item.neighborhood_name,
				});
			}
			neighborhoodsMap.get(item.neighborhood_name).ocupabilidad = item.score;
		});

		// Procesar accessibility
		accessibility.accessibility?.forEach(item => {
			if (!neighborhoodsMap.has(item.neighborhood_name)) {
				neighborhoodsMap.set(item.neighborhood_name, {
					barrio: item.neighborhood_name,
				});
			}
			neighborhoodsMap.get(item.neighborhood_name).accesibilidad = item.score;
		});

		// Procesar salary
		salary.salary?.forEach(item => {
			if (!neighborhoodsMap.has(item.neighborhood_name)) {
				neighborhoodsMap.set(item.neighborhood_name, {
					barrio: item.neighborhood_name,
				});
			}
			neighborhoodsMap.get(item.neighborhood_name).salario = item.classification;
		});

		// Convertir el mapa a array y calcular score total
		const neighborhoods = Array.from(neighborhoodsMap.values()).map(neighborhood => {
			// Calcular score promedio de todas las métricas numéricas
			const scores = [
				neighborhood.conectividad,
				neighborhood.zonas_verdes,
				neighborhood.ruido,
				neighborhood.calidad_aire,
				neighborhood.ocupabilidad,
				neighborhood.accesibilidad,
			].filter(score => score !== undefined && score !== null);

			const score_total = scores.length > 0
				? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
				: 0;

			return {
				...neighborhood,
				score_total,
			};
		});

		// Ordenar por score total descendente
		neighborhoods.sort((a, b) => b.score_total - a.score_total);

		return {
			total_barrios: neighborhoods.length,
			barrios: neighborhoods,
		};
	}

	@Get('connectivity')
	async getConnectivity(): Promise<ConnectivityCollectionResultDto> {
		return this.lifestyleService.getAllConnectivityData();
	}

	@Get('green-zones')
	async getGreenZones(): Promise<GreenZonesCollectionResultDto> {
		return this.lifestyleService.getAllGreenZonesData();
	}

	@Get('noise')
	async getNoise(): Promise<NoiseCollectionResultDto> {
		return this.lifestyleService.getAllNoiseData();
	}

	@Get('air-quality')
	async getAirQuality(): Promise<AirQualityCollectionResultDto> {
		return this.lifestyleService.getAllAirQualityData();
	}

	@Get('occupability')
	async getOccupability(): Promise<OccupabilityCollectionResultDto> {
		return this.lifestyleService.getAllOccupabilityData();
	}

	@Get('accessibility')
	async getAccessibility(): Promise<AccessibilityCollectionResultDto> {
		return this.lifestyleService.getAllAccessibilityData();
	}

	@Get('salary')
	async getSalary(): Promise<SalaryCollectionResultDto> {
		return this.lifestyleService.getAllSalaryData();
	}
}
