import { Injectable, HttpException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { SecurityService } from '../security/security.service';
import { ServicesService } from '../services/services.service';
import { MobilityService } from '../mobility/mobility.service';
import { LifestyleService } from '../lifestyle/lifestyle.service';
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
    private readonly lifestyleService: LifestyleService,
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
      // Lifestyle weights
      Connectivity: 40,
      GreenZones: 30,
      Noise: 35,
      AirQuality: 35,
      Occupability: 30,
      Accessibility: 40,
      Salary: 25,
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
      weights.GreenZones += 40; // LIFESTYLE: Muy importante
      weights.Noise += 20; // Zonas verdes suelen ser más tranquilas
    }

    // NUEVAS PREGUNTAS - AMBIENTE (CRÍTICO: debe dominar la decisión)
    if (profile.ambiente === 'urbano-bullicioso') {
      weights.Connectivity += 60;
      weights.Accessibility += 60;
      weights.Occupability += 50;
      weights.Noise = 15; // FORZAR bajo (buscan ruido urbano)
      weights.GreenZones = 20; // FORZAR bajo
      weights.OciNocturn += 50;
      weights.TransportePublico += 40;
      weights.Taxis += 35;
      weights.Botigues += 35;
    } else if (profile.ambiente === 'residencial-tranquilo') {
      weights.Noise = 100; // FORZAR máximo en tranquilidad
      weights.GreenZones += 70;
      weights.Seguridad += 50;
      weights.OciNocturn = Math.max(0, weights.OciNocturn - 50); // REDUCIR fuertemente
      weights.Connectivity = Math.max(20, weights.Connectivity - 40);
      weights.Accessibility = Math.max(20, weights.Accessibility - 30);
      weights.Parking += 40;
      weights.CaminarCorrer += 40;
      weights.AirQuality += 50;
      // REDUCIR importancia de servicios básicos
      weights.Botigues = Math.max(30, weights.Botigues - 30);
      weights.Hospitals = Math.max(40, weights.Hospitals - 25);
    } else if (profile.ambiente === 'equilibrado') {
      weights.Noise += 35;
      weights.GreenZones += 30;
      weights.Connectivity += 25;
      weights.Accessibility += 25;
    } else if (profile.ambiente === 'naturaleza') {
      weights.GreenZones = 100; // FORZAR máximo naturaleza
      weights.Noise = 100; // FORZAR máximo tranquilidad
      weights.AirQuality = 100; // FORZAR máximo aire limpio
      weights.CaminarCorrer += 50;
      weights.CarrilesBici += 45;
      weights.OciDiurn += 40;
      // REDUCIR DRÁSTICAMENTE importancia de centro urbano
      weights.Connectivity = Math.max(15, weights.Connectivity - 60);
      weights.Occupability = Math.max(15, weights.Occupability - 50);
      weights.OciNocturn = Math.max(0, weights.OciNocturn - 50);
      weights.Accessibility = Math.max(20, weights.Accessibility - 40);
      // REDUCIR importancia de servicios urbanos
      weights.Botigues = Math.max(25, weights.Botigues - 40);
      weights.Hospitals = Math.max(35, weights.Hospitals - 30);
    }

    // CALIDAD DEL AIRE (impacto masivo)
    if (profile.calidadAire === 'muy-importante') {
      weights.AirQuality = 100; // FORZAR máximo
      weights.GreenZones += 60;
      weights.Noise += 40;
      weights.Connectivity = Math.max(20, weights.Connectivity - 40);
    } else if (profile.calidadAire === 'importante') {
      weights.AirQuality += 60;
      weights.GreenZones += 35;
    } else if (profile.calidadAire === 'poco-importante') {
      weights.AirQuality = Math.max(20, weights.AirQuality - 25);
    }

    // MODALIDAD DE TRABAJO (debe cambiar drásticamente ubicación)
    if (profile.modalidadTrabajo === 'oficina-centro') {
      // Si ya buscan naturaleza, no reducir tanto GreenZones (conflicto)
      if (profile.ambiente !== 'naturaleza') {
        weights.Connectivity += 70;
        weights.Accessibility = 100; // FORZAR máximo - CRÍTICO
        weights.TransportePublico += 70;
        weights.Taxis += 40;
        weights.Occupability += 50;
        weights.GreenZones = Math.max(20, weights.GreenZones - 40);
      } else {
        // Busca naturaleza + oficina centro: barrios costeros con acceso a centro
        weights.Connectivity += 40;
        weights.Accessibility += 60;
        weights.TransportePublico += 50;
        // NO reducir GreenZones, mantener ambiente natural
      }
    } else if (profile.modalidadTrabajo === 'oficina-suburbios') {
      weights.Parking += 60; // CRÍTICO tener coche
      weights.Accessibility += 35;
      weights.TransportePublico += 25;
      weights.Connectivity = Math.max(30, weights.Connectivity - 30);
      weights.GreenZones += 35;
    } else if (profile.modalidadTrabajo === 'remoto') {
      weights.Connectivity += 80; // Internet CRÍTICO
      weights.GreenZones += 60; // Buscar calidad de vida
      weights.Noise += 70; // CRÍTICO trabajar en tranquilidad
      weights.OciDiurn += 40;
      weights.Botigues += 30;
      weights.AirQuality += 50;
      weights.Accessibility = Math.max(25, weights.Accessibility - 40);
      weights.TransportePublico = Math.max(25, weights.TransportePublico - 35);
    } else if (profile.modalidadTrabajo === 'hibrido') {
      weights.Connectivity += 55;
      weights.Accessibility += 50;
      weights.TransportePublico += 50;
      weights.Parking += 40;
      weights.GreenZones += 30;
    } else if (profile.modalidadTrabajo === 'no-aplica') {
      // Estudiantes, jubilados, etc. - priorizar calidad de vida
      weights.GreenZones += 40;
      weights.OciDiurn += 40;
      weights.Seguridad += 30;
      weights.Noise += 30;
    }

    // TIPO DE VIVIENDA (CRÍTICO: debe cambiar completamente los resultados)
    if (profile.tipoVivienda === 'premium') {
      weights.Salary = 100; // FORZAR máximo - BUSCAR barrios caros
      weights.Seguridad += 60;
      weights.GreenZones += 55;
      weights.AirQuality += 55;
      weights.Noise += 60;
      weights.Botigues += 35;
      weights.Accessibility = Math.max(30, weights.Accessibility - 20);
    } else if (profile.tipoVivienda === 'confortable') {
      weights.Salary += 50; // Nivel medio-alto
      weights.Seguridad += 35;
      weights.Accessibility += 30;
      weights.GreenZones += 25;
    } else if (profile.tipoVivienda === 'economico') {
      weights.Salary = -100; // FORZAR mínimo - EVITAR barrios caros
      weights.Accessibility += 60;
      weights.TransportePublico += 65;
      weights.Occupability += 55;
      weights.Connectivity += 35;
      weights.GreenZones = Math.max(20, weights.GreenZones - 30);
    } else if (profile.tipoVivienda === 'compartido') {
      weights.Salary = -80; // Buscar barrios económicos
      weights.Universitats += 65;
      weights.TransportePublico += 70;
      weights.Occupability += 40;
      weights.OciNocturn += 50;
      weights.OciDiurn += 35;
      weights.Connectivity += 50;
      weights.Accessibility += 50;
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
    lifestyle?: any,
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

    // Añadir lifestyle scores si están disponibles
    if (lifestyle) {
      score += (lifestyle.connectivity * weights.Connectivity) / 100;
      
      // GREEN ZONES: Aplicar penalización si se busca naturaleza y no hay
      if (weights.GreenZones >= 100) {
        // Usuario busca MÁXIMA naturaleza: ELIMINAR barrios sin zonas verdes
        if (lifestyle.greenZones < 60) {
          score -= 100; // ELIMINACIÓN TOTAL
        } else if (lifestyle.greenZones < 75) {
          score -= 50; // Penalización fuerte
        } else {
          score += (lifestyle.greenZones * weights.GreenZones) / 100;
        }
      } else if (weights.GreenZones > 70) {
        // Usuario busca naturaleza: penalizar barrios sin verde
        if (lifestyle.greenZones < 50) {
          score -= 60; // Penalización muy fuerte
        } else {
          score += (lifestyle.greenZones * weights.GreenZones) / 100;
        }
      } else {
        score += (lifestyle.greenZones * weights.GreenZones) / 100;
      }
      
      // NOISE: Aplicar penalización BRUTAL si no cumple requisitos
      if (weights.Noise >= 100) {
        // Usuario busca MÁXIMA tranquilidad: ELIMINAR barrios ruidosos
        if (lifestyle.noise < 60) {
          score -= 100; // PENALIZACIÓN BRUTAL - prácticamente elimina el barrio
        } else if (lifestyle.noise < 75) {
          score -= 40; // Penalización fuerte
        } else {
          score += (lifestyle.noise * weights.Noise) / 100;
        }
      } else if (weights.Noise > 60) {
        // Usuario busca tranquilidad: penalizar fuerte barrios ruidosos
        if (lifestyle.noise < 50) {
          score -= 50; // Penalización muy grande
        } else {
          score += (lifestyle.noise * weights.Noise) / 100;
        }
      } else if (weights.Noise < 30) {
        // Usuario busca ambiente urbano: penalizar barrios tranquilos
        if (lifestyle.noise > 70) {
          score -= 40; // Penalización por demasiado tranquilo
        } else {
          score += (lifestyle.noise * weights.Noise) / 100;
        }
      } else {
        score += (lifestyle.noise * weights.Noise) / 100;
      }
      
      // AIR QUALITY: Aplicar penalización si es crítico
      if (weights.AirQuality >= 100) {
        // Usuario busca MÁXIMA calidad aire: ELIMINAR barrios contaminados
        if (lifestyle.airQuality < 60) {
          score -= 100; // ELIMINACIÓN TOTAL
        } else if (lifestyle.airQuality < 75) {
          score -= 50; // Penalización fuerte
        } else {
          score += (lifestyle.airQuality * weights.AirQuality) / 100;
        }
      } else if (weights.AirQuality > 70) {
        // Usuario prioriza calidad aire
        if (lifestyle.airQuality < 50) {
          score -= 60;
        } else {
          score += (lifestyle.airQuality * weights.AirQuality) / 100;
        }
      } else {
        score += (lifestyle.airQuality * weights.AirQuality) / 100;
      }
      
      score += (lifestyle.occupability * weights.Occupability) / 100;
      score += (lifestyle.accessibility * weights.Accessibility) / 100;
      
      // Salary: manejo especial CON PENALIZACIONES BRUTALES
      if (weights.Salary >= 100) {
        // Buscan PREMIUM exclusivo: SOLO barrios High, ELIMINAR resto
        if (lifestyle.salary === 'High') {
          score += (100 * weights.Salary) / 100;
        } else if (lifestyle.salary === 'Medium') {
          score -= 60; // PENALIZACIÓN BRUTAL - Medium no es suficiente
        } else if (lifestyle.salary === 'Low') {
          score -= 120; // ELIMINACIÓN TOTAL
        }
      } else if (weights.Salary > 60) {
        // Buscan barrios caros: PENALIZAR fuertemente los económicos
        if (lifestyle.salary === 'High') {
          score += (100 * weights.Salary) / 100;
        } else if (lifestyle.salary === 'Medium') {
          score -= 30; // Penalización fuerte
        } else if (lifestyle.salary === 'Low') {
          score -= 80; // PENALIZACIÓN MUY FUERTE
        }
      } else if (weights.Salary <= -80) {
        // Buscan ECONÓMICO: SOLO barrios Low/Medium, ELIMINAR caros
        const absWeight = Math.abs(weights.Salary);
        if (lifestyle.salary === 'Low') {
          score += (100 * absWeight) / 100;
        } else if (lifestyle.salary === 'Medium') {
          score += (60 * absWeight) / 100;
        } else if (lifestyle.salary === 'High') {
          score -= 120; // ELIMINACIÓN TOTAL de barrios caros
        }
      } else if (weights.Salary < -40) {
        // Buscan barrios económicos: PENALIZAR los caros
        const absWeight = Math.abs(weights.Salary);
        if (lifestyle.salary === 'Low') {
          score += (100 * absWeight) / 100;
        } else if (lifestyle.salary === 'Medium') {
          score += (50 * absWeight) / 100;
        } else if (lifestyle.salary === 'High') {
          score -= 80; // PENALIZACIÓN FUERTE por ser caro
        }
      } else if (weights.Salary > 0) {
        // Buscan barrios caros pero no extremo
        if (lifestyle.salary === 'High') score += (100 * weights.Salary) / 100;
        else if (lifestyle.salary === 'Medium') score += (60 * weights.Salary) / 100;
        else if (lifestyle.salary === 'Low') score += (20 * weights.Salary) / 100;
      } else if (weights.Salary < 0) {
        // Buscan barrios económicos pero no extremo
        const absWeight = Math.abs(weights.Salary);
        if (lifestyle.salary === 'Low') score += (100 * absWeight) / 100;
        else if (lifestyle.salary === 'Medium') score += (60 * absWeight) / 100;
        else if (lifestyle.salary === 'High') score += (20 * absWeight) / 100;
      }
    }

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

      // 3.5 Obtener datos de lifestyle
      console.log('🌟 Obteniendo datos de lifestyle...');
      const lifestyleData = await this.lifestyleService.getAllLifestyleScores();
      const lifestyleMap = new Map(
        lifestyleData.map((item: any) => [item.barrio, item]),
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

          // Obtener datos de lifestyle para este barrio
          const lifestyle: any = lifestyleMap.get(neighborhood.name);

          const score = this.calculateNeighborhoodScore(data, weights, lifestyle);

          return {
            barrio: neighborhood.name,
            score: score,
            data: data,
            lifestyle: lifestyle ? {
              connectivity: lifestyle.connectivity || 0,
              greenZones: lifestyle.greenZones || 0,
              noise: lifestyle.noise || 0,
              airQuality: lifestyle.airQuality || 0,
              occupability: lifestyle.occupability || 0,
              accessibility: lifestyle.accessibility || 0,
              salary: lifestyle.salary || 'Low',
            } : undefined,
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
