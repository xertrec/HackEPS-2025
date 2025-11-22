// src/mobility/mobility.constants.ts

export const MOBILITY_CONFIG = {
  RADIUS: 800,          
  SCORE_DIVISOR: 21,   
  


    // Pesos de las 4 grandes secciones (Suman 1.0)
    SECTION_WEIGHTS: {
        PARKING: 0.15,
        TRANSPORT: 0.35,
        TRAFFIC: 0.20,
        INFRA: 0.30,
    },

  DATA_SOURCES: {
    
    // --- SECCIÓN 1: PARKING ---
    PARKING: [
      // LA Express Park Area Map
      { type: 'LACITY', id: '895k-6zuw', name: 'Express Park Map' },
      // LADOT Preferential Parking Districts (PPD)
      { type: 'LACITY', id: 's3st-6nwi', name: 'PPD Districts' },
      // LADOT Parking Calendar Sign Locations
      { type: 'LACITY', id: 'jp2s-nfz4', name: 'Parking Signs' },
      // Metered Parking Inventory
      { type: 'LACITY', id: 's49e-q6j2', name: 'Parquímetros' },
      
      // PPD Boundaries (He seleccionado los más relevantes de tu lista para no saturar)
      { type: 'LACITY', id: '8mwm-e4ge', name: 'PPD Boundary 1' },
      { type: 'LACITY', id: 'qwem-tyir', name: 'PPD Boundary 2' },
      { type: 'LACITY', id: '6n5x-dymz', name: 'PPD Boundary 3' },
      
      // Parking Privado/Público (Edificios) - Añadido vía OSM para completar
      { type: 'OVERPASS', query: 'node["amenity"="parking"]', name: 'Edificios Parking' }
    ],

    // --- SECCIÓN 2: TRANSPORTE PÚBLICO ---
    TRANSPORT: [
      // Downtown DASH Stops
      { type: 'LACITY', id: '4wd4-uzr6', name: 'DASH Downtown Stops' },
      // Community DASH Stops
      { type: 'LACITY', id: 'ee5q-u9aq', name: 'DASH Community Stops' },
      // Commuter Express Stops
      { type: 'LACITY', id: 'jnwm-mx8g', name: 'Commuter Express Stops' },
      
      // Monthly Dockless Vehicles (Patinetes/Bicis compartidas)
      // Nota: Este dataset es complejo, si falla cuenta como 0.
      { type: 'LACITY', id: 'j5g7-w4y7', name: 'Vehículos Dockless' },

      // Metro (Añadido vía OSM porque no había link)
      { type: 'OVERPASS', query: 'node["railway"="subway_entrance"]', name: 'Entrada Metro' },
      { type: 'OVERPASS', query: 'node["railway"="station"]', name: 'Estación Tren' },
      
      // Taxis (Añadido vía OSM)
      { type: 'OVERPASS', query: 'node["amenity"="taxi"]', name: 'Parada Taxi' }
    ],

    // --- SECCIÓN 3: TRÁFICO ---
    TRAFFIC: [
      // LADOT Traffic Counts Summary
      { type: 'LACITY', id: '94wu-3ps3', name: 'Contadores Tráfico' },
      // Accidentes (Extra para dar volumen de datos)
      { type: 'LACITY', id: 'd5tf-ez2w', name: 'Colisiones Recientes' }
    ],

    // --- SECCIÓN 4: INFRAESTRUCTURA ---
    INFRA: [
      // Carriles Bici (OSM es mejor para esto que el PDF/Chart de LA City)
      { type: 'OVERPASS', query: 'way["highway"="cycleway"]', name: 'Carril Bici' },
      // Autopistas (Longitud/Accesos)
      { type: 'OVERPASS', query: 'way["highway"="motorway"]', name: 'Autopista' },
      // Pasos de Peatones
      { type: 'OVERPASS', query: 'node["highway"="crossing"]', name: 'Paso Peatonal' },
      // Semáforos (Indicador de infraestructura urbana)
      { type: 'OVERPASS', query: 'node["highway"="traffic_signals"]', name: 'Semáforos' }
    ]
  },

  URLS: {
    LACITY_BASE: 'https://data.lacity.org/resource',
    OVERPASS_API: 'https://overpass-api.de/api/interpreter'
  }
};