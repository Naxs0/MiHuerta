# Mi Huerta 🌱

App para Android que, según el cultivo, el lugar y el clima, te dice **cómo regar, cómo nutrir y qué plagas vigilar**.

## Qué hace

- **39 cultivos**: verduras, legumbres, hierbas y frutales (palto, cítricos, manzano, cerezo, parra, arándano, frambuesa, olivo…).
- **Ubicación** por GPS o eligiéndola en un mapa (con vista satelital y buscador).
- **Zona y clima automáticos** con datos reales del lugar (Open-Meteo), o **manual** eligiendo la zona.
- **Pronóstico de 7 días** con alertas de heladas, calor, viento y lluvia.
- **Riego (método FAO)**: evapotranspiración × coeficiente del cultivo, menos la lluvia; frecuencia según el suelo y la raíz; litros por planta y minutos de goteo.
- **Nutrición**: necesidad total de N, P, K, Ca y Mg; programa por etapa con productos y dosis; fósforo (MAP); microelementos foliares; corrección de pH; equivalente orgánico; fertirriego; guía de deficiencias.
- **Plagas y enfermedades**, con control natural y químico, y aviso de riesgo de hongos según la zona.
- **Copia de seguridad en Google Drive**, automática, con restauración si borras la app.
- **Aviso de nueva versión**: la app revisa los *releases* de este repositorio.

## Instalar en Android

1. Descarga `MiHuerta.apk` desde [Releases](https://github.com/Naxs0/MiHuerta/releases/latest).
2. Ábrelo en el celular. Si lo pide, permite "Instalar apps desconocidas".
3. Toca **Instalar** (o **Actualizar** si ya la tenías).

## Publicar una nueva versión

1. Sube el número en `android/version.properties` (`VERSION_CODE` +1 y `VERSION_NAME`).
2. Escribe las novedades en `android/NOVEDADES.md`.
3. En Git Bash: `bash android/publicar.sh`

Esto compila, sube el código y crea el *release* con el APK. Las apps instaladas mostrarán el aviso "Nueva versión disponible".

> ⚠️ Guarda una copia de `android/mihuerta.keystore` (no se sube a GitHub). Es la firma de la app: sin ella las actualizaciones no se instalan encima.

## Compilar

Requiere JDK y las herramientas de Android en `F:\android-sdk` (build-tools 35 y plataforma android-35):

```
bash android/build.sh
```

## Estructura

| Archivo | Contenido |
|---|---|
| `data.js` | Cultivos, zonas, fertilizantes, microelementos, plagas |
| `calc.js` | Cálculo de etapas, riego y nutrición |
| `clima.js` | GPS, mapa, clima de la ubicación y pronóstico |
| `respaldo.js` | Copia en Google Drive y aviso de versiones |
| `app.js` | Pantallas |
| `android/` | App nativa (WebView) y scripts de compilación |

Las dosis son de referencia; lo ideal es complementarlas con un análisis de suelo.
