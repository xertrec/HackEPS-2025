import { Injectable, HttpException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { SecurityService } from '../security/security.service';
import { ServicesService } from '../services/services.service';
import { MobilityService } from '../mobility/mobility.service';
import {
  UserProfile,
  ServiceWeights,
  NeighborhoodData,
  RecommendationResponse,
} from './recommendations.types';

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly securityService: SecurityService,
    private readonly servicesService: ServicesService,
    private readonly mobilityService: MobilityService,
  ) {}

  /**
   * Calcula los pesos de cada servicio basado en el perfil del usuario
   */
  private calculateWeights(profile: UserProfile): ServiceWeights {
    const weights: ServiceWeights = {
      Seguridad: 50, // Base para todos
      Botigues: 50,
      Escoles: 0,
      Hospitals: 40,
      Bombers: 40,
      Policies: 50,
      OciNocturn: 20,
      OciDiurn: 30,
      Universitats: 0,
      TransportePublico: 40, // Base para movilidad
      Taxis: 20,
      CarrilesBici: 30,
      CaminarCorrer: 35,
      Parking: 35,
    };

    // EDAD
    if (profile.edad === '18-25') {
      weights.OciNocturn += 30;
      weights.OciDiurn += 20;
      weights.Universitats += 40;
      weights.Seguridad -= 10;
      weights.TransportePublico += 30; // Jóvenes usan más transporte público
      weights.CarrilesBici += 25; // Jóvenes usan más bici
      weights.CaminarCorrer += 20;
      weights.Parking -= 10; // Menos probable tener coche
      weights.Taxis += 10;
    } else if (profile.edad === '26-35') {
      weights.OciNocturn += 20;
      weights.OciDiurn += 25;
      weights.Botigues += 20;
      weights.TransportePublico += 20;
      weights.CarrilesBici += 15;
      weights.Parking += 10;
      weights.Taxis += 15;
    } else if (profile.edad === '36-50') {
      weights.Hospitals += 15;
      weights.Botigues += 15;
      weights.Seguridad += 10;
      weights.Parking += 25; // Familias suelen tener coche
      weights.TransportePublico += 10;
      weights.CarrilesBici += 5;
    } else if (profile.edad === '51+') {
      weights.Hospitals += 30;
      weights.Seguridad += 20;
      weights.OciNocturn -= 15;
      weights.Bombers += 15;
      weights.Parking += 20; // Prefieren coche
      weights.CaminarCorrer += 15; // Caminar es saludable
      weights.TransportePublico += 15;
      weights.CarrilesBici -= 10;
    }

    // SITUACIÓN FAMILIAR
    if (profile.situacionFamiliar === 'hijos-pequenos') {
      weights.Escoles += 80;
      weights.Seguridad += 30;
      weights.Hospitals += 20;
      weights.Bombers += 20;
      weights.OciDiurn += 20; // Parques, cafés familiares
      weights.OciNocturn -= 20;
      weights.Parking += 30; // Familias con hijos necesitan coche
      weights.CaminarCorrer += 20; // Parques para niños
      weights.TransportePublico += 15;
      weights.CarrilesBici += 10;
    } else if (profile.situacionFamiliar === 'hijos-adolescentes') {
      weights.Escoles += 60;
      weights.Seguridad += 25;
      weights.OciDiurn += 15;
      weights.Universitats += 20; // Preparación para universidad
      weights.Parking += 25;
      weights.TransportePublico += 20; // Adolescentes usan transporte público
      weights.CarrilesBici += 15;
    } else if (profile.situacionFamiliar === 'multigeneracional') {
      weights.Hospitals += 25;
      weights.Seguridad += 20;
      weights.Bombers += 20;
      weights.Botigues += 15;
      weights.Parking += 25;
      weights.TransportePublico += 20; // Importante para todos
      weights.CaminarCorrer += 10;
    } else if (
      profile.situacionFamiliar === 'solo' ||
      profile.situacionFamiliar === 'pareja'
    ) {
      weights.OciNocturn += 15;
      weights.Botigues += 15;
      weights.OciDiurn += 10;
      weights.TransportePublico += 15;
      weights.CarrilesBici += 20; // Más flexible sin hijos
      weights.CaminarCorrer += 15;
      weights.Taxis += 15;
    }

    // ESTILO DE VIDA
    if (profile.estiloVida.includes('nocturna')) {
      weights.OciNocturn += 40;
      weights.Seguridad += 10; // Quieren seguridad al salir de noche
      weights.Policies += 10;
      weights.Taxis += 25; // Importante para volver de noche
      weights.TransportePublico += 15;
      weights.Parking += 10;
    }

    if (profile.estiloVida.includes('diurna')) {
      weights.OciDiurn += 30;
      weights.Botigues += 20;
      weights.CaminarCorrer += 25; // Pasear, explorar
      weights.CarrilesBici += 20;
      weights.TransportePublico += 10;
    }

    if (profile.estiloVida.includes('tranquila')) {
      weights.Seguridad += 30;
      weights.Hospitals += 15;
      weights.OciNocturn -= 15;
      weights.Bombers += 10;
      weights.CaminarCorrer += 20; // Paseos tranquilos
      weights.Parking += 15;
    }

    if (profile.estiloVida.includes('estudiante')) {
      weights.Universitats += 80;
      weights.OciNocturn += 25;
      weights.OciDiurn += 20;
      weights.Botigues += 15;
      weights.TransportePublico += 35; // Muy importante para estudiantes
      weights.CarrilesBici += 30;
      weights.CaminarCorrer += 20;
      weights.Parking -= 15; // Generalmente no tienen coche
    }

    if (profile.estiloVida.includes('profesional')) {
      weights.Botigues += 20;
      weights.OciDiurn += 15;
      weights.Hospitals += 10;
      weights.TransportePublico += 20;
      weights.Parking += 20; // Probablemente tiene coche
      weights.CaminarCorrer += 15; // Ejercicio importante
    }

    // PRIORIDADES
    if (profile.prioridades.includes('seguridad')) {
      weights.Seguridad += 30;
      weights.Policies += 20;
      weights.Bombers += 15;
      weights.CaminarCorrer += 15; // Poder caminar seguro
    }

    if (profile.prioridades.includes('servicios')) {
      weights.Botigues += 25;
      weights.Hospitals += 25;
      weights.Bombers += 15;
      weights.Policies += 15;
      weights.TransportePublico += 20; // Acceso a servicios
      weights.Parking += 15;
    }

    if (profile.prioridades.includes('social')) {
      weights.OciNocturn += 25;
      weights.OciDiurn += 25;
      weights.Botigues += 15;
      weights.TransportePublico += 15; // Para moverse socialmente
      weights.Taxis += 20;
      weights.CaminarCorrer += 10;
    }

    if (profile.prioridades.includes('educacion')) {
      weights.Escoles += 40;
      weights.Universitats += 40;
      weights.TransportePublico += 25; // Importante para estudiantes
      weights.CarrilesBici += 15;
    }

    if (profile.prioridades.includes('verde')) {
      weights.OciDiurn += 25; // Parques incluidos en ocio diurno
      weights.Seguridad += 10; // Barrios verdes suelen ser más seguros
      weights.CaminarCorrer += 30; // Importante poder caminar/correr
      weights.CarrilesBici += 25; // Rutas en bici
    }

    // Normalizar: asegurar que están entre 0-100
    Object.keys(weights).forEach((key) => {
      weights[key as keyof ServiceWeights] = Math.min(
        100,
        Math.max(0, weights[key as keyof ServiceWeights]),
      );
    });

    return weights;
  }

  /**
   * Calcula el score final de un barrio basado en sus datos y los pesos del usuario
   */
  private calculateNeighborhoodScore(
    data: NeighborhoodData,
    weights: ServiceWeights,
  ): number {
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

    if (totalWeight === 0) {
      return 0;
    }

    let score = 0;
    score += (data.Seguridad * weights.Seguridad) / 100;
    score += (data.Botigues * weights.Botigues) / 100;
    score += (data.Escoles * weights.Escoles) / 100;
    score += (data.Hospitals * weights.Hospitals) / 100;
    score += (data.Bombers * weights.Bombers) / 100;
    score += (data.Policies * weights.Policies) / 100;
    score += (data.OciNocturn * weights.OciNocturn) / 100;
    score += (data.OciDiurn * weights.OciDiurn) / 100;
    score += (data.Universitats * weights.Universitats) / 100;
    score += (data.TransportePublico * weights.TransportePublico) / 100;
    score += (data.Taxis * weights.Taxis) / 100;
    score += (data.CarrilesBici * weights.CarrilesBici) / 100;
    score += (data.CaminarCorrer * weights.CaminarCorrer) / 100;
    score += (data.Parking * weights.Parking) / 100;

    // Normalizar al peso total
    return (score / totalWeight) * 100;
  }

  /**
   * Obtiene recomendaciones de barrios basadas en el perfil del usuario
   */
  async getNeighborhoodRecommendations(profile: UserProfile): Promise<RecommendationResponse> {
    try {
      console.log('🔍 Procesando perfil de usuario:', profile);

      // 1. Calcular pesos basados en el perfil
      const weights = this.calculateWeights(profile);
      console.log('⚖️ Pesos calculados:', weights);

      // 2. Obtener todos los barrios
      const neighborhoods = await this.databaseService.getAllNeighborhoods();
      console.log(`📍 Total de barrios: ${neighborhoods.length}`);

      // 3. Obtener datos de seguridad
      console.log('🛡️ Obteniendo datos de seguridad...');
      const securityRanking = await this.securityService.getNeighborhoodRanking();
      const securityMap = new Map(
        securityRanking.map((item) => [item.barrio, item.seguridad]),
      );

      // 4. Calcular score para cada barrio
      console.log('📊 Calculando scores para cada barrio...');
      const neighborhoodScores = await Promise.all(
        neighborhoods.map(async (neighborhood) => {
          // Obtener datos de servicios
          const [
            botigues,
            escoles,
            hospitals,
            bombers,
            policies,
            ociNocturn,
            ociDiurn,
            universitats,
            mobilityData,
          ] = await Promise.all([
            this.servicesService.calculateShopsPercentage(
              neighborhood.name,
              neighborhood.latitude,
              neighborhood.longitude,
            ),
            this.servicesService.calculateSchoolsPercentage(
              neighborhood.name,
              neighborhood.latitude,
              neighborhood.longitude,
            ),
            this.servicesService.calculateHospitalsPercentage(
              neighborhood.name,
              neighborhood.latitude,
              neighborhood.longitude,
            ),
            this.servicesService.calculateFireStationsPercentage(
              neighborhood.name,
              neighborhood.latitude,
              neighborhood.longitude,
            ),
            this.servicesService.calculatePoliceStationsPercentage(
              neighborhood.name,
              neighborhood.latitude,
              neighborhood.longitude,
            ),
            this.servicesService.calculateNightlifePercentage(
              neighborhood.name,
              neighborhood.latitude,
              neighborhood.longitude,
            ),
            this.servicesService.calculateDayLeisurePercentage(
              neighborhood.name,
              neighborhood.latitude,
              neighborhood.longitude,
            ),
            this.servicesService.calculateUniversitiesPercentage(
              neighborhood.name,
              neighborhood.latitude,
              neighborhood.longitude,
            ),
            this.mobilityService.calculateFullScore(
              neighborhood.name,
              neighborhood.latitude,
              neighborhood.longitude,
            ),
          ]);

          const data: NeighborhoodData = {
            barrio: neighborhood.name,
            Seguridad: securityMap.get(neighborhood.name) || 0,
            Botigues: botigues,
            Escoles: escoles,
            Hospitals: hospitals,
            Bombers: bombers,
            Policies: policies,
            OciNocturn: ociNocturn,
            OciDiurn: ociDiurn,
            Universitats: universitats,
            TransportePublico: mobilityData.detalle.transport || 0,
            Taxis: mobilityData.detalle.taxis || 0,
            CarrilesBici: mobilityData.detalle.bike_lanes || 0,
            CaminarCorrer: mobilityData.detalle.footpaths || 0,
            Parking: mobilityData.detalle.parking || 0,
          };

          const score = this.calculateNeighborhoodScore(data, weights);

          return {
            barrio: neighborhood.name,
            score: score,
            data: data,
          };
        }),
      );

      // 5. Ordenar por score descendente
      neighborhoodScores.sort((a, b) => b.score - a.score);

      console.log('✅ Recomendaciones calculadas exitosamente');
      console.log(`🏆 Top 3: ${neighborhoodScores.slice(0, 3).map(n => `${n.barrio} (${n.score.toFixed(1)})`).join(', ')}`);

      return {
        profile: profile,
        weights: weights,
        recommendations: neighborhoodScores,
      };
    } catch (error) {
      console.error('❌ Error en getNeighborhoodRecommendations:', error);
      throw new HttpException(
        'Error generando recomendaciones',
        500,
      );
    }
  }
}
