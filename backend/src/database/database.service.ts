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
	ocupability_score: number;
	accessibility_score: number;
	salary_score: string;
	note?: string;
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
	private db: sqlite3.Database;
	private dbPath: string;

	async onModuleInit() {
		// Buscar la base de datos en la raíz del proyecto
		// process.cwd() nos da la raíz del proyecto donde se ejecuta npm
		this.dbPath = path.join(process.cwd(), 'neighborhoods.db');
		console.log('Intentando conectar a la base de datos en:', this.dbPath);
		
		this.db = new sqlite3.Database(this.dbPath, async (err) => {
			if (err) {
				console.error('Error al conectar con la base de datos:', err);
				console.error('Ruta intentada:', this.dbPath);
			} else {
				console.log('✓ Conectado a la base de datos neighborhoods.db');
				console.log('✓ Ruta:', this.dbPath);
				
				// Verificar si la tabla está vacía y llenarla si es necesario
				await this.initializeNeighborhoodsIfEmpty();
			}
		});
	}

	private async initializeNeighborhoodsIfEmpty(): Promise<void> {
		try {
			const neighborhoods = await this.getAllNeighborhoods();
			
			if (neighborhoods.length === 0) {
				console.log('⚠️ La tabla de barrios está vacía. Inicializando...');
				await this.seedNeighborhoods();
				console.log('✅ Barrios inicializados correctamente');
			} else {
				console.log(`✓ ${neighborhoods.length} barrios encontrados en la base de datos`);
			}
		} catch (error) {
			console.error('Error al verificar/inicializar barrios:', error);
		}
	}

	private seedNeighborhoods(): Promise<void> {
		const neighborhoods = [
			// Downtown & Central LA
			{ name: 'Downtown Los Angeles', lat: 34.0407, lon: -118.2468 },
			{ name: 'Koreatown', lat: 34.0580, lon: -118.3010 },
			{ name: 'Silver Lake', lat: 34.0869, lon: -118.2704 },
			{ name: 'Echo Park', lat: 34.0739, lon: -118.2606 },
			{ name: 'Highland Park', lat: 34.1107, lon: -118.1933 },
			{ name: 'Boyle Heights', lat: 34.0332, lon: -118.2064 },
			{ name: 'Arts District', lat: 34.0408, lon: -118.2329 },
			
			// Westside
			{ name: 'Santa Monica', lat: 34.0195, lon: -118.4912 },
			{ name: 'Venice', lat: 33.9850, lon: -118.4695 },
			{ name: 'Beverly Hills', lat: 34.0736, lon: -118.4004 },
			{ name: 'West Hollywood', lat: 34.0900, lon: -118.3617 },
			{ name: 'Culver City', lat: 34.0211, lon: -118.3965 },
			{ name: 'Mar Vista', lat: 33.9979, lon: -118.4276 },
			{ name: 'Palms', lat: 34.0135, lon: -118.4086 },
			{ name: 'Westwood', lat: 34.0633, lon: -118.4456 },
			{ name: 'Brentwood', lat: 34.0508, lon: -118.4737 },
			
			// Hollywood Area
			{ name: 'Hollywood', lat: 34.0928, lon: -118.3287 },
			{ name: 'Los Feliz', lat: 34.1161, lon: -118.2828 },
			
			// San Fernando Valley
			{ name: 'Studio City', lat: 34.1464, lon: -118.3965 },
			{ name: 'Sherman Oaks', lat: 34.1508, lon: -118.4490 },
			{ name: 'Van Nuys', lat: 34.1900, lon: -118.4514 },
			{ name: 'North Hollywood', lat: 34.1719, lon: -118.3762 },
			{ name: 'Burbank', lat: 34.1808, lon: -118.3090 },
			{ name: 'Encino', lat: 34.1592, lon: -118.5018 },
			{ name: 'Tarzana', lat: 34.1686, lon: -118.5468 },
			{ name: 'Woodland Hills', lat: 34.1683, lon: -118.6059 },
			{ name: 'Canoga Park', lat: 34.2014, lon: -118.6006 },
			
			// South LA
			{ name: 'South Los Angeles', lat: 33.9731, lon: -118.2474 },
			{ name: 'Inglewood', lat: 33.9617, lon: -118.3531 },
			{ name: 'Hawthorne', lat: 33.9164, lon: -118.3526 },
			{ name: 'Compton', lat: 33.8958, lon: -118.2201 },
			{ name: 'Carson', lat: 33.8314, lon: -118.2820 },
			{ name: 'Torrance', lat: 33.8358, lon: -118.3406 },
			{ name: 'Long Beach', lat: 33.7701, lon: -118.1937 },
			
			// East LA
			{ name: 'East Los Angeles', lat: 34.0239, lon: -118.1720 },
			{ name: 'El Sereno', lat: 34.0900, lon: -118.1700 },
			{ name: 'Monterey Park', lat: 34.0625, lon: -118.1228 },
			{ name: 'Alhambra', lat: 34.0953, lon: -118.1270 },
			{ name: 'Pasadena', lat: 34.1478, lon: -118.1445 },
			
			// Northeast LA
			{ name: 'Eagle Rock', lat: 34.1383, lon: -118.2078 },
			{ name: 'Glassell Park', lat: 34.1143, lon: -118.2332 },
			{ name: 'Atwater Village', lat: 34.1208, lon: -118.2604 },
			{ name: 'Glendale', lat: 34.1425, lon: -118.2551 },
			
			// Coastal South Bay
			{ name: 'Manhattan Beach', lat: 33.8847, lon: -118.4109 },
			{ name: 'Hermosa Beach', lat: 33.8622, lon: -118.3996 },
			{ name: 'Redondo Beach', lat: 33.8492, lon: -118.3884 },
			{ name: 'El Segundo', lat: 33.9192, lon: -118.4165 },
			
			// Other Notable Areas
			{ name: 'Mid-Wilshire', lat: 34.0619, lon: -118.3426 },
			{ name: 'Miracle Mile', lat: 34.0626, lon: -118.3596 },
			{ name: 'Fairfax District', lat: 34.0753, lon: -118.3621 },
			{ name: 'Pico-Robertson', lat: 34.0522, lon: -118.3842 },
			{ name: 'Sawtelle', lat: 34.0358, lon: -118.4551 },
		];

		return new Promise((resolve, reject) => {
			this.db.serialize(() => {
				const stmt = this.db.prepare(`
          INSERT OR IGNORE INTO neighborhoods (name, latitude, longitude) 
          VALUES (?, ?, ?)
        `);

				let insertCount = 0;
				neighborhoods.forEach((neighborhood) => {
					stmt.run(neighborhood.name, neighborhood.lat, neighborhood.lon, (err) => {
						if (err) {
							console.error(`Error al insertar ${neighborhood.name}:`, err);
						} else {
							insertCount++;
						}
					});
				});

				stmt.finalize((err) => {
					if (err) {
						console.error('Error al finalizar statement:', err);
						reject(err);
					} else {
						console.log(`✓ ${insertCount} barrios insertados`);
						resolve();
					}
				});
			});
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

  getAllLifestyles(): Promise<Lifestyle[]> {
		return new Promise((resolve, reject) => {
			this.db.all(
				'SELECT * FROM lifestyle ORDER BY name',
				(err, rows: Lifestyle[]) => {
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
		ocupabilityScore: number,
		accessibilityScore: number,
		salaryScore: 'High' | 'Medium' | 'Low',
		note: string | undefined,
	): Promise<void> {
		return new Promise((resolve, reject) => {
			this.db.run(
				`INSERT INTO lifestyle (neighborhood_name, score, green_zones_score, noise_score, air_quality_score, ocupability_score, accessibility_score, salary_classification, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					neighborhoodName,
					score,
					greenZonesScore,
					noiseScore,
					airQualityScore,
					ocupabilityScore,
					accessibilityScore,
					salaryScore,
					note,
				],
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
		ocupabilityScore: number,
		accessibilityScore: number,
		salaryScore: 'High' | 'Medium' | 'Low',
		note: string | undefined,
	): Promise<void> {
		return new Promise((resolve, reject) => {
			this.db.run(
				`UPDATE lifestyle SET score = ?, green_zones_score = ?, noise_score = ?, air_quality_score = ?, ocupability_score = ?, accessibility_score = ?, salary_classification = ?, note = ? WHERE neighborhood_name = ?`,
				[
					score,
					greenZonesScore,
					noiseScore,
					airQualityScore,
					ocupabilityScore,
					accessibilityScore,
					salaryScore,
					note,
					neighborhoodName,
				],
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
