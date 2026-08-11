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
 *  - El color de la sede no compite con el degradado: grafito por defecto y
 *    violeta para la carencia, dos tonos que no estan en la rampa de
 *    intensidad. El rojo del reporte ciudadano va sobre un pin con halo blanco,
 *    que ninguna banda tiene.
 */

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

import { cargaHuellas, miles } from "@/lib/datos";
import { BANDAS } from "@/lib/tipos";
import type {
  Evento,
  Filtros,
  MapaBase,
  RasgoSede,
  Reporte,
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
  reportes: Reporte[];
  danesConReporte: string[];
  colombia: unknown | null;
  filtros: Filtros;
  capas: Capas;
  mapaBase: MapaBase;
  tema: Tema;
  seleccion: string | null;
  onSeleccion: (dane: string | null) => void;
};

type Expr = maplibregl.ExpressionSpecification;

/** Que se dibuja encima del mapa base. Lo maneja la tarjeta de capas. */
export type Capas = {
  intensidad: boolean;
  sedes: boolean;
  reportes: boolean;
  huellas: boolean;
};

export const CAPAS_INICIALES: Capas = {
  intensidad: true,
  sedes: true,
  reportes: true,
  huellas: true,
};

/** El color dice lo que pregunta la pestana activa, y nada mas. */
function colorSede(f: Filtros, tema: Tema): string {
  if (f.tab === "servicios") {
    const falta =
      f.energia === "sin" || f.internet === "sin" ||
      (f.energia === "todas" && f.internet === "todas");
    return falta ? CARENCIA[tema] : BASE[tema];
  }
  return f.fisica === "no_encuestadas" ? CARENCIA[tema] : BASE[tema];
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
  reportes,
  danesConReporte,
  filtros,
  capas,
  mapaBase,
  tema,
  seleccion,
  onSeleccion,
}: Props) {
  const div = useRef<HTMLDivElement>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const listo = useRef(false);
  const cacheHuellas = useRef(new Map<string, unknown>());
  const marcaEpicentro = useRef<maplibregl.Marker | null>(null);
  // Cambiar de tema recarga el estilo entero y con el se van todas las fuentes,
  // asi que hay que poder volver a montarlas con los datos que hubiera.
  const datos = useRef({ contornos, bordeGrilla, colombia, sedes, reportes,
    danesConReporte, filtros, capas, tema });
  datos.current = { contornos, bordeGrilla, colombia, sedes, reportes,
    danesConReporte, filtros, capas, tema };
  const alClic = useRef(onSeleccion);
  alClic.current = onSeleccion;

  /** Rasgos de reporte, anclados a la sede asignada y no al punto reportado. */
  function rasgosReporte() {
    const { reportes: rs, sedes: ss } = datos.current;
    return rs
      .filter((r) => r.es_escuela === "si" && r.dane_asignado)
      .map((r) => {
        const c = r.candidatas.find((x) => x.dane === r.dane_asignado);
        const sede = ss.find((s) => s.properties.dane === r.dane_asignado);
        return {
          type: "Feature" as const,
          properties: {
            id: r.id,
            dane: r.dane_asignado,
            sede: c?.sede ?? "",
            dist_m: c?.dist_m ?? null,
          },
          geometry: {
            type: "Point" as const,
            coordinates: sede?.geometry.coordinates ?? [r.lon, r.lat],
          },
        };
      });
  }

  function registraPines(m: maplibregl.Map, color: string) {
    for (const [nombre, hueco] of [["pin-lleno", false], ["pin-hueco", true]] as
      [string, boolean][]) {
      if (m.hasImage(nombre)) m.removeImage(nombre);
      m.addImage(nombre, creaPin(color, hueco), { pixelRatio: 2 });
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
    m.addSource("reportes", {
      type: "geojson",
      data: { type: "FeatureCollection", features: rasgosReporte() } as never,
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
        // Chicos a proposito: a escala nacional son 26.584 puntos y cualquier
        // radio mayor los funde en una mancha negra que no dice nada.
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 1.3, 7, 1.9, 9, 3],
        "circle-color": color,
        "circle-opacity": ["case", ["get", "encuestada"], 0.75, 0.18],
        "circle-stroke-color": color,
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
        "icon-image": ["case", ["get", "encuestada"], "pin-lleno", "pin-hueco"],
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

    m.addLayer({
      id: "reportes-punto",
      type: "circle",
      source: "reportes",
      layout: { visibility: visible(d.capas.reportes) },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 6, 14, 11],
        "circle-color": REPORTE,
        "circle-opacity": 0.95,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2.5,
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
    m.addControl(new ControlInicio(), "bottom-right");
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

      const capasClic = ["sedes-pin", "sedes-punto", "reportes-punto"];
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
            capa === "reportes-punto"
              ? `<strong>Reporte ciudadano</strong><br>${p.sede}<br>Reportado a ${p.dist_m} m de la sede`
              : `<strong>${p.sede}</strong><br>${p.mpio}, ${p.depto}<br>` +
                `<span class="num">${miles(Number(p.matricula))}</span> estudiantes, ` +
                `intensidad MMI ${Number(p.mmi).toFixed(1).replace(".", ",")}<br>` +
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
      const f = m.getSource("reportes") as maplibregl.GeoJSONSource | undefined;
      if (f) {
        f.setData({ type: "FeatureCollection", features: rasgosReporte() } as never);
      }
    });
  }, [reportes, sedes]);

  useEffect(() => {
    cuandoListo((m) => {
      if (!m.getLayer("sedes-punto")) return;
      const color = colorSede(filtros, tema);
      registraPines(m, color);
      m.setPaintProperty("sedes-punto", "circle-color", color);
      m.setPaintProperty("sedes-punto", "circle-stroke-color", color);
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
      ver("reportes-punto", capas.reportes);
      ver("huellas-relleno", capas.huellas);
      ver("huellas-linea", capas.huellas);
    });
  }, [capas]);

  useEffect(() => {
    cuandoListo((m) => {
      if (!m.getLayer("sedes-seleccion")) return;
      m.setFilter("sedes-seleccion", ["==", ["get", "dane"], seleccion ?? ""]);
    });
  }, [seleccion]);

  return <div ref={div} className="h-full w-full" />;
}

/** Volver a la vista inicial. MapLibre no trae un control de inicio, y en una
 * herramienta de emergencia perderse en el zoom cuesta segundos que importan. */
class ControlInicio implements maplibregl.IControl {
  private div!: HTMLDivElement;

  onAdd(m: maplibregl.Map) {
    this.div = document.createElement("div");
    // La clase propia permite dejarlo visible en el telefono cuando se
    // esconden los demas controles del mapa.
    this.div.className = "maplibregl-ctrl maplibregl-ctrl-group ctrl-inicio";
    const b = document.createElement("button");
    b.type = "button";
    b.title = "Volver a la vista inicial";
    b.setAttribute("aria-label", "Volver a la vista inicial");
    b.innerHTML =
      "<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" style=\"margin:auto;display:block\">" +
      "<path d=\"M2 7.2 8 2l6 5.2V14H10v-4H6v4H2V7.2Z\" fill=\"none\" " +
      "stroke=\"#333\" stroke-width=\"1.4\" stroke-linejoin=\"round\"/></svg>";
    b.onclick = () => m.easeTo({ ...VISTA_INICIAL, duration: 600 });
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
