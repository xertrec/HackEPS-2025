export interface UserProfile {
  edad: string;
  situacionFamiliar: string;
  estiloVida: string[];
  prioridades: string[];
  ambiente: string;
  calidadAire: string;
  modalidadTrabajo: string;
  tipoVivienda: string;
  // Nuevas preguntas detalladas
  presupuesto?: string;
  nivelSeguridad?: string;
  distanciaTrabajo?: string;
  vidaNocturna?: string;
  accesoHospitales?: string;
  calidadEscuelas?: string;
  accesoTiendas?: string;
  transportePublico?: string;
  usoTaxis?: string;
  usoBicicleta?: string;
  necesidadParking?: string;
  actividadFisica?: string;
  necesidadSenderos?: string;
  cercaniaUniversidad?: string;
  ocioDiurno?: string;
  ocioNocturno?: string;
}

export interface ServiceWeights {
  Seguridad: number;
  Botigues: number;
  Escoles: number;
  Hospitals: number;
  Bombers: number;
  Policies: number;
  OciNocturn: number;
  OciDiurn: number;
  Universitats: number;
  TransportePublico: number;
  Taxis: number;
  CarrilesBici: number;
  CaminarCorrer: number;
  Parking: number;
  // Lifestyle weights
  Connectivity: number;
  GreenZones: number;
  Noise: number;
  AirQuality: number;
  Occupability: number;
  Accessibility: number;
  Salary: number;
}

export interface LifestyleData {
  connectivity: number;
  greenZones: number;
  noise: number;
  airQuality: number;
  occupability: number;
  accessibility: number;
  salary: string;
}

export interface NeighborhoodData {
  barrio: string;
  Seguridad: number;
  Botigues: number;
  Escoles: number;
  Hospitals: number;
  Bombers: number;
  Policies: number;
  OciNocturn: number;
  OciDiurn: number;
  Universitats: number;
  TransportePublico: number;
  Taxis: number;
  CarrilesBici: number;
  CaminarCorrer: number;
  Parking: number;
}

export interface NeighborhoodRecommendation {
  barrio: string;
  score: number;
  baseScore?: number; // Score sin tie-breaker
  noise?: number; // Ruido aplicado para tie-breaker
  data: NeighborhoodData;
  lifestyle?: LifestyleData;
}

export interface RecommendationMetadata {
  runId: string;
  timestamp: string;
  seed: number;
  totalNeighborhoods: number;
}

export interface RecommendationResponse {
  profile: UserProfile;
  weights: ServiceWeights;
  recommendations: NeighborhoodRecommendation[];
  metadata?: RecommendationMetadata;
}
