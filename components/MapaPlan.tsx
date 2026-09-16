"use client";

/** El mapa del plan de campo, que se puede poner a correr.
 *
 * Es un mapa aparte del de la emergencia y no una capa suya. El de la emergencia
 * responde a dónde mandar a alguien a mirar primero; este responde otra cosa:
 * cómo se pueden acomodar las rutas y cuánto se va en carretera cada día, para
 * que quien tiene que cotizar el trabajo lo pueda evaluar.
 *
 * Por eso el objeto central no es el plan dibujado sino el plan CORRIENDO. Un
 * mapa con nueve semanas encima es un plato de espagueti que nadie lee. El mismo
 * plan reproducido día por día, con las tres cuadrillas moviéndose a la vez y un
 * contador que sube, se entiende sin explicación y deja ver dónde se va el
 * tiempo.
 *
 * Decisiones de codificación, que no son de gusto:
 *
 *  - LA LÍNEA ES LA CARRETERA, NO LA RECTA. Cada tramo viene con el trazado que
 *    devolvió Mapbox, del mismo endpoint, el mismo perfil y la misma hora de
 *    salida con que se calculó el tiempo. Una recta entre dos sedes es una
 *    afirmación falsa dibujada con autoridad: en el Valle hay pares de sedes a
 *    tres kilómetros en línea recta y a media hora por carretera.
 *
 *  - LO YA RECORRIDO SE QUEDA, APAGADO. Al avanzar los días el mapa va dejando
 *    el rastro de lo hecho. Así, al final, el plan completo está dibujado, pero
 *    se llegó a él viéndolo construirse y no de golpe.
 *
 *  - LA SECUENCIA VA EN EL NÚMERO, NO EN LA FLECHA. Cada escuela lleva escrito
 *    el día de campo en que se visita, del 1 al 15. Primero se escribía el día
 *    de la semana, del 1 al 5, y cada cuadrilla tenía tres escuelas con el
 *    mismo número: no se leía el orden. Las flechas sobre una línea se
 *    pierden al alejar el zoom y obligan a seguir el trazo con el ojo.
 *
 *  - LÍNEA LLENA AL SALIR, PUNTEADA AL LLEGAR A DORMIR. La ida a la escuela es
 *    trabajo; el trayecto de la tarde es dónde se acaba el día.
 *
 *  - DÓNDE SE DUERME VA EN OTRA FORMA, NO EN OTRO COLOR. Un rombo la base, un
 *    cuadrado hueco el poblado donde se pasa la noche, un círculo la escuela. El
 *    color ya está ocupado por la cuadrilla y no puede significar dos cosas. El
 *    cuadrado va hueco porque el plan nombra el pueblo, no el hotel.
 */

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";

import { COLOR_CONCEPTO, colorCuadrilla } from "@/lib/plan";
import type { ColeccionTramos, Concepto, Escenario, Plan } from "@/lib/plan";

// Los dos estilos base que usa el visor. Van repetidos aquí y no importados del
// mapa de la emergencia porque ese componente pesa dos mil líneas y traerlo
// entero para leerle dos URL lo cargaría en esta pantalla sin usarlo.
const ESTILO = {
  claro: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  oscuro: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

/** Las 43 sedes, con 28 km por cada 100 px.
 *
 * El centro es el de la caja de las 43 (latitud 3,33 a 4,86, longitud -76,72 a
 * -75,83). A esa latitud, con zoom 8,12, cien píxeles son 28 km: los 170 km de
 * norte a sur caben con holgura en una pantalla de portátil. Con 8,6 (20 km)
 * las puntas quedaban al borde; con 7,3 los pines se amontonaban. La barra de
 * escala redondea su rótulo a 20 o 30 km y ajusta su largo. El margen izquierdo
 * corre el centro fuera del panel de tarjetas, que tapa 380 px del mapa.
 */
const VISTA_INICIAL = { center: [-76.27, 4.09] as [number, number], zoom: 8.12 };
const MARGEN_PANEL = { left: 380, top: 0, right: 0, bottom: 0 };
/** En el teléfono el panel no va al costado, así que no hay que correr nada. */
const SIN_MARGEN = { left: 0, top: 0, right: 0, bottom: 0 };
function margenPanel() {
  return window.innerWidth >= 768 ? MARGEN_PANEL : SIN_MARGEN;
}

const APAGADO = { claro: "#c9c8c1", oscuro: "#3f3f3b" };
const SUPERFICIE = { claro: "#fcfcfb", oscuro: "#1a1a19" };
const TINTA = { claro: "#0b0b0b", oscuro: "#ffffff" };
const GRAFITO = { claro: "#33414d", oscuro: "#d7dee4" };

const VACIA = { type: "FeatureCollection", features: [] } as const;

/** Los días de campo que puede llevar escritos un pin: tres semanas de cinco. */
const DIAS_PIN = 15;

// La cuadrilla en movimiento. Dos que quedan a menos de CHOQUE_PX en pantalla
// se tapan; la segunda se corre CORRIMIENTO_PX a la derecha.
const TAMANO_MOVIL = 0.58;
const CHOQUE_PX = 22;
const CORRIMIENTO_PX = 26;

// Los municipios del Valle, del script 79. El territorio de la SE del Valle va
// con un velo del color de la tinta y un contorno firme; los ocho municipios con
// secretaría propia quedan sin velo. Así se ve que las rutas cruzan territorio
// que no es de la SE, y que las 43 caen todas en el que sí.
const MUNICIPIOS = "datos/plan_municipios.geojson";
const VELO_SE = { claro: 0.07, oscuro: 0.09 };
const LIMITE_MPIO = { claro: "#a3a29b", oscuro: "#5c5b56" };

/** El contenido del globo de una escuela. Se arma con nodos y no con HTML en
 *  texto, porque los nombres vienen de fuentes externas. */
function globoSede(p: Record<string, unknown>): HTMLElement {
  const nodo = document.createElement("div");
  nodo.style.maxWidth = "240px";
  const linea = (texto: string, estilo: Partial<CSSStyleDeclaration> = {}) => {
    const d = document.createElement("div");
    d.textContent = texto;
    Object.assign(d.style, estilo);
    nodo.append(d);
    return d;
  };
  linea(String(p.nombre), { fontWeight: "600", lineHeight: "1.2" });
  linea(`${p.municipio} · cuadrilla ${p.cuadrilla} · día ${p.dia}`, {
    fontSize: "11px", color: "var(--tinta-2)",
  });
  const concepto = String(p.concepto ?? "") as Concepto | "";
  if (concepto && COLOR_CONCEPTO[concepto]) {
    const c = COLOR_CONCEPTO[concepto];
    const fila = linea("", { marginTop: "4px", fontSize: "11px" });
    const chip = document.createElement("span");
    chip.textContent = concepto;
    Object.assign(chip.style, {
      background: c.fondo, color: c.tinta, borderRadius: "3px",
      padding: "1px 5px", fontWeight: "600",
    });
    fila.append(chip);
    if (p.dictamen !== "aprobado por la mesa") {
      const nota = document.createElement("span");
      nota.textContent = ` ${p.dictamen || "sin dictamen"}`;
      nota.style.color = "var(--tinta-3)";
      fila.append(nota);
    }
  } else {
    linea("sin concepto técnico", { marginTop: "4px", fontSize: "11px",
                                    color: "var(--tinta-3)" });
  }
  if (String(p.dificil) === "true") {
    linea("acceso difícil", { fontSize: "11px", color: "var(--critico)" });
  }
  linea("clic para ver la ficha", { marginTop: "3px", fontSize: "10px",
                                    color: "var(--tinta-3)" });
  return nodo;
}

/** El botón de casa: vuelve a la vista inicial y cierra la ficha.
 *
 * Es el mismo control del visor nacional (`ControlInicio` en `Mapa.tsx`), con
 * el mismo ícono y la misma clase, copiado aquí por la misma razón que los
 * estilos base: importar ese archivo cargaría el mapa nacional entero.
 */
class ControlInicio implements maplibregl.IControl {
  private div!: HTMLDivElement;

  constructor(private alVolver: () => void) {}

  onAdd(m: maplibregl.Map) {
    this.div = document.createElement("div");
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
      m.easeTo({ ...VISTA_INICIAL, padding: margenPanel(), duration: 600 });
      this.alVolver();
    };
    this.div.appendChild(b);
    return this.div;
  }

  onRemove() {
    this.div.remove();
  }
}

/** Dónde va cada cuadrilla en este instante. */
export type Movil = {
  cuadrilla: string;
  punto: [number, number] | null;
  fase: "manana" | "inspeccion" | "tarde" | "fin";
};

/** El pin de una escuela: un círculo del color de su cuadrilla con el día.
 *
 * Se dibuja en lienzo en vez de usar una capa de texto de MapLibre porque el
 * texto depende de que el estilo base publique la tipografía pedida, y si no la
 * tiene la capa no falla: desaparece en silencio. Un número que a veces no está
 * es peor que ninguno.
 */
function creaDia(color: string, dia: number, borde: string, tinta: string): ImageData {
  const R = 2;
  const s = 26;
  const c = document.createElement("canvas");
  c.width = s * R;
  c.height = s * R;
  const x = c.getContext("2d")!;
  x.scale(R, R);

  x.beginPath();
  x.arc(13, 13, dia > 0 ? 9.5 : 6, 0, Math.PI * 2);
  x.fillStyle = color;
  x.fill();
  // El anillo de superficie de 2 px es lo que deja leer dos pines pegados, que
  // en Yotoco y en La Unión quedan a cien metros uno del otro.
  x.strokeStyle = borde;
  x.lineWidth = 2;
  x.stroke();

  // El pin apagado va sin número. No es un día 0: es una escuela que todavía no
  // se ha visitado, y escribirle una cifra inventaría una.
  if (dia > 0) {
    x.fillStyle = tinta;
    // Con dos cifras la letra baja un punto para caber en el círculo.
    x.font = `bold ${dia > 9 ? 11 : 12}px system-ui, sans-serif`;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText(String(dia), 13, 13.5);
  }
  return x.getImageData(0, 0, s * R, s * R);
}

/** La cuadrilla en movimiento: un círculo con halo y su letra.
 *
 * Más grande que el pin de la escuela y con un anillo doble, porque tiene que
 * encontrarse con el ojo mientras se mueve y va a pasar por encima de pines del
 * mismo color.
 */
function creaMovil(color: string, letra: string, borde: string): ImageData {
  const R = 2;
  const s = 34;
  const c = document.createElement("canvas");
  c.width = s * R;
  c.height = s * R;
  const x = c.getContext("2d")!;
  x.scale(R, R);
  const cx = 17;

  x.beginPath();
  x.arc(cx, cx, 15, 0, Math.PI * 2);
  x.fillStyle = color;
  x.globalAlpha = 0.22;
  x.fill();
  x.globalAlpha = 1;

  x.beginPath();
  x.arc(cx, cx, 10, 0, Math.PI * 2);
  x.fillStyle = color;
  x.fill();
  x.strokeStyle = borde;
  x.lineWidth = 2.4;
  x.stroke();

  x.fillStyle = "#ffffff";
  x.font = "bold 12px system-ui, sans-serif";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText(letra, cx, cx + 0.5);
  return x.getImageData(0, 0, s * R, s * R);
}

/** La base de salida: un rombo lleno. */
function creaBase(color: string, borde: string): ImageData {
  const R = 2;
  const s = 24;
  const c = document.createElement("canvas");
  c.width = s * R;
  c.height = s * R;
  const x = c.getContext("2d")!;
  x.scale(R, R);
  x.beginPath();
  x.moveTo(12, 2.5);
  x.lineTo(21.5, 12);
  x.lineTo(12, 21.5);
  x.lineTo(2.5, 12);
  x.closePath();
  x.fillStyle = color;
  x.fill();
  x.strokeStyle = borde;
  x.lineWidth = 2;
  x.stroke();
  return x.getImageData(0, 0, s * R, s * R);
}

/** El poblado donde se duerme: un cuadrado hueco.
 *
 * Hueco a propósito. Es el mismo recurso que en el mapa de la emergencia marca
 * la sede nunca encuestada: el contorno sin relleno dice «aquí hay algo que no
 * está confirmado». Y no lo está: el plan nombra el poblado, no el hotel.
 */
function creaCama(color: string, borde: string): ImageData {
  const R = 2;
  const s = 22;
  const c = document.createElement("canvas");
  c.width = s * R;
  c.height = s * R;
  const x = c.getContext("2d")!;
  x.scale(R, R);
  x.beginPath();
  x.rect(4, 4, 14, 14);
  x.fillStyle = borde;
  x.fill();
  x.strokeStyle = color;
  x.lineWidth = 2.6;
  x.stroke();
  return x.getImageData(0, 0, s * R, s * R);
}

export default function MapaPlan({
  plan,
  tramos,
  escenario,
  diaActual,
  moviles,
  visitadas,
  reposo,
  simulando,
  altoSimulacion,
  cuadrilla,
  seleccion,
  onSelecciona,
  tema,
}: {
  plan: Plan | null;
  tramos: ColeccionTramos | null;
  escenario: Escenario;
  /** El día corrido que se está viendo, del 1 al 15. Null muestra el plan
   *  completo de una vez, que es la vista de reposo. */
  diaActual: number | null;
  moviles: Movil[];
  /** Las escuelas ya visitadas hasta el instante que se está viendo. */
  visitadas: Set<string>;
  /** La vista de entrada, antes de reproducir. Solo las escuelas, todas con el
   *  color de su cuadrilla y sin trazados ni poblados: lo primero que se ve es
   *  a qué grupo pertenece cada escuela, no el recorrido. */
  reposo: boolean;
  /** Con la simulación prendida el mapa se aleja hasta que caben los
   *  recorridos de las tres cuadrillas, por encima del panel de abajo. */
  simulando: boolean;
  altoSimulacion: number;
  /** Null es «todas». Al escoger una, las demás se apagan. */
  cuadrilla: string | null;
  seleccion: string | null;
  onSelecciona: (dane: string | null) => void;
  tema: "claro" | "oscuro";
}) {
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const listo = useRef(false);
  // Cuenta las veces que el mapa quedó listo para recibir datos: al cargar y
  // tras cada cambio de estilo. Los efectos que dibujan dependen de ella. Sin
  // esto, si los datos llegaban antes que el mapa, el efecto salía sin dibujar
  // y nada lo volvía a llamar: la vista de entrada abría sin escuelas.
  const [capasListas, setCapasListas] = useState(0);
  const alSeleccionar = useRef(onSelecciona);
  alSeleccionar.current = onSelecciona;

  const oscuro = tema === "oscuro";

  /** Arma las capas. Se llama al cargar y cada vez que cambia el estilo base. */
  const pinta = useRef<(m: maplibregl.Map) => void>(() => {});
  pinta.current = (m: maplibregl.Map) => {
    const borde = SUPERFICIE[tema];
    const tinta = TINTA[tema];
    for (const c of ["A", "B", "C"]) {
      for (let d = 1; d <= DIAS_PIN; d++) {
        const id = `dia-${c}-${d}`;
        if (!m.hasImage(id)) {
          m.addImage(id, creaDia(colorCuadrilla(c, oscuro), d, borde, tinta));
        }
      }
      if (!m.hasImage(`cama-${c}`)) {
        m.addImage(`cama-${c}`, creaCama(colorCuadrilla(c, oscuro), borde));
      }
      if (!m.hasImage(`movil-${c}`)) {
        m.addImage(`movil-${c}`, creaMovil(colorCuadrilla(c, oscuro), c, borde));
      }
    }
    if (!m.hasImage("dia-apagado")) {
      m.addImage("dia-apagado", creaDia(APAGADO[tema], 0, borde, borde));
    }
    if (!m.hasImage("cama-apagada")) {
      m.addImage("cama-apagada", creaCama(APAGADO[tema], borde));
    }
    if (!m.hasImage("base-salida")) {
      m.addImage("base-salida", creaBase(GRAFITO[tema], borde));
    }

    if (!m.getSource("municipios")) {
      // Debajo de los nombres del mapa base, para que el velo no tape las
      // ciudades. Todo lo demás del plan va encima de ellos.
      const debajo = m.getStyle().layers.find((c) => c.type === "symbol")?.id;
      m.addSource("municipios", {
        type: "geojson",
        data: new URL(MUNICIPIOS, window.location.href).href,
      });
      m.addLayer({
        id: "municipios-velo",
        type: "fill",
        source: "municipios",
        filter: ["has", "municipio"],
        paint: {
          "fill-color": GRAFITO[tema],
          // El certificado lleva velo cero y no se filtra fuera: tiene que
          // seguir respondiendo al cursor para decir de quién es.
          "fill-opacity": ["case", ["get", "se_valle"], VELO_SE[tema], 0],
        },
      }, debajo);
      m.addLayer({
        id: "municipios-limite",
        type: "line",
        source: "municipios",
        filter: ["has", "municipio"],
        paint: {
          "line-color": LIMITE_MPIO[tema],
          "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.5, 11, 1],
        },
      }, debajo);
      m.addLayer({
        id: "municipios-se",
        type: "line",
        source: "municipios",
        filter: ["has", "contorno_se_valle"],
        layout: { "line-join": "round" },
        paint: {
          "line-color": GRAFITO[tema],
          "line-width": ["interpolate", ["linear"], ["zoom"], 7, 1.4, 11, 2.2],
          "line-opacity": 0.8,
        },
      }, debajo);
    }

    if (!m.getSource("tramos")) {
      m.addSource("tramos", { type: "geojson", data: VACIA as never });
      m.addLayer({
        id: "tramos-halo",
        type: "line",
        source: "tramos",
        // Solo debajo de lo que está pasando hoy. Un halo de superficie bajo el
        // rastro de días pasados lo resaltaría en vez de dejarlo de fondo.
        filter: ["get", "hoy"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": SUPERFICIE[tema],
          "line-width": ["interpolate", ["linear"], ["zoom"], 7, 4.5, 12, 8],
          "line-opacity": 0.85,
        },
      });
      // Dos capas y no una con el guion por expresión: `line-dasharray` no
      // admite expresiones de dato en MapLibre, así que la ida y el trayecto de
      // la tarde tienen que ser capas distintas filtradas por el momento.
      const ancho: maplibregl.DataDrivenPropertyValueSpecification<number> = [
        "interpolate", ["linear"], ["zoom"], 7,
        ["case", ["get", "hoy"], 2.6, 1.6], 12,
        ["case", ["get", "hoy"], 4, 2.4],
      ];
      m.addLayer({
        id: "tramos-manana",
        type: "line",
        source: "tramos",
        filter: ["==", ["get", "momento"], "manana"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": ancho,
                 "line-opacity": 0.9 },
      });
      m.addLayer({
        id: "tramos-tarde",
        type: "line",
        source: "tramos",
        filter: ["==", ["get", "momento"], "tarde"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": ancho,
                 "line-opacity": 0.9, "line-dasharray": [1.4, 1.6] },
      });
    }

    if (!m.getSource("poblados")) {
      m.addSource("poblados", { type: "geojson", data: VACIA as never });
      m.addLayer({
        id: "poblados-punto",
        type: "symbol",
        source: "poblados",
        layout: { "icon-image": ["get", "icono"], "icon-size": 0.5,
                  "icon-allow-overlap": true },
      });
    }

    if (!m.getSource("bases")) {
      m.addSource("bases", { type: "geojson", data: VACIA as never });
      m.addLayer({
        id: "bases-punto",
        type: "symbol",
        source: "bases",
        layout: { "icon-image": "base-salida", "icon-size": 0.55,
                  "icon-allow-overlap": true },
      });
    }

    if (!m.getSource("sedes")) {
      m.addSource("sedes", { type: "geojson", data: VACIA as never });
      m.addLayer({
        id: "sedes-punto",
        type: "symbol",
        source: "sedes",
        layout: {
          "icon-image": ["get", "icono"],
          "icon-size": ["case", ["get", "elegida"], 0.68, 0.5],
          "icon-allow-overlap": true,
        },
      });
      m.on("click", "sedes-punto", (e) => {
        const p = e.features?.[0]?.properties as Record<string, string> | undefined;
        if (p) alSeleccionar.current(p.dane);
      });
      m.on("mouseenter", "sedes-punto", () => {
        m.getCanvas().style.cursor = "pointer";
      });
      m.on("mouseleave", "sedes-punto", () => {
        m.getCanvas().style.cursor = "";
      });
      // Un clic en el vacío suelta la selección. Sin esto la ficha se queda
      // abierta y no hay forma de cerrarla sin escoger otra escuela.
      m.on("click", (e) => {
        const hay = m.queryRenderedFeatures(e.point, { layers: ["sedes-punto"] });
        if (hay.length === 0) alSeleccionar.current(null);
      });
    }

    // Los móviles van de últimos: tienen que quedar por encima de todo, que para
    // eso son lo que se está mirando.
    if (!m.getSource("moviles")) {
      m.addSource("moviles", { type: "geojson", data: VACIA as never });
      m.addLayer({
        id: "moviles-punto",
        type: "symbol",
        source: "moviles",
        layout: { "icon-image": ["get", "icono"], "icon-size": TAMANO_MOVIL,
                  // `icon-offset` se multiplica por `icon-size`, de ahí la
                  // división. Va con `match` porque la expresión no deja
                  // armar el par a partir de un número del rasgo.
                  "icon-offset": ["match", ["get", "corrida"],
                    1, ["literal", [CORRIMIENTO_PX / TAMANO_MOVIL, 0]],
                    2, ["literal", [(2 * CORRIMIENTO_PX) / TAMANO_MOVIL, 0]],
                    ["literal", [0, 0]]],
                  "icon-allow-overlap": true, "icon-ignore-placement": true },
      });
    }
  };

  useEffect(() => {
    if (!caja.current || mapa.current) return;
    const m = new maplibregl.Map({
      container: caja.current,
      style: ESTILO[tema],
      center: VISTA_INICIAL.center,
      zoom: VISTA_INICIAL.zoom,
      attributionControl: { compact: true },
    });
    m.setPadding(margenPanel());
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }),
                 "bottom-right");
    m.addControl(new ControlInicio(() => alSeleccionar.current(null)),
                 "bottom-right");
    m.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
    mapa.current = m;
    m.on("load", () => {
      listo.current = true;
      pinta.current(m);
      setCapasListas((x) => x + 1);
    });

    // Un solo globo para las dos cosas que responden al cursor. Encima de una
    // escuela dice quién es y en qué estado está; fuera de ellas, de quién es
    // el municipio.
    const globo = new maplibregl.Popup({
      closeButton: false, closeOnClick: false, offset: 10,
    });
    m.on("mousemove", (e) => {
      if (!m.getLayer("municipios-velo")) return;
      const pin = m.getLayer("sedes-punto")
        ? m.queryRenderedFeatures(e.point, { layers: ["sedes-punto"] })[0]
        : undefined;
      if (pin) {
        globo.setLngLat(e.lngLat).setDOMContent(globoSede(
          pin.properties as Record<string, unknown>)).addTo(m);
        return;
      }
      const f = m.queryRenderedFeatures(e.point, {
        layers: ["municipios-velo"],
      })[0];
      if (!f) {
        globo.remove();
        return;
      }
      const p = f.properties as {
        municipio: string; se_valle: boolean; sedes_plan: number;
      };
      const n = Number(p.sedes_plan);
      const nodo = document.createElement("div");
      const titulo = document.createElement("div");
      titulo.style.fontWeight = "600";
      titulo.textContent = p.municipio;
      const linea = document.createElement("div");
      linea.style.fontSize = "11px";
      linea.style.color = "var(--tinta-2)";
      linea.textContent = String(p.se_valle) === "true"
        ? `SE del Valle · ${n === 0 ? "ninguna sede" : n === 1 ? "1 sede" : `${n} sedes`} del plan`
        : "Secretaría propia · fuera de la SE del Valle";
      nodo.append(titulo, linea);
      globo.setLngLat(e.lngLat).setDOMContent(nodo).addTo(m);
    });
    m.on("mouseout", () => globo.remove());
    return () => {
      m.remove();
      mapa.current = null;
      listo.current = false;
    };
    // El mapa se crea una sola vez. El cambio de tema se atiende aparte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El cambio de tema recarga el estilo base, y con él se van todas las capas.
  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo.current) return;
    m.setStyle(ESTILO[tema]);
    m.once("styledata", () => {
      pinta.current(m);
      setCapasListas((x) => x + 1);
    });
  }, [tema]);

  // Las líneas, las escuelas y los poblados. Se recalculan enteros en cada
  // cambio: son 43 escuelas y unos cientos de tramos, así que no hay nada que
  // optimizar y sí mucho que enredar.
  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo.current || !plan || !tramos) return;

    const suya = (c: string) => cuadrilla === null || c === cuadrilla;

    // Lo apagado se apaga por COLOR y no por opacidad: `line-opacity` con
    // expresión de dato no es de fiar entre versiones de MapLibre, y un tramo
    // que a veces se dibuja a plena opacidad rompería toda la lectura.
    const lineas = tramos.features
      .filter((r) => {
        const p = r.properties;
        if (reposo) return false;
        if (p.escenario !== escenario || !suya(p.cuadrilla)) return false;
        return diaActual === null || p.dia_corrido <= diaActual;
      })
      .map((r) => {
        const p = r.properties;
        const hoy = diaActual !== null && p.dia_corrido === diaActual;
        return {
          ...r,
          properties: {
            ...p,
            hoy,
            color: hoy || diaActual === null
              ? colorCuadrilla(p.cuadrilla, oscuro)
              : APAGADO[tema],
          },
        };
      })
      // Lo de hoy se dibuja de último para que quede encima del rastro.
      .sort((a, b) => Number(a.properties.hoy) - Number(b.properties.hoy));
    (m.getSource("tramos") as maplibregl.GeoJSONSource)?.setData({
      type: "FeatureCollection", features: lineas as never,
    });

    const delEscenario = plan.sedes.filter((s) => s.escenario === escenario);

    const sedes = delEscenario.map((s) => {
      // Una escuela se prende cuando ya se visitó. Antes está ahí pero apagada:
      // borrarla diría que no existe, y prenderla diría que ya se hizo.
      const hecha = diaActual === null || reposo ||
        visitadas.has(s.dane_propuesto);
      const on = hecha && suya(s.cuadrilla);
      return {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [s.lon_final, s.lat_final] },
        properties: {
          dane: s.dane_propuesto,
          icono: on ? `dia-${s.cuadrilla}-${s.dia_corrido}` : "dia-apagado",
          elegida: s.dane_propuesto === seleccion,
          // Lo que dice el globo al pasar el cursor.
          nombre: s.sede,
          municipio: s.municipio,
          cuadrilla: s.cuadrilla,
          dia: s.dia_corrido,
          concepto: s.concepto ?? "",
          dictamen: s.dictamen ?? "",
          dificil: Boolean(s.acceso_dificil),
        },
      };
    });
    (m.getSource("sedes") as maplibregl.GeoJSONSource)?.setData({
      type: "FeatureCollection", features: sedes as never,
    });

    // Los poblados donde se duerme. Solo los que el plan usa de verdad, y solo
    // hasta el día que se está viendo: dibujar los 27 candidatos llenaría el
    // mapa de sitios donde nadie va.
    const porPoblado = new Map<string, { cuadrilla: string; on: boolean }>();
    for (const s of delEscenario) {
      if (reposo || !s.fuera_de_base) continue;
      if (diaActual !== null && (s.semana - 1) * 5 + s.dia > diaActual) continue;
      const on = suya(s.cuadrilla);
      const ya = porPoblado.get(s.duerme_en);
      if (!ya || (on && !ya.on)) {
        porPoblado.set(s.duerme_en, { cuadrilla: s.cuadrilla, on });
      }
    }
    const coord = new Map(plan.lugares.map((l) => [l.nombre, l]));
    const poblados = [...porPoblado.entries()].flatMap(([nombre, v]) => {
      const l = coord.get(nombre);
      if (!l) return [];
      return [{
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [l.lon, l.lat] },
        properties: { nombre, icono: v.on ? `cama-${v.cuadrilla}` : "cama-apagada" },
      }];
    });
    (m.getSource("poblados") as maplibregl.GeoJSONSource)?.setData({
      type: "FeatureCollection", features: poblados as never,
    });

    (m.getSource("bases") as maplibregl.GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: plan.lugares
        .filter((l) => l.tipo === "base")
        .map((l) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [l.lon, l.lat] },
          properties: { nombre: l.nombre },
        })) as never,
    });
  }, [plan, tramos, escenario, diaActual, visitadas, reposo, cuadrilla,
      seleccion, oscuro, tema, capasListas]);

  // Los móviles, aparte y en su propio efecto: se mueven sesenta veces por
  // segundo y no tienen por qué arrastrar el recálculo de todo lo demás.
  // Al cambiar el zoom dos cuadrillas pueden empezar o dejar de taparse, así que
  // la separación se recalcula aunque el reloj esté quieto.
  const [zoomTic, setZoomTic] = useState(0);
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    const alZoom = () => setZoomTic((x) => x + 1);
    m.on("zoomend", alZoom);
    return () => {
      m.off("zoomend", alZoom);
    };
  }, []);

  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo.current) return;
    const fuente = m.getSource("moviles") as maplibregl.GeoJSONSource | undefined;
    if (!fuente) return;
    const visibles = moviles.filter(
      (v) => v.punto && (cuadrilla === null || v.cuadrilla === cuadrilla),
    );
    // Las dos cuadrillas de Cali salen del mismo punto y una tapaba a la otra.
    // La que llega segunda a un sitio ocupado se corre a la derecha, en
    // píxeles de pantalla: el punto en el mapa sigue siendo el verdadero.
    const ocupados: maplibregl.Point[] = [];
    const features = visibles.map((v) => {
      const px = m.project(v.punto!);
      const encima = ocupados.filter((o) => o.dist(px) < CHOQUE_PX).length;
      ocupados.push(px);
      return {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: v.punto! },
        properties: {
          icono: `movil-${v.cuadrilla}`,
          fase: v.fase,
          corrida: Math.min(encima, 2),
        },
      };
    });
    fuente.setData({ type: "FeatureCollection", features: features as never });
  }, [moviles, cuadrilla, zoomTic, capasListas]);

  // El encuadre de la simulación. Cabe todo lo que se va a recorrer en el
  // escenario: los trazados, las escuelas y las dos bases. Lo que tapan las
  // tarjetas y el panel de abajo se descuenta con el margen. Al apagarla se
  // vuelve a la vista de entrada.
  const encuadrado = useRef(false);
  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo.current || !plan || !tramos) return;
    if (!simulando) {
      if (encuadrado.current) {
        m.easeTo({ ...VISTA_INICIAL, padding: margenPanel(), duration: 700 });
        encuadrado.current = false;
      }
      return;
    }
    const caja = new maplibregl.LngLatBounds();
    for (const r of tramos.features) {
      if (r.properties.escenario !== escenario) continue;
      for (const c of r.geometry.coordinates) caja.extend(c);
    }
    for (const l of plan.lugares) {
      if (l.tipo === "base") caja.extend([l.lon, l.lat]);
    }
    if (caja.isEmpty()) return;
    const ancho = window.innerWidth >= 768;
    // El margen fijo del mapa se suma al del encuadre: sin ponerlo en cero, el
    // panel izquierdo se descontaba dos veces y el recorrido quedaba corrido.
    m.setPadding(SIN_MARGEN);
    m.fitBounds(caja, {
      padding: {
        top: 56,
        right: ancho ? 72 : 24,
        bottom: altoSimulacion + 16,
        left: ancho ? MARGEN_PANEL.left + 16 : 24,
      },
      duration: 800,
    });
    encuadrado.current = true;
  }, [simulando, escenario, plan, tramos, altoSimulacion, capasListas]);

  // Al escoger una escuela el mapa va hacia ella. Sin esto hay que buscar a mano
  // en el mapa lo que ya se escogió en el panel, que es el error que hace inútil
  // una lista al lado de un mapa.
  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo.current || !plan || !seleccion) return;
    const s = plan.sedes.find(
      (x) => x.escenario === escenario && x.dane_propuesto === seleccion,
    );
    if (s) {
      m.easeTo({ center: [s.lon_final, s.lat_final],
                 zoom: Math.max(m.getZoom(), 11) });
    }
  }, [plan, escenario, seleccion]);

  return <div ref={caja} className="h-full w-full" />;
}
