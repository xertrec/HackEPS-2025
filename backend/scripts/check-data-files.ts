// Script para verificar y generar archivos de datos si no existen
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const requiredFiles = [
  {
    name: 'transport_data.json',
    command: 'npx ts-node scripts/download-transport-data.ts',
    description: 'Datos de transporte público'
  },
  {
    name: 'taxi_data.json',
    command: 'npx ts-node scripts/download-taxi-data.ts',
    description: 'Datos de paradas de taxi'
  },
  {
    name: 'bike_lanes_data.json',
    command: 'npx ts-node scripts/download-bike-lanes-data.ts',
    description: 'Datos de carriles bici'
  },
  {
    name: 'footpaths_data.json',
    command: 'npx ts-node scripts/download-footpaths-data.ts',
    description: 'Datos de caminos peatonales'
  },
  {
    name: 'nightlife_data.json',
    command: 'npm run fetch-leisure',
    description: 'Datos de ocio nocturno y diurno',
    skipIfExists: 'dayleisure_data.json' // Si existe el otro, no ejecutar
  }
];

async function checkAndGenerateFiles() {
  console.log('🔍 Verificando archivos de datos necesarios...\n');
  
  let needsGeneration = false;
  
  for (const file of requiredFiles) {
    const filePath = path.join(__dirname, '..', file.name);
    
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`✅ ${file.name} existe (${sizeMB} MB)`);
    } else {
      // Verificar si debemos saltar por otro archivo
      if (file.skipIfExists) {
        const skipPath = path.join(__dirname, '..', file.skipIfExists);
        if (fs.existsSync(skipPath)) {
          console.log(`⏭️  ${file.name} no existe pero ${file.skipIfExists} sí`);
          continue;
        }
      }
      
      console.log(`❌ ${file.name} no existe`);
      console.log(`📥 Generando ${file.description}...`);
      
      try {
        execSync(file.command, { 
          cwd: path.join(__dirname, '..'),
          stdio: 'inherit'
        });
        needsGeneration = true;
      } catch (error) {
        console.error(`❌ Error generando ${file.name}:`, error.message);
      }
    }
  }
  
  if (!needsGeneration) {
    console.log('\n✅ Todos los archivos de datos están listos!\n');
  } else {
    console.log('\n✅ Archivos de datos generados correctamente!\n');
  }
}

checkAndGenerateFiles().catch(console.error);
