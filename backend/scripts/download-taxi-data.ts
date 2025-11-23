// Script para descargar datos de paradas de taxi de LA y guardarlos localmente
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

interface TaxiStop {
  lat: number;
  lon: number;
  name?: string;
  operator?: string;
}

async function downloadTaxiData() {
  console.log('🚕 Descargando datos de paradas de taxi de Los Angeles...');
  
  // Bounding box de Los Angeles (aproximado)
  const bbox = {
    south: 33.7,
    west: -118.7,
    north: 34.35,
    east: -118.1
  };
  
  const allTaxis: TaxiStop[] = [];
  
  // Paradas de taxi
  console.log('📍 Descargando paradas de taxi...');
  const taxiQuery = `
    [out:json][timeout:60];
    (
      node["amenity"="taxi"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
    );
    out body;
  `;
  
  try {
    const taxiResponse = await axios.get('https://overpass-api.de/api/interpreter', {
      params: { data: taxiQuery }
    });
    
    for (const element of taxiResponse.data.elements) {
      // Para ways, usar el centro
      const lat = element.lat || element.center?.lat;
      const lon = element.lon || element.center?.lon;
      
      if (lat && lon) {
        allTaxis.push({
          lat,
          lon,
          name: element.tags?.name,
          operator: element.tags?.operator
        });
      }
    }
    console.log(`✅ ${allTaxis.length} paradas de taxi descargadas`);
  } catch (e) {
    console.error('❌ Error descargando paradas de taxi:', e.message);
  }
  
  // Guardar en archivo JSON
  const outputPath = path.join(__dirname, '..', 'taxi_data.json');
  fs.writeFileSync(outputPath, JSON.stringify(allTaxis, null, 2));
  
  console.log(`\n✅ Total: ${allTaxis.length} paradas de taxi guardadas en taxi_data.json`);
  console.log(`📂 Ubicación: ${outputPath}`);
}

downloadTaxiData().catch(console.error);
