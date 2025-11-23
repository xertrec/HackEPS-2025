import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as sqlite3 from 'sqlite3';
import * as path from 'path';

export interface Neighborhood {
	id: number;
	name: string;
	latitude: number;
	longitude: number;
	nightlife_score: number;
	shops_score: number;
	leisure_score: number;
	total_score: number;
	last_updated: string;
}

export class Lifestyle {
	neighborhood_name: string;
	score: number;
	green_zones_score: number;
  noise_score: number;
  air_quality_score: number;
	note?: string;
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
	private db: sqlite3.Database;
	private dbPath: string;

	onModuleInit() {
		// Buscar la base de datos en la raíz del proyecto
		// process.cwd() nos da la raíz del proyecto donde se ejecuta npm
		this.dbPath = path.join(process.cwd(), 'neighborhoods.db');
		console.log('Intentando conectar a la base de datos en:', this.dbPath);

		this.db = new sqlite3.Database(this.dbPath, (err) => {
			if (err) {
				console.error('Error al conectar con la base de datos:', err);
				console.error('Ruta intentada:', this.dbPath);
			} else {
				console.log('✓ Conectado a la base de datos neighborhoods.db');
				console.log('✓ Ruta:', this.dbPath);
			}
		});
	}

	onModuleDestroy() {
		if (this.db) {
			this.db.close((err) => {
				if (err) {
					console.error('Error al cerrar la base de datos:', err);
				}
			});
		}
	}

	// Obtener todos los barrios
	getAllNeighborhoods(): Promise<Neighborhood[]> {
		return new Promise((resolve, reject) => {
			this.db.all(
				'SELECT * FROM neighborhoods ORDER BY name',
				(err, rows: Neighborhood[]) => {
					if (err) {
						reject(err);
					} else {
						resolve(rows);
					}
				},
			);
		});
	}

	// Obtener un barrio por nombre
	getNeighborhoodByName(name: string): Promise<Neighborhood | undefined> {
		return new Promise((resolve, reject) => {
			this.db.get(
				'SELECT * FROM neighborhoods WHERE name = ?',
				[name],
				(err, row: Neighborhood) => {
					if (err) {
						reject(err);
					} else {
						resolve(row);
					}
				},
			);
		});
	}

	// Obtener un barrio por ID
	getNeighborhoodById(id: number): Promise<Neighborhood | undefined> {
		return new Promise((resolve, reject) => {
			this.db.get(
				'SELECT * FROM neighborhoods WHERE id = ?',
				[id],
				(err, row: Neighborhood) => {
					if (err) {
						reject(err);
					} else {
						resolve(row);
					}
				},
			);
		});
	}

	// Actualizar scores de un barrio
	updateNeighborhoodScores(
		id: number,
		nightlifeScore: number,
		shopsScore: number,
		leisureScore: number,
	): Promise<void> {
		const totalScore = Math.round(
			(nightlifeScore + shopsScore + leisureScore) / 3,
		);

		return new Promise((resolve, reject) => {
			this.db.run(
				`UPDATE neighborhoods 
         SET nightlife_score = ?, 
             shops_score = ?, 
             leisure_score = ?, 
             total_score = ?,
             last_updated = CURRENT_TIMESTAMP
         WHERE id = ?`,
				[nightlifeScore, shopsScore, leisureScore, totalScore, id],
				(err) => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
				},
			);
		});
	}

	// Obtener barrios con mejor puntuación
	getTopNeighborhoods(limit: number = 10): Promise<Neighborhood[]> {
		return new Promise((resolve, reject) => {
			this.db.all(
				'SELECT * FROM neighborhoods ORDER BY total_score DESC LIMIT ?',
				[limit],
				(err, rows: Neighborhood[]) => {
					if (err) {
						reject(err);
					} else {
						resolve(rows);
					}
				},
			);
		});
	}

	// Buscar barrios por coordenadas (radio en km)
	getNeighborhoodsNearby(
		lat: number,
		lon: number,
		radiusKm: number = 5,
	): Promise<Neighborhood[]> {
		// Aproximación simple usando distancia euclidiana
		// Para mayor precisión se podría usar la fórmula de Haversine
		const latDelta = radiusKm / 111; // 1 grado de latitud ≈ 111 km
		const lonDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

		return new Promise((resolve, reject) => {
			this.db.all(
				`SELECT * FROM neighborhoods 
         WHERE latitude BETWEEN ? AND ? 
         AND longitude BETWEEN ? AND ?
         ORDER BY name`,
				[lat - latDelta, lat + latDelta, lon - lonDelta, lon + lonDelta],
				(err, rows: Neighborhood[]) => {
					if (err) {
						reject(err);
					} else {
						resolve(rows);
					}
				},
			);
		});
	}

	// --- Lifestyle (Connectivity) Methods ---
	insertLifestyle(
		neighborhoodName: string,
		score: number,
		greenZonesScore: number,
    noiseScore: number,
    airQualityScore: number,
		note: string | undefined,
	): Promise<void> {
		return new Promise((resolve, reject) => {
			this.db.run(
				`INSERT INTO lifestyle (neighborhood_name, score, green_zones_score, noise_score, air_quality_score, note) VALUES (?, ?, ?, ?, ?, ?)`,
				[neighborhoodName, score, greenZonesScore, noiseScore, airQualityScore, note],
				(err) => {
					if (err) reject(err);
					else resolve();
				},
			);
		});
	}

	updateLifestyle(
		neighborhoodName: string,
		score: number,
		greenZonesScore: number,
    noiseScore: number,
    airQualityScore: number,
		note: string | undefined,
	): Promise<void> {
		return new Promise((resolve, reject) => {
			this.db.run(
				`UPDATE lifestyle SET score = ?, green_zones_score = ?, noise_score = ?, air_quality_score = ?, note = ? WHERE neighborhood_name = ?`,
				[score, greenZonesScore, noiseScore, airQualityScore, note, neighborhoodName],
				(err) => {
					if (err) reject(err);
					else resolve();
				},
			);
		});
	}

	getLifestyleByNeighborhoodName(
		neighborhoodName: string,
	): Promise<Lifestyle | undefined> {
		return new Promise((resolve, reject) => {
			this.db.get(
				'SELECT * FROM lifestyle WHERE neighborhood_name = ?',
				[neighborhoodName],
				(err, row: Lifestyle) => {
					if (err) {
						reject(err);
					} else {
						resolve(row);
					}
				},
			);
		});
	}
}
