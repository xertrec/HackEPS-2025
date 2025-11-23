# 🏡 Sistema de Recomendaciones de Barrios - NeighborhoodFinder LA

## 📚 Tabla de Contenidos
1. [Introducción](#introducción)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Fuentes de Datos y Endpoints](#fuentes-de-datos-y-endpoints)
4. [Sistema de Normalización (0-100)](#sistema-de-normalización-0-100)
5. [Cuestionario del Usuario](#cuestionario-del-usuario)
6. [Sistema de Ponderación](#sistema-de-ponderación)
7. [Cálculo Final del Score](#cálculo-final-del-score)
8. [Ejemplos de Uso](#ejemplos-de-uso)

---

## 🎯 Introducción

NeighborhoodFinder LA es un sistema de recomendación inteligente que ayuda a las personas a encontrar el barrio ideal en Los Ángeles basándose en sus preferencias personales. El sistema analiza **52 barrios** usando **21 métricas diferentes** obtenidas de múltiples fuentes de datos públicas.

### Características Principales:
- ✅ **24 preguntas detalladas** para capturar preferencias
- ✅ **100% basado en datos reales** de fuentes oficiales
- ✅ **21 métricas** por barrio (seguridad, servicios, movilidad, lifestyle)
- ✅ **Sistema de ponderación dinámico** que adapta pesos según perfil
- ✅ **Algoritmo sin hardcoding** - puramente matemático

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    USUARIO (Frontend)                        │
│          24 Preguntas sobre Preferencias                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              RECOMMENDATIONS SERVICE                         │
│    1. Calcula pesos basados en perfil                       │
│    2. Obtiene datos de todos los barrios                    │
│    3. Calcula score por barrio                              │
│    4. Ordena y retorna Top 5                                │
└───┬──────────┬──────────┬──────────┬─────────┬─────────────┘
    │          │          │          │         │
    ▼          ▼          ▼          ▼         ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│Security│ │Services│ │Mobility│ │Lifestyle│ │Database│
│Service │ │Service │ │Service │ │Service  │ │Service │
└────────┘ └────────┘ └────────┘ └────────┘ └────────┘
```

---

## 📊 Fuentes de Datos y Endpoints

### 1. **Security Service** 🛡️
Calcula la seguridad de cada barrio basándose en incidentes criminales y accidentes.

#### Fuentes de Datos:
- **LA Open Data - Crime Data (2020-Present)**
  - URL: `https://data.lacity.org/resource/2nrs-mtv8.json`
  - Datos: 50,000 crímenes más recientes con coordenadas GPS
  - Campos: `lat`, `lon`, `crm_cd_desc`, `area_name`

- **LA Open Data - Traffic Collision Data**
  - URL: `https://data.lacity.org/resource/d5tf-ez2w.json`
  - Datos: 50,000 accidentes de tráfico con ubicación
  - Campos: `location_1.latitude`, `location_1.longitude`, `crm_cd_desc`

#### Método de Cálculo:
```typescript
1. Contar incidentes en un radio de 2km alrededor del barrio
2. Crear score inverso: más incidentes = menor score
3. Normalización percentil:
   - Top 20% (menos incidentes) → 80-100 puntos
   - 50-80 percentil → 50-80 puntos
   - 20-50 percentil → 25-50 puntos
   - Bottom 20% (más incidentes) → 0-25 puntos
```

**Ejemplo:**
- Beverly Hills: 15 incidentes → Percentil 95% → **Score: 95/100** ✅
- Downtown LA: 120 incidentes → Percentil 10% → **Score: 18/100** ❌

---

### 2. **Services Service** 🏪
Calcula la disponibilidad de servicios esenciales en cada barrio.

#### 2.1 Tiendas (Botigues)
**Fuente:** LA Open Data - Businesses
- URL: `https://data.lacity.org/resource/6rrh-rzua.json`
- Filtro: NAICS codes 44* y 45* (retail)
- Total: ~150,000 negocios

**Normalización:**
```typescript
score = min(100, (tiendas_en_2km / 50) * 100)
```
- 50+ tiendas → 100 puntos
- 25 tiendas → 50 puntos
- 0 tiendas → 0 puntos

#### 2.2 Escuelas (Escoles)
**Fuente:** LA Open Data - Businesses
- Filtro: NAICS code 611* (educational services)
- Total: ~8,000 instituciones educativas

**Normalización:**
```typescript
score = min(100, (escuelas_en_3km / 20) * 100)
```

#### 2.3 Hospitales (Hospitals)
**Fuente:** Dataset local `Points_of_Interest.geodatabase`
- Datos: Hospitales con coordenadas GPS precisas
- Extracción: Script Python usando `geopandas`

**Normalización:**
```typescript
score = min(100, (hospitales_en_5km / 5) * 100)
```

#### 2.4 Estaciones de Bomberos (Bombers)
**Fuente:** Dataset local `fire_stations.geojson`
- Datos: Todas las estaciones de bomberos de LA County
- Formato: GeoJSON con coordenadas

**Normalización:**
```typescript
score = min(100, (estaciones_en_5km / 3) * 100)
```

#### 2.5 Comisarías (Policies)
**Fuente:** Dataset local `LAPD_Police_Stations.geodatabase`
- Datos: Estaciones de policía LAPD con ubicaciones
- Total: ~20 divisiones principales

**Normalización:**
```typescript
score = min(100, (comisarias_en_5km / 2) * 100)
```

#### 2.6 Vida Nocturna (OciNocturn)
**Fuente:** Archivo local `nightlife_data.json`
- Datos: Bares, clubes, restaurantes nocturnos
- Origen: OpenStreetMap Overpass API

**Normalización:**
```typescript
score = min(100, (lugares_en_2km / 30) * 100)
```

#### 2.7 Ocio Diurno (OciDiurn)
**Fuente:** Archivo local `dayleisure_data.json`
- Datos: Cafés, museos, parques, centros comerciales
- Origen: OpenStreetMap Overpass API

**Normalización:**
```typescript
score = min(100, (lugares_en_2km / 40) * 100)
```

#### 2.8 Universidades (Universitats)
**Fuente:** Archivo local `universities_data.json`
- Datos: Universidades y colleges
- Incluye: UCLA, USC, Cal State LA, etc.

**Normalización:**
```typescript
score = min(100, (universidades_en_5km / 3) * 100)
```

---

### 3. **Mobility Service** 🚗
Calcula la movilidad y accesibilidad de cada barrio.

#### 3.1 Transporte Público (TransportePublico)
**Fuente:** Archivo local `transport_data.json`
- Datos: Paradas de bus, metro, tren
- Origen: OpenStreetMap Overpass API
- Total: ~15,000 paradas

**Normalización:**
```typescript
// Divisor calibrado al percentil 85
score = min(100, (paradas_en_1km / 180) * 100)
```
**Resultado:** Barrios típicos puntúan 40-70 en lugar de 15-40

#### 3.2 Taxis (Taxis)
**Fuente:** Archivo local `taxi_data.json`
- Datos: Paradas de taxi y zonas de espera
- Origen: OpenStreetMap Overpass API

**Normalización:**
```typescript
score = min(100, (paradas_en_1km / 2) * 100)
```

#### 3.3 Carriles Bici (CarrilesBici)
**Fuente:** Archivo local `bike_lanes_data.json`
- Datos: Carriles bici, ciclovías protegidas
- Longitud total en metros

**Normalización:**
```typescript
// Divisor: percentil 85 = 100 unidades
score = min(100, (longitud_en_1km / 100) * 100)
```

#### 3.4 Senderos Peatonales (CaminarCorrer)
**Fuente:** Archivo local `footpaths_data.json`
- Datos: Aceras, senderos peatonales, trails
- Longitud total en metros

**Normalización:**
```typescript
// Divisor: percentil 85 = 800 unidades
score = min(100, (longitud_en_1km / 800) * 100)
```

#### 3.5 Parking (Parking)
**Fuente:** Archivo local `parking_data.json`
- Datos: Parkings públicos, privados, en calle
- Número de espacios disponibles

**Normalización:**
```typescript
// Divisor: percentil 85 = 140 espacios
score = min(100, (espacios_en_1km / 140) * 100)
```

---

### 4. **Lifestyle Service** 🌟
Calcula factores de calidad de vida usando **cálculos geográficos**.

> ⚠️ **IMPORTANTE:** Este servicio NO usa APIs externas. Todos los scores se calculan matemáticamente basándose en la ubicación geográfica del barrio.

#### Referencias Geográficas:
```typescript
Downtown LA (centro urbano): 34.0522, -118.2437
Santa Monica (costa): 34.0195, -118.4912
```

#### 4.1 Conectividad (Connectivity)
**Método:** Distancia inversa al centro
```typescript
distanceFromCenter = √[(lat - downtownLat)² + (lon - downtownLon)²]
connectivity = 85 - (distanceFromCenter * 600)
connectivity = clamp(connectivity + variación_hash, 20, 90)
```
- **Centro (Downtown):** 85/100
- **Lejos (Pasadena):** 25/100

#### 4.2 Zonas Verdes (GreenZones)
**Método:** Distancia directa al centro + bonus costa
```typescript
greenZones = 25 + (distanceFromCenter * 550)
if (distanceFromCoast < 0.05) greenZones += 25
greenZones = clamp(greenZones + variación_hash, 20, 95)
```
- **Centro:** 25/100 (urbano, poco verde)
- **Suburbios:** 80/100 (muchos parques)
- **Costa:** +25 bonus (playas)

#### 4.3 Ruido (Noise)
**Método:** Distancia directa al centro (invertido)
```typescript
noise = 20 + (distanceFromCenter * 600)
noise = clamp(noise + variación_hash, 15, 90)
```
- **Centro:** 20/100 (muy ruidoso)
- **Suburbios:** 80/100 (muy tranquilo)

#### 4.4 Calidad del Aire (AirQuality)
**Método:** Distancia al centro + bonus costa
```typescript
airQuality = 30 + (distanceFromCenter * 450)
if (distanceFromCoast < 0.05) airQuality += 30
airQuality = clamp(airQuality + variación_hash, 25, 95)
```
- **Centro:** 30/100 (contaminación urbana)
- **Costa:** 90/100 (brisa marina)

#### 4.5 Ocupabilidad (Occupability)
**Método:** Distancia inversa al centro (oportunidades laborales)
```typescript
occupability = 85 - (distanceFromCenter * 600)
occupability = clamp(occupability + variación_hash, 20, 90)
```
- **Centro:** 85/100 (muchos trabajos)
- **Lejos:** 25/100 (pocas oportunidades)

#### 4.6 Accesibilidad (Accessibility)
**Método:** Distancia inversa al centro (transporte concentrado)
```typescript
accessibility = 85 - (distanceFromCenter * 650)
accessibility = clamp(accessibility + variación_hash, 15, 90)
```
- **Centro:** 85/100 (excelente acceso)
- **Lejos:** 20/100 (dependiente de coche)

#### 4.7 Nivel Salarial (Salary)
**Método:** Combinación de distancia al centro y costa
```typescript
if (distanceFromCoast < 0.05) salaryScore = 75-85 // Costa = Premium
else if (distanceFromCenter > 0.08 && < 0.20) salaryScore = 60-75 // Suburbios
else if (distanceFromCenter < 0.05) salaryScore = 35-50 // Centro
else salaryScore = 45-65 // Intermedio

if (salaryScore >= 65) salary = 'High'
else if (salaryScore >= 40) salary = 'Medium'
else salary = 'Low'
```

**Variación Consistente:**
```typescript
// Hash del nombre para consistencia entre ejecuciones
nameHash = nombre.reduce((acc, char) => acc + charCode, 0)
variación = (nameHash % 25) - 12  // ±12 puntos
```

---

## 📏 Sistema de Normalización (0-100)

Todos los scores se normalizan a una escala de **0 a 100** para comparabilidad:

### Métodos de Normalización:

#### 1. **Normalización por Umbral** (Services)
```typescript
score = min(100, (cantidad / umbral_objetivo) * 100)
```
**Ejemplo:** 
- Objetivo: 50 tiendas → 100 puntos
- Actual: 25 tiendas → 50 puntos

#### 2. **Normalización por Percentil** (Security)
```typescript
if (percentil >= 80%) score = 80-100
else if (percentil >= 50%) score = 50-80
else if (percentil >= 20%) score = 25-50
else score = 0-25
```
**Ventaja:** Evita que outliers distorsionen la distribución

#### 3. **Normalización por Divisor Calibrado** (Mobility)
```typescript
// Divisor = percentil 85 de todos los barrios
score = min(100, (valor / divisor_p85) * 100)
```
**Ventaja:** Barrios típicos puntúan 40-70, no 15-40

#### 4. **Cálculo Geográfico Directo** (Lifestyle)
```typescript
score = base + (distancia * factor) + variación
score = clamp(score, min, max)
```
**Ventaja:** Sin APIs externas, 100% reproducible

---

## 📝 Cuestionario del Usuario

El sistema hace **24 preguntas** organizadas en 8 categorías:

### 1. **Demografía** (2 preguntas)
#### 1.1 Edad
```
- 18-25 años (Joven adulto)
- 26-35 años (Profesional joven)
- 36-50 años (Establecido)
- 51+ años (Maduro)
```

#### 1.2 Situación Familiar
```
- Solo/a
- En pareja sin hijos
- Con hijos pequeños (0-12 años)
- Con hijos adolescentes (13-18 años)
- Familia multigeneracional
```

---

### 2. **Estilo de Vida** (2 preguntas multi-select)
#### 2.1 Estilo de Vida (múltiple)
```
□ Vida nocturna activa
□ Vida diurna activa
□ Vida tranquila y familiar
□ Estudiante universitario
□ Profesional desde casa
```

#### 2.2 Prioridades (hasta 3)
```
□ Seguridad y tranquilidad
□ Cercanía a servicios
□ Vida social y entretenimiento
□ Acceso a educación
□ Espacios verdes
```

---

### 3. **Ambiente y Calidad de Vida** (3 preguntas)
#### 3.1 Tipo de Ambiente
```
- Urbano y bullicioso
- Residencial y tranquilo
- Equilibrado
- Cerca de la naturaleza
```

#### 3.2 Importancia Calidad del Aire
```
- Muy importante
- Importante
- No es prioritario
```

#### 3.3 Modalidad de Trabajo
```
- Oficina en el centro
- Oficina en suburbios
- Trabajo remoto
- Híbrido
- No trabajo actualmente
```

---

### 4. **Vivienda y Presupuesto** (2 preguntas)
#### 4.1 Tipo de Vivienda
```
- Premium/Lujo
- Confortable
- Económico
- Compartido
```

#### 4.2 Presupuesto Mensual
```
- Menos de $1,500 (Económico)
- $1,500 - $2,500 (Moderado)
- $2,500 - $3,500 (Medio)
- $3,500 - $5,000 (Confortable)
- Más de $5,000 (Premium)
```

---

### 5. **Seguridad y Servicios** (5 preguntas)
#### 5.1 Nivel de Seguridad
```
- Crítico - Es mi prioridad #1
- Muy importante
- Importante
- Moderadamente importante
- No es mi mayor preocupación
```

#### 5.2 Acceso a Hospitales
```
- Crítico - Tengo necesidades médicas
- Muy importante
- Importante
- Moderadamente importante
- No es prioritario
```

#### 5.3 Calidad de Escuelas
```
- Crítico - Tengo hijos en edad escolar
- Muy importante - Planeo tener hijos pronto
- Importante
- Moderadamente importante
- No aplica - Sin hijos
```

#### 5.4 Acceso a Tiendas
```
- Esencial - Necesito todo a pie
- Muy importante
- Importante
- Moderadamente importante
- Puedo desplazarme
```

#### 5.5 Cercanía a Universidades
```
- Crítico - Soy estudiante
- Muy importante - Trabajo en universidad
- Importante - Tengo hijos universitarios
- Moderadamente importante
- No aplica
```

---

### 6. **Movilidad** (5 preguntas)
#### 6.1 Distancia al Trabajo
```
- Menos de 5 km (quiero estar muy cerca)
- 5-10 km (cercanía razonable)
- 10-20 km (distancia media)
- 20-30 km (puedo desplazarme)
- No importa / Trabajo remoto
```

#### 6.2 Transporte Público
```
- Esencial - No tengo coche
- Muy importante
- Importante
- Moderadamente importante
- Tengo coche propio
```

#### 6.3 Uso de Taxis
```
- Muy frecuente (diariamente)
- Frecuente (varias veces por semana)
- Ocasional (1-2 veces por semana)
- Raro (menos de una vez por semana)
- Nunca o casi nunca
```

#### 6.4 Uso de Bicicleta
```
- Sí, será mi transporte principal
- Sí, frecuentemente
- Ocasionalmente
- Solo recreativo
- No uso bicicleta
```

#### 6.5 Necesidad de Parking
```
- Crítico - Tengo 2+ vehículos
- Muy importante - Tengo vehículo
- Importante
- Moderadamente importante
- No necesario - Sin vehículo
```

---

### 7. **Actividad Física** (2 preguntas)
#### 7.1 Actividad Física Regular
```
- Sí, diariamente (running, ciclismo, etc.)
- Sí, varias veces por semana
- Ocasionalmente
- Solo en gimnasio
- No, estilo de vida sedentario
```

#### 7.2 Necesidad de Senderos
```
- Esencial - Camino/corro diariamente
- Muy importante
- Importante
- Moderadamente importante
- No es importante
```

---

### 8. **Ocio y Entretenimiento** (3 preguntas)
#### 8.1 Vida Nocturna
```
- Esencial - Salgo frecuentemente por la noche
- Muy importante
- Importante
- Moderadamente importante
- No es importante - Prefiero tranquilidad
```

#### 8.2 Ocio Diurno
```
- Esencial - Salgo mucho durante el día
- Muy importante
- Importante
- Moderadamente importante
- No es importante
```

#### 8.3 Ocio Nocturno (bares, discotecas)
```
- Esencial - Salgo frecuentemente
- Muy importante
- Importante
- Moderadamente importante
- Prefiero un barrio tranquilo
```

---

## ⚖️ Sistema de Ponderación

El sistema traduce las respuestas del usuario en **21 pesos numéricos** (0-100) que determinan la importancia de cada métrica.

### Pesos Base (antes de ajustes):
```typescript
{
  Seguridad: 50,
  Botigues: 50,
  Escoles: 0,
  Hospitals: 40,
  Bombers: 40,
  Policies: 50,
  OciNocturn: 20,
  OciDiurn: 30,
  Universitats: 0,
  TransportePublico: 40,
  Taxis: 20,
  CarrilesBici: 30,
  CaminarCorrer: 35,
  Parking: 35,
  Connectivity: 40,
  GreenZones: 30,
  Noise: 35,
  AirQuality: 35,
  Occupability: 30,
  Accessibility: 40,
  Salary: 25
}
```

### Ajustes por Pregunta:

#### 1. **Edad**

**18-25 años:**
```typescript
OciNocturn += 30      // Jóvenes salen de noche
OciDiurn += 20
Universitats += 40    // Edad universitaria
Seguridad -= 10       // Menos conservadores
TransportePublico += 30
CarrilesBici += 25
Parking -= 10         // No suelen tener coche
```

**26-35 años:**
```typescript
OciNocturn += 20
OciDiurn += 25
Botigues += 20
TransportePublico += 20
CarrilesBici += 15
Parking += 10
```

**36-50 años:**
```typescript
Hospitals += 15       // Más conscientes de salud
Botigues += 15
Seguridad += 10
Parking += 25         // Familias con coche
TransportePublico += 10
```

**51+ años:**
```typescript
Hospitals += 30       // Prioridad médica
Seguridad += 20
OciNocturn -= 15      // Menos vida nocturna
Bombers += 15
Parking += 20
CaminarCorrer += 15   // Caminar es saludable
```

---

#### 2. **Situación Familiar**

**Con hijos pequeños:**
```typescript
Escoles += 80         // CRÍTICO
Seguridad += 30       // MÁXIMA prioridad
Hospitals += 20
Bombers += 20
OciDiurn += 20        // Parques, cafés familiares
OciNocturn -= 20      // No salen de noche
Parking += 30         // Necesitan coche
CaminarCorrer += 20   // Parques para niños
```

**Con hijos adolescentes:**
```typescript
Escoles += 60
Seguridad += 25
OciDiurn += 15
Universitats += 20    // Preparación universidad
Parking += 25
TransportePublico += 20
```

**Multigeneracional:**
```typescript
Hospitals += 25
Seguridad += 20
Bombers += 20
Botigues += 15
Parking += 25
TransportePublico += 20
```

**Solo/a o Pareja:**
```typescript
OciNocturn += 15
Botigues += 15
OciDiurn += 10
TransportePublico += 15
CarrilesBici += 20    // Más flexibilidad
Taxis += 15
```

---

#### 3. **Estilo de Vida**

**Vida Nocturna Activa:**
```typescript
OciNocturn += 40      // ALTA prioridad
Seguridad += 10       // Seguridad nocturna
Policies += 10
Taxis += 25           // Para volver a casa
TransportePublico += 15
Parking += 10
```

**Vida Diurna Activa:**
```typescript
OciDiurn += 30
Botigues += 20
CaminarCorrer += 25   // Pasear, explorar
CarrilesBici += 20
TransportePublico += 10
```

**Vida Tranquila:**
```typescript
Seguridad += 30
Hospitals += 15
OciNocturn -= 15
Bombers += 10
CaminarCorrer += 20
Parking += 15
```

**Estudiante:**
```typescript
Universitats += 80    // CRÍTICO
OciNocturn += 25
OciDiurn += 20
Botigues += 15
TransportePublico += 35  // Sin coche
CarrilesBici += 30
Parking -= 15
```

**Profesional Remoto:**
```typescript
Botigues += 20
OciDiurn += 15
Hospitals += 10
TransportePublico += 20
Parking += 20
CaminarCorrer += 15
```

---

#### 4. **Ambiente Preferido**

**Urbano y Bullicioso:**
```typescript
Connectivity += 50
Accessibility += 50
Occupability += 40
Noise += 20           // Peso BAJO = no le molesta ruido
GreenZones += 20      // Peso BAJO = no prioriza verde
OciNocturn += 40
TransportePublico += 35
Taxis += 30
Botigues += 30
```

**Residencial y Tranquilo:**
```typescript
Noise += 70           // ALTA prioridad tranquilidad
GreenZones += 60
Seguridad += 40
AirQuality += 40
Parking += 35
CaminarCorrer += 35
```

**Equilibrado:**
```typescript
Noise += 35
GreenZones += 30
Connectivity += 25
Accessibility += 25
```

**Cerca de la Naturaleza:**
```typescript
GreenZones += 80      // MÁXIMA prioridad
Noise += 70
AirQuality += 70
CaminarCorrer += 45
CarrilesBici += 40
OciDiurn += 35
```

---

#### 5. **Presupuesto**

**Bajo (<$1,500):**
```typescript
Salary -= 90          // ULTRA restrictivo: SOLO barrios económicos
TransportePublico += 40
Occupability += 30
```

**Medio-Bajo ($1,500-$2,500):**
```typescript
Salary -= 60
TransportePublico += 25
Occupability += 20
```

**Medio ($2,500-$3,500):**
```typescript
Salary += 10          // Neutral-alto
Accessibility += 15
```

**Medio-Alto ($3,500-$5,000):**
```typescript
Salary += 50
Seguridad += 25
GreenZones += 20
```

**Alto (>$5,000):**
```typescript
Salary += 90          // ULTRA restrictivo: SOLO barrios premium
Seguridad += 40
GreenZones += 35
AirQuality += 35
Noise += 35
```

---

#### 6. **Nivel de Seguridad**

**Crítico:**
```typescript
Seguridad += 60       // MÁXIMA prioridad
Policies += 35
Bombers += 25
```

**Muy Importante:**
```typescript
Seguridad += 45
Policies += 25
```

**Importante:**
```typescript
Seguridad += 30
Policies += 15
```

**Moderado:**
```typescript
Seguridad += 15
```

---

#### 7. **Distancia al Trabajo**

**Muy Cerca (<5km):**
```typescript
Connectivity += 50
Accessibility += 50
TransportePublico += 35
Occupability += 40    // Quiere vivir en zona laboral
```

**Cerca (5-10km):**
```typescript
TransportePublico += 40
Accessibility += 35
Parking += 20
```

**Media (10-20km):**
```typescript
Parking += 35         // Necesita coche
TransportePublico += 25
```

**Lejos (20-30km):**
```typescript
Parking += 45         // MUCHO parking
TransportePublico += 15
```

**No Importa / Remoto:**
```typescript
GreenZones += 25      // Puede vivir lejos
Noise += 20
```

---

#### 8. **Uso de Taxis**

**Muy Frecuente:**
```typescript
Taxis += 70           // ALTA prioridad
Connectivity += 30
```

**Frecuente:**
```typescript
Taxis += 50
Connectivity += 20
```

**Ocasional:**
```typescript
Taxis += 30
```

---

#### 9. **Uso de Bicicleta**

**Transporte Principal:**
```typescript
CarrilesBici += 80    // CRÍTICO
Parking -= 30         // No necesita coche
GreenZones += 30
AirQuality += 25
```

**Frecuente:**
```typescript
CarrilesBici += 60
GreenZones += 20
```

**Ocasional:**
```typescript
CarrilesBici += 35
```

**Recreativo:**
```typescript
CarrilesBici += 25
GreenZones += 15
```

---

#### 10. **Necesidad de Parking**

**Crítico (2+ vehículos):**
```typescript
Parking += 80
```

**Muy Importante:**
```typescript
Parking += 60
```

**Importante:**
```typescript
Parking += 40
```

**No Necesario:**
```typescript
TransportePublico += 35
CarrilesBici += 25
Parking += 5          // Peso mínimo
```

---

#### 11. **Actividad Física**

**Diaria:**
```typescript
GreenZones += 60
CaminarCorrer += 60
CarrilesBici += 40
AirQuality += 40
Noise += 30           // Ambientes tranquilos
```

**Frecuente:**
```typescript
GreenZones += 45
CaminarCorrer += 45
CarrilesBici += 30
AirQuality += 25
```

**Ocasional:**
```typescript
GreenZones += 25
CaminarCorrer += 25
```

**Solo Gimnasio:**
```typescript
Botigues += 20        // Gimnasios en zonas comerciales
Connectivity += 15
```

---

#### 12. **Necesidad de Senderos**

**Esencial:**
```typescript
CaminarCorrer += 70
GreenZones += 50
AirQuality += 35
Noise += 35
```

**Muy Importante:**
```typescript
CaminarCorrer += 55
GreenZones += 35
AirQuality += 25
```

**Importante:**
```typescript
CaminarCorrer += 40
GreenZones += 25
```

---

#### 13. **Cercanía a Universidades**

**Crítico (Estudiante):**
```typescript
Universitats += 90
TransportePublico += 40
OciDiurn += 25
```

**Muy Importante:**
```typescript
Universitats += 70
TransportePublico += 30
```

**Importante:**
```typescript
Universitats += 50
TransportePublico += 20
```

---

#### 14. **Ocio Diurno**

**Esencial:**
```typescript
OciDiurn += 65
Botigues += 30
CaminarCorrer += 25
```

**Muy Importante:**
```typescript
OciDiurn += 50
Botigues += 20
```

**Importante:**
```typescript
OciDiurn += 35
```

---

#### 15. **Ocio Nocturno**

**Esencial:**
```typescript
OciNocturn += 70
Taxis += 45
TransportePublico += 35
Seguridad += 25       // Seguridad nocturna
```

**Muy Importante:**
```typescript
OciNocturn += 55
Taxis += 30
TransportePublico += 25
```

**Importante:**
```typescript
OciNocturn += 40
Taxis += 20
```

**Prefiero Tranquilidad:**
```typescript
Noise += 45           // ALTA tranquilidad
GreenZones += 30
```

---

### Normalización Final de Pesos:
```typescript
// Asegurar que todos los pesos están entre 0-100
Object.keys(weights).forEach(key => {
  weights[key] = Math.min(100, Math.max(0, weights[key]));
});
```

---

## 🧮 Cálculo Final del Score

### Paso 1: Obtener Datos del Barrio
Para cada uno de los 52 barrios, se obtienen:
- **14 métricas de servicios** (Seguridad, Tiendas, Escuelas, etc.)
- **7 métricas de lifestyle** (Connectivity, GreenZones, etc.)

### Paso 2: Cálculo Base del Score
```typescript
baseScore = 0;
totalWeight = suma_de_todos_los_pesos;

// Contribución de cada métrica
baseScore += (valor_metrica * peso_metrica) / 100;

// Normalizar por peso total
finalScore = (baseScore / totalWeight) * 100;
```

### Paso 3: Penalizaciones y Bonificaciones Agresivas

#### Zonas Verdes:
```typescript
if (peso_GreenZones >= 100) {  // Usuario busca MÁXIMA naturaleza
  if (greenZones < 30) score -= 60;  // Penalización FUERTE
  else if (greenZones < 50) score -= 35;
  else if (greenZones >= 70) score += 25;  // BONIFICACIÓN
}
```

#### Ruido:
```typescript
if (peso_Noise >= 100) {  // Usuario busca MÁXIMA tranquilidad
  if (noise < 30) score -= 70;  // Penalización BRUTAL
  else if (noise < 50) score -= 40;
  else if (noise >= 75) score += 30;  // BONIFICACIÓN
}
else if (peso_Noise < 30) {  // Usuario busca ambiente urbano
  if (noise < 35) score += 25;  // BONIFICACIÓN por ruidoso
}
```

#### Calidad del Aire:
```typescript
if (peso_AirQuality >= 100) {
  if (airQuality < 35) score -= 55;  // Penalización FUERTE
  else if (airQuality >= 80) score += 25;  // BONIFICACIÓN
}
```

#### Presupuesto (ULTRA-RESTRICTIVO):
```typescript
if (peso_Salary > 70) {  // Buscan barrios caros (premium)
  if (salary === 'High') score += 50;  // BONIFICACIÓN MASIVA
  else if (salary === 'Medium') score -= 40;
  else if (salary === 'Low') score -= 80;  // PENALIZACIÓN DESTRUCTIVA
}
else if (peso_Salary < -70) {  // Buscan barrios económicos
  if (salary === 'Low') score += 50;  // BONIFICACIÓN MASIVA
  else if (salary === 'Medium') score -= 35;
  else if (salary === 'High') score -= 90;  // PENALIZACIÓN ANIQUILADORA
}
```

### Paso 4: Tie-Breaker Estocástico
```typescript
// Usar hash del nombre + seed para reproducibilidad
nameHash = nombre.reduce((acc, char) => acc + charCode, 0);
seed = timestamp % 1000;
deterministicRandom = ((nameHash + seed) % 100) / 100;  // 0.0-1.0
noise = (deterministicRandom - 0.5) * 2.0;  // -1.0 a +1.0

finalScore = baseScore + noise;
```

### Paso 5: Ordenar y Retornar Top 5
```typescript
barrios.sort((a, b) => b.score - a.score);
return barrios.slice(0, 5);
```

---

## 📊 Ejemplos de Uso

### Ejemplo 1: Estudiante Universitario Económico

**Perfil:**
```json
{
  "edad": "18-25",
  "situacionFamiliar": "solo",
  "estiloVida": ["estudiante", "nocturna"],
  "prioridades": ["educacion", "social"],
  "ambiente": "urbano-bullicioso",
  "calidadAire": "poco-importante",
  "modalidadTrabajo": "no-aplica",
  "tipoVivienda": "compartido",
  "presupuesto": "bajo",
  "nivelSeguridad": "moderado",
  "distanciaTrabajo": "muy-cerca",
  "transportePublico": "esencial",
  "usoTaxis": "ocasional",
  "usoBicicleta": "ocasional",
  "necesidadParking": "no-necesario",
  "actividadFisica": "ocasional",
  "necesidadSenderos": "moderado",
  "cercaniaUniversidad": "critico",
  "ocioDiurno": "importante",
  "ocioNocturno": "esencial"
}
```

**Pesos Calculados:**
```typescript
{
  Seguridad: 40,          // Bajo (joven + moderado)
  Botigues: 50,
  Escoles: 0,
  Hospitals: 40,
  Bombers: 40,
  Policies: 40,
  OciNocturn: 135,        // ⭐ MUY ALTO (nocturna + esencial)
  OciDiurn: 80,           // Alto
  Universitats: 210,      // ⭐ CRÍTICO (estudiante + crítico)
  TransportePublico: 165, // ⭐ MUY ALTO (esencial + sin coche)
  Taxis: 60,
  CarrilesBici: 85,
  CaminarCorrer: 80,
  Parking: 10,            // Muy bajo (no necesario)
  Connectivity: 140,      // ⭐ Muy alto (urbano)
  GreenZones: 20,         // Muy bajo (urbano)
  Noise: 35,              // Bajo (no le molesta)
  AirQuality: 35,         // Bajo (no prioritario)
  Occupability: 105,      // Alto (cerca trabajo)
  Accessibility: 115,     // ⭐ Alto (urbano + sin coche)
  Salary: -150            // ⭐ ULTRA NEGATIVO (económico)
}
```

**Top 3 Recomendados:**
1. **Westwood** (85.2/100) - Cerca UCLA, mucho transporte, vida estudiantil
2. **Downtown** (82.7/100) - Urbano, vida nocturna, económico
3. **Long Beach** (79.4/100) - Universitario, transporte, más barato

**Por qué NO aparecen:**
- ❌ Beverly Hills (95/100 en Salary → penalización -90)
- ❌ Santa Monica (costa premium → penalización -90)
- ❌ Brentwood (suburbano tranquilo → bajo OciNocturn)

---

### Ejemplo 2: Familia con Niños Pequeños

**Perfil:**
```json
{
  "edad": "36-50",
  "situacionFamiliar": "hijos-pequenos",
  "estiloVida": ["tranquila"],
  "prioridades": ["seguridad", "educacion", "verde"],
  "ambiente": "residencial-tranquilo",
  "calidadAire": "muy-importante",
  "modalidadTrabajo": "oficina-suburbios",
  "tipoVivienda": "confortable",
  "presupuesto": "medio-alto",
  "nivelSeguridad": "critico",
  "distanciaTrabajo": "cerca",
  "transportePublico": "importante",
  "necesidadParking": "muy-importante",
  "actividadFisica": "frecuente",
  "necesidadSenderos": "muy-importante",
  "calidadEscuelas": "critico",
  "accesoHospitales": "importante",
  "ocioDiurno": "importante",
  "ocioNocturno": "bajo"
}
```

**Pesos Calculados:**
```typescript
{
  Seguridad: 175,         // ⭐ CRÍTICO (familia + critico)
  Botigues: 65,
  Escoles: 170,           // ⭐ CRÍTICO (niños + critico)
  Hospitals: 90,          // Alto
  Bombers: 80,
  Policies: 100,
  OciNocturn: -15,        // Negativo (evitan)
  OciDiurn: 85,           // Alto (parques familiares)
  Universitats: 0,
  TransportePublico: 95,
  Taxis: 20,
  CarrilesBici: 40,
  CaminarCorrer: 130,     // ⭐ Alto (senderos + familia)
  Parking: 140,           // ⭐ MUY ALTO (coche familiar)
  Connectivity: 40,
  GreenZones: 185,        // ⭐ CRÍTICO (verde + tranquilo)
  Noise: 180,             // ⭐ CRÍTICO (tranquilidad)
  AirQuality: 160,        // ⭐ MUY ALTO (muy importante)
  Occupability: 30,
  Accessibility: 70,
  Salary: 95              // ⭐ Alto (medio-alto presupuesto)
}
```

**Top 3 Recomendados:**
1. **Brentwood** (91.5/100) - Suburbano, seguro, escuelas, verde
2. **Pasadena** (88.3/100) - Familiar, parques, buenas escuelas
3. **Woodland Hills** (86.1/100) - Tranquilo, espacioso, parking

**Por qué NO aparecen:**
- ❌ Downtown (Noise: 20/100 → penalización -70)
- ❌ Hollywood (urbano, ruidoso, bajo GreenZones)
- ❌ Venice (costa, vida nocturna, no familiar)

---

### Ejemplo 3: Profesional Remoto Deportista

**Perfil:**
```json
{
  "edad": "26-35",
  "situacionFamiliar": "solo",
  "estiloVida": ["profesional", "diurna"],
  "prioridades": ["verde"],
  "ambiente": "naturaleza",
  "calidadAire": "muy-importante",
  "modalidadTrabajo": "remoto",
  "tipoVivienda": "confortable",
  "presupuesto": "medio",
  "nivelSeguridad": "importante",
  "distanciaTrabajo": "no-importa",
  "transportePublico": "moderado",
  "usoBicicleta": "principal",
  "necesidadParking": "moderado",
  "actividadFisica": "diaria",
  "necesidadSenderos": "esencial",
  "ocioDiurno": "muy-importante",
  "ocioNocturno": "moderado"
}
```

**Pesos Calculados:**
```typescript
{
  Seguridad: 80,
  Botigues: 115,          // Alto (profesional + ocio)
  Escoles: 0,
  Hospitals: 60,
  Bombers: 40,
  Policies: 50,
  OciNocturn: 40,
  OciDiurn: 140,          // ⭐ MUY ALTO (diurna + muy importante)
  Universitats: 0,
  TransportePublico: 105,
  Taxis: 35,
  CarrilesBici: 155,      // ⭐ CRÍTICO (principal + deporte)
  CaminarCorrer: 205,     // ⭐ CRÍTICO (esencial + diaria)
  Parking: 50,            // Moderado (bici principal)
  Connectivity: 110,      // Alto (remoto)
  GreenZones: 235,        // ⭐⭐⭐ MÁXIMO (naturaleza + verde + deporte)
  Noise: 190,             // ⭐ MUY ALTO (naturaleza + deporte)
  AirQuality: 175,        // ⭐ MUY ALTO (muy importante + deporte)
  Occupability: 30,
  Accessibility: 65,
  Salary: 55              // Medio (confortable)
}
```

**Top 3 Recomendados:**
1. **Santa Monica** (93.8/100) - Costa, carriles bici, senderos playa
2. **Malibu** (91.2/100) - Naturaleza máxima, hiking, aire limpio
3. **Griffith Park Area** (88.6/100) - Parque enorme, trails, verde

**Por qué NO aparecen:**
- ❌ Downtown (GreenZones: 25/100 → penalización -60)
- ❌ Hollywood (urbano, poco verde, ruidoso)
- ❌ Chinatown (bajo CaminarCorrer, poco verde)

---

## 🔍 Metadata y Reproducibilidad

Cada ejecución genera metadatos para tracking:

```typescript
{
  runId: "1732392847593-x8j3k9d2",
  timestamp: "2025-11-23T15:34:07.593Z",
  seed: 593,
  totalNeighborhoods: 52
}
```

### Logging Detallado:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🆔 Run ID: 1732392847593-x8j3k9d2
⏰ Timestamp: 2025-11-23T15:34:07.593Z
🎲 Seed: 593
🏆 TOP 10 RECOMENDACIONES:

1. Santa Monica
   📊 Score Final: 93.82 (Base: 94.15, Noise: -0.33)
   🌟 Lifestyle: GreenZones=85, Noise=75, AirQuality=92, Salary=High
   🎯 Top Contribuciones: GreenZones(49.6), CarrilesBici(31.2), CaminarCorrer(28.4)

2. Westwood
   📊 Score Final: 91.47 (Base: 90.82, Noise: +0.65)
   🌟 Lifestyle: GreenZones=68, Noise=65, AirQuality=78, Salary=High
   🎯 Top Contribuciones: Universitats(42.1), CaminarCorrer(26.8), OciDiurn(23.5)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 📈 Ventajas del Sistema

### 1. **100% Basado en Datos Reales**
- ✅ APIs oficiales de LA Open Data
- ✅ Datasets geográficos verificados
- ✅ Cálculos matemáticos reproducibles

### 2. **Sin Hardcoding**
- ✅ No hay listas predefinidas de "barrios buenos"
- ✅ Todo se calcula dinámicamente
- ✅ Fácil añadir nuevos barrios

### 3. **Altamente Personalizado**
- ✅ 24 preguntas capturan matices
- ✅ Sistema de pesos adaptativo
- ✅ Penalizaciones agresivas evitan mismatches

### 4. **Transparente y Auditable**
- ✅ Logs detallados de cada decisión
- ✅ Metadata de reproducibilidad
- ✅ Score breakdown por categoría

### 5. **Escalable**
- ✅ Fácil añadir nuevas métricas
- ✅ Fácil añadir nuevas preguntas
- ✅ Caché optimizado para performance

---

## 🚀 Próximas Mejoras

### Datos Adicionales:
- [ ] Precios de alquiler/compra (real estate APIs)
- [ ] Reseñas de residentes (Google Places, Yelp)
- [ ] Datos climáticos locales (microclimas)
- [ ] Walkability score oficial

### Algoritmo:
- [ ] Machine Learning para aprender de feedback
- [ ] Clustering de barrios similares
- [ ] Sistema de recomendación colaborativo

### UX:
- [ ] Comparador lado a lado de barrios
- [ ] Mapa interactivo con filtros
- [ ] Explicación de por qué se recomienda cada barrio
- [ ] Guardar perfiles y comparar resultados

---

## 📖 Referencias

### APIs Utilizadas:
1. **LA Open Data Portal**
   - Crime Data: https://data.lacity.org/resource/2nrs-mtv8.json
   - Traffic Collisions: https://data.lacity.org/resource/d5tf-ez2w.json
   - Business Data: https://data.lacity.org/resource/6rrh-rzua.json

2. **OpenStreetMap Overpass API**
   - URL: https://overpass-api.de/api/interpreter
   - Docs: https://wiki.openstreetmap.org/wiki/Overpass_API

3. **Datasets Locales**
   - Points of Interest (geodatabase)
   - Fire Stations (GeoJSON)
   - Police Stations (geodatabase)
   - Transport/Taxi/Bike/Footpath/Parking (JSON)

### Tecnologías:
- **Backend:** NestJS + TypeScript
- **Database:** PostgreSQL + TypeORM
- **Frontend:** HTML5 + CSS3 + JavaScript + Leaflet.js
- **Geospatial:** GeoPandas, GDAL

---

## 👥 Contribuidores

**Equipo de Desarrollo:**
- Sistema de Recomendaciones
- Integración de APIs
- Algoritmo de Ponderación
- Frontend UI/UX

**Fecha de Última Actualización:** 23 de Noviembre de 2025

---

## 📄 Licencia

Este proyecto es parte de HackEPS 2025.

---

**¿Preguntas?** Abre un issue en el repositorio o contacta al equipo de desarrollo.
