import * as sqlite3 from 'sqlite3';
import * as path from 'path';

// Barrios principales de Los Ángeles con sus coordenadas (centro aproximado)
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
  { name: 'West Hollywood', lat: 34.0900, lon: -118.3617 },
  
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
  { name: 'Montebello', lat: 34.0165, lon: -118.1137 },
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

const dbPath = path.join(__dirname, '..', 'neighborhoods.db');

console.log('Creando base de datos en:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al crear la base de datos:', err);
    process.exit(1);
  }
  console.log('✓ Base de datos conectada');
});

db.serialize(() => {
  // Crear tabla de barrios
  db.run(`
    CREATE TABLE IF NOT EXISTS neighborhoods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      nightlife_score INTEGER DEFAULT 0,
      shops_score INTEGER DEFAULT 0,
      leisure_score INTEGER DEFAULT 0,
      total_score INTEGER DEFAULT 0,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error al crear tabla neighborhoods:', err);
      return;
    }
    console.log('✓ Tabla neighborhoods creada');
  });

  // Insertar barrios
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO neighborhoods (name, latitude, longitude) 
    VALUES (?, ?, ?)
  `);

  neighborhoods.forEach((neighborhood) => {
    stmt.run(neighborhood.name, neighborhood.lat, neighborhood.lon, (err) => {
      if (err) {
        console.error(`Error al insertar ${neighborhood.name}:`, err);
      }
    });
  });

  stmt.finalize((err) => {
    if (err) {
      console.error('Error al finalizar statement:', err);
    } else {
      console.log(`✓ ${neighborhoods.length} barrios insertados`);
    }
  });

  // Verificar datos insertados
  db.all('SELECT COUNT(*) as count FROM neighborhoods', (err, rows: any) => {
    if (err) {
      console.error('Error al contar barrios:', err);
    } else {
      console.log(`✓ Total de barrios en la base de datos: ${rows[0].count}`);
    }
    
    db.close((err) => {
      if (err) {
        console.error('Error al cerrar la base de datos:', err);
      } else {
        console.log('✓ Base de datos cerrada correctamente');
      }
    });
  });

  db.run(`
    CREATE TABLE lifestyle (
      neighborhood_name TEXT PRIMARY KEY,
      score INTEGER NOT NULL DEFAULT 0,
      green_zones_score INTEGER NOT NULL DEFAULT 0,
      noise_score INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      FOREIGN KEY (neighborhood_name) REFERENCES neighborhoods(name)
    );
  `, (err) => {
    if (err) {
      console.error('Error al crear tabla lifestyle:', err);
      return;
    }
    console.log('✓ Tabla lifestyle creada');
  });
});
