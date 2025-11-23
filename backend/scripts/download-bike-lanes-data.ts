// Script para descargar datos de carriles bici de LA y guardarlos localmente
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

interface BikeLane {
  id: number;
  lat: number;
  lon: number;
  type: string; // 'cycleway', 'lane', 'track', etc.
  name?: string;
}

async function downloadBikeLaneData() {
  console.log('🚴 Descargando datos de carriles bici de Los Angeles...');
  
  // Bounding box de Los Angeles (aproximado)
  const bbox = {
    south: 33.7,
    west: -118.7,
    north: 34.35,
    east: -118.1
  };
  
  const allBikeLanes: BikeLane[] = [];
  
  // Carriles bici - nodos y vías
  console.log('📍 Descargando carriles bici...');
  const bikeQuery = `
    [out:json][timeout:90];
    (
      way["highway"="cycleway"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      way["cycleway"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      way["cycleway:left"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      way["cycleway:right"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      way["bicycle"="designated"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
    );
    out center;
  `;
  
  try {
    const bikeResponse = await axios.get('https://overpass-api.de/api/interpreter', {
      params: { data: bikeQuery },
      timeout: 120000
    });
    
    for (const element of bikeResponse.data.elements) {
      // Para ways, usar el centro
      const lat = element.center?.lat;
      const lon = element.center?.lon;
      
      if (lat && lon) {
        allBikeLanes.push({
          id: element.id,
          lat,
          lon,
          type: element.tags?.highway || element.tags?.cycleway || 'bike_lane',
          name: element.tags?.name
        });
      }
    }
    console.log(`✅ ${allBikeLanes.length} carriles bici descargados`);
  } catch (e) {
    console.error('❌ Error descargando carriles bici:', e.message);
  }
  
  // Guardar en archivo JSON
  const outputPath = path.join(__dirname, '..', 'bike_lanes_data.json');
  fs.writeFileSync(outputPath, JSON.stringify(allBikeLanes, null, 2));
  
  console.log(`\n✅ Total: ${allBikeLanes.length} carriles bici guardados en bike_lanes_data.json`);
  console.log(`📂 Ubicación: ${outputPath}`);
}

downloadBikeLaneData().catch(console.error);
