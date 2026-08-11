# Visor de emergencia escolar

Responde una sola pregunta: a dónde mandar a alguien a mirar primero después de
un evento. El caso es el sismo M 7.4 del Chocó del 10 de agosto de 2026, que dejó
13.090 sedes educativas oficiales en MMI V o más.

El plan y las razones de cada decisión están en `docs/09_plan_visor_emergencia.md`.
Esto es solo cómo se corre.

## Correrlo

```
pnpm install
pnpm dev
```

Los datos ya están en `public/datos/`. Si hace falta regenerarlos, desde la raíz
del repositorio:

```
uv run --with pandas --with numpy --with scipy --with pyarrow --with matplotlib \
       python scripts/23_visor_datos.py
```

Ese script produce cuatro cosas:

| archivo | qué es |
|---|---|
| `evento.json` | magnitud, epicentro, profundidad y con qué se calibró el ShakeMap |
| `sedes_evento.geojson` | las 13.090 sedes en MMI V o más, con todo lo que se sabe de cada una |
| `contornos_mmi.geojson` | las isolíneas de intensidad de la grilla del USGS, cada media unidad de MMI |
| `huellas/{dane}.geojson` | los edificios de Open Buildings de cada sede en MMI VI o más |

Las huellas son 3.000 archivos y 52 MB. No van al repositorio y se cargan bajo
demanda a partir del zoom 15, nunca todas juntas. Para iterar en la
presentación sin reescribirlas cada vez, `--sin-huellas`.

## Cómo está organizada la pantalla

Mapa a pantalla completa. A la izquierda, tarjetas plegables en el orden en que
se contesta la pregunta operativa:

1. **El evento.** Qué pasó y dónde, con el pin del epicentro. El botón de
   información explica por qué bajo el epicentro la intensidad es 6,0 y el
   máximo del mapa, 6,9, cae 44 km al sureste.
2. **Daños Reportados en Instituciones Educativas (IE).** Lo que llegó de la
   ciudadanía por ChatMap y ya pasó por curaduría.
3. **Capas.** Intensidad con sus seis bandas, sedes educativas con sus filtros
   colgando (secretaría, y dentro de "más filtros" el área, la matrícula mínima
   y el quintil de riqueza) y huellas de edificio.
4. **Características de las IE antes del sismo.** La encuesta del FFIE de 2021 y
   2022 y el registro C-600 de 2024.

A la derecha, arriba: cuántas instituciones y cuántos estudiantes hay en la
selección, la descarga en CSV y el selector de mapa base (claro, oscuro, calles,
OpenStreetMap). El tema de la interfaz sigue al mapa base. Abajo a la derecha, el
zoom y un botón de inicio que devuelve la vista al encuadre original.

Las secretarías se listan de la más cercana al epicentro a la más lejana, no en
orden alfabético: quien coordina busca por dónde empezar.

La casilla de cada banda de intensidad hace dos cosas a la vez: pinta la mancha y
deja pasar sus escuelas. Es deliberado. Si el mapa pintara una zona de MMI 5,0
mientras la lista cuenta otra cosa, los dos números de la pantalla dejarían de
hablar del mismo territorio.

En la última tarjeta hay una distinción que importa. El relato ("de las 4.340
sedes seleccionadas, 1.570 fueron visitadas y de esas el 74 % declaró avería en
techos") se calcula sobre la selección **sin** los botones de esa misma tarjeta.
Si se calculara sobre lo filtrado, al elegir "nunca visitadas" diría que cero de
cero fueron visitadas y que el 0 % declaró avería. Lo que sí cambia con esos
botones es el mapa, y la tarjeta lo dice aparte.

El contorno de Colombia va en una línea negra fina, de Natural Earth 1:50m. No es
decoración: sobre el mapa claro las bandas de intensidad se comen la frontera, y
sin ella cuesta saber si una mancha cae en el mar o en Venezuela.

## Los colores

| qué | color |
|---|---|
| intensidad | degradado de verde (4,0) a rojo (6,5), a baja opacidad |
| sede educativa | pin grafito con gorro de grado; hueco si nunca fue encuestada |
| carencia (sin encuestar, sin el servicio) | violeta |
| reporte ciudadano confirmado | rojo con halo blanco |

El violeta y el grafito no están en la rampa de intensidad, así que ningún tono
significa dos cosas en el mismo mapa. Desde el zoom 9 las sedes son pines; por
debajo son puntos, porque 26.584 pines a escala nacional son una mancha.

## Hasta dónde llega el dato

La grilla del ShakeMap cubre de latitud 1,77 a 7,9 y de longitud −79,3 a −73,13,
y en ese borde el MMI todavía vale 4,8. La sacudida no se acaba ahí: se acaba el
archivo. Por eso las bandas de 4,0 y 4,5 se cortan contra una recta, y por eso
esa recta se dibuja punteada y solo aparece cuando alguna de esas dos bandas está
encendida.

## La edad del marco

El universo de sedes es el SIMAT oficial de 2022 y ya tiene cuatro años. En ese
tiempo hay escuelas que se liquidaron, se fusionaron o quedaron inactivas.
Contarlas con su matrícula de 2022 infla cualquier cifra de personas expuestas.

El C-600 de 2024 lo corrige sin necesidad de un marco nuevo: cubre 52.700 de las
52.823 sedes y declara la novedad de cada una. De ahí salen dos columnas,
`vigencia_2024` y `matricula_2024`.

De las 13.090 sedes en MMI V o más, 426 ya no operaban en 2024: 263 inactivas,
150 liquidadas, 11 duplicadas y 2 fusionadas.

El conteo de estudiantes usa la matrícula de 2024 y cae a la de 2022 solo cuando
la sede no reportó ese año, porque no reportar no es quedarse sin alumnos. El
número de la esquina dice en su título cuántas sedes de la selección están en ese
caso. En la vista que abre por defecto, la matrícula pasa de 961.350 a 915.886.

Ninguna sede se elimina del mapa por no operar. Después de un sismo, una escuela
cerrada con el edificio en pie sigue importando: puede ser albergue o puede
caerse. La vigencia es un filtro en "más filtros", no un recorte silencioso.

Lo que el C-600 no puede arreglar es el marco al revés: hay 1.617 sedes oficiales
en el C-600 de 2024 que no existen en el SIMAT de 2022, y 891 de ellas rinden
normalmente. Eso exige un SIMAT más reciente y está levantado en
`docs/10_issue_cobertura_area_class.md`.

## Reportes ciudadanos

Vienen de ChatMap (HOT), que convierte en puntos las fotos que la gente manda por
WhatsApp. La ingesta es `scripts/24_chatmap_ingesta.py`. Necesita el endpoint,
que se pone en `URL_CHATMAP` al principio del script o se pasa con `--url`.
También lee un archivo local con `--archivo`.

El script no decide nada: por cada reporte busca las cinco sedes más cercanas y
deja una fila pendiente en `data/curaduria/reportes_chatmap.csv`. Ese archivo va
al repositorio, porque es el registro de decisiones humanas y tiene que poder
auditarse.

La revisión se hace en `/triaje`, con la aplicación corriendo en local. Muestra
un reporte a la vez, la foto ciudadana contra la foto previa del FFIE, y dos
teclas: `S` si es esa escuela, `N` si no es una escuela. Las flechas cambian de
sede candidata. La ruta que escribe el CSV se niega a funcionar en producción, y
lo dice: ahí el sistema de archivos es efímero y la decisión se perdería en el
siguiente despliegue.

El mapa solo dibuja los reportes confirmados, y los dibuja en la coordenada de la
sede asignada, no en la del reporte.

## Lo que el visor no dice

El MMI es la sacudida que el modelo del USGS estima que llegó a cada punto,
calibrada con 239 reportes ciudadanos y 2 estaciones sismológicas. No es daño.
Ninguna sede de esta pantalla ha sido inspeccionada, y la advertencia está fija
en la interfaz para que nadie lea el mapa como otra cosa.

Un reporte confirmado significa que una persona miró la foto y dijo que
corresponde a esa escuela. Tampoco significa que la escuela esté dañada.

## Despliegue

`pnpm build` compila. Las dos rutas de API quedan como dinámicas: `/api/reportes`
sirve la cola ya curada y funciona en cualquier parte; `/api/triaje` solo escribe
en local.

## Publicar en Vercel

La aplicación vive en un subdirectorio del repositorio, así que en Vercel hay que
poner **Root Directory = `visor_emergencia_escolar`**. Con eso, framework
detectado (Next.js), build y salida quedan automáticos. No hay variables de
entorno ni servicios externos: no hace falta nada más.

Tres cosas que conviene saber antes de dar el botón.

**Los datos van dentro del repositorio.** `public/datos/` pesa unos 16 MB, casi
todo `sedes_evento.geojson` con las 26.584 sedes. Vercel lo sirve comprimido, así
que por la red viajan unos 4 MB. En conexión de campo eso es lento la primera vez
y luego queda en caché. Si molesta, la salida se puede recortar volviendo a subir
`MMI_MINIMO` en `scripts/23_visor_datos.py`.

**Las huellas de edificio no se publican.** Son 2.995 archivos y 58 MB, están
ignoradas en git, y esa capa quedará vacía en producción aunque el interruptor
aparezca. Publicarlas exigiría empaquetarlas de otra forma (vector tiles), que es
trabajo aparte.

**El triaje solo funciona en local.** `/api/triaje` escribe en
`data/curaduria/reportes_chatmap.csv`, que está fuera del directorio desplegado y
además en Vercel el sistema de archivos es de solo lectura. La ruta se niega en
producción y lo dice. Lo que sí viaja es `public/datos/reportes.json`, que trae
únicamente los reportes ya confirmados y se regenera con cada decisión de triaje y
con cada corrida del script 24. Flujo: se tría en local, se hace commit del CSV y
del JSON, y el despliegue muestra lo confirmado.

Los pendientes y los descartados nunca salen: son fotos de personas que todavía
nadie ha revisado.
