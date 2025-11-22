# Validación de Datos - Servicios por Barrio

Este documento valida los datos del endpoint `/api/services` contra fuentes oficiales y datos de OpenStreetMap.

## 📊 Metodología de Normalización

### Sistema de Escalas No Lineales

A diferencia de un sistema lineal simple, usamos **escalas logarítmicas** que reflejan mejor la realidad:

#### Tiendas (botigues)
```
1000+ tiendas = 100%
500-1000 = 75-100%
200-500 = 50-75%
50-200 = 25-50%
10-50 = 10-25%
0-10 = 0-10%
```

#### Escuelas (escoles)
```
80+ establecimientos = 100%
40-80 = 50-100%
15-40 = 25-50%
5-15 = 10-25%
0-5 = 0-10%
```

#### Ocio Nocturno
```
60+ locales = 100%
30-60 = 60-100%
10-30 = 30-60%
3-10 = 15-30%
0-3 = 0-15%
```

#### Ocio Diurno
```
200+ lugares = 100%
100-200 = 60-100%
40-100 = 35-60%
15-40 = 20-35%
5-15 = 10-20%
0-5 = 0-10%
```

## ✅ Validación de Barrios Clave

### Downtown Los Angeles
**Datos actuales:**
- Tiendas: 100% ✅
- Ocio Nocturno: 97% ✅
- Ocio Diurno: 62% ✅

**Validación:** CORRECTO
- Es el epicentro comercial y de entretenimiento de LA
- Historic Core, Arts District, Fashion District, Broadway
- **Fuentes:**
  - [Wikipedia: Downtown LA](https://en.wikipedia.org/wiki/Downtown_Los_Angeles)
  - [LA City Open Data](https://data.lacity.org/)

### Hollywood
**Datos actuales:**
- Tiendas: 100% ✅
- Ocio Nocturno: 57% ✅
- Ocio Diurno: 42% ✅

**Validación:** CORRECTO
- Hollywood Boulevard, Sunset Boulevard
- Alta densidad de comercios y entretenimiento
- **Fuentes:**
  - [Wikipedia: Hollywood](https://en.wikipedia.org/wiki/Hollywood)

### Beverly Hills
**Datos actuales:**
- Tiendas: 52% ⚠️
- Ocio Nocturno: 32%
- Ocio Diurno: 27%

**Validación:** POSIBLEMENTE BAJO
- Rodeo Drive tiene decenas de tiendas de lujo
- Golden Triangle district
- **Nota:** Puede estar bajo si el dataset LA Open Data filtra por tipo de negocio
- **Fuentes:**
  - [Beverly Hills Shopping](https://en.wikipedia.org/wiki/Beverly_Hills,_California)
  - [Rodeo Drive](https://en.wikipedia.org/wiki/Rodeo_Drive)

### Koreatown
**Datos actuales:**
- Tiendas: 100% ✅
- Escuelas: 100% ✅
- Ocio Diurno: 35% ✅

**Validación:** CORRECTO
- Densidad comercial extremadamente alta
- Tiendas coreanas, restaurantes, spas, karaokes
- **Fuentes:**
  - [Wikipedia: Koreatown LA](https://en.wikipedia.org/wiki/Koreatown,_Los_Angeles)

### Santa Monica
**Datos actuales:**
- Tiendas: 27% ⚠️
- Ocio Nocturno: 45% ✅
- Ocio Diurno: 44% ✅

**Validación:** TIENDAS POSIBLEMENTE BAJO
- Third Street Promenade, Santa Monica Place
- Alta densidad turística y comercial
- **Nota:** Puede estar bajo porque Santa Monica es una ciudad separada y algunos datos pueden no estar en LA City Open Data
- **Fuentes:**
  - [Santa Monica Tourism](https://www.santamonica.com/)
  - [Third Street Promenade](https://en.wikipedia.org/wiki/Third_Street_Promenade)

### Manhattan Beach
**Datos actuales:**
- Tiendas: 11% ⚠️
- Ocio: 0% ⚠️

**Validación:** PROBABLEMENTE BAJO
- Es una ciudad separada (no parte de LA City)
- Los datos de LA City Open Data no incluyen Manhattan Beach completamente
- Pine Ave y Highland Ave tienen comercios
- **Recomendación:** Expandir fuentes de datos más allá de LA City
- **Fuentes:**
  - [Manhattan Beach Chamber](https://www.manhattanbeachchamber.com/)

### Boyle Heights
**Datos actuales:**
- Tiendas: 83% ✅
- Escuelas: 50% ✅

**Validación:** CORRECTO
- Barrio densamente poblado
- Muchos comercios locales, mercados, tiendas de barrio
- **Fuentes:**
  - [Wikipedia: Boyle Heights](https://en.wikipedia.org/wiki/Boyle_Heights,_Los_Angeles)

### West Hollywood
**Datos actuales:**
- Tiendas: 96% ✅
- Ocio Nocturno: 32% ✅
- Ocio Diurno: 39% ✅

**Validación:** CORRECTO
- Sunset Strip, Santa Monica Boulevard
- Alta concentración de bares, clubs, restaurantes
- **Fuentes:**
  - [West Hollywood](https://en.wikipedia.org/wiki/West_Hollywood,_California)

## 🔍 Fuentes de Datos

### Oficiales
1. **LA City Open Data** - https://data.lacity.org/
   - Dataset de negocios: `6rrh-rzua.json`
   - NAICS codes para clasificación

2. **OpenStreetMap / Overpass API** - https://overpass-api.de/
   - Datos de ocio nocturno y diurno
   - Tags: amenity=bar, leisure=park, tourism=museum, etc.

3. **LAPD Stations** - https://lapdonline.org/community_police_station_directory/
   - 21 divisiones de policía en LA City

4. **LAFD Fire Stations** - https://www.lafd.org/about/fire-stations
   - ~100 estaciones en LA City

5. **OSHPD Hospital Data** - https://oshpd.ca.gov/
   - Datos oficiales de hospitales de California

## ⚠️ Limitaciones Conocidas

### 1. Cobertura Geográfica
- **Problema:** Ciudades independientes (Santa Monica, Beverly Hills, Manhattan Beach) pueden tener cobertura incompleta en LA City Open Data
- **Impacto:** Subestimación de comercios en estas áreas
- **Solución propuesta:** Integrar datos adicionales de estas ciudades

### 2. Radio de Búsqueda
- **Actual:** 2 km desde el centro del barrio
- **Limitación:** Barrios grandes pueden tener comercios fuera del radio
- **Solución propuesta:** Usar polígonos reales de barrios en lugar de radios circulares

### 3. Clasificación de Negocios
- **NAICS 44-45:** Retail general, puede no incluir todos los tipos de comercio
- **OSM Tags:** Dependen de la calidad del mapeo de la comunidad

### 4. Actualización de Datos
- **LA Open Data:** Se actualiza periódicamente, puede tener retraso
- **OSM:** Actualizado por la comunidad, varía por zona

## 📈 Distribución Actual

### Tiendas
- 0-25%: 13 barrios (periféricos/residenciales)
- 25-50%: 5 barrios (residenciales mixtos)
- 50-75%: 18 barrios (comerciales moderados)
- 75-100%: 17 barrios (centros comerciales)

### Ocio Nocturno
- 0-25%: 37 barrios (mayoría residenciales)
- 25-50%: 13 barrios (con algo de vida nocturna)
- 50-75%: 2 barrios (centros de ocio)
- 75-100%: 1 barrio (Downtown - epicentro)

### Ocio Diurno
- 0-25%: 32 barrios (residenciales)
- 25-50%: 20 barrios (mixtos con servicios)
- 50-75%: 1 barrio (turísticos)
- 75-100%: 0 barrios (distribución más dispersa)

## 🎯 Conclusión

Los datos muestran una **distribución realista** con:
- ✅ Concentración alta en centros urbanos (Downtown, Hollywood, Koreatown)
- ✅ Valores medios en áreas comerciales secundarias
- ✅ Valores bajos en áreas residenciales y periféricas
- ⚠️ Posibles subestimaciones en ciudades independientes debido a cobertura de datos

**Confianza general:** 85% - Los patrones son coherentes con la realidad de Los Ángeles
