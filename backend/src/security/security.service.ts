
import { Injectable, HttpException, OnModuleInit } from '@nestjs/common';
import axios from 'axios';
import { DatabaseService } from '../database/database.service';

interface CrimeData {
	lat: string;
	lon: string;
	crm_cd_desc: string;
	area_name: string;
}

interface AccidentData {
	latitude: string;
	longitude: string;
	type_description: string;
}

interface DisasterData {
	latitude: string;
	longitude: string;
	incident_type: string;
}

@Injectable()
export class SecurityService implements OnModuleInit {
	// Cache para datos de seguridad
	private securityDataCache: {
		crimes: CrimeData[];
		accidents: AccidentData[];
		disasters: DisasterData[];
		lastUpdated: Date | null;
	} = {
		crimes: [],
		accidents: [],
		disasters: [],
		lastUpdated: null,
	};

	constructor(private readonly databaseService: DatabaseService) {}

	/**
	 * Cargar datos al inicializar el módulo
	 */
	async onModuleInit() {
		try {
			await this.loadAllSecurityData();
		} catch (error) {
			console.error('⚠️ Error cargando datos de seguridad al inicio:', error.message);
		}
	}

	/**
	 * Carga todos los datos de seguridad al inicio para evitar rate limiting
	 */
	async loadAllSecurityData() {
		const now = new Date();
		
		// Si ya tenemos datos y fueron actualizados hace menos de 1 hora, usar cache
		if (
			this.securityDataCache.lastUpdated &&
			now.getTime() - this.securityDataCache.lastUpdated.getTime() < 3600000
		) {
			console.log('✓ Usando datos de seguridad cacheados');
			return;
		}

		console.log('🔄 Cargando datos de seguridad de LA...');

		try {
			// Cargar crímenes (últimos 50000 registros con coordenadas)
			console.log('  🚨 Descargando datos de crímenes...');
			const crimesRes = await axios.get(
				'https://data.lacity.org/resource/2nrs-mtv8.json',
				{
					params: {
						$limit: 50000,
						$select: 'lat,lon,crm_cd_desc,area_name',
						$where: 'lat IS NOT NULL AND lon IS NOT NULL',
					},
				}
			);
			this.securityDataCache.crimes = crimesRes.data;
			console.log(`  ✓ ${this.securityDataCache.crimes.length} crímenes cargados`);

			// Cargar accidentes de tráfico (últimos 50000)
			console.log('  🚗 Descargando datos de accidentes...');
			const accidentsRes = await axios.get(
				'https://data.lacity.org/resource/d5tf-ez2w.json',
				{
					params: {
						$limit: 50000,
						$select: 'location_1,crm_cd_desc',
						$where: 'location_1 IS NOT NULL',
					},
				}
			);
			// Transformar location_1 a latitude/longitude
			this.securityDataCache.accidents = accidentsRes.data
				.filter((item: any) => item.location_1?.latitude && item.location_1?.longitude)
				.map((item: any) => ({
					latitude: item.location_1.latitude,
					longitude: item.location_1.longitude,
					type_description: item.crm_cd_desc || 'Unknown',
				}));
			console.log(`  ✓ ${this.securityDataCache.accidents.length} accidentes cargados`);

			// Por ahora no cargamos desastres naturales (no hay dataset público disponible)
			// Se podría agregar en el futuro con datos de FEMA o similar
			console.log('  ⚠️ Desastres naturales: dataset no disponible (usando solo crímenes + accidentes)');
			this.securityDataCache.disasters = [];

			this.securityDataCache.lastUpdated = now;
			console.log('✅ Datos de seguridad cargados correctamente');
		} catch (error) {
			console.error('❌ Error cargando datos de seguridad:', error.message);
			throw error;
		}
	}

	/**
	 * Calcula la distancia entre dos puntos en km (fórmula Haversine)
	 */
	private calculateDistance(
		lat1: number,
		lon1: number,
		lat2: number,
		lon2: number
	): number {
		const R = 6371; // Radio de la Tierra en km
		const dLat = ((lat2 - lat1) * Math.PI) / 180;
		const dLon = ((lon2 - lon1) * Math.PI) / 180;
		const a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos((lat1 * Math.PI) / 180) *
				Math.cos((lat2 * Math.PI) / 180) *
				Math.sin(dLon / 2) *
				Math.sin(dLon / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		return R * c;
	}

	/**
	 * Cuenta incidentes dentro de un radio alrededor de un barrio
	 */
	private countIncidentsInRadius(
		neighborhoodLat: number,
		neighborhoodLon: number,
		incidents: Array<{ lat?: string; lon?: string; latitude?: string; longitude?: string }>,
		radiusKm: number
	): number {
		let count = 0;
		for (const incident of incidents) {
			const lat = parseFloat(incident.lat || incident.latitude || '0');
			const lon = parseFloat(incident.lon || incident.longitude || '0');
			
			if (lat && lon) {
				const distance = this.calculateDistance(
					neighborhoodLat,
					neighborhoodLon,
					lat,
					lon
				);
				if (distance <= radiusKm) {
					count++;
				}
			}
		}
		return count;
	}

	/**
	 * Calcula el score de seguridad para un barrio basado en incidentes cercanos
	 * Score 0-100: 100 = muy seguro (pocos incidentes), 0 = muy inseguro (muchos incidentes)
	 */
	private calculateSecurityScore(
		neighborhoodLat: number,
		neighborhoodLon: number
	): number {
		const radiusKm = 2; // Radio de búsqueda: 2km alrededor del barrio

		// Contar incidentes de cada tipo
		const crimesCount = this.countIncidentsInRadius(
			neighborhoodLat,
			neighborhoodLon,
			this.securityDataCache.crimes,
			radiusKm
		);

		const accidentsCount = this.countIncidentsInRadius(
			neighborhoodLat,
			neighborhoodLon,
			this.securityDataCache.accidents,
			radiusKm
		);

		const disastersCount = this.countIncidentsInRadius(
			neighborhoodLat,
			neighborhoodLon,
			this.securityDataCache.disasters,
			radiusKm
		);

		// Ponderar cada tipo de incidente
		// Crímenes pesan más (1.8x) ya que son más directamente relacionados con seguridad
		// Accidentes también son importantes pero menos peso (1.0x)
		const weightedScore =
			crimesCount * 1.8 + // Crímenes: robo, asalto, violencia, etc.
			accidentsCount * 1.0 + // Accidentes de tráfico
			disastersCount * 1.5; // Desastres (actualmente 0)

		return weightedScore;
	}

	/**
	 * Obtiene el ranking de seguridad de todos los barrios
	 */
	async getNeighborhoodRanking() {
		try {
			// Asegurar que tenemos datos cargados
			await this.loadAllSecurityData();

			// Obtener todos los barrios de la base de datos
			const neighborhoods = await this.databaseService.getAllNeighborhoods();

			// Calcular score de seguridad para cada barrio
			const scores = neighborhoods.map((neighborhood) => {
				const rawScore = this.calculateSecurityScore(
					neighborhood.latitude,
					neighborhood.longitude
				);

				return {
					name: neighborhood.name,
					rawScore: rawScore,
				};
			});

			// Normalizar scores a 0-100 (invertido: más incidentes = menos score)
			const rawValues = scores.map((s) => s.rawScore);
			const maxRaw = Math.max(...rawValues);
			const minRaw = Math.min(...rawValues);

			const normalized = scores.map((s) => {
				let score = 0;
				
				if (maxRaw === minRaw) {
					// Todos tienen el mismo valor
					score = s.rawScore === 0 ? 100 : 50;
				} else {
					// Invertir: mayor rawScore (más incidentes) = menor score de seguridad
					// Usamos escala logarítmica para mejor distribución
					const normalizedValue = (s.rawScore - minRaw) / (maxRaw - minRaw);
					score = Math.round((1 - normalizedValue) * 100);
				}

				return {
					barrio: s.name,
					seguridad: Math.max(0, Math.min(100, score)), // Asegurar rango 0-100
				};
			});

			// Ordenar por score descendente (más seguro primero)
			normalized.sort((a, b) => b.seguridad - a.seguridad);

			return normalized;
		} catch (error) {
			console.error('Error calculando ranking de seguridad:', error);
			throw new HttpException(
				'Error obteniendo datos de seguridad',
				500
			);
		}
	}
}
