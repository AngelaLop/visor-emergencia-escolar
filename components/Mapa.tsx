"use client";

/** El mapa. Todo lo demas del visor son tarjetas flotando encima, a la
 * izquierda, al estilo de un mapa de navegacion.
 *
 * Decisiones de codificacion visual, que no son de gusto:
 *
 *  - La intensidad va como degradado continuo del epicentro hacia afuera, de
 *    rojo a verde. Es la convencion con la que se publica una intensidad y es
 *    lo que hace que se lea de un vistazo hacia donde crece. Va a poca opacidad
 *    porque es contexto: el dato que se mira son las sedes.
 *  - Donde la banda se corta contra el borde de la grilla del USGS se dibuja
 *    una linea punteada. Esa recta es el final del archivo, no el final del
 *    temblor: en ese borde el MMI todavia vale 4,8. Sin decirlo, el mapa
 *    afirmaria una frontera del terreno que no existe.
 *  - Las sedes son pines con gorro de grado desde el zoom 9, y puntos por
 *    debajo. Veintiseis mil pines a escala nacional son una mancha.
 *  - El pin hueco es la sede que nunca fue encuestada. Es el hallazgo del
 *    proyecto y tiene su propio canal, aparte del color.
 *  - El color de la sede no compite con el degradado: grafito por defecto,
 *    violeta para la carencia de servicio y la rampa lila del indice de
 *    vulnerabilidad en la vista de visitadas. Ninguno de esos tonos esta en la
 *    rampa de intensidad.
 *  - Los danos reportados van en tres colores, uno por emisor, y los tres con
 *    halo blanco, que ninguna banda tiene. El color dice quien lo afirma. Ver
 *    COLOR_FUENTE.
 *  - Todos los puntos de dano son del mismo tamano. El colapso se dibujo mas
 *    grande durante un tiempo y no funciono: no se lee como "esto es mas grave",
 *    se lee como que el mapa dibuja mal, porque no hay leyenda de tamanos y dos
 *    puntos del mismo color a dos tamanos distintos parecen un defecto. Lo que
 *    separa el colapso es la casilla "Colapso" de la tarjeta de danos, que aisla
 *    los 21 casos, y el estado escrito en el globo y en la ficha.
 */

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

import { cargaHuellas, miles, TONO_IVID } from "@/lib/datos";
import { BANDAS, GRAVEDAD, NOMBRE_ESTADO, NOMBRE_FUENTE } from "@/lib/tipos";
import type { EstadoDano } from "@/lib/tipos";
import type {
  Dano,
  Evento,
  Filtros,
  MapaBase,
  RasgoSede,
  Tema,
} from "@/lib/tipos";

const ESTILO: Record<MapaBase, string | maplibregl.StyleSpecification> = {
  claro: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  oscuro: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  calles: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  // OSM no publica un estilo vectorial libre, asi que va como teselas raster.
  osm: {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        maxzoom: 19,
        attribution: "&copy; OpenStreetMap",
      },
    },
    layers: [{ id: "osm", type: "raster", source: "osm" }],
  },
};

/** La vista inicial, a la que vuelve el boton de inicio. */
const VISTA_INICIAL = { center: [-76.0, 4.6] as [number, number], zoom: 6.3 };

// Grafito por defecto: mientras nadie pregunte nada, el punto no afirma nada.
export const BASE = { claro: "#33414d", oscuro: "#d7dee4" };
// La carencia. Violeta y no naranja porque el naranja ya es una banda de
// intensidad, y un tono no puede significar dos cosas en el mismo mapa.
export const CARENCIA = { claro: "#4a3aa7", oscuro: "#9085e9" };
export const REPORTE = "#b3261e";

/** Un color por emisor de reporte, no por gravedad.
 *
 * La rampa de intensidad ocupa medio circulo cromatico, de verde a rojo pasando
 * por amarillo y naranja, asi que los tonos libres son pocos y hay que gastarlos
 * con cuidado.
 *
 * El naranja quedo descartado aunque parezca el candidato obvio: `--sede-ignota`
 * ya es naranja y significa "nunca fue encuestada". Y no es un choque teorico.
 * La sede que colapso en Calima El Darien es justamente una que nadie visito
 * nunca, asi que su ficha tendria dos naranjas al lado, uno diciendo que no se
 * sabe nada de ella y otro diciendo que se cayo.
 *
 * El magenta duro un tiempo en `noticia` y no servia. Contra el rojo de HOT, que
 * es el emisor con mas puntos en el mapa, los dos tonos tienen la misma
 * luminosidad y la misma temperatura, y a 6 pixeles de radio con halo blanco se
 * vuelven el mismo punto. Se noto mirando la leyenda, no el mapa: en la leyenda
 * estan uno al lado del otro y aun asi hay que acercarse.
 *
 * `noticia` pasa al turquesa, que es el unico hueco grande que queda. La rampa
 * de intensidad va de verde a rojo por el lado calido, asi que el cian no choca
 * con ninguna banda; contra el azul de `oficial` se separa por saturacion y
 * brillo, y contra el rojo de HOT esta en el lado opuesto del circulo.
 *
 * Los tres van con halo blanco porque sobre la mancha de intensidad cualquier
 * tono solido se pierde.
 */
export const COLOR_FUENTE: Record<string, string> = {
  hot: REPORTE,
  oficial: "#1558a6",
  noticia: "#0aa2b8",
};

/** El degradado de intensidad, de la banda mas lejana a la del epicentro. */
export const COLOR_BANDA: Record<number, string> = {
  4.0: "#3f9e5a",
  4.5: "#86b544",
  5.0: "#d4c13f",
  5.5: "#e8a33d",
  6.0: "#dd7134",
  6.5: "#c93b2f",
};

const VACIA = { type: "FeatureCollection", features: [] } as const;

// Mas de esto en pantalla a la vez son cientos de peticiones y ninguna mejora
// de lectura: a ese zoom no caben mas escuelas en la ventana.
const MAX_HUELLAS_VISIBLES = 20;
// Debajo de este zoom los pines se encinman y el mapa deja de leerse.
const ZOOM_PIN = 9;

type Props = {
  contornos: unknown | null;
  bordeGrilla: unknown | null;
  evento: Evento | null;
  sedes: RasgoSede[];
  danos: Dano[];
  /** Los DANE con algun reporte, para que el filtro de la lista los distinga. */
  danesConReporte: string[];
  colombia: unknown | null;
  filtros: Filtros;
  capas: Capas;
  mapaBase: MapaBase;
  tema: Tema;
  seleccion: string | null;
  /** La sede a la que hay que volar. El contador hace que tocar dos veces la
   *  misma tarjeta vuelva a mover el mapa. */
  foco: { dane: string; n: number } | null;
  onSeleccion: (dane: string | null) => void;
};

type Expr = maplibregl.ExpressionSpecification;

/** Que se dibuja encima del mapa base. Lo maneja la tarjeta de capas. */
export type Capas = {
  intensidad: boolean;
  sedes: boolean;
  reportes: boolean;
  huellas: boolean;
  /** Que estados de la capa de daños se dibujan.
   *
   * Un reporte contesta dos preguntas encadenadas: si alguien fue a mirar y
   * que encontro. Los cuatro estados las mezclaban en una lista plana, y por
   * eso no habia por donde filtrar. Separadas, "inspeccionadas" deja de ser una
   * categoria y pasa a ser la suma de las dos primeras casillas.
   *
   * Abre solo con daño. Una escuela que alguien reviso y encontro bien no se
   * pinta en un mapa de daños hasta que se pida, y la que tiene foto
   * emparejada pero nadie evaluo, tampoco: ninguna de las dos afirma daño. */
  estadosDano: EstadoDano[];
  /** Si la capa de daños ignora el recorte de intensidad.
   *
   * Apagado, que es como abre, un punto de daño solo se dibuja si su sede cae en
   * las bandas encendidas. Es lo que hace que el mapa cuente una sola cosa: la
   * mancha de intensidad, las escuelas y los reportes hablan del mismo
   * territorio, y el número de la tarjeta cuadra con lo que se ve.
   *
   * Encendido, se dibujan todos. Existe porque el reporte no es una salida del
   * modelo, es una fuente afirmando que esa escuela se dañó, y hay 91 sedes con
   * reporte fuera de las dos bandas con las que abre el visor. Cinco de ellas ni
   * siquiera tienen banda, porque caen fuera de la grilla del ShakeMap. Sin esta
   * opción no había ningún camino para llegar a ellas.
   *
   * Va apagado por defecto y no al revés. Estuvo al revés un rato y no funcionó:
   * los puntos aparecían sobre el mapa base pelado, sin mancha debajo, y eso no
   * se lee como "aquí hay un reporte que el modelo no explica", se lee como que
   * el mapa está mal dibujado. Ver la casilla "ver todas las sedes
   * reportadas" en la tarjeta de daños. */
  danosTodasLasBandas: boolean;
};

export const CAPAS_INICIALES: Capas = {
  intensidad: true,
  sedes: true,
  reportes: true,
  huellas: true,
  estadosDano: ["colapso", "dano"],
  danosTodasLasBandas: false,
};

/** El color dice lo que pregunta la pestana activa, y nada mas.
 *
 * En la pestana de infraestructura el color es grafito siempre, salvo cuando se
 * pide el indice y entonces manda la rampa de `TONO_IVID`. Las nunca visitadas
 * van grafito y no violeta, aunque el violeta sea el tono de la carencia en el
 * resto del visor: la rampa del indice es de la misma familia, y sus dos tramos
 * altos, #6754c0 y #3d2c94, quedan a los lados del violeta de carencia #4a3aa7.
 * Con eso, pasar de "visitadas" a "nunca visitadas" cambiaba de un violeta a
 * otro y el mismo tono acababa significando "indice alto" y "nunca visitada" en
 * la misma pestana, a un clic de distancia.
 *
 * No se pierde nada: la sede nunca visitada ya tiene su propio canal, que es el
 * pin hueco de cerca y el punto casi transparente de lejos. La forma dice lo que
 * el color deja de decir.
 */
function colorSede(f: Filtros, tema: Tema): string {
  if (f.tab === "servicios") {
    const falta =
      f.energia === "sin" || f.internet === "sin" ||
      (f.energia === "todas" && f.internet === "todas");
    return falta ? CARENCIA[tema] : BASE[tema];
  }
  return BASE[tema];
}

/** Si el mapa pinta cada sede con el tono de su indice de vulnerabilidad.
 *
 * Solo en la vista de visitadas, que es exactamente cuando la tarjeta muestra la
 * leyenda de los cinco tramos. Fuera de ahi el punto vuelve al grafito: mientras
 * nadie pregunte por el estado declarado, no tiene que afirmar nada. Y es
 * tambien la unica vista donde todas las sedes en juego tienen indice.
 */
function pintaPorIvid(f: Filtros): boolean {
  return f.tab === "fisica" && f.fisica === "encuestadas";
}

/** Los cortes son los mismos de `categoriaIvid`: 0, 1, 2, 3 y 4 o mas.
 *
 * `has` antes del `step` no sobra. El script 23 omite la propiedad cuando la
 * sede no tiene indice, y un `step` sobre una propiedad ausente no evalua. Esas
 * sedes se quedan en el color plano, que es lo correcto: no tener indice es no
 * haber sido visitada, y eso no es un tramo de la rampa.
 */
function colorIvid(plano: string): Expr {
  return [
    "case",
    ["has", "ivid"],
    [
      "step", ["get", "ivid"],
      TONO_IVID[0],
      1, TONO_IVID[1],
      2, TONO_IVID[2],
      3, TONO_IVID[3],
      4, TONO_IVID[4],
    ],
    plano,
  ] as Expr;
}

/** El mismo corte, pero devolviendo el nombre de la imagen del pin. */
function pinIvid(): Expr {
  return [
    "case",
    ["has", "ivid"],
    [
      "step", ["get", "ivid"],
      "pin-ivid-0",
      1, "pin-ivid-1",
      2, "pin-ivid-2",
      3, "pin-ivid-3",
      4, "pin-ivid-4",
    ],
    "pin-lleno",
  ] as Expr;
}

/** Dibuja el pin con gorro de grado y lo registra como imagen del mapa.
 *
 * Se generan en el navegador y no se traen como archivo por una razon simple:
 * el color depende de la pregunta activa y del tema, y una imagen por
 * combinacion son ocho archivos que habria que mantener sincronizados con la
 * paleta. Dibujarlos aqui deja el color en un solo sitio.
 */
function creaPin(color: string, hueco: boolean): ImageData {
  const R = 2; // densidad, para que no se vea pixelado
  const w = 26 * R;
  const h = 34 * R;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d")!;
  x.scale(R, R);

  // La gota: circulo arriba y punta abajo.
  const cx = 13;
  const cy = 13;
  const r = 10;
  x.beginPath();
  x.arc(cx, cy, r, Math.PI * 0.82, Math.PI * 0.18);
  x.lineTo(cx, 32);
  x.closePath();

  if (hueco) {
    x.fillStyle = "#ffffff";
    x.fill();
    x.strokeStyle = color;
    x.lineWidth = 2.4;
    x.stroke();
  } else {
    x.fillStyle = color;
    x.fill();
    x.strokeStyle = "#ffffff";
    x.lineWidth = 1.2;
    x.stroke();
  }

  // El gorro de grado: rombo por tabla y una borla corta.
  const tinta = hueco ? color : "#ffffff";
  x.fillStyle = tinta;
  x.strokeStyle = tinta;
  x.lineWidth = 1.2;
  x.beginPath();
  x.moveTo(cx, 8);
  x.lineTo(cx + 6.5, 11.5);
  x.lineTo(cx, 15);
  x.lineTo(cx - 6.5, 11.5);
  x.closePath();
  x.fill();
  x.beginPath();
  x.moveTo(cx - 3.6, 13.2);
  x.lineTo(cx - 3.6, 16.5);
  x.lineTo(cx + 3.6, 16.5);
  x.lineTo(cx + 3.6, 13.2);
  x.stroke();

  return x.getImageData(0, 0, w, h);
}

export default function Mapa({
  contornos,
  bordeGrilla,
  colombia,
  evento,
  sedes,
  danos,
  danesConReporte,
  filtros,
  capas,
  mapaBase,
  tema,
  seleccion,
  foco,
  onSeleccion,
}: Props) {
  const div = useRef<HTMLDivElement>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const listo = useRef(false);
  const cacheHuellas = useRef(new Map<string, unknown>());
  const marcaEpicentro = useRef<maplibregl.Marker | null>(null);
  // Cambiar de tema recarga el estilo entero y con el se van todas las fuentes,
  // asi que hay que poder volver a montarlas con los datos que hubiera.
  const datos = useRef({ contornos, bordeGrilla, colombia, sedes,
    danos, danesConReporte, filtros, capas, tema });
  datos.current = { contornos, bordeGrilla, colombia, sedes,
    danos, danesConReporte, filtros, capas, tema };
  const alClic = useRef(onSeleccion);
  alClic.current = onSeleccion;

  /** Un punto por sede con reporte, no uno por reporte.
   *
   * En Calima El Darien hablaron el alcalde y la rectora: son dos
   * declaraciones sobre el mismo predio y dibujarlas apiladas no agrega nada y
   * confunde el clic. Se queda la mas grave, que es la que decide el color y el
   * tamano. La ficha si las muestra todas.
   *
   * La coordenada sale del propio dano y no de la coleccion de sedes, porque
   * hay dano reportado fuera de la grilla del ShakeMap: las 30 sedes de la
   * Normal Superior La Inmaculada, en Barbacoas, no tienen MMI y no estan en
   * `sedes_evento.geojson`.
   */
  function rasgosDano() {
    const peor = new Map<string, Dano>();
    for (const d of datos.current.danos) {
      const y = peor.get(d.dane);
      if (!y || GRAVEDAD[d.estado] > GRAVEDAD[y.estado]) peor.set(d.dane, d);
    }
    // Fuera las que no tienen coordenada. Son 5 sedes de Manizales cuyo
    // `lat`/`lon` es nulo en el directorio, y el script 27 ya las cuenta como
    // no dibujables. Sin este filtro entraban a la fuente GeoJSON con
    // `coordinates: [null, null]`, que MapLibre acepta sin quejarse y deja el
    // punto en un sitio que no existe.
    const bandas = datos.current.filtros.bandas;
    return [...peor.values()].filter((d) => d.lon != null && d.lat != null)
      .map((d) => ({
      type: "Feature" as const,
      properties: {
        id: d.id,
        dane: d.dane,
        sede: d.sede,
        mpio: d.mpio,
        fuente: d.fuente,
        estado: d.estado,
        alcance: d.alcance,
        matricula: d.matricula,
        quien: d.quien,
        n_sedes_institucion: d.n_sedes_institucion ?? 1,
        // Si la sede cae en las bandas de intensidad que estan encendidas.
        //
        // No filtra, atenua. Es el punto medio entre las dos cosas que la capa
        // tiene que hacer a la vez y que se estorban: el reporte es evidencia y
        // no puede desaparecer porque el modelo diga que ahi no sacudio fuerte,
        // pero el control de bandas tiene que servir para algo, y con la capa
        // ignorandolo por completo no habia forma de preguntar cuales de las
        // sedes en MMI 6,0 y mas tienen reporte.
        //
        // Atenuado quiere decir que el punto sigue estando y se lee que esta
        // fuera del recorte. Las sedes sin banda, que son las que caen fuera de
        // la grilla del ShakeMap, nunca estan dentro: de esas el modelo no dice
        // nada, asi que ninguna seleccion de bandas las incluye.
        en_seleccion: d.banda != null && bandas.includes(d.banda),
      },
      geometry: {
        type: "Point" as const,
        coordinates: [d.lon, d.lat] as [number, number],
      },
    }));
  }

  function registraPines(m: maplibregl.Map, color: string) {
    for (const [nombre, hueco] of [["pin-lleno", false], ["pin-hueco", true]] as
      [string, boolean][]) {
      if (m.hasImage(nombre)) m.removeImage(nombre);
      m.addImage(nombre, creaPin(color, hueco), { pixelRatio: 2 });
    }
    // Un pin por fuente de reporte. La escuela con dano no lleva un punto al
    // lado: lleva su propio icono del color de quien lo reporto. Un circulo
    // encima del pin se perdia, porque el pin crece hacia arriba desde la
    // coordenada y el circulo quedaba en la punta, compitiendo con los pines
    // vecinos.
    for (const [f, c] of Object.entries(COLOR_FUENTE)) {
      const nombre = `pin-${f}`;
      if (m.hasImage(nombre)) m.removeImage(nombre);
      m.addImage(nombre, creaPin(c, false), { pixelRatio: 2 });
    }
    // Un pin por tramo del indice de vulnerabilidad. La leyenda de la tarjeta
    // pinta cinco casillas de colores y el mapa tiene que pintar lo mismo, o la
    // leyenda no es leyenda de nada.
    for (const [c, tono] of Object.entries(TONO_IVID)) {
      const nombre = `pin-ivid-${c}`;
      if (m.hasImage(nombre)) m.removeImage(nombre);
      m.addImage(nombre, creaPin(tono, false), { pixelRatio: 2 });
    }
  }

  function montaCapas(m: maplibregl.Map) {
    const d = datos.current;
    const color = colorSede(d.filtros, d.tema);
    registraPines(m, color);

    m.addSource("contornos", {
      type: "geojson",
      data: (d.contornos ?? VACIA) as never,
    });
    m.addSource("borde", {
      type: "geojson",
      data: (d.bordeGrilla ?? VACIA) as never,
    });
    m.addSource("colombia", {
      type: "geojson",
      data: (d.colombia ?? VACIA) as never,
    });
    m.addSource("huellas", { type: "geojson", data: VACIA });
    m.addSource("sedes", {
      type: "geojson",
      data: { type: "FeatureCollection", features: d.sedes } as never,
    });
    m.addSource("danos", {
      type: "geojson",
      data: { type: "FeatureCollection", features: rasgosDano() } as never,
    });

    const visible = (on: boolean): "visible" | "none" =>
      on ? "visible" : "none";

    m.addLayer({
      id: "bandas",
      type: "fill",
      source: "contornos",
      layout: { visibility: visible(d.capas.intensidad) },
      filter: filtroBandas(d.filtros.bandas),
      paint: {
        "fill-color": [
          "step",
          ["get", "banda"],
          COLOR_BANDA[4.0],
          4.5, COLOR_BANDA[4.5],
          5.0, COLOR_BANDA[5.0],
          5.5, COLOR_BANDA[5.5],
          6.0, COLOR_BANDA[6.0],
          6.5, COLOR_BANDA[6.5],
        ] as never,
        "fill-opacity": d.tema === "claro" ? 0.3 : 0.34,
      },
    });
    m.addLayer({
      id: "bandas-linea",
      type: "line",
      source: "contornos",
      layout: { visibility: visible(d.capas.intensidad) },
      filter: filtroBandas(d.filtros.bandas),
      paint: {
        "line-color": [
          "step",
          ["get", "banda"],
          COLOR_BANDA[4.0],
          4.5, COLOR_BANDA[4.5],
          5.0, COLOR_BANDA[5.0],
          5.5, COLOR_BANDA[5.5],
          6.0, COLOR_BANDA[6.0],
          6.5, COLOR_BANDA[6.5],
        ] as never,
        "line-width": 1,
        "line-opacity": 0.7,
      },
    });

    // El contorno del pais, en una linea fina. No es decoracion: sobre el mapa
    // base claro las bandas de intensidad se comen la frontera, y sin ella
    // cuesta saber si una mancha esta cayendo en el mar o en Venezuela.
    m.addLayer({
      id: "colombia",
      type: "line",
      source: "colombia",
      paint: {
        "line-color": d.tema === "claro" ? "#0b0b0b" : "#ffffff",
        "line-width": 0.6,
        "line-opacity": 0.55,
      },
    });

    m.addLayer({
      id: "borde-grilla",
      type: "line",
      source: "borde",
      // Solo se dibuja cuando esta prendida una banda que de verdad se corta
      // contra el. Con solo 6,0 y 6,5 encendidas el rectangulo no explica nada
      // y ensucia el mapa.
      layout: {
        visibility: visible(d.capas.intensidad && seCortaEnElBorde(d.filtros.bandas)),
      },
      paint: {
        "line-color": d.tema === "claro" ? "#6f6d66" : "#a8a69c",
        "line-width": 1.2,
        "line-dasharray": [3, 3],
        "line-opacity": 0.8,
      },
    });

    m.addLayer({
      id: "huellas-relleno",
      type: "fill",
      source: "huellas",
      minzoom: 15,
      layout: { visibility: visible(d.capas.huellas) },
      paint: {
        "fill-color": d.tema === "claro" ? "#52514e" : "#c3c2b7",
        "fill-opacity": 0.25,
      },
    });
    m.addLayer({
      id: "huellas-linea",
      type: "line",
      source: "huellas",
      minzoom: 15,
      layout: { visibility: visible(d.capas.huellas) },
      paint: {
        "line-color": d.tema === "claro" ? "#52514e" : "#c3c2b7",
        "line-width": 0.6,
        "line-opacity": 0.6,
      },
    });

    // Halo de coordenada sin verificar, debajo del simbolo.
    m.addLayer({
      id: "sedes-coord",
      type: "circle",
      source: "sedes",
      filter: ["!=", ["get", "calidad_coord"], "gps_validated"],
      layout: { visibility: "none" },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 4, 14, 12],
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-color": REPORTE,
        "circle-stroke-width": 1.2,
        "circle-stroke-opacity": 0.75,
      },
    });

    // El realce de la vista de visitadas, debajo del punto. Los dos tonos
    // claros de la rampa del indice son lila palido, y a escala nacional un
    // punto de dos pixeles en lila palido sobre la mancha de intensidad no se
    // ve. El anillo le da un borde que no depende del tono.
    m.addLayer({
      id: "sedes-realce",
      type: "circle",
      source: "sedes",
      maxzoom: ZOOM_PIN,
      layout: { visibility: visible(d.capas.sedes && pintaPorIvid(d.filtros)) },
      paint: {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"], 5, 3.2, 7, 4, 9, 5.4,
        ] as never,
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-color": d.tema === "claro" ? "#ffffff" : "#0b0b0b",
        "circle-stroke-width": 1.4,
        "circle-stroke-opacity": 0.85,
      },
    });

    // Lejos, puntos. Cerca, pines. Es el mismo dato con dos representaciones,
    // porque el simbolo que sirve para leer una escuela no sirve para leer
    // veintiseis mil.
    m.addLayer({
      id: "sedes-punto",
      type: "circle",
      source: "sedes",
      maxzoom: ZOOM_PIN,
      layout: { visibility: visible(d.capas.sedes) },
      paint: {
        // Chicos a proposito: a escala nacional son 26.591 puntos y cualquier
        // radio mayor los funde en una mancha negra que no dice nada.
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 1.3, 7, 1.9, 9, 3],
        "circle-color": pintaPorIvid(d.filtros) ? colorIvid(color) : color,
        "circle-opacity": ["case", ["get", "encuestada"], 0.75, 0.18],
        "circle-stroke-color": pintaPorIvid(d.filtros)
          ? colorIvid(color)
          : color,
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 5, 0.4, 9, 0.9],
      },
    });
    m.addLayer({
      id: "sedes-pin",
      type: "symbol",
      source: "sedes",
      minzoom: ZOOM_PIN,
      layout: {
        visibility: visible(d.capas.sedes),
        "icon-image": pintaPorIvid(d.filtros)
          ? pinIvid()
          : ["case", ["get", "encuestada"], "pin-lleno", "pin-hueco"],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 9, 0.55, 14, 0.9],
        "icon-anchor": "bottom",
        "icon-allow-overlap": true,
      },
    });

    m.addLayer({
      id: "sedes-seleccion",
      type: "circle",
      source: "sedes",
      filter: ["==", ["get", "dane"], seleccion ?? ""],
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 6, 14, 16],
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-color": d.tema === "claro" ? "#0b0b0b" : "#ffffff",
        "circle-stroke-width": 2,
      },
    });

    // El color dice quien lo afirma, y es lo unico que dice el simbolo. La
    // gravedad se pregunta con las casillas de la tarjeta de danos, no mirando
    // el mapa: un canal que no tiene leyenda no comunica, confunde.
    const porFuente = [
      "match", ["get", "fuente"],
      "hot", COLOR_FUENTE.hot,
      "oficial", COLOR_FUENTE.oficial,
      "noticia", COLOR_FUENTE.noticia,
      COLOR_FUENTE.hot,
    ];
    // De cerca, el pin del color de la fuente, encima del pin grafito de la
    // misma sede. De lejos no caben pines y se usa el circulo, igual que las
    // sedes. Los dos son el mismo dato con dos representaciones.
    // El filtro por estado es lo que separa "que encontraron" de "si fueron".
    // `sin_dano` nunca entra en estas dos capas: tiene la suya, hueca, para que
    // no se lea como afectacion.
    // El estado y el recorte de intensidad se piden a la vez. Con
    // `danosTodasLasBandas` apagado el punto tiene que cumplir las dos cosas;
    // encendido, solo el estado, y el que queda fuera del recorte se dibuja
    // atenuado en vez de desaparecer.
    const filtroEstado = (estados: EstadoDano[], todas: boolean): Expr => {
      const porEstado: Expr =
        ["in", ["get", "estado"], ["literal", estados]] as Expr;
      return todas
        ? porEstado
        : (["all", porEstado, ["get", "en_seleccion"]] as Expr);
    };
    const conDano = (c: Capas): EstadoDano[] =>
      c.estadosDano.filter((e) => e !== "sin_dano");

    // Lo que hace visible el recorte de intensidad sin borrar nada. Dentro de
    // las bandas encendidas el punto va como siempre; fuera queda translucido y
    // se lee como "esto existe y no es de lo que estas mirando ahora".
    //
    // Se atenua y no se vacia el relleno a proposito: el circulo hueco ya
    // significa otra cosa en este mapa, es la sede que alguien reviso y encontro
    // sin dano. Dos cosas distintas no pueden compartir el mismo simbolo.
    const atenua = (dentro: number, fuera: number): Expr =>
      ["case", ["get", "en_seleccion"], dentro, fuera] as Expr;

    m.addLayer({
      id: "danos-pin",
      type: "symbol",
      source: "danos",
      minzoom: ZOOM_PIN,
      filter: filtroEstado(conDano(d.capas), d.capas.danosTodasLasBandas),
      layout: {
        visibility: visible(d.capas.reportes),
        "icon-image": [
          "match", ["get", "fuente"],
          "hot", "pin-hot",
          "oficial", "pin-oficial",
          "noticia", "pin-noticia",
          "pin-hot",
        ] as never,
        // Apenas mas grande que el pin de la sede, que va de 0,55 a 0,9. Estuvo
        // en 0,7 a 1,1 y pesaba demasiado: en las zonas con muchos reportes los
        // pines se tapaban entre si y tapaban las sedes de debajo, que son el
        // dato de fondo del mapa. Un solo tamano para los cuatro estados.
        "icon-size": ["interpolate", ["linear"], ["zoom"], 9, 0.62, 14, 0.95],
        "icon-anchor": "bottom",
        "icon-allow-overlap": true,
      },
      paint: { "icon-opacity": atenua(1, 0.4) as never },
    });

    m.addLayer({
      id: "danos-punto",
      type: "circle",
      source: "danos",
      maxzoom: ZOOM_PIN,
      filter: filtroEstado(conDano(d.capas), d.capas.danosTodasLasBandas),
      layout: { visibility: visible(d.capas.reportes) },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 5, 14, 9],
        "circle-color": porFuente as never,
        "circle-opacity": atenua(0.95, 0.35) as never,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
        "circle-stroke-opacity": atenua(1, 0.4) as never,
      },
    });

    // Verificada y sin daño. Va hueca y del color de su fuente: dice quien fue
    // a mirar sin afirmar afectacion. Sin relleno no compite con los puntos de
    // daño, que son los que hay que ver primero, y a la vez deja constancia de
    // que ese predio ya se reviso. Sin esta distincion, "no aparece en el mapa"
    // significaria a la vez "nadie fue" y "fueron y esta bien".
    m.addLayer({
      id: "danos-sin",
      type: "circle",
      source: "danos",
      filter: filtroEstado(
        d.capas.estadosDano.includes("sin_dano") ? ["sin_dano"] : [],
        d.capas.danosTodasLasBandas),
      layout: { visibility: visible(d.capas.reportes) },
      paint: {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"], 5, 4.2, 14, 7.5,
        ] as never,
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-color": porFuente as never,
        "circle-stroke-width": 2,
        "circle-stroke-opacity": atenua(0.9, 0.35) as never,
      },
    });

    // El anillo de la sede abierta, del color de su fuente y no del negro de la
    // seleccion normal. Al llegar volando hasta aqui, lo primero que hay que
    // reconocer es de quien es el reporte, y el color es lo que lo dice.
    m.addLayer({
      id: "danos-seleccion",
      type: "circle",
      source: "danos",
      filter: ["==", ["get", "dane"], seleccion ?? ""],
      paint: {
        // Casi el doble del radio del punto, para que el anillo se vea como
        // anillo y no como un borde grueso. Sigue al punto y por eso tampoco
        // cambia con el estado.
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 9, 14, 15],
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-color": porFuente as never,
        "circle-stroke-width": 2.5,
        // El anillo no se atenua. Marca la sede que esta abierta en la ficha, y
        // esa se abre a proposito: si quien mira pidio ver una sede de una banda
        // apagada, el anillo tiene que decirle donde esta.
        "circle-stroke-opacity": 0.9,
      },
    });

    listo.current = true;
    m.fire("visor:listo");
  }

  useEffect(() => {
    if (!div.current || mapa.current) return;
    const m = new maplibregl.Map({
      container: div.current,
      style: ESTILO[mapaBase],
      ...VISTA_INICIAL,
      attributionControl: { compact: true },
    });
    m.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );
    m.addControl(new ControlInicio(() => alClic.current(null)), "bottom-right");
    m.addControl(
      new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }),
      "bottom-right",
    );
    mapa.current = m;

    const emergente = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 12,
    });

    m.on("load", () => {
      montaCapas(m);

      const capasClic = ["danos-pin", "danos-punto", "danos-sin",
        "sedes-pin", "sedes-punto"];
      for (const capa of capasClic) {
        m.on("mouseenter", capa, () => (m.getCanvas().style.cursor = "pointer"));
        m.on("mouseleave", capa, () => {
          m.getCanvas().style.cursor = "";
          emergente.remove();
        });
        m.on("mousemove", capa, (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const p = f.properties as Record<string, unknown>;
          const html =
            capa.startsWith("danos-")
              ? textoDano(p)
              : `<strong>${p.sede}</strong><br>${p.mpio}, ${p.depto}<br>` +
                `<span class="num">${miles(
                  Number(p.matricula_2024 ?? p.matricula),
                )}</span> estudiantes, ` +
                // Dos decimales: con uno, un 6,49 se leia "6,5", que es el
                // nombre de la banda de arriba, y la mancha decia 6,0.
                `intensidad MMI ${Number(p.mmi).toFixed(2).replace(".", ",")}<br>` +
                (p.encuestada === true || p.encuestada === "true"
                  ? "Encuestada por el FFIE"
                  : "<em>Nunca fue encuestada</em>");
          emergente.setLngLat(e.lngLat).setHTML(html).addTo(m);
        });
        m.on("click", capa, (e) => {
          const f = e.features?.[0];
          if (!f) return;
          alClic.current(String((f.properties as Record<string, unknown>).dane ?? ""));
        });
      }

      m.on("click", (e) => {
        if (!m.queryRenderedFeatures(e.point, { layers: capasClic }).length) {
          alClic.current(null);
        }
      });

      m.on("moveend", () => void refrescaHuellas());
    });

    async function refrescaHuellas() {
      const m = mapa.current;
      if (!m || !listo.current) return;
      const fuente = m.getSource("huellas") as maplibregl.GeoJSONSource | undefined;
      if (!fuente) return;
      if (m.getZoom() < 15) {
        fuente.setData(VACIA as never);
        return;
      }
      const vistos = m.queryRenderedFeatures({ layers: ["sedes-pin"] });
      const danes = Array.from(
        new Set(vistos.map((f) => String(f.properties?.dane ?? ""))),
      )
        .filter(Boolean)
        .slice(0, MAX_HUELLAS_VISIBLES);

      const rasgos: unknown[] = [];
      for (const dane of danes) {
        if (!cacheHuellas.current.has(dane)) {
          cacheHuellas.current.set(dane, await cargaHuellas(dane));
        }
        const col = cacheHuellas.current.get(dane) as { features: unknown[] } | null;
        if (col?.features) rasgos.push(...col.features);
      }
      fuente.setData({ type: "FeatureCollection", features: rasgos } as never);
    }

    return () => {
      m.remove();
      mapa.current = null;
      listo.current = false;
    };
  }, []);

  // El epicentro es un marcador de HTML y no una capa: es un solo punto y su
  // dibujo es el mismo que el de la tarjeta de arriba, asi que conviene que sea
  // el mismo SVG y no dos versiones que se puedan desincronizar.
  useEffect(() => {
    const m = mapa.current;
    if (!m || !evento) return;
    marcaEpicentro.current?.remove();
    const el = document.createElement("div");
    el.innerHTML = svgEpicentro(30);
    el.title = `Epicentro del sismo de magnitud ${evento.magnitud}, profundidad ${evento.profundidad_km} km`;
    marcaEpicentro.current = new maplibregl.Marker({ element: el, anchor: "bottom" })
      .setLngLat(evento.epicentro)
      .addTo(m);
    return () => {
      marcaEpicentro.current?.remove();
    };
  }, [evento]);

  // Cambiar de mapa base recarga el estilo entero y con el se van todas las
  // fuentes, asi que hay que volver a montarlas encima.
  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo.current) return;
    listo.current = false;
    m.setStyle(ESTILO[mapaBase]);
    m.once("styledata", () => montaCapas(m));
  }, [mapaBase]);

  /** Aplica algo cuando el estilo este montado, ahora o cuando termine. */
  function cuandoListo(fn: (m: maplibregl.Map) => void) {
    const m = mapa.current;
    if (!m) return;
    if (listo.current) fn(m);
    else m.once("visor:listo", () => fn(m));
  }

  useEffect(() => {
    cuandoListo((m) => {
      const f = m.getSource("contornos") as maplibregl.GeoJSONSource | undefined;
      if (f && contornos) f.setData(contornos as never);
      const g = m.getSource("borde") as maplibregl.GeoJSONSource | undefined;
      if (g && bordeGrilla) g.setData(bordeGrilla as never);
      const c = m.getSource("colombia") as maplibregl.GeoJSONSource | undefined;
      if (c && colombia) c.setData(colombia as never);
    });
  }, [contornos, bordeGrilla, colombia]);

  useEffect(() => {
    cuandoListo((m) => {
      const f = m.getSource("sedes") as maplibregl.GeoJSONSource | undefined;
      if (f) f.setData({ type: "FeatureCollection", features: sedes } as never);
    });
  }, [sedes]);

  useEffect(() => {
    cuandoListo((m) => {
      const f = m.getSource("danos") as maplibregl.GeoJSONSource | undefined;
      if (f) {
        f.setData({ type: "FeatureCollection", features: rasgosDano() } as never);
      }
    });
    // También escucha las bandas, porque `en_seleccion` se calcula aquí y
    // cambia con ellas. No cambia qué puntos hay, solo cuáles se ven
    // atenuados, pero eso vive en la fuente y hay que reescribirla. Los estados
    // siguen yendo por `setFilter`, más abajo, que no toca la fuente.
  }, [danos, filtros.bandas]);

  useEffect(() => {
    cuandoListo((m) => {
      if (!m.getLayer("sedes-punto")) return;
      const color = colorSede(filtros, tema);
      registraPines(m, color);
      const porIvid = pintaPorIvid(filtros);
      const tono = porIvid ? colorIvid(color) : color;
      m.setPaintProperty("sedes-punto", "circle-color", tono);
      m.setPaintProperty("sedes-punto", "circle-stroke-color", tono);
      m.setLayoutProperty(
        "sedes-pin",
        "icon-image",
        porIvid
          ? pinIvid()
          : (["case", ["get", "encuestada"], "pin-lleno", "pin-hueco"] as Expr),
      );
      m.setPaintProperty(
        "sedes-realce",
        "circle-stroke-color",
        tema === "claro" ? "#ffffff" : "#0b0b0b",
      );
      m.setLayoutProperty(
        "sedes-realce",
        "visibility",
        capas.sedes && porIvid ? "visible" : "none",
      );
      m.setLayoutProperty(
        "sedes-coord",
        "visibility",
        filtros.resaltarCoordDudosa ? "visible" : "none",
      );
      m.setFilter("bandas", filtroBandas(filtros.bandas));
      m.setFilter("bandas-linea", filtroBandas(filtros.bandas));
      m.setLayoutProperty(
        "borde-grilla",
        "visibility",
        capas.intensidad && seCortaEnElBorde(filtros.bandas) ? "visible" : "none",
      );
    });
  }, [filtros, capas, danesConReporte, tema]);

  useEffect(() => {
    cuandoListo((m) => {
      if (!m.getLayer("bandas")) return;
      const ver = (capa: string, on: boolean) =>
        m.setLayoutProperty(capa, "visibility", on ? "visible" : "none");
      ver("bandas", capas.intensidad);
      ver("bandas-linea", capas.intensidad);
      ver("borde-grilla", capas.intensidad && seCortaEnElBorde(filtros.bandas));
      ver("sedes-punto", capas.sedes);
      ver("sedes-pin", capas.sedes);
      ver("sedes-realce", capas.sedes && pintaPorIvid(filtros));
      ver("danos-punto", capas.reportes);
      ver("danos-pin", capas.reportes);
      ver("danos-sin", capas.reportes);
      // Los estados se filtran aqui y no rehaciendo la fuente: son 141 puntos
      // y volver a construir el GeoJSON en cada casilla haria parpadear el mapa.
      const sinDano = capas.estadosDano.includes("sin_dano");
      const conDanoAhora = capas.estadosDano.filter((e) => e !== "sin_dano");
      const todas = capas.danosTodasLasBandas;
      // El recorte de intensidad viaja pegado al estado, en el mismo filtro. Es
      // por lo mismo que los estados no rehacen la fuente: son 189 puntos y
      // reconstruir el GeoJSON al tocar una casilla hace parpadear el mapa.
      const conRecorte = (estados: EstadoDano[]): Expr => {
        const e: Expr = ["in", ["get", "estado"], ["literal", estados]] as Expr;
        return todas ? e : (["all", e, ["get", "en_seleccion"]] as Expr);
      };
      m.setFilter("danos-pin", conRecorte(conDanoAhora));
      m.setFilter("danos-punto", conRecorte(conDanoAhora));
      m.setFilter("danos-sin", conRecorte(sinDano ? ["sin_dano"] : []));
      ver("huellas-relleno", capas.huellas);
      ver("huellas-linea", capas.huellas);
    });
  }, [capas]);

  useEffect(() => {
    cuandoListo((m) => {
      if (!m.getLayer("sedes-seleccion")) return;
      m.setFilter("sedes-seleccion", ["==", ["get", "dane"], seleccion ?? ""]);
      m.setFilter("danos-seleccion", ["==", ["get", "dane"], seleccion ?? ""]);
    });
  }, [seleccion]);

  /** Vuela hasta la sede que se abrió, se haya tocado en la lista o en el mapa.
   *
   * La coordenada se busca primero en el daño y solo después en la colección de
   * sedes. Da igual cuál de las dos tenga el punto: lo que importa es que si la
   * sede sigue seleccionada, alguna de las dos lo tiene.
   *
   * Se acerca a zoom 16, que es donde ya cargan las huellas de edificio, para
   * que al llegar se vea el predio y no una mancha. Si el mapa ya está más
   * cerca, no se aleja: acercarse siempre a 16 alejaría a quien ya estaba
   * mirando un tejado.
   */
  useEffect(() => {
    if (!foco) return;
    cuandoListo((m) => {
      const d = datos.current.danos.find(
        (x) => x.dane === foco.dane && x.lon != null && x.lat != null,
      );
      const s = datos.current.sedes.find(
        (x) => x.properties.dane === foco.dane,
      );
      const centro = d
        ? ([d.lon, d.lat] as [number, number])
        : s
          ? (s.geometry.coordinates as [number, number])
          : null;
      if (!centro) return;
      m.flyTo({ center: centro, zoom: Math.max(m.getZoom(), 16), speed: 1.2 });
    });
  }, [foco]);

  return <div ref={div} className="h-full w-full" />;
}

/** Volver a la vista inicial. MapLibre no trae un control de inicio, y en una
 * herramienta de emergencia perderse en el zoom cuesta segundos que importan. */
class ControlInicio implements maplibregl.IControl {
  private div!: HTMLDivElement;

  /** @param alVolver cierra la ficha. Devolver el encuadre y dejar la ficha
   *  abierta era media vuelta: la sede seguía seleccionada y su anillo quedaba
   *  perdido en la mancha a escala de país. Lo que no se toca son los filtros,
   *  que pueden ser quince minutos de trabajo y no se pierden por un clic. */
  constructor(private alVolver: () => void) {}

  onAdd(m: maplibregl.Map) {
    this.div = document.createElement("div");
    // La clase propia permite dejarlo visible en el telefono cuando se
    // esconden los demas controles del mapa.
    this.div.className = "maplibregl-ctrl maplibregl-ctrl-group ctrl-inicio";
    const b = document.createElement("button");
    b.type = "button";
    b.title = "Volver a la vista inicial y cerrar la ficha";
    b.setAttribute("aria-label", "Volver a la vista inicial y cerrar la ficha");
    b.innerHTML =
      "<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" style=\"margin:auto;display:block\">" +
      "<path d=\"M2 7.2 8 2l6 5.2V14H10v-4H6v4H2V7.2Z\" fill=\"none\" " +
      "stroke=\"#333\" stroke-width=\"1.4\" stroke-linejoin=\"round\"/></svg>";
    b.onclick = () => {
      m.easeTo({ ...VISTA_INICIAL, duration: 600 });
      this.alVolver();
    };
    this.div.appendChild(b);
    return this.div;
  }

  onRemove() {
    this.div.remove();
  }
}

/** Ninguna banda elegida no puede caer al filtro por defecto de MapLibre, que
 * las dibujaria todas. Se compara contra una lista vacia a proposito. */
function filtroBandas(bandas: number[]): Expr {
  return ["in", ["get", "banda"], ["literal", bandas]] as Expr;
}

/** Las dos bandas bajas son las unicas que alcanzan el limite de la grilla del
 * USGS. Con las demas, el rectangulo punteado no explica ningun corte. */
function seCortaEnElBorde(bandas: number[]): boolean {
  return bandas.includes(4.0) || bandas.includes(4.5);
}

/** El globo de un punto de daño.
 *
 * Dice tres cosas y en este orden: qué se afirma, sobre qué se afirma y quién lo
 * afirma. La segunda es la que evita el malentendido caro: cuando el reporte
 * habla de la institución, el globo dice en cuántas sedes puede estar el daño en
 * vez de dejar creer que está en esta.
 */
function textoDano(p: Record<string, unknown>): string {
  const fuente = NOMBRE_FUENTE[p.fuente as keyof typeof NOMBRE_FUENTE] ?? "";
  const estado = NOMBRE_ESTADO[p.estado as keyof typeof NOMBRE_ESTADO] ?? "";
  const n = Number(p.n_sedes_institucion ?? 1);
  const deGrupo = p.alcance !== "sede" && n > 1;
  const alcance = deGrupo
    ? `<em>El reporte habla de la institución, no de esta sede. El daño puede estar en cualquiera de sus ${n}.</em>`
    : p.estado === "sin_verificar"
      ? "<em>Alguien emparejó una foto con esta sede. No afirma daño.</em>"
      : "<em>La afirmación es sobre esta sede.</em>";
  return (
    `<strong>${p.sede}</strong><br>${p.mpio}<br>` +
    `${fuente}: <strong>${estado}</strong><br>` +
    `<span class="num">${miles(Number(p.matricula))}</span> estudiantes<br>` +
    alcance
  );
}

export { BANDAS };

/** El pin del epicentro: gota amarilla con borde naranja y estallido en la
 * punta. Se usa igual en el mapa y en la tarjeta del encabezado. */
export function svgEpicentro(alto = 30): string {
  const w = (alto * 26) / 34;
  return `<svg width="${w}" height="${alto}" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M13 33 L13 24" stroke="#E8720C" stroke-width="1.4" fill="none"/>
  <g fill="#E8720C">
    <path d="M13 34 L10.2 29.6 L5.6 30.4 L8.2 26.6 L4.2 24.2 L8.8 23 L7.4 18.6 L11.4 21 L13 16.6 L14.6 21 L18.6 18.6 L17.2 23 L21.8 24.2 L17.8 26.6 L20.4 30.4 L15.8 29.6 Z"/>
  </g>
  <path d="M13 1.2 C7.6 1.2 3.4 5.4 3.4 10.6 C3.4 17.2 13 26 13 26 C13 26 22.6 17.2 22.6 10.6 C22.6 5.4 18.4 1.2 13 1.2 Z" fill="#FFD400" stroke="#E8720C" stroke-width="2"/>
  <circle cx="13" cy="10.6" r="3.6" fill="#E8720C"/>
</svg>`;
}
