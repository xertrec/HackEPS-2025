import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

interface OverpassElement {
  type: string;
  id: number;
  lat: number;
  lon: number;
  tags?: {
    name?: string;
    amenity?: string;
    leisure?: string;
    tourism?: string;
    [key: string]: string | undefined;
  };
}

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchNightlifeData(): Promise<void> {
  console.log('📍 Descargando datos de ocio nocturno...');
  
  const query = `[out:json][timeout:60];
(
  node["amenity"="bar"](34.0,-118.7,34.4,-118.0);
  node["amenity"="nightclub"](34.0,-118.7,34.4,-118.0);
  node["amenity"="pub"](34.0,-118.7,34.4,-118.0);
  node["amenity"="music_venue"](34.0,-118.7,34.4,-118.0);
);
out body;`;

  try {
    const response = await axios.post(OVERPASS_API, query, {
      headers: { 'Content-Type': 'text/plain' },
      timeout: 90000,
    });

    const elements: OverpassElement[] = response.data.elements || [];
    
    // Guardar SOLO en la raíz del proyecto
    const rootPath = path.join(__dirname, '..', 'nightlife_data.json');
    fs.writeFileSync(rootPath, JSON.stringify(elements, null, 2));
    
    console.log(`✓ ${elements.length} lugares de ocio nocturno guardados en nightlife_data.json`);
    
    // Mostrar estadísticas
    const stats = {
      bars: elements.filter(e => e.tags?.amenity === 'bar').length,
      nightclubs: elements.filter(e => e.tags?.amenity === 'nightclub').length,
      pubs: elements.filter(e => e.tags?.amenity === 'pub').length,
      music_venues: elements.filter(e => e.tags?.amenity === 'music_venue').length,
    };
    console.log('  Estadísticas:', stats);
  } catch (error) {
    console.error('Error al descargar datos de ocio nocturno:', error.message);
    throw error;
  }
}

async function fetchDayLeisureData(): Promise<void> {
  console.log('📍 Descargando datos de ocio diurno...');
  
  const query = `[out:json][timeout:60];
(
  node["amenity"="cinema"](34.0,-118.7,34.4,-118.0);
  node["amenity"="theatre"](34.0,-118.7,34.4,-118.0);
  node["tourism"="museum"](34.0,-118.7,34.4,-118.0);
  node["leisure"="park"](34.0,-118.7,34.4,-118.0);
  node["amenity"="cafe"](34.0,-118.7,34.4,-118.0);
  node["amenity"="arts_centre"](34.0,-118.7,34.4,-118.0);
  node["leisure"="sports_centre"](34.0,-118.7,34.4,-118.0);
  node["leisure"="playground"](34.0,-118.7,34.4,-118.0);
);
out body;`;

  try {
    const response = await axios.post(OVERPASS_API, query, {
      headers: { 'Content-Type': 'text/plain' },
      timeout: 90000,
    });

    const elements: OverpassElement[] = response.data.elements || [];
    
    // Guardar SOLO en la raíz del proyecto
    const rootPath = path.join(__dirname, '..', 'dayleisure_data.json');
    fs.writeFileSync(rootPath, JSON.stringify(elements, null, 2));
    
    console.log(`✓ ${elements.length} lugares de ocio diurno guardados en dayleisure_data.json`);
    
    // Mostrar estadísticas
    const stats = {
      cinemas: elements.filter(e => e.tags?.amenity === 'cinema').length,
      theatres: elements.filter(e => e.tags?.amenity === 'theatre').length,
      museums: elements.filter(e => e.tags?.tourism === 'museum').length,
      parks: elements.filter(e => e.tags?.leisure === 'park').length,
      cafes: elements.filter(e => e.tags?.amenity === 'cafe').length,
      arts_centres: elements.filter(e => e.tags?.amenity === 'arts_centre').length,
      sports_centres: elements.filter(e => e.tags?.leisure === 'sports_centre').length,
      playgrounds: elements.filter(e => e.tags?.leisure === 'playground').length,
    };
    console.log('  Estadísticas:', stats);
  } catch (error) {
    console.error('Error al descargar datos de ocio diurno:', error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Iniciando descarga de datos de ocio de Los Ángeles...\n');
  
  try {
    // Descargar datos de ocio nocturno
    await fetchNightlifeData();
    
    // Esperar 5 segundos entre peticiones para evitar rate limiting
    console.log('\n⏳ Esperando 5 segundos...\n');
    await delay(5000);
    
    // Descargar datos de ocio diurno
    await fetchDayLeisureData();
    
    console.log('\n✅ ¡Todos los datos descargados correctamente!');
  } catch (error) {
    console.error('\n❌ Error durante la descarga:', error.message);
    process.exit(1);
  }
}

main();
