/** El plan de campo de las 43 sedes: tipos y carga.
 *
 * Los archivos los escribe el script 78 del repositorio de análisis. Aquí no se
 * calcula nada: lo que llega son tres planes ya resueltos al óptimo y los
 * trazados de carretera con los que se dibujaron. Esta capa solo los tipa y los
 * agrupa.
 *
 * Por qué son tres planes y no uno. Lo que el TdR fija son 3 cuadrillas, 5
 * visitas por cuadrilla por semana y 3 semanas de campo. Cinco visitas en cinco
 * días son una visita por día, así que dentro del día no hay recorrido que
 * optimizar. Lo único que mueve el total es dónde duerme la cuadrilla, y eso
 * depende de lo que cueste una noche de hotel, que no sabemos. Los tres
 * escenarios son el mismo modelo con distintos sitios permitidos para dormir:
 *
 *   base       vuelve a Cali o a Pereira todas las noches
 *   ciudad     duerme en la ciudad principal más cercana del corredor
 *   municipio  duerme en la cabecera del municipio, o en una ciudad si conviene
 *
 * Por qué vive aparte de `datos.ts`. Ese archivo carga el mapa de la emergencia,
 * que responde «a dónde mandar a alguien a mirar primero». El plan responde otra
 * cosa: «quién va, qué día, dónde duerme y por dónde entra». Son dos preguntas y
 * dos pantallas, y mezclarlas habría metido 43 sedes del BID dentro de un
 * archivo que habla de 52.823.
 */

/** Cuál de los tres planes se está mirando. */
export type Escenario = "base" | "ciudad" | "municipio";

/** Una sede con su día asignado, dónde se duerme, y todo lo que se puede saber
 *  sin ir. Hay una fila por sede y por escenario. */
export type SedePlan = {
  escenario: Escenario;
  dane_propuesto: string;
  sede: string;
  institucion: string;
  municipio: string;
  lat_final: number;
  lon_final: number;
  matricula_libro: number | null;
  especialidad_visita: string | null;

  base: string;
  cuadrilla: string;
  semana: number;
  dia: number;
  /** El día de campo del 1 al 15. Es el número que va escrito en el pin. */
  dia_corrido: number;
  /** El poblado de donde sale esa mañana y donde duerme esa noche. En el
   *  escenario de base los dos son su propia base. */
  sale_de: string;
  duerme_en: string;
  fuera_de_base: boolean;

  min_manana: number;
  min_tarde: number;
  min_carretera_del_dia: number;
  km_del_dia: number;

  /** Ida y vuelta desde la base, por separado: la matriz es asimétrica y el
   *  doble de la ida no es el viaje redondo. `min_piso` y `min_techo` son el
   *  rango que dejaron los tres motores de ruteo sobre la ida. */
  min_ida_desde_base: number;
  min_vuelta_a_base: number;
  min_piso: number;
  min_techo: number;

  /** Por dónde se entra. */
  tipo_acceso: string | null;
  acceso_dificil: boolean | null;
  nombre_util: string | null;
  origen_del_nombre: string | null;
  dist_via_m: number | null;
  sinc_nombre_via: string | null;
  sinc_categoria: string | null;
  sinc_competencia: string | null;

  /** Lo que el formulario del IDIGER pide en su primera caja. */
  predio: string | null;
  terreno_m2: number | null;
  construida_m2: number | null;
  veredicto_catastro: string | null;
  punto_sobre_huella: boolean | null;
  huellas_100m: number | null;

  /** Identificación. La dirección es la del SIMAT. */
  direccion: string | null;
  zona_libro: string | null;

  /** Fotos del FFIE, de la encuesta de 2022: anteriores al sismo. */
  fotos_ffie: string[] | null;
  fecha_encuesta: string | null;

  /** Por qué el acceso es fácil o difícil, en una frase. */
  fclass_via: string | null;
  acceso_razon: string | null;

  /** Qué tanto creerle a las áreas del catastro: alta, media, baja o sin dato,
   *  con la razón escrita. */
  confianza_areas: string | null;
  confianza_areas_razon: string | null;

  /** Lo que dice el tablero de la Secretaría del Valle. El concepto es la
   *  escala de habitabilidad del formulario IDIGER; sin dictamen aprobado no
   *  está en firme. */
  concepto: Concepto | null;
  concepto_orden: number | null;
  dictamen: string | null;
  declaracion_rector: string | null;
  observacion_rector: string | null;
  fichas: FichaAis[] | null;
  fotos_reporte: FotoReporte[] | null;
};

export type Concepto =
  | "Habitable"
  | "Uso restringido"
  | "No habitable"
  | "Peligro de colapso";

export type FichaAis = {
  ficha: string;
  concepto: string;
  tipo: string;
  dictamen: string;
};

/** Un daño que reportó el rector, con su foto en Drive. */
export type FotoReporte = {
  url: string;
  zona: string;
  descripcion: string;
  fecha: string;
};

/** Los cuatro colores del formulario IDIGER: verde, amarillo, naranja y rojo.
 *  `tinta` es el color del texto encima, que en el amarillo tiene que ser
 *  oscuro para leerse. */
export const COLOR_CONCEPTO: Record<Concepto, { fondo: string; tinta: string }> = {
  Habitable: { fondo: "#2e9d57", tinta: "#ffffff" },
  "Uso restringido": { fondo: "#e8b92a", tinta: "#1a1a19" },
  "No habitable": { fondo: "#e8741f", tinta: "#ffffff" },
  "Peligro de colapso": { fondo: "#c8322b", tinta: "#ffffff" },
};

/** Una semana-cuadrilla: la unidad de planeación que fija el TdR. */
export type Bloque = {
  escenario: Escenario;
  cuadrilla: string;
  semana: number;
  base: string;
  sedes: number;
  municipios: string;
  noches_fuera: number;
  /** Los poblados donde pasa las noches esa semana, o «—» si vuelve siempre. */
  duerme: string;
  min_carretera: number;
  recorrido: string;
};

export type ResumenEscenario = {
  escenario: Escenario;
  glosa: string;
  horas_carretera: number;
  /** La cota que el solucionador demuestra cuando no alcanzó a probar el
   *  óptimo. Si hay un plan mejor, no baja de aquí. */
  cota_horas: number;
  optimo_probado: boolean;
  noches_fuera: number;
  km: number;
  dias_apretados: number;
  min_dia_mediano: number;
  min_dia_peor: number;
};

export type Lugar = {
  nombre: string;
  tipo: "base" | "ciudad" | "cabecera";
  lat: number;
  lon: number;
  sedes_urbanas: number | null;
  matricula_urbana: number | null;
};

export type Plan = {
  generado: string;
  tdr: {
    cuadrillas: number;
    semanas_campo: number;
    visitas_por_semana: number;
    sedes: number;
    cupos: number;
  };
  escenarios: ResumenEscenario[];
  bloques: Bloque[];
  sedes: SedePlan[];
  lugares: Lugar[];
  /** Cuándo se consultó el tablero del Valle y desde cuándo no cambia. */
  tablero_valle: { consultado: string; sin_cambios_desde: string };
};

/** Un tramo dibujado: el trazado real por carretera de un desplazamiento.
 *
 * La geometría va tipada a mano y no con el espacio de nombres `GeoJSON`, que
 * este proyecto no tiene instalado. Es el mismo camino que sigue `tipos.ts` con
 * las sedes de la emergencia.
 */
export type TramoPlan = {
  escenario: Escenario;
  cuadrilla: string;
  semana: number;
  dia: number;
  /** El día corrido del 1 al 15, que es el eje de la reproducción. Lo calcula
   *  el script 78 para que el número sea el mismo en el informe y en pantalla. */
  dia_corrido: number;
  momento: "manana" | "tarde";
  /** El poblado del otro extremo: de donde sale o donde duerme. */
  poblado: string;
  sede: string;
  dane: string;
  municipio: string;
  min: number;
  km: number;
};

export async function cargaPlan(): Promise<Plan> {
  const r = await fetch("datos/plan_campo.json");
  if (!r.ok) throw new Error("no se pudo cargar el plan de campo");
  return (await r.json()) as Plan;
}

export type RasgoTramo = {
  type: "Feature";
  properties: TramoPlan;
  geometry: { type: "LineString"; coordinates: [number, number][] };
};

export type ColeccionTramos = {
  type: "FeatureCollection";
  features: RasgoTramo[];
};

export async function cargaTramos(): Promise<ColeccionTramos> {
  const r = await fetch("datos/plan_tramos.geojson");
  if (!r.ok) throw new Error("no se pudieron cargar los tramos");
  return (await r.json()) as ColeccionTramos;
}

/** El color de cada cuadrilla.
 *
 * Son las tres primeras casillas de la paleta categórica de referencia, en su
 * orden fijo, que es el único trío que pasa el validador contra TODOS los pares
 * y no solo contra los adyacentes: es lo que pide un mapa, donde dos colores
 * cualesquiera pueden quedar uno al lado del otro. Peor par con daltonismo 9,2
 * en claro y 9,4 en oscuro; a visión normal 24,0 y 20,9.
 *
 * El aguamarina se queda por debajo de 3:1 sobre la superficie clara, así que el
 * color nunca va solo: la cuadrilla se rotula con su letra en el panel, en la
 * leyenda y en la ficha.
 *
 * Son las mismas casillas 1 y 2 que en el mapa de la emergencia significan sede
 * encuestada y sede nunca encuestada. No hay choque porque esas dos categorías
 * no existen en esta pantalla: aquí las 43 sedes son todas del mismo tipo y lo
 * único que las separa es quién las visita.
 */
export const COLOR_CUADRILLA: Record<string, { claro: string; oscuro: string }> = {
  A: { claro: "#2a78d6", oscuro: "#3987e5" },
  B: { claro: "#eb6834", oscuro: "#d95926" },
  C: { claro: "#1baf7a", oscuro: "#199e70" },
};

export function colorCuadrilla(c: string, oscuro: boolean): string {
  const par = COLOR_CUADRILLA[c] ?? COLOR_CUADRILLA.A;
  return oscuro ? par.oscuro : par.claro;
}

/** Horas y minutos, que es como se lee una jornada. «2:35 h», no «155 min». */
export function hm(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")} h` : `${m} min`;
}

/** Los días de una semana-cuadrilla en un escenario, en orden. */
export function diasDelBloque(
  plan: Plan,
  escenario: Escenario,
  cuadrilla: string,
  semana: number,
): SedePlan[] {
  return plan.sedes
    .filter(
      (s) =>
        s.escenario === escenario &&
        s.cuadrilla === cuadrilla &&
        s.semana === semana,
    )
    .sort((a, b) => a.dia - b.dia);
}

/** Las cuadrillas que hay, en orden. */
export function cuadrillas(plan: Plan): string[] {
  return [...new Set(plan.bloques.map((b) => b.cuadrilla))].sort();
}

/** Un día con más de media jornada de carretera deja menos de media para
 *  inspeccionar con el formulario del IDIGER, que son dos páginas. El umbral es
 *  nuestro y no del TdR: señala el día, no lo descarta. */
export const MIN_DIA_APRETADO = 240;

export const NOMBRE_ESCENARIO: Record<Escenario, string> = {
  base: "Vuelve a la base",
  ciudad: "Duerme en ciudad",
  municipio: "Duerme en el municipio",
};

// --------------------------------------------------------------------------- //
// La animación: recorrer el plan del día 1 al 15 y ver subir el contador
// --------------------------------------------------------------------------- //

/** El día corrido, del 1 al 15. Las tres cuadrillas se mueven el mismo día. */
export const DIAS_DE_CAMPO = 15;

/** La jornada contra la que se mide si un día cabe.
 *
 * Ocho horas es nuestro, no del TdR, y por eso se dice en pantalla. Sirve para
 * que la barra de un día tenga contra qué medirse.
 */
export const JORNADA_MIN = 8 * 60;

/** Cuánto dura una inspección. NO LO SABEMOS y no se puede deducir.
 *
 * El TdR lo esquiva al fijar 5 visitas por cuadrilla por semana: ese número ya
 * la trae adentro, pero no la separa del desplazamiento. En vez de inventar una
 * cifra, la pantalla la pone como control: quien mira mueve el valor y ve cuántos
 * días se salen de la jornada. El valor de arranque es solo el punto medio del
 * rango, y la pantalla dice que es un supuesto suyo.
 */
export const INSPECCION_MIN_DEFECTO = 180;
export const INSPECCION_RANGO: [number, number] = [60, 360];

/** Una línea preparada para interpolar posiciones sobre ella.
 *
 * `acum` lleva la distancia acumulada hasta cada vértice. Se calcula en el plano
 * y no sobre la esfera a propósito: lo único que se hace con ella es repartir un
 * recorrido en fracciones para mover un punto, y a esta escala la diferencia no
 * se ve. El kilometraje que se muestra NO sale de aquí: sale medido de Mapbox.
 */
export type Recorrido = {
  coords: [number, number][];
  acum: number[];
  total: number;
};

export function preparaRecorrido(coords: [number, number][]): Recorrido {
  const acum = [0];
  for (let i = 1; i < coords.length; i++) {
    const [x1, y1] = coords[i - 1];
    const [x2, y2] = coords[i];
    // El coseno de la latitud corrige que un grado de longitud mide menos que
    // uno de latitud. Sin eso el punto se movería a tirones en los tramos que
    // van de oriente a occidente.
    const dx = (x2 - x1) * Math.cos((((y1 + y2) / 2) * Math.PI) / 180);
    const dy = y2 - y1;
    acum.push(acum[i - 1] + Math.hypot(dx, dy));
  }
  return { coords, acum, total: acum[acum.length - 1] || 1 };
}

/** Dónde está el punto cuando lleva recorrida la fracción `f` de la línea. */
export function puntoEn(r: Recorrido, f: number): [number, number] {
  if (r.coords.length === 0) return [0, 0];
  const objetivo = Math.max(0, Math.min(1, f)) * r.total;
  let i = 1;
  while (i < r.acum.length && r.acum[i] < objetivo) i++;
  if (i >= r.coords.length) return r.coords[r.coords.length - 1];
  const t0 = r.acum[i - 1];
  const t1 = r.acum[i];
  const p = t1 > t0 ? (objetivo - t0) / (t1 - t0) : 0;
  const [x1, y1] = r.coords[i - 1];
  const [x2, y2] = r.coords[i];
  return [x1 + (x2 - x1) * p, y1 + (y2 - y1) * p];
}

/** El guion de un día para una cuadrilla: la mañana, la inspección y la tarde. */
export type GuionDia = {
  diaCorrido: number;
  semana: number;
  dia: number;
  cuadrilla: string;
  dane: string;
  sede: string;
  municipio: string;
  saleDe: string;
  duermeEn: string;
  fueraDeBase: boolean;
  minManana: number;
  minTarde: number;
  kmManana: number;
  kmTarde: number;
  manana: Recorrido | null;
  tarde: Recorrido | null;
};

/** Arma el guion completo de un escenario, listo para reproducir. */
export function armaGuion(plan: Plan, tramos: ColeccionTramos, escenario: Escenario) {
  const porClave = new Map<string, RasgoTramo>();
  for (const r of tramos.features) {
    const p = r.properties;
    if (p.escenario !== escenario) continue;
    porClave.set(`${p.cuadrilla}|${p.semana}|${p.dia}|${p.momento}`, r);
  }
  const guion: GuionDia[] = [];
  for (const s of plan.sedes) {
    if (s.escenario !== escenario) continue;
    const k = `${s.cuadrilla}|${s.semana}|${s.dia}`;
    const m = porClave.get(`${k}|manana`);
    const t = porClave.get(`${k}|tarde`);
    guion.push({
      diaCorrido: (s.semana - 1) * 5 + s.dia,
      semana: s.semana,
      dia: s.dia,
      cuadrilla: s.cuadrilla,
      dane: s.dane_propuesto,
      sede: s.sede,
      municipio: s.municipio,
      saleDe: s.sale_de,
      duermeEn: s.duerme_en,
      fueraDeBase: s.fuera_de_base,
      minManana: s.min_manana,
      minTarde: s.min_tarde,
      kmManana: m ? m.properties.km : 0,
      kmTarde: t ? t.properties.km : 0,
      manana: m ? preparaRecorrido(m.geometry.coordinates) : null,
      tarde: t ? preparaRecorrido(t.geometry.coordinates) : null,
    });
  }
  return guion.sort((a, b) => a.diaCorrido - b.diaCorrido
    || a.cuadrilla.localeCompare(b.cuadrilla));
}

/** Dónde va una cuadrilla, y cuánto lleva acumulado, en un instante del día.
 *
 * `t` son minutos de jornada desde que arranca el día, no una hora del reloj. No
 * se muestra una hora en pantalla porque sería inventarla: lo que está medido es
 * cuánto dura cada trayecto, no a qué hora ocurre cada cosa. Lo único fijado es
 * que la mañana se midió saliendo a las 7 y la tarde saliendo a las 4.
 */
export type Estado = {
  fase: "manana" | "inspeccion" | "tarde" | "fin";
  punto: [number, number] | null;
  /** Minutos y kilómetros de carretera ya hechos ese día hasta el instante `t`. */
  minHechos: number;
  kmHechos: number;
};

export function estadoEn(g: GuionDia, t: number, inspeccion: number): Estado {
  const finManana = g.minManana;
  const finInspeccion = finManana + inspeccion;
  const finDia = finInspeccion + g.minTarde;
  if (t < finManana) {
    const f = finManana > 0 ? t / finManana : 1;
    return {
      fase: "manana",
      punto: g.manana ? puntoEn(g.manana, f) : null,
      minHechos: t,
      kmHechos: g.kmManana * f,
    };
  }
  if (t < finInspeccion) {
    return {
      fase: "inspeccion",
      punto: g.manana ? puntoEn(g.manana, 1) : null,
      minHechos: g.minManana,
      kmHechos: g.kmManana,
    };
  }
  if (t < finDia) {
    const f = g.minTarde > 0 ? (t - finInspeccion) / g.minTarde : 1;
    return {
      fase: "tarde",
      punto: g.tarde ? puntoEn(g.tarde, f) : null,
      minHechos: g.minManana + g.minTarde * f,
      kmHechos: g.kmManana + g.kmTarde * f,
    };
  }
  return {
    fase: "fin",
    punto: g.tarde ? puntoEn(g.tarde, 1) : null,
    minHechos: g.minManana + g.minTarde,
    kmHechos: g.kmManana + g.kmTarde,
  };
}

/** Cuánto dura el día más largo de una jornada, que es lo que hay que esperar
 *  antes de pasar al día siguiente: las tres cuadrillas salen el mismo día. */
export function largoDelDia(guion: GuionDia[], diaCorrido: number, inspeccion: number) {
  const hoy = guion.filter((g) => g.diaCorrido === diaCorrido);
  if (hoy.length === 0) return 0;
  return Math.max(...hoy.map((g) => g.minManana + inspeccion + g.minTarde));
}
