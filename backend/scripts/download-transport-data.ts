// Script para descargar datos de transporte público de LA y guardarlos localmente
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

interface TransportStop {
  lat: number;
  lon: number;
  type: string; // 'bus_stop', 'subway_entrance', 'station'
  name?: string;
}

async function downloadTransportData() {
  console.log('🚌 Descargando datos de transporte público de Los Angeles...');
  
  // Bounding box de Los Angeles (aproximado)
  const bbox = {
    south: 33.7,
    west: -118.7,
    north: 34.35,
    east: -118.1
  };
  
  const allStops: TransportStop[] = [];
  
  // 1. Paradas de bus
  console.log('📍 Descargando paradas de bus...');
  const busQuery = `
    [out:json][timeout:60];
    (
      node["highway"="bus_stop"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
    );
    out body;
  `;
  
  try {
    const busResponse = await axios.get('https://overpass-api.de/api/interpreter', {
      params: { data: busQuery }
    });
    
    for (const element of busResponse.data.elements) {
      allStops.push({
        lat: element.lat,
        lon: element.lon,
        type: 'bus_stop',
        name: element.tags?.name
      });
    }
    console.log(`✅ ${busResponse.data.elements.length} paradas de bus descargadas`);
  } catch (e) {
    console.error('❌ Error descargando paradas de bus:', e.message);
  }
  
  // Esperar un poco para no sobrecargar la API
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 2. Entradas de metro
  console.log('📍 Descargando entradas de metro...');
  const metroQuery = `
    [out:json][timeout:60];
    (
      node["railway"="subway_entrance"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      node["railway"="station"]["station"="subway"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
    );
    out body;
  `;
  
  try {
    const metroResponse = await axios.get('https://overpass-api.de/api/interpreter', {
      params: { data: metroQuery }
    });
    
    for (const element of metroResponse.data.elements) {
      allStops.push({
        lat: element.lat,
        lon: element.lon,
        type: element.tags?.railway === 'subway_entrance' ? 'subway_entrance' : 'station',
        name: element.tags?.name
      });
    }
    console.log(`✅ ${metroResponse.data.elements.length} estaciones de metro descargadas`);
  } catch (e) {
    console.error('❌ Error descargando estaciones de metro:', e.message);
  }
  
  // Guardar en archivo JSON
  const outputPath = path.join(__dirname, '..', 'transport_data.json');
  fs.writeFileSync(outputPath, JSON.stringify(allStops, null, 2));
  
  console.log(`\n✅ Total: ${allStops.length} paradas guardadas en transport_data.json`);
  console.log(`📂 Ubicación: ${outputPath}`);
}

downloadTransportData().catch(console.error);
