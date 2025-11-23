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

    // NUEVAS PREGUNTAS - AMBIENTE (aumentar pesos lifestyle)
    if (profile.ambiente === 'urbano-bullicioso') {
      weights.Connectivity += 50;
      weights.Accessibility += 50;
      weights.Occupability += 40;
      weights.Noise += 20; // Bajo peso = les gusta el ruido
      weights.GreenZones += 20; // Bajo peso = no priorizan verde
      weights.OciNocturn += 40;
      weights.TransportePublico += 35;
      weights.Taxis += 30;
      weights.Botigues += 30;
    } else if (profile.ambiente === 'residencial-tranquilo') {
      weights.Noise += 70; // ALTA prioridad en tranquilidad
      weights.GreenZones += 60;
      weights.Seguridad += 40;
      weights.AirQuality += 40;
      weights.Parking += 35;
      weights.CaminarCorrer += 35;
    } else if (profile.ambiente === 'equilibrado') {
      weights.Noise += 35;
      weights.GreenZones += 30;
      weights.Connectivity += 25;
      weights.Accessibility += 25;
    } else if (profile.ambiente === 'naturaleza') {
      weights.GreenZones += 80; // MÁXIMA prioridad naturaleza
      weights.Noise += 70; // ALTA tranquilidad
      weights.AirQuality += 70; // ALTA calidad aire
      weights.CaminarCorrer += 45;
      weights.CarrilesBici += 40;
      weights.OciDiurn += 35;
    }

    // CALIDAD DEL AIRE
    if (profile.calidadAire === 'muy-importante') {
      weights.AirQuality += 70;
      weights.GreenZones += 50;
      weights.Noise += 35;
    } else if (profile.calidadAire === 'importante') {
      weights.AirQuality += 50;
      weights.GreenZones += 30;
    } else if (profile.calidadAire === 'poco-importante') {
      weights.AirQuality += 15; // Peso bajo pero no ignorar
    }

    // MODALIDAD DE TRABAJO
    if (profile.modalidadTrabajo === 'oficina-centro') {
      weights.Connectivity += 60;
      weights.Accessibility += 70;
      weights.TransportePublico += 65;
      weights.Taxis += 35;
      weights.Occupability += 45;
    } else if (profile.modalidadTrabajo === 'oficina-suburbios') {
      weights.Parking += 55;
      weights.Accessibility += 30;
      weights.TransportePublico += 25;
      weights.GreenZones += 30;
    } else if (profile.modalidadTrabajo === 'remoto') {
      weights.Connectivity += 70;
      weights.GreenZones += 55;
      weights.Noise += 65;
      weights.OciDiurn += 35;
      weights.Botigues += 25;
      weights.AirQuality += 45;
    } else if (profile.modalidadTrabajo === 'hibrido') {
      weights.Connectivity += 50;
      weights.Accessibility += 45;
      weights.TransportePublico += 45;
      weights.Parking += 35;
      weights.GreenZones += 25;
    } else if (profile.modalidadTrabajo === 'no-aplica') {
      weights.GreenZones += 35;
      weights.OciDiurn += 35;
      weights.Seguridad += 25;
      weights.Noise += 25;
    }

    // TIPO DE VIVIENDA (impacto en presupuesto)
    if (profile.tipoVivienda === 'premium') {
      weights.Salary += 85; // ALTA prioridad barrios caros
      weights.Seguridad += 50;
      weights.GreenZones += 45;
      weights.AirQuality += 45;
      weights.Noise += 50;
      weights.Botigues += 30;
    } else if (profile.tipoVivienda === 'confortable') {
      weights.Salary += 45; // Nivel medio-alto
      weights.Seguridad += 30;
      weights.Accessibility += 25;
      weights.GreenZones += 20;
    } else if (profile.tipoVivienda === 'economico') {
      weights.Salary -= 85; // ALTA prioridad barrios económicos
      weights.Accessibility += 50;
      weights.TransportePublico += 55;
      weights.Occupability += 45;
      weights.Connectivity += 30;
    } else if (profile.tipoVivienda === 'compartido') {
      weights.Salary -= 70; // Buscar barrios económicos
      weights.Universitats += 55;
      weights.TransportePublico += 60;
      weights.Occupability += 35;
      weights.OciNocturn += 45;
      weights.OciDiurn += 30;
      weights.Connectivity += 45;
      weights.Accessibility += 45;
    }

    // ============================================================
    // NUEVAS PREGUNTAS DETALLADAS - Usar datos específicos que tenemos
    // ============================================================
    
    // PRESUPUESTO (más granular que tipoVivienda)
    if (profile.presupuesto) {
      if (profile.presupuesto === 'bajo') {
        weights.Salary -= 90; // ULTRA restrictivo: solo barrios muy económicos
        weights.TransportePublico += 40;
        weights.Occupability += 30;
      } else if (profile.presupuesto === 'medio-bajo') {
        weights.Salary -= 60;
        weights.TransportePublico += 25;
        weights.Occupability += 20;
      } else if (profile.presupuesto === 'medio') {
        weights.Salary += 10; // Neutral-alto
        weights.Accessibility += 15;
      } else if (profile.presupuesto === 'medio-alto') {
        weights.Salary += 50;
        weights.Seguridad += 25;
        weights.GreenZones += 20;
      } else if (profile.presupuesto === 'alto') {
        weights.Salary += 90; // ULTRA restrictivo: solo barrios premium
        weights.Seguridad += 40;
        weights.GreenZones += 35;
        weights.AirQuality += 35;
        weights.Noise += 35;
      }
    }
    
    // NIVEL DE SEGURIDAD (explícito, no inferido)
    if (profile.nivelSeguridad) {
      if (profile.nivelSeguridad === 'critico') {
        weights.Seguridad += 60;
        weights.Policies += 35;
        weights.Bombers += 25;
      } else if (profile.nivelSeguridad === 'muy-importante') {
        weights.Seguridad += 45;
        weights.Policies += 25;
      } else if (profile.nivelSeguridad === 'importante') {
        weights.Seguridad += 30;
        weights.Policies += 15;
      } else if (profile.nivelSeguridad === 'moderado') {
        weights.Seguridad += 15;
      }
      // 'bajo' no añade peso extra
    }
    
    // DISTANCIA AL TRABAJO
    if (profile.distanciaTrabajo) {
      if (profile.distanciaTrabajo === 'muy-cerca') {
        weights.Connectivity += 50;
        weights.Accessibility += 50;
        weights.TransportePublico += 35;
        weights.Occupability += 40;
      } else if (profile.distanciaTrabajo === 'cerca') {
        weights.TransportePublico += 40;
        weights.Accessibility += 35;
        weights.Parking += 20;
      } else if (profile.distanciaTrabajo === 'media') {
        weights.Parking += 35;
        weights.TransportePublico += 25;
      } else if (profile.distanciaTrabajo === 'lejos') {
        weights.Parking += 45;
        weights.TransportePublico += 15;
      } else if (profile.distanciaTrabajo === 'no-importa') {
        weights.GreenZones += 25;
        weights.Noise += 20;
      }
    }
    
    // VIDA NOCTURNA (ya existía como pregunta pero ahora más explícito)
    if (profile.vidaNocturna || profile.ocioNocturno) {
      const respuesta = profile.ocioNocturno || profile.vidaNocturna;
      if (respuesta === 'esencial') {
        weights.OciNocturn += 60;
        weights.Taxis += 40;
        weights.TransportePublico += 30;
        weights.Seguridad += 20; // Seguridad nocturna
      } else if (respuesta === 'muy-importante' || respuesta === 'importante') {
        weights.OciNocturn += 40;
        weights.Taxis += 25;
        weights.TransportePublico += 20;
      } else if (respuesta === 'moderado') {
        weights.OciNocturn += 20;
        weights.Taxis += 10;
      } else if (respuesta === 'prefiero-evitar' || respuesta === 'bajo') {
        weights.Noise += 40; // Prefiere tranquilidad
        weights.OciNocturn -= 20;
      }
    }
    
    // ACCESO A HOSPITALES (explícito)
    if (profile.accesoHospitales) {
      if (profile.accesoHospitales === 'critico') {
        weights.Hospitals += 70;
      } else if (profile.accesoHospitales === 'muy-importante') {
        weights.Hospitals += 50;
      } else if (profile.accesoHospitales === 'importante') {
        weights.Hospitals += 35;
      } else if (profile.accesoHospitales === 'moderado') {
        weights.Hospitals += 20;
      }
    }
    
    // CALIDAD DE ESCUELAS (explícito)
    if (profile.calidadEscuelas) {
      if (profile.calidadEscuelas === 'critico') {
        weights.Escoles += 90;
        weights.Seguridad += 35;
        weights.GreenZones += 25; // Barrios familiares
      } else if (profile.calidadEscuelas === 'muy-importante') {
        weights.Escoles += 70;
        weights.Seguridad += 25;
      } else if (profile.calidadEscuelas === 'importante') {
        weights.Escoles += 50;
      } else if (profile.calidadEscuelas === 'moderado') {
        weights.Escoles += 25;
      }
    }
    
    // ACCESO A TIENDAS (explícito)
    if (profile.accesoTiendas) {
      if (profile.accesoTiendas === 'esencial') {
        weights.Botigues += 60;
        weights.CaminarCorrer += 30; // Poder caminar a tiendas
      } else if (profile.accesoTiendas === 'muy-importante') {
        weights.Botigues += 45;
        weights.CaminarCorrer += 20;
      } else if (profile.accesoTiendas === 'importante') {
        weights.Botigues += 30;
      } else if (profile.accesoTiendas === 'moderado') {
        weights.Botigues += 15;
      }
    }
    
    // TRANSPORTE PÚBLICO (explícito - prioriza datos de transport_data.json)
    if (profile.transportePublico) {
      if (profile.transportePublico === 'esencial') {
        weights.TransportePublico += 70;
        weights.Accessibility += 50;
        weights.Parking -= 30; // No tiene coche
      } else if (profile.transportePublico === 'muy-importante') {
        weights.TransportePublico += 50;
        weights.Accessibility += 35;
      } else if (profile.transportePublico === 'importante') {
        weights.TransportePublico += 35;
        weights.Accessibility += 20;
      } else if (profile.transportePublico === 'moderado') {
        weights.TransportePublico += 20;
      } else if (profile.transportePublico === 'bajo') {
        weights.Parking += 40; // Tiene coche propio
        weights.TransportePublico += 5; // Peso mínimo
      }
    }
    
    // USO DE TAXIS (datos de taxi_data.json)
    if (profile.usoTaxis) {
      if (profile.usoTaxis === 'muy-frecuente') {
        weights.Taxis += 70;
        weights.Connectivity += 30;
      } else if (profile.usoTaxis === 'frecuente') {
        weights.Taxis += 50;
        weights.Connectivity += 20;
      } else if (profile.usoTaxis === 'ocasional') {
        weights.Taxis += 30;
      } else if (profile.usoTaxis === 'raro') {
        weights.Taxis += 10;
      }
      // 'nunca' no añade peso
    }
    
    // USO DE BICICLETA (datos de bike_lanes_data.json)
    if (profile.usoBicicleta) {
      if (profile.usoBicicleta === 'principal') {
        weights.CarrilesBici += 80;
        weights.Parking -= 30; // No necesita parking para coche
        weights.GreenZones += 30; // Rutas agradables
        weights.AirQuality += 25;
      } else if (profile.usoBicicleta === 'frecuente') {
        weights.CarrilesBici += 60;
        weights.GreenZones += 20;
      } else if (profile.usoBicicleta === 'ocasional') {
        weights.CarrilesBici += 35;
      } else if (profile.usoBicicleta === 'recreativo') {
        weights.CarrilesBici += 25;
        weights.GreenZones += 15;
      }
      // 'no' no añade peso
    }
    
    // NECESIDAD DE PARKING (datos de parking_data.json)
    if (profile.necesidadParking) {
      if (profile.necesidadParking === 'critico') {
        weights.Parking += 80;
      } else if (profile.necesidadParking === 'muy-importante') {
        weights.Parking += 60;
      } else if (profile.necesidadParking === 'importante') {
        weights.Parking += 40;
      } else if (profile.necesidadParking === 'moderado') {
        weights.Parking += 20;
      } else if (profile.necesidadParking === 'no-necesario') {
        weights.TransportePublico += 35;
        weights.CarrilesBici += 25;
        weights.Parking += 5; // Peso mínimo
      }
    }
    
    // ACTIVIDAD FÍSICA (determina importancia de espacios verdes y senderos)
    if (profile.actividadFisica) {
      if (profile.actividadFisica === 'diaria') {
        weights.GreenZones += 60;
        weights.CaminarCorrer += 60;
        weights.CarrilesBici += 40;
        weights.AirQuality += 40;
        weights.Noise += 30; // Ambientes tranquilos para deporte
      } else if (profile.actividadFisica === 'frecuente') {
        weights.GreenZones += 45;
        weights.CaminarCorrer += 45;
        weights.CarrilesBici += 30;
        weights.AirQuality += 25;
      } else if (profile.actividadFisica === 'ocasional') {
        weights.GreenZones += 25;
        weights.CaminarCorrer += 25;
      } else if (profile.actividadFisica === 'gimnasio') {
        weights.Botigues += 20; // Gimnasios suelen estar en zonas comerciales
        weights.Connectivity += 15;
      }
      // 'sedentario' no añade peso
    }
    
    // NECESIDAD DE SENDEROS (datos de footpaths_data.json)
    if (profile.necesidadSenderos) {
      if (profile.necesidadSenderos === 'esencial') {
        weights.CaminarCorrer += 70;
        weights.GreenZones += 50;
        weights.AirQuality += 35;
        weights.Noise += 35;
      } else if (profile.necesidadSenderos === 'muy-importante') {
        weights.CaminarCorrer += 55;
        weights.GreenZones += 35;
        weights.AirQuality += 25;
      } else if (profile.necesidadSenderos === 'importante') {
        weights.CaminarCorrer += 40;
        weights.GreenZones += 25;
      } else if (profile.necesidadSenderos === 'moderado') {
        weights.CaminarCorrer += 20;
      }
    }
    
    // CERCANÍA A UNIVERSIDADES (datos de universities_data.json)
    if (profile.cercaniaUniversidad) {
      if (profile.cercaniaUniversidad === 'critico') {
        weights.Universitats += 90;
        weights.TransportePublico += 40;
        weights.OciDiurn += 25;
      } else if (profile.cercaniaUniversidad === 'muy-importante') {
        weights.Universitats += 70;
        weights.TransportePublico += 30;
      } else if (profile.cercaniaUniversidad === 'importante') {
        weights.Universitats += 50;
        weights.TransportePublico += 20;
      } else if (profile.cercaniaUniversidad === 'moderado') {
        weights.Universitats += 25;
      }
    }
    
    // OCIO DIURNO (datos de dayleisure_data.json)
    if (profile.ocioDiurno) {
      if (profile.ocioDiurno === 'esencial') {
        weights.OciDiurn += 65;
        weights.Botigues += 30;
        weights.CaminarCorrer += 25;
      } else if (profile.ocioDiurno === 'muy-importante') {
        weights.OciDiurn += 50;
        weights.Botigues += 20;
      } else if (profile.ocioDiurno === 'importante') {
        weights.OciDiurn += 35;
      } else if (profile.ocioDiurno === 'moderado') {
        weights.OciDiurn += 20;
      }
    }
    
    // OCIO NOCTURNO (datos de nightlife_data.json)
    if (profile.ocioNocturno) {
      if (profile.ocioNocturno === 'esencial') {
        weights.OciNocturn += 70;
        weights.Taxis += 45;
        weights.TransportePublico += 35;
        weights.Seguridad += 25;
      } else if (profile.ocioNocturno === 'muy-importante') {
        weights.OciNocturn += 55;
        weights.Taxis += 30;
        weights.TransportePublico += 25;
      } else if (profile.ocioNocturno === 'importante') {
        weights.OciNocturn += 40;
        weights.Taxis += 20;
      } else if (profile.ocioNocturno === 'moderado') {
        weights.OciNocturn += 20;
      } else if (profile.ocioNocturno === 'bajo') {
        weights.Noise += 45; // Prefiere tranquilidad
        weights.GreenZones += 30;
      }
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
      
      // GREEN ZONES: Aplicar bonificación/penalización MÁS AGRESIVA
      if (weights.GreenZones >= 100) {
        // Usuario busca MÁXIMA naturaleza: penalizar FUERTEMENTE barrios urbanos sin verde
        if (lifestyle.greenZones < 30) {
          score += (lifestyle.greenZones * weights.GreenZones) / 100;
          score -= 60; // Penalización FUERTE para barrios muy urbanos
        } else if (lifestyle.greenZones < 50) {
          score += (lifestyle.greenZones * weights.GreenZones) / 100;
          score -= 35; // Penalización moderada
        } else if (lifestyle.greenZones < 70) {
          score += (lifestyle.greenZones * weights.GreenZones) / 100;
          score -= 10; // Penalización leve
        } else {
          score += (lifestyle.greenZones * weights.GreenZones) / 100;
          score += 25; // BONIFICACIÓN GRANDE por cumplir expectativas
        }
      } else if (weights.GreenZones > 70) {
        if (lifestyle.greenZones < 40) {
          score += (lifestyle.greenZones * weights.GreenZones) / 100;
          score -= 30;
        } else {
          score += (lifestyle.greenZones * weights.GreenZones) / 100;
        }
      } else if (weights.GreenZones < 30) {
        // Usuario NO quiere naturaleza (urbano): bonificar centro sin verde
        if (lifestyle.greenZones < 35) {
          score += (lifestyle.greenZones * weights.GreenZones) / 100;
          score += 20; // BONIFICACIÓN por ambiente urbano
        }
      } else {
        score += (lifestyle.greenZones * weights.GreenZones) / 100;
      }
      
      // NOISE: Aplicar bonificación/penalización MÁS AGRESIVA
      if (weights.Noise >= 100) {
        // Usuario busca MÁXIMA tranquilidad: RECHAZAR centros urbanos ruidosos
        if (lifestyle.noise < 30) {
          score += (lifestyle.noise * weights.Noise) / 100;
          score -= 70; // Penalización BRUTAL para barrios muy ruidosos (Downtown)
        } else if (lifestyle.noise < 50) {
          score += (lifestyle.noise * weights.Noise) / 100;
          score -= 40; // Penalización fuerte
        } else if (lifestyle.noise < 70) {
          score += (lifestyle.noise * weights.Noise) / 100;
          score -= 15; // Penalización leve
        } else if (lifestyle.noise >= 75) {
          score += (lifestyle.noise * weights.Noise) / 100;
          score += 30; // BONIFICACIÓN GRANDE por muy tranquilo
        } else {
          score += (lifestyle.noise * weights.Noise) / 100;
        }
      } else if (weights.Noise > 60) {
        if (lifestyle.noise < 40) {
          score += (lifestyle.noise * weights.Noise) / 100;
          score -= 35;
        } else {
          score += (lifestyle.noise * weights.Noise) / 100;
        }
      } else if (weights.Noise < 30) {
        // Usuario busca ambiente urbano ruidoso: bonificar Downtown
        if (lifestyle.noise > 70) {
          score += (lifestyle.noise * weights.Noise) / 100;
          score -= 25; // Penalización por demasiado tranquilo
        } else if (lifestyle.noise < 35) {
          score += (lifestyle.noise * weights.Noise) / 100;
          score += 25; // BONIFICACIÓN GRANDE por ruidoso/urbano
        } else {
          score += (lifestyle.noise * weights.Noise) / 100;
        }
      } else {
        score += (lifestyle.noise * weights.Noise) / 100;
      }
      
      // AIR QUALITY: Aplicar bonificación/penalización MÁS AGRESIVA
      if (weights.AirQuality >= 100) {
        // Usuario busca MÁXIMA calidad aire: rechazar centros urbanos contaminados
        if (lifestyle.airQuality < 35) {
          score += (lifestyle.airQuality * weights.AirQuality) / 100;
          score -= 55; // Penalización FUERTE para barrios contaminados
        } else if (lifestyle.airQuality < 55) {
          score += (lifestyle.airQuality * weights.AirQuality) / 100;
          score -= 30; // Penalización moderada
        } else if (lifestyle.airQuality < 70) {
          score += (lifestyle.airQuality * weights.AirQuality) / 100;
          score -= 10; // Penalización leve
        } else if (lifestyle.airQuality >= 80) {
          score += (lifestyle.airQuality * weights.AirQuality) / 100;
          score += 25; // BONIFICACIÓN GRANDE por excelente calidad
        } else {
          score += (lifestyle.airQuality * weights.AirQuality) / 100;
        }
      } else if (weights.AirQuality > 70) {
        if (lifestyle.airQuality < 40) {
          score += (lifestyle.airQuality * weights.AirQuality) / 100;
          score -= 30;
        } else {
          score += (lifestyle.airQuality * weights.AirQuality) / 100;
        }
      } else {
        score += (lifestyle.airQuality * weights.AirQuality) / 100;
      }
      
      score += (lifestyle.occupability * weights.Occupability) / 100;
      score += (lifestyle.accessibility * weights.Accessibility) / 100;
      
      // Salary: SISTEMA ULTRA-RESTRICTIVO - El presupuesto es CRÍTICO
      // La mayoría de la gente no puede permitirse vivir en barrios muy caros
      if (weights.Salary > 70) {
        // Buscan barrios caros (premium): SOLO quieren High, RECHAZAR todo lo demás
        if (lifestyle.salary === 'High') {
          score += (100 * weights.Salary) / 100;
          score += 50; // BONIFICACIÓN MASIVA por match perfecto
        } else if (lifestyle.salary === 'Medium') {
          score += (30 * weights.Salary) / 100; // Muy bajo match
          score -= 40; // Penalización fuerte - buscan premium no medio
        } else if (lifestyle.salary === 'Low') {
          score += (5 * weights.Salary) / 100; // Casi ignorar
          score -= 80; // Penalización DESTRUCTIVA - incompatible con presupuesto
        }
      } else if (weights.Salary < -70) {
        // Buscan barrios económicos: SOLO quieren Low, RECHAZAR caros completamente
        const absWeight = Math.abs(weights.Salary);
        if (lifestyle.salary === 'Low') {
          score += (100 * absWeight) / 100;
          score += 50; // BONIFICACIÓN MASIVA por match perfecto
        } else if (lifestyle.salary === 'Medium') {
          score += (40 * absWeight) / 100; // Bajo match
          score -= 35; // Penalización moderada - prefieren más barato
        } else if (lifestyle.salary === 'High') {
          score += (0 * absWeight) / 100; // IGNORAR COMPLETAMENTE
          score -= 90; // Penalización ANIQUILADORA - no pueden pagar esto
        }
      } else if (weights.Salary > 40) {
        // Preferencia moderada por barrios caros (confortable)
        if (lifestyle.salary === 'High') {
          score += (100 * weights.Salary) / 100;
          score += 25;
        } else if (lifestyle.salary === 'Medium') {
          score += (75 * weights.Salary) / 100;
          score += 10; // Leve bonus - aceptable
        } else if (lifestyle.salary === 'Low') {
          score += (25 * weights.Salary) / 100;
          score -= 40; // Penalización fuerte - buscan mejor zona
        }
      } else if (weights.Salary < -40) {
        // Preferencia moderada por barrios económicos
        const absWeight = Math.abs(weights.Salary);
        if (lifestyle.salary === 'Low') {
          score += (100 * absWeight) / 100;
          score += 25;
        } else if (lifestyle.salary === 'Medium') {
          score += (70 * absWeight) / 100;
          score += 5; // Leve bonus - aceptable
        } else if (lifestyle.salary === 'High') {
          score += (20 * absWeight) / 100;
          score -= 50; // Penalización muy fuerte - fuera de presupuesto
        }
      } else if (weights.Salary !== 0) {
        // Preferencia neutra/leve (poco peso en presupuesto)
        if (lifestyle.salary === 'High') score += (80 * Math.abs(weights.Salary)) / 100;
        else if (lifestyle.salary === 'Medium') score += (90 * Math.abs(weights.Salary)) / 100;
        else if (lifestyle.salary === 'Low') score += (75 * Math.abs(weights.Salary)) / 100;
      } else {
        // Neutral - no importa el precio (solo cuando Salary weight = 0)
        score += 50; // Bonus neutral
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
      // METADATA: Generar ID único y timestamp para esta ejecución
      const runId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = new Date().toISOString();
      const seed = Date.now() % 1000; // Seed para tie-breaker estocástico
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🆔 Run ID: ${runId}`);
      console.log(`⏰ Timestamp: ${timestamp}`);
      console.log(`🎲 Seed: ${seed}`);
      console.log('🔍 Perfil de usuario:', JSON.stringify(profile, null, 2));

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

          const baseScore = this.calculateNeighborhoodScore(data, weights, lifestyle);
          
          // TIE-BREAKER ESTOCÁSTICO: Añadir pequeño ruido para romper empates determinísticos
          // Usar hash del nombre + seed para reproducibilidad dentro de la misma ejecución
          const nameHash = neighborhood.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const deterministicRandom = ((nameHash + seed) % 100) / 100; // 0.0 - 1.0
          const noise = (deterministicRandom - 0.5) * 2.0; // -1.0 a +1.0
          const finalScore = baseScore + noise; // Añadir ruido pequeño (~1-2 puntos)

          return {
            barrio: neighborhood.name,
            score: finalScore,
            baseScore: baseScore, // Guardar score original
            noise: noise, // Guardar ruido aplicado
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

      // 5. Ordenar por score descendente (ahora incluye tie-breaker)
      neighborhoodScores.sort((a, b) => b.score - a.score);

      console.log('✅ Recomendaciones calculadas exitosamente');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🏆 TOP 10 RECOMENDACIONES:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // Mostrar top 10 con breakdown detallado
      neighborhoodScores.slice(0, 10).forEach((n, idx) => {
        console.log(`\n${idx + 1}. ${n.barrio}`);
        console.log(`   📊 Score Final: ${n.score.toFixed(2)} (Base: ${n.baseScore.toFixed(2)}, Noise: ${n.noise >= 0 ? '+' : ''}${n.noise.toFixed(2)})`);
        
        if (n.lifestyle) {
          console.log(`   �️  Lifestyle: GreenZones=${n.lifestyle.greenZones}, Noise=${n.lifestyle.noise}, AirQuality=${n.lifestyle.airQuality}, Salary=${n.lifestyle.salary}`);
        }
        
        // Calcular contribución de cada categoría al score
        const contributions = {
          Seguridad: (n.data.Seguridad * weights.Seguridad) / 100,
          Servicios: ((n.data.Botigues * weights.Botigues + n.data.Hospitals * weights.Hospitals + n.data.Escoles * weights.Escoles) / 300),
          Movilidad: ((n.data.TransportePublico * weights.TransportePublico + n.data.CarrilesBici * weights.CarrilesBici) / 200),
          Lifestyle: n.lifestyle ? ((n.lifestyle.greenZones * weights.GreenZones + n.lifestyle.noise * weights.Noise) / 200) : 0,
        };
        
        const topContributions = Object.entries(contributions)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([cat, val]) => `${cat}(${val.toFixed(1)})`)
          .join(', ');
        
        console.log(`   🎯 Top Contribuciones: ${topContributions}`);
      });
      
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🎯 Resumen: Top 3 → ${neighborhoodScores.slice(0, 3).map(n => `${n.barrio} (${n.score.toFixed(1)})`).join(', ')}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      return {
        profile: profile,
        weights: weights,
        recommendations: neighborhoodScores,
        metadata: {
          runId,
          timestamp,
          seed,
          totalNeighborhoods: neighborhoodScores.length,
        },
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
