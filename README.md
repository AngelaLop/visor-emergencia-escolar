# Visor de emergencia escolar

Responde una sola pregunta: a dónde mandar a alguien a mirar primero después de
un evento. El caso es el sismo M 7.4 del Chocó del 10 de agosto de 2026, que dejó
13.093 sedes educativas oficiales en MMI V o más.

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
| `sedes_evento.geojson` | las 26.591 sedes desde MMI 4,0, con todo lo que se sabe de cada una. De ellas, 13.093 están en MMI V o más |
| `contornos_mmi.geojson` | las isolíneas de intensidad de la grilla del USGS, cada media unidad de MMI |
| `huellas/{dane}.geojson` | los edificios de Open Buildings de cada sede en MMI VI o más |

Las huellas son 3.004 archivos y 53 MB. No van al repositorio y se cargan bajo
demanda a partir del zoom 15, nunca todas juntas. Para iterar en la
presentación sin reescribirlas cada vez, `--sin-huellas`.

Los daños reportados salen de otro script, porque su fuente son los archivos de
curaduría y no la base maestra:

```
uv run --with pandas --with numpy --with pyarrow \
       python scripts/27_danos_reportados.py
```

## Cómo está organizada la pantalla

Mapa a pantalla completa. A la izquierda, tarjetas plegables en el orden en que
se contesta la pregunta operativa:

1. **El evento.** Qué pasó y dónde, con el pin del epicentro. El botón de
   información explica por qué bajo el epicentro la intensidad es 6,0 y el
   máximo del mapa, 6,9, cae 44 km al sureste.
2. **Daños Reportados en Sedes Educativas (SE).** Lo que llegó de la
   ciudadanía por ChatMap y ya pasó por curaduría.
3. **Capas.** Intensidad con sus seis bandas, sedes educativas con sus filtros
   colgando (secretaría, y dentro de "más filtros" el área, la matrícula mínima
   y el quintil de riqueza) y huellas de edificio.
4. **Características de las SE antes del sismo.** La encuesta del FFIE de 2021 y
   2022 y el registro C-600 de 2024.

A la derecha, arriba: cuántas sedes educativas y cuántos estudiantes hay en la
selección, la descarga en CSV y el selector de mapa base (claro, oscuro, calles,
OpenStreetMap). El tema de la interfaz sigue al mapa base. Abajo a la derecha, el
zoom y un botón de inicio que devuelve la vista al encuadre original.

Las secretarías se listan de la más cercana al epicentro a la más lejana, no en
orden alfabético: quien coordina busca por dónde empezar.

La casilla de cada banda de intensidad hace dos cosas a la vez: pinta la mancha y
deja pasar sus escuelas. Es deliberado. Si el mapa pintara una zona de MMI 5,0
mientras la lista cuenta otra cosa, los dos números de la pantalla dejarían de
hablar del mismo territorio.

En la última tarjeta hay una distinción que importa. El relato ("de las 4.350
sedes seleccionadas, 1.571 fueron visitadas") se calcula sobre la selección
**sin** los botones de esa misma tarjeta. Si se calculara sobre lo filtrado, al
elegir "nunca visitadas" diría que cero de cero fueron visitadas. Lo que sí
cambia con esos botones es el mapa, y la tarjeta lo dice aparte.

El contorno de Colombia va en una línea negra fina, de Natural Earth 1:50m. No es
decoración: sobre el mapa claro las bandas de intensidad se comen la frontera, y
sin ella cuesta saber si una mancha cae en el mar o en Venezuela.

## Los colores

| qué | color |
|---|---|
| intensidad | degradado de verde (4,0) a rojo (6,5), a baja opacidad |
| sede educativa | pin grafito con gorro de grado; hueco si nunca fue encuestada |
| índice de vulnerabilidad, en la vista de visitadas | rampa lila de cinco tramos, la misma de la leyenda |
| carencia de servicio (sin energía, sin internet) | violeta |
| registro fotográfico HOT | rojo `#b3261e` con halo blanco |
| reporte oficial | azul `#1558a6` con halo blanco |
| noticia | magenta `#b5177e` con halo blanco |

El violeta y el grafito no están en la rampa de intensidad, así que ningún tono
significa dos cosas en el mismo mapa. Desde el zoom 9 las sedes son pines; por
debajo son puntos, porque 26.591 pines a escala nacional son una mancha.

El naranja quedó descartado para las noticias aunque pareciera el candidato
obvio. `--sede-ignota` ya es naranja y significa "nunca fue encuestada", y el
choque no era teórico: la sede que colapsó en Calima El Darién es justamente una
que nadie visitó nunca, así que su ficha habría tenido dos naranjas al lado, uno
diciendo que no se sabe nada de ella y otro diciendo que se cayó. El azul y el
magenta son los únicos tonos que quedan fuera de la rampa y fuera del violeta.

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

De las 13.093 sedes en MMI V o más, 426 ya no operaban en 2024: 263 inactivas,
150 liquidadas, 11 duplicadas y 2 fusionadas.

El conteo de estudiantes usa la matrícula de 2024 y cae a la de 2022 solo cuando
la sede no reportó ese año, porque no reportar no es quedarse sin alumnos. El
número de la esquina dice en su título cuántas sedes de la selección están en ese
caso. En la vista que abre por defecto, la matrícula pasa de 963.176 a 917.602.

Ninguna sede se elimina del mapa por no operar. Después de un sismo, una escuela
cerrada con el edificio en pie sigue importando: puede ser albergue o puede
caerse. La vigencia es un filtro en "más filtros", no un recorte silencioso.

Lo que el C-600 no puede arreglar es el marco al revés: hay 1.617 sedes oficiales
en el C-600 de 2024 que no existen en el SIMAT de 2022, y 891 de ellas rinden
normalmente. Eso exige un SIMAT más reciente y está levantado en
`docs/10_issue_cobertura_area_class.md`.

## El índice de vulnerabilidad declarada

Lo construye `scripts/25_indice_vulnerabilidad.py` y va de 0 a 5. Es el promedio
simple de tres elementos que pesan igual: techos, muros y pisos.

La encuesta del FFIE no preguntó gravedad, preguntó qué problemas hay, con
casillas que se marcan a la vez. Cada elemento ofrece condiciones de deterioro
(agrietado, humedad, material en mal estado) y estructurales (derruido,
incompleto, inclinado, hundido). Un elemento vale 0 si el rector lo declaró en
buen estado, y si no, `1 + 1 × (deterioro marcado / disponible) + 3 ×
(estructural marcado / disponible)`.

Se divide por lo disponible en cada elemento porque techos y muros ofrecen dos
casillas de deterioro y una estructural, y pisos al revés. Esa asimetría es del
formulario, no de las escuelas.

Los pesos 1 y 3 sostienen una propiedad que el script comprueba en cada corrida:
**por elemento**, el máximo sin daño estructural es 2 y el mínimo con daño
estructural es 2,5, así que un puntaje de elemento de 2,5 o más significa
siempre que hay algo estructural comprometido.

El índice de la sede, en cambio, mide cuánto daño se declaró en total y no de
qué tipo. Dos sedes con el mismo puntaje pueden haber llegado ahí por caminos
distintos: una con el piso hundido y lo demás sano, otra con los tres elementos
deteriorados sin nada estructural. Las dos son daño y por eso puntúan parecido.
Cuál de las dos es se ve en la ficha de la sede, que trae los tres elementos por
separado y nombra el que tenga compromiso estructural.

En la vista de visitadas el mapa pinta cada sede con el tono de su tramo, la
misma rampa lila que muestra la leyenda de la tarjeta. Los dos definen su color
en un solo sitio, `TONO_IVID` en `lib/datos.ts`, para que un retoque no deje la
leyenda diciendo una cosa y el mapa pintando otra. Como los dos tramos claros son
lila pálido y a escala nacional un punto de dos píxeles en lila pálido sobre la
mancha de intensidad no se ve, en esa vista cada punto lleva un anillo de
contraste.

Las nunca visitadas van en grafito y no en el violeta de carencia. La rampa del
índice es de esa misma familia y sus tramos altos quedan a los lados del violeta,
así que el mismo tono habría significado "índice alto" y "nunca visitada" a un
clic de distancia. No se pierde nada: esas sedes ya tienen su propio canal, el
pin hueco de cerca y el punto casi transparente de lejos.

El filtro del mapa corta en tramos de una unidad sobre el propio índice, que es
lo que lo hace legible sin explicación: 0 a 0,99, 1 a 1,99, y así hasta 4 a 5.
En el país, esos tramos reparten las 15.150 sedes en 21,9 %, 31,8 %, 23,7 %,
11,6 % y 11,1 %.

Distribución de las 15.150 sedes con índice: 10,3 % en 0, 25,5 % hasta 1,5,
30,6 % hasta 2,5, 17,6 % hasta 3,5, 8,4 % hasta 4,5 y 7,5 % por encima. Media
1,99 y mediana 1,83.

La ficha técnica completa está en la pantalla, detrás del botón de información
de esa sección, y su texto vive en `FICHA_IVID` (`lib/datos.ts`). Si el script 25
cambia, ese texto cambia con él.

No es una inspección. Es una declaración administrativa puesta en orden, hecha
por el rector sobre su propia sede, sin foto y frente a un fondo de
infraestructura, y anterior al sismo.

## Daños reportados: tres fuentes, tres colores

La tarjeta de daños tiene tres emisores y no dicen lo mismo. Por eso no comparten
símbolo. Los une `scripts/27_danos_reportados.py` en `public/datos/danos.json`, a
partir de tres archivos de curaduría que se editan a mano y se versionan, porque
son el registro de decisiones humanas.

| fuente | qué afirma | archivo |
|---|---|---|
| registro fotográfico HOT | que una persona emparejó una foto con esa sede, nada más | `data/curaduria/reportes_chatmap.csv` |
| reporte oficial | daño de una **institución**, o sea de un grupo de sedes | `data/curaduria/reportes_oficiales.csv` |
| noticia | lo que declaró una autoridad, con nombre, cargo y cita | `data/curaduria/reportes_noticias.csv` |

Los estados son cuatro y cerrados: **colapso**, **daño**, **sin daño** y **sin
verificar**. Las sedes en "sin daño" no se dibujan ni se listan, porque esta capa
es de daños reportados y un punto que significa "ya preguntamos y está bien" solo
le quita espacio al que significa que se cayó. Pero el dato no se pierde: queda
en el archivo y la ficha de esa sede lo muestra. Que alguien haya mirado y no
haya encontrado nada es información, y borrarla obliga a volver a preguntar. Hoy
son 23 sedes del reporte del PTIES.

Una sede es una fila, no una por declaración. En Calima El Darién hablaron el
alcalde y la rectora sobre el mismo predio; la lista muestra la declaración más
grave y la ficha las muestra todas.

Hay una distinción que atraviesa todo y es la razón de que exista el campo
`alcance`. El reporte del PTIES del 10 de agosto nombra instituciones y no trae
un solo código DANE. Una institución agrupa varias sedes, que en ese reporte
llegan a estar a 45,7 km unas de otras, así que "la IEM X presentó daños" no
alcanza para pintar un predio. Esas sedes se marcan todas, con `alcance` de
institución, y tanto el globo del mapa como la ficha dicen en cuántas sedes puede
estar el daño. De los 77 casos del reporte oficial, **ninguno** identifica la
sede. La única fuente que hasta hoy afirma el daño de una sede con nombre propio
es la noticia.

La capa respeta el alcance de la pantalla, igual que todo lo demás. Un reporte se
dibuja solo si su sede tiene coordenada, tiene banda de intensidad, esa banda
está encendida y llega al menos a 5,5. Prender una banda pinta la mancha y deja
pasar sus escuelas, y esta capa no puede ser la excepción: si el mapa dibujara el
reporte de una sede en MMI 4,9 con la pantalla filtrada en 6,0, estaría mostrando
un punto de un territorio que la selección dejó fuera.

El piso de 5,5 es un juicio y está pendiente de confirmar. Hasta 5,0 el USGS
describe un sismo que se siente y que tumba objetos de los estantes, no que
agriete un edificio, así que un daño reportado ahí es más probable que sea
deterioro previo que alguien miró por primera vez después del sismo. Hoy saca un
solo caso, las ocho sedes de la IEM Pablo VI en López de Micay, que están entre
MMI 4,95 y 5,07. El corte va en 5,5 y no en 5,0 porque en 5,0 quedaba una sola de
las ocho dentro, y el reporte del PTIES habla de la institución y no de ese
predio: o entran las ocho o no entra ninguna.

Eso deja fuera dos grupos, y la tarjeta dice cuántos son en vez de callarlos. Doce
sedes están en bandas que la vista por defecto tiene apagadas y aparecen al
prenderlas. Otras treinta, las de la Normal Superior La Inmaculada en Barbacoas,
quedan fuera de la grilla del ShakeMap: están a 409 km del epicentro y a 10 km al
sur del borde del archivo del USGS, así que no tienen intensidad estimada, no
figuran en `sedes_evento.geojson` y no entran en ningún conteo de la pantalla. El
punto de grilla más cercano a Barbacoas vale MMI 4,10. No se dibujan porque el
mapa no puede situarlas en una banda que no existe, pero siguen enteras en
`danos.json` y en su ficha.

Aun así cada daño lleva su propia coordenada en el archivo, y no la de la
colección de sedes. Es lo que permite abrir la ficha de una sede que el visor no
tiene en su universo, como las de Barbacoas, cuando se llega a ella desde otro
lado.

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

Un reporte confirmado de ChatMap significa que una persona miró la foto y dijo
que corresponde a esa escuela. Tampoco significa que la escuela esté dañada.

Lo que sí cambió es que el visor ya afirma daño en algunos puntos, y lo hace bajo
una condición: siempre dice quién lo afirmó, cuándo y con qué palabras. La ficha
muestra la cita textual y el nombre y cargo de quien la dijo. Un punto que afirma
un colapso sin poder mostrar la frase exacta y de quién es no está informando,
está repitiendo.

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

**Los datos van dentro del repositorio.** `public/datos/` pesa 19,6 MB sin contar
las huellas, casi todo `sedes_evento.geojson` con las 26.591 sedes. Vercel lo
sirve comprimido y ese archivo baja a 1,5 MB con gzip. En conexión de campo eso
es lento la primera vez y luego queda en caché. Si molesta, la salida se puede
recortar volviendo a subir `MMI_MINIMO` en `scripts/23_visor_datos.py`.

**Las huellas de edificio no se publican.** Son 3.004 archivos y 53 MB, están
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
