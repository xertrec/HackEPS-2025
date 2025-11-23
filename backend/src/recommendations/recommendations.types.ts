export interface UserProfile {
  edad: string;
  situacionFamiliar: string;
  estiloVida: string[];
  prioridades: string[];
  ambiente: string;
  calidadAire: string;
  modalidadTrabajo: string;
  tipoVivienda: string;
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
  data: NeighborhoodData;
  lifestyle?: LifestyleData;
}

export interface RecommendationResponse {
  profile: UserProfile;
  weights: ServiceWeights;
  recommendations: NeighborhoodRecommendation[];
}
