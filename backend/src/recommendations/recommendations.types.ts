export interface UserProfile {
  edad: string;
  situacionFamiliar: string;
  estiloVida: string[];
  prioridades: string[];
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
}

export interface RecommendationResponse {
  profile: UserProfile;
  weights: ServiceWeights;
  recommendations: NeighborhoodRecommendation[];
}
