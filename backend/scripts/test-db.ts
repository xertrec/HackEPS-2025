import * as sqlite3 from 'sqlite3';
import * as path from 'path';

const dbPath = path.join(__dirname, '..', 'neighborhoods.db');
console.log('Intentando conectar a:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }
  console.log('✓ Conectado');
  
  db.all('SELECT * FROM neighborhoods LIMIT 3', (err, rows) => {
    if (err) {
      console.error('Error al consultar:', err);
      process.exit(1);
    }
    console.log('✓ Barrios encontrados:', rows.length);
    console.log(JSON.stringify(rows, null, 2));
    
    db.close();
  });
});
