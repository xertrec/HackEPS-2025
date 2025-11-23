// src/mobility/mobility.constants.ts

export const MOBILITY_CONFIG = {
  RADIUS: 1500,  // Aumentado a 1.5km para capturar mejor el área del barrio
  
  // DIVISORES REBALANCEADOS: Usar percentil 80-85 en lugar de máximo absoluto
  // Esto evita que un outlier extreme (Downtown) haga que todo lo demás sea bajo
  // Objetivo: Mejor distribución entre 30-90 puntos en lugar de 5-100
  SCORE_DIVISORS: {
    TRANSPORT: 180,    // ~180 paradas (percentil 85) = 100 puntos (antes 270)
    TAXIS: 2,          // 2 paradas de taxi = 100 puntos (hay muy pocas, OK)
    BIKE_LANES: 100,   // 100 carriles bici = 100 puntos (antes 150, más alcanzable)
    FOOTPATHS: 800,    // 800 caminos = 100 puntos (antes 1200, más alcanzable)
    PARKING: 140,      // 140 parkings = 100 puntos (antes 200, más alcanzable)
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