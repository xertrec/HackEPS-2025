import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: {
    name?: string;
    'name:en'?: string;
    amenity?: string;
    building?: string;
  };
}

interface UniversityData {
  id: number;
  name: string;
  lat: number;
  lon: number;
  type: string; // 'university' o 'college'
}

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

/**
 * Descarga datos de universidades y colleges desde OpenStreetMap
 */
async function fetchUniversitiesData(): Promise<UniversityData[]> {
  console.log('📚 Descargando datos de universidades desde OpenStreetMap...');
  
  // Query Overpass para obtener universidades y colleges en Los Angeles
  // Bounding box de Los Angeles: aproximadamente [33.7, -118.7, 34.3, -118.1]
  const query = `
    [out:json][timeout:120];
    (
      node["amenity"="university"](33.7,-118.7,34.3,-118.1);
      way["amenity"="university"](33.7,-118.7,34.3,-118.1);
      node["amenity"="college"](33.7,-118.7,34.3,-118.1);
      way["amenity"="college"](33.7,-118.7,34.3,-118.1);
    );
    out center;
  `;

  try {
    const response = await axios.post(
      OVERPASS_API,
      query,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 120000, // 120 segundos
      }
    );

    const elements: OverpassElement[] = response.data.elements || [];
    console.log(`  ✓ Encontrados ${elements.length} elementos de universidades/colleges`);

    // Convertir elementos a formato simplificado
    const universities: UniversityData[] = elements
      .map((element) => {
        // Obtener coordenadas (puede ser directo o en center para ways/relations)
        let lat: number | undefined;
        let lon: number | undefined;

        if (element.lat && element.lon) {
          lat = element.lat;
          lon = element.lon;
        } else if (element.center) {
          lat = element.center.lat;
          lon = element.center.lon;
        }

        if (!lat || !lon) {
          return null;
        }

        // Obtener nombre
        const name = element.tags?.name || element.tags?.['name:en'] || 'Unknown University';
        
        // Determinar tipo
        const type = element.tags?.amenity || 'university';

        return {
          id: element.id,
          name,
          lat,
          lon,
          type,
        };
      })
      .filter((u): u is UniversityData => u !== null);

    console.log(`  ✓ Procesadas ${universities.length} universidades válidas`);
    return universities;
  } catch (error) {
    console.error('❌ Error al descargar datos de universidades:', error.message);
    throw error;
  }
}

/**
 * Guarda los datos en archivos JSON
 */
function saveUniversitiesData(universities: UniversityData[]): void {
  // Guardar en la raíz del proyecto backend
  const rootPath = path.join(__dirname, '..', 'universities_data.json');
  
  fs.writeFileSync(rootPath, JSON.stringify(universities, null, 2));
  console.log(`✅ Datos guardados en: ${rootPath}`);
  console.log(`   Total: ${universities.length} universidades/colleges`);
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log('🎓 Iniciando descarga de datos de universidades...\n');
    
    // Descargar datos de universidades
    const universities = await fetchUniversitiesData();
    
    // Esperar 2 segundos para no saturar la API
    console.log('\n⏳ Esperando 2 segundos...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Guardar datos
    console.log('\n💾 Guardando datos...');
    saveUniversitiesData(universities);
    
    console.log('\n✅ ¡Proceso completado exitosamente!');
    console.log('\n📊 Resumen:');
    console.log(`   - Universidades/Colleges: ${universities.length}`);
    
  } catch (error) {
    console.error('\n❌ Error en el proceso:', error.message);
    process.exit(1);
  }
}

// Ejecutar
main();
