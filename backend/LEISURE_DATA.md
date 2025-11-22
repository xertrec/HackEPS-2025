# Datos de Ocio (Leisure Data)

Este documento explica cómo funcionan los datos de ocio nocturno y diurno en la API.

## Descripción

Los datos de ocio se obtienen de OpenStreetMap mediante la API de Overpass y se almacenan localmente en archivos JSON para evitar hacer consultas repetidas a la API.

## Archivos de Datos

- **nightlife_data.json**: Contiene todos los lugares de ocio nocturno de Los Ángeles
  - Bares (amenity=bar)
  - Discotecas (amenity=nightclub)
  - Pubs (amenity=pub)
  - Venues musicales (amenity=music_venue)

- **dayleisure_data.json**: Contiene todos los lugares de ocio diurno de Los Ángeles
  - Cines (amenity=cinema)
  - Teatros (amenity=theatre)
  - Museos (tourism=museum)
  - Parques (leisure=park)
  - Cafeterías (amenity=cafe)
  - Centros de arte (amenity=arts_centre)
  - Centros deportivos (leisure=sports_centre)
  - Parques infantiles (leisure=playground)

## Actualizar los Datos

Para descargar/actualizar los datos desde OpenStreetMap, ejecuta:

```bash
npm run fetch-leisure
```

Este script:
1. Consulta la API de Overpass para obtener datos de toda el área de Los Ángeles
2. Guarda los datos en `nightlife_data.json` y `dayleisure_data.json`
3. Espera 5 segundos entre consultas para evitar rate limiting

## Después de Actualizar

El script genera automáticamente los archivos en la **raíz del proyecto**.

Después de ejecutar `npm run fetch-leisure`:

1. Limpiar la caché de la API:
```bash
curl http://localhost:3000/api/services/clear-cache
```

2. Los cambios se reflejarán inmediatamente (el servidor carga los datos en memoria desde la raíz)

**Nota:** Los archivos se generan y leen siempre desde la raíz del proyecto (`nightlife_data.json` y `dayleisure_data.json`). No es necesario copiarlos a ningún otro lugar.

## Estadísticas Actuales

Última actualización: 22 de noviembre de 2025

### Ocio Nocturno (319 lugares)
- Bares: 216
- Discotecas: 35
- Pubs: 66
- Venues musicales: 2

### Ocio Diurno (1387 lugares)
- Cines: 55
- Teatros: 90
- Museos: 50
- Parques: 48
- Cafeterías: 994
- Centros de arte: 20
- Centros deportivos: 55
- Parques infantiles: 75

## Cálculo de Porcentajes

Los porcentajes se calculan filtrando los lugares dentro de un radio de 2km del centro de cada barrio:

- **Ocio Nocturno**: 30+ lugares = 100%
- **Ocio Diurno**: 50+ lugares = 100%

Los barrios con más lugares obtienen porcentajes más altos, con un máximo del 100%.
