// Script para descargar datos de parkings de LA y guardarlos localmente
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

interface ParkingSpot {
  id: number;
  lat: number;
  lon: number;
  type: string; // 'surface', 'underground', 'multi-storey', etc.
  name?: string;
  capacity?: number;
}

async function downloadParkingData() {
  console.log('🅿️  Descargando datos de parkings de Los Angeles...');
  
  // Bounding box de Los Angeles (aproximado)
  const bbox = {
    south: 33.7,
    west: -118.7,
    north: 34.35,
    east: -118.1
  };
  
  const allParkings: ParkingSpot[] = [];
  
  // Parkings - nodos y vías
  console.log('📍 Descargando parkings...');
  const parkingQuery = `
    [out:json][timeout:90];
    (
      node["amenity"="parking"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      way["amenity"="parking"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      relation["amenity"="parking"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
    );
    out center;
  `;
  
  try {
    const parkingResponse = await axios.get('https://overpass-api.de/api/interpreter', {
      params: { data: parkingQuery },
      timeout: 120000
    });
    
    for (const element of parkingResponse.data.elements) {
      // Para ways y relations, usar el centro
      const lat = element.lat || element.center?.lat;
      const lon = element.lon || element.center?.lon;
      
      if (lat && lon) {
        allParkings.push({
          id: element.id,
          lat,
          lon,
          type: element.tags?.parking || 'surface',
          name: element.tags?.name,
          capacity: element.tags?.capacity ? parseInt(element.tags.capacity) : undefined
        });
      }
    }
    console.log(`✅ ${allParkings.length} parkings descargados`);
    
    // Mostrar estadísticas
    const withCapacity = allParkings.filter(p => p.capacity).length;
    const totalCapacity = allParkings.reduce((sum, p) => sum + (p.capacity || 0), 0);
    console.log(`   - Con capacidad conocida: ${withCapacity}`);
    console.log(`   - Capacidad total: ${totalCapacity} plazas`);
    
    const byType = {
      surface: allParkings.filter(p => p.type === 'surface').length,
      underground: allParkings.filter(p => p.type === 'underground').length,
      multi_storey: allParkings.filter(p => p.type === 'multi-storey').length,
      other: allParkings.filter(p => !['surface', 'underground', 'multi-storey'].includes(p.type)).length,
    };
    console.log('   - Por tipo:', byType);
  } catch (e) {
    console.error('❌ Error descargando parkings:', e.message);
  }
  
  // Guardar en archivo JSON
  const outputPath = path.join(__dirname, '..', 'parking_data.json');
  fs.writeFileSync(outputPath, JSON.stringify(allParkings, null, 2));
  
  console.log(`\n✅ Total: ${allParkings.length} parkings guardados en parking_data.json`);
  console.log(`📂 Ubicación: ${outputPath}`);
}

downloadParkingData().catch(console.error);
