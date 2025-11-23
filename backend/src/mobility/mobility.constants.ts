// src/mobility/mobility.constants.ts

export const MOBILITY_CONFIG = {
  RADIUS: 1500,  // Aumentado a 1.5km para capturar mejor el área del barrio
  
  // Divisores específicos por categoría para mejor normalización
  // Basado en valores máximos observados en LA
  SCORE_DIVISORS: {
    TRANSPORT: 270,    // ~270 paradas (Downtown LA) = 100 puntos
    TAXIS: 2,          // 2 paradas de taxi = 100 puntos (hay muy pocas)
    BIKE_LANES: 150,   // 150 carriles bici en radio = 100 puntos
    FOOTPATHS: 1200,   // 1200 caminos peatonales = 100 puntos (más estricto)
    PARKING: 200,      // 200 parkings en radio = 100 puntos
  },   
  


    // Pesos desactivados - cada métrica es independiente
    SECTION_WEIGHTS: {
        PARKING: 0,
        TRANSPORT: 0,
        TAXIS: 0,
        BIKE_LANES: 0,
        TRAFFIC: 0,
        INFRA: 0,
    },

  DATA_SOURCES: {
    
    // --- SECCIÓN 1: PARKING ---
    PARKING: [
      // Datos locales desde parking_data.json
      { type: 'LOCAL_PARKING', name: 'Parkings' }
    ],

    // --- SECCIÓN 2: TRANSPORTE PÚBLICO ---
    TRANSPORT: [
      // Solo OSM por ahora - más rápido que GTFS
      { type: 'OVERPASS', query: 'node["highway"="bus_stop"]', name: 'Paradas Bus (OSM)' }
    ],

    // --- SECCIÓN 2.5: TAXIS ---
    TAXIS: [
      // Datos locales desde taxi_data.json
      { type: 'LOCAL_TAXI', name: 'Paradas de Taxi' }
    ],

    // --- SECCIÓN 3: CARRILES BICI ---
    BIKE_LANES: [
      // Datos locales desde bike_lanes_data.json
      { type: 'LOCAL_BIKE_LANE', name: 'Carriles Bici' }
    ],

    // --- SECCIÓN 4: CAMINOS PEATONALES ---
    FOOTPATHS: [
      // Datos locales desde footpaths_data.json
      { type: 'LOCAL_FOOTPATH', name: 'Caminos Peatonales' }
    ],

    // --- SECCIÓN 5: TRÁFICO ---
    TRAFFIC: [],

    // --- SECCIÓN 6: INFRAESTRUCTURA ---
    INFRA: []
  },

  URLS: {
    LACITY_BASE: 'https://data.lacity.org/resource',
    OVERPASS_API: 'https://overpass-api.de/api/interpreter'
  }
};