
import { Injectable, HttpException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class SecurityService {
	async getNeighborhoodRanking() {
		try {
			// Fetch accidentes
			const accUrl = 'https://data.lacity.org/resource/d5tf-ez2w.json?$select=area_name,%20count(*)%20as%20accidents&$group=area_name&$order=accidents%20DESC';
			const crimesUrl = 'https://data.lacity.org/resource/2nrs-mtv8.json?$select=area_name,count(*)%20as%20crimes&$group=area_name&$order=crimes%20DESC';
			const [accRes, crimesRes] = await Promise.all([
				axios.get(accUrl),
				axios.get(crimesUrl),
			]);

			// Map area_name to accidents and crimes
			const accidentsMap = new Map<string, number>();
			for (const item of accRes.data) {
				accidentsMap.set(item.area_name, Number(item.accidents));
			}
			const crimesMap = new Map<string, number>();
			for (const item of crimesRes.data) {
				crimesMap.set(item.area_name, Number(item.crimes));
			}

			// Unir barrios y calcular score (puedes ajustar el score como quieras)
			const allAreas = new Set([
				...Array.from(accidentsMap.keys()),
				...Array.from(crimesMap.keys()),
			]);
			const ranking = Array.from(allAreas).map((area) => {
				const accidents = accidentsMap.get(area) || 0;
				const crimes = crimesMap.get(area) || 0;
				// Score simple: suma de ambos
						return {
							area_name: area,
							_rawScore: accidents + crimes,
						};
			});
					// Ordenar por rawScore (desc)
					ranking.sort((a, b) => b._rawScore - a._rawScore);

					// Normalizar scores a rango 0-100
					const rawValues = ranking.map((r) => r._rawScore);
					const max = Math.max(...rawValues);
					const min = Math.min(...rawValues);

					const normalized = ranking.map((r) => {
						let score = 0;
						if (max === min) {
							// Si todos los valores son iguales: si son cero -> 0, si no -> 100
							score = r._rawScore === 0 ? 0 : 100;
						} else {
							score = Math.round(((r._rawScore - min) / (max - min)) * 100);
						}
						return {
							area_name: r.area_name,
							score,
						};
					});

					return normalized;
		} catch (e) {
			throw new HttpException('Error obteniendo datos externos', 500);
		}
	}
}
