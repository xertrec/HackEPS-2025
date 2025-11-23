// Script para descargar datos de caminos para caminar/correr de LA
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

interface Footpath {
  id: number;
  lat: number;
  lon: number;
  type: string; // 'footway', 'path', 'track', 'trail'
  name?: string;
  surface?: string;
}

async function downloadFootpathData() {
  console.log('🏃 Descargando datos de caminos para caminar/correr de Los Angeles...');
  
  // Bounding box de Los Angeles (aproximado)
  const bbox = {
    south: 33.7,
    west: -118.7,
    north: 34.35,
    east: -118.1
  };
  
  const allFootpaths: Footpath[] = [];
  
  // Caminos para peatones y corredores
  console.log('📍 Descargando caminos peatonales...');
  const footpathQuery = `
    [out:json][timeout:90];
    (
      way["highway"~"path|footway|pedestrian"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      way["foot"="designated"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      way["leisure"="track"]["sport"~"running|athletics"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      way["route"="hiking"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
    );
    out center;
  `;
  
  try {
    const response = await axios.get('https://overpass-api.de/api/interpreter', {
      params: { data: footpathQuery },
      timeout: 120000
    });
    
    for (const element of response.data.elements) {
      // Para ways, usar el centro
      const lat = element.center?.lat;
      const lon = element.center?.lon;
      
      if (lat && lon) {
        allFootpaths.push({
          id: element.id,
          lat,
          lon,
          type: element.tags?.highway || element.tags?.leisure || element.tags?.route || 'footpath',
          name: element.tags?.name,
          surface: element.tags?.surface
        });
      }
    }
    console.log(`✅ ${allFootpaths.length} caminos peatonales descargados`);
  } catch (e) {
    console.error('❌ Error descargando caminos peatonales:', e.message);
  }
  
  // Guardar en archivo JSON
  const outputPath = path.join(__dirname, '..', 'footpaths_data.json');
  fs.writeFileSync(outputPath, JSON.stringify(allFootpaths, null, 2));
  
  console.log(`\n✅ Total: ${allFootpaths.length} caminos guardados en footpaths_data.json`);
  console.log(`📂 Ubicación: ${outputPath}`);
}

downloadFootpathData().catch(console.error);
