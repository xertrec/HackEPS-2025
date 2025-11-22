// src/mobility/mobility.constants.ts

export const MOBILITY_CONFIG = {
  RADIUS: 800,          
  SCORE_DIVISOR: 21,   
  


    // Pesos de las 4 grandes secciones (Suman 1.0)
    SECTION_WEIGHTS: {
        PARKING: 0,
        TRANSPORT: 1.0,
        TRAFFIC: 0,
        INFRA: 0,
    },

  DATA_SOURCES: {
    
    // --- SECCIÓN 1: PARKING ---
    PARKING: [],

    // --- SECCIÓN 2: TRANSPORTE PÚBLICO ---
    TRANSPORT: [
      // Solo OSM por ahora - más rápido que GTFS
      { type: 'OVERPASS', query: 'node["highway"="bus_stop"]', name: 'Paradas Bus (OSM)' }
    ],

    // --- SECCIÓN 3: TRÁFICO ---
    TRAFFIC: [],

    // --- SECCIÓN 4: INFRAESTRUCTURA ---
    INFRA: []
  },

  URLS: {
    LACITY_BASE: 'https://data.lacity.org/resource',
    OVERPASS_API: 'https://overpass-api.de/api/interpreter'
  }
};