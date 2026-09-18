/** El plan de campo: tipos y carga.
 *
 * Los archivos los escribe el script 84 del repositorio de análisis. Aquí no se
 * calcula nada: lo que llega son planes ya resueltos y los trazados de carretera
 * con los que se dibujaron. Esta capa solo los tipa y los agrupa.
 *
 * Por qué son varios planes y no uno. No son variantes del mismo trabajo: son
 * alcances distintos. Las 43 sedes que pidió el BID, esas más las que aportan
 * tres secretarías certificadas, y las 91 de las cinco, que se cubren de dos
 * formas: una cuarta cuadrilla o una cuarta semana. El de 70 es la
 * recomendación. Cambia el número de sedes, de cuadrillas y de días de campo,
 * así que nada de eso se puede suponer: cada escenario lo trae en su resumen.
 *
 * Por qué vive aparte de `datos.ts`. Ese archivo carga el mapa de la emergencia,
 * que responde «a dónde mandar a alguien a mirar primero». El plan responde otra
 * cosa: «quién va, qué día, dónde duerme y por dónde entra». Son dos preguntas y
 * dos pantallas, y mezclarlas habría metido 43 sedes del BID dentro de un
 * archivo que habla de 52.823.
 */

/** Cuál de los planes se está mirando.
 *
 * Antes era el reparto de las cuadrillas (por municipio o sede por sede).
 * Desde el 17-sep-2026 el reparto libre se retiró y la palabra pasó a
 * significar el alcance: hasta dónde llega el plan. Las claves las fija el
 * script 84 y el visor no las conoce de antemano, así que van como texto y el
 * rótulo viaja con los datos. */
export type Escenario = string;

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
  /** El día de campo, corrido. Es el número que va escrito en el pin. */
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
  min_ida_desde_base: number | null;
  min_vuelta_a_base: number | null;
  min_piso: number | null;
  min_techo: number | null;

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

  /** Del plan ampliado: la posición de la visita en su día (1 o 2), de qué
   *  grupo viene (las 43 del BID o la secretaría que la aporta), si su
   *  coordenada es provisional, y el estado en la capa actual del MEN, que es
   *  la única fuente de estado para las sedes que no son del Valle. */
  orden_en_el_dia?: number;
  grupo?: string;
  en_revision?: boolean;
  estado_men_actual?: string | null;
  nivel_men_actual?: string | null;
};

/** Un día de una cuadrilla, con sus visitas en orden. */
export type DiaPlan = {
  escenario: Escenario;
  cuadrilla: string;
  dia_corrido: number;
  semana: number;
  dia: number;
  visitas: string[];
  sale_de: string;
  duerme_en: string;
  fuera_de_base: boolean;
  min_carretera: number;
  km: number;
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

/** Lo que trabaja una cuadrilla en un día promedio del plan. */
export type JornadaCuadrilla = {
  cuadrilla: string;
  dias: number;
  min_carretera_media: number;
  min_inspeccion_media: number;
  min_jornada_media: number;
};

export type ResumenEscenario = {
  escenario: Escenario;
  /** El nombre corto que va en el botón. */
  rotulo: string;
  glosa: string;
  /** La forma del escenario. Cambian los tres, así que la pantalla no puede
   *  suponer ninguno: 43, 70 o 91 sedes; 3 cuadrillas o 4; 14, 15 o 20 días. */
  sedes: number;
  cuadrillas: number;
  dias_campo: number;
  bases: Record<string, string>;
  /** Si cabe en lo que fija el TdR: 3 cuadrillas por 3 semanas. */
  en_tdr: boolean;
  /** El que abre la pantalla. Lo marca el script 84 y no se deduce acá: el
   *  alcance elegido no es el más grande que cabe en el TdR. */
  por_defecto?: boolean;
  /** Con el regreso final a la base, que no ocupa un día hábil pero se maneja.
   *  Es lo comparable con `cota_horas`. `horas_dias` es lo que suma el
   *  contador de la simulación, que recorre los días y no el regreso. */
  horas_carretera: number;
  horas_dias: number;
  horas_regreso: number;
  /** La cota que el solucionador demuestra cuando no alcanzó a probar el
   *  óptimo. Si hay un plan mejor, no baja de aquí. */
  cota_horas: number;
  optimo_probado: boolean;
  noches_fuera: number;
  km: number;
  /** Las noches que hay que pagar: las de días de campo que terminan fuera de
   *  la base más las de fin de semana, porque el plan no devuelve la cuadrilla
   *  a su casa el viernes. Es lo que va a la cotización; `noches_fuera` deja
   *  las de fin de semana por fuera y se queda corto. */
  noches_hotel: number;
  dias_apretados: number;
  min_dia_mediano: number;
  min_dia_peor: number;
  /** Minutos supuestos de una inspección. Es nuestro, no del TdR. */
  inspeccion_min: number;
  /** 3 h por sede visitada. Hereda el supuesto de `inspeccion_min`. */
  horas_inspeccion: number;
  /** Carretera (con el regreso a la base) más la inspección. */
  horas_campo: number;
  /** Jornada diaria: carretera más inspección de ese día. En minutos. */
  min_jornada_media: number;
  min_jornada_mediana: number;
  min_jornada_peor: number;
  /** Promedio diario de cada cuadrilla, para ver el reparto manejar / mirar. */
  cuadrillas_jornada: JornadaCuadrilla[];
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
  /** Lo que fija el TdR y no depende del escenario. Cuántas sedes, cuántas
   *  cuadrillas y cuántos días son de cada escenario y van en su resumen. */
  tdr: {
    cuadrillas: number;
    semanas_campo: number;
    visitas_por_semana: number;
    cupos: number;
    inspeccion_min?: number;
    jornada_min?: number;
  };
  escenarios: ResumenEscenario[];
  bloques: Bloque[];
  sedes: SedePlan[];
  lugares: Lugar[];
  dias: DiaPlan[];
  /** La copia de la capa del MEN de donde sale el estado de las sedes nuevas. */
  men_actual?: string;
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
  /** El día corrido, que es el eje de la reproducción. Lo calcula el script 84
   *  para que el número sea el mismo en el informe y en pantalla. */
  dia_corrido: number;
  momento: "manana" | "entre" | "tarde";
  /** La posición del tramo dentro del día: 0, 1 y, si hay dos visitas, 2. */
  orden: number;
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
  // La cuarta cuadrilla, que solo existe en el escenario de las 91 sedes.
  //
  // No es la cuarta casilla de la paleta de referencia. Esa es amarilla, y la
  // propia paleta advierte que amarillo y naranja juntos no pasan el piso de
  // todos los pares: visión normal 13,7 en claro y daltonismo 4,8 en oscuro.
  // Un mapa es el caso de todos los pares, porque dos cuadrillas cualesquiera
  // pueden quedar una al lado de la otra.
  //
  // Este violeta se buscó contra el validador hasta que pasaran las dos
  // versiones. Con las cuatro en juego y todos los pares: daltonismo 9,2 en
  // claro y 9,4 en oscuro, visión normal 17,2 y 17,8. El aguamarina sigue por
  // debajo de 3:1 sobre la superficie clara, así que la regla de siempre
  // aguanta: el color nunca va solo, la cuadrilla se rotula con su letra.
  D: { claro: "#5d3f91", oscuro: "#6b4c9a" },
};

export function colorCuadrilla(c: string, oscuro: boolean): string {
  const par = COLOR_CUADRILLA[c] ?? COLOR_CUADRILLA.A;
  return oscuro ? par.oscuro : par.claro;
}

/** Un decimal con coma, que es como se escribe un número en español.
 *
 * Existe porque `toFixed` siempre devuelve punto y la pantalla mezclaba las dos
 * formas: la tarjeta de resumen decía «72.7 h» y la de supuestos, «72,8 h», en
 * la misma columna y a dos centímetros de distancia. Las coordenadas de la ficha
 * siguen con punto a propósito: «3,45678, -76,12345» no se sabe dónde parte.
 */
export function coma(n: number, decimales = 1): string {
  return n.toFixed(decimales).replace(".", ",");
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

/** Las cuadrillas de un escenario, en orden.
 *
 * Por escenario y no del plan entero: el de las cinco secretarías tiene una
 * cuarta cuadrilla y los otros no. Mirándolos todos a la vez, la D salía en la
 * tabla de los escenarios de tres cuadrillas con ceros en todas las columnas.
 */
export function cuadrillas(plan: Plan, escenario?: Escenario): string[] {
  // De los días del plan y, si no hay, de los resúmenes por semana del plan
  // anterior, que el plan ampliado ya no trae.
  const fuente = plan.dias?.length ? plan.dias : plan.bloques;
  const suyos = escenario
    ? fuente.filter((b) => b.escenario === escenario)
    : fuente;
  return [...new Set(suyos.map((b) => b.cuadrilla))].sort();
}

/** Un día con más de media jornada de carretera deja menos de media para
 *  inspeccionar con el formulario del IDIGER, que son dos páginas. El umbral es
 *  nuestro y no del TdR: señala el día, no lo descarta. */
/** La secretaría de educación que responde por una sede del plan. Las 43 del
 *  BID son todas de la SE del Valle; las demás llevan en `grupo` el nombre de
 *  la secretaría certificada que las aporta. */
export const SE_VALLE = "Valle del Cauca";
export function secretariaDe(s: SedePlan): string {
  return !s.grupo || s.grupo.startsWith("BID") ? SE_VALLE : s.grupo;
}

/** Las secretarías con sedes en el escenario, la del Valle primero y las demás
 *  de mayor a menor número de sedes. */
export function secretarias(plan: Plan, escenario: Escenario): [string, number][] {
  const n = new Map<string, number>();
  for (const s of plan.sedes) {
    if (s.escenario !== escenario) continue;
    const k = secretariaDe(s);
    n.set(k, (n.get(k) ?? 0) + 1);
  }
  return [...n.entries()].sort((a, b) =>
    Number(b[0] === SE_VALLE) - Number(a[0] === SE_VALLE) || b[1] - a[1]);
}

export const MIN_DIA_APRETADO = 240;

/** El rótulo de un escenario viaja con los datos (script 84). Esto es el
 *  recurso para cuando se pide uno que ya no está en el archivo. */
export function nombreEscenario(plan: Plan, e: Escenario): string {
  return plan.escenarios.find((x) => x.escenario === e)?.rotulo ?? e;
}

/** El escenario que se muestra al entrar.
 *
 *  Lo decide el dato: el script 84 marca uno con `por_defecto` y ese abre. El
 *  18-sep-2026 es el de las 91 sedes con cuatro cuadrillas, que no cabe en el
 *  TdR, así que ninguna regla deducible del plan lo escogería.
 *
 *  Si el archivo no marca ninguno, se cae a la regla anterior: el más grande
 *  que cabe en el TdR, y si ninguno cabe, el más grande. */
export function escenarioPorDefecto(plan: Plan): Escenario {
  const marcado = plan.escenarios.find((e) => e.por_defecto);
  if (marcado) return marcado.escenario;
  const dentro = plan.escenarios.filter((e) => e.en_tdr);
  const lista = dentro.length > 0 ? dentro : plan.escenarios;
  return lista.reduce((a, b) => (b.sedes > a.sedes ? b : a)).escenario;
}

// --------------------------------------------------------------------------- //
// La animación: recorrer el plan día a día y ver subir el contador
// --------------------------------------------------------------------------- //

/** Cuántos días de campo tiene un escenario. Las cuadrillas se mueven el mismo
 *  día, así que es el día corrido más alto del plan. Deja de ser una constante
 *  porque cambia: 14 en el de solo BID, 15 en el recomendado. */
export function diasDeCampo(guion: GuionDia[]): number {
  return guion.reduce((a, g) => Math.max(a, g.diaCorrido), 0);
}

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

/** Una escuela que se visita en un día. */
export type Visita = { dane: string; sede: string; municipio: string };

/** Un paso del día: manejar un tramo o inspeccionar una escuela. */
export type Paso =
  | {
      tipo: "viaje";
      momento: "manana" | "entre" | "tarde";
      min: number;
      km: number;
      rec: Recorrido | null;
    }
  | { tipo: "inspeccion"; dane: string };

/** El guion de un día para una cuadrilla: sus tramos y sus inspecciones, en
 *  orden. Un día tiene una o dos visitas; con dos, entre las inspecciones hay
 *  un tramo de una escuela a la otra. */
export type GuionDia = {
  diaCorrido: number;
  semana: number;
  dia: number;
  cuadrilla: string;
  visitas: Visita[];
  saleDe: string;
  duermeEn: string;
  fueraDeBase: boolean;
  minCarretera: number;
  kmCarretera: number;
  pasos: Paso[];
};

/** Arma el guion completo, listo para reproducir. */
export function armaGuion(plan: Plan, tramos: ColeccionTramos, escenario: Escenario) {
  const porDia = new Map<string, RasgoTramo[]>();
  for (const r of tramos.features) {
    const p = r.properties;
    if (p.escenario !== escenario) continue;
    const k = `${p.cuadrilla}|${p.dia_corrido}`;
    porDia.set(k, [...(porDia.get(k) ?? []), r]);
  }
  const sede = new Map(
    plan.sedes
      .filter((s) => s.escenario === escenario)
      .map((s) => [s.dane_propuesto, s]),
  );
  const guion: GuionDia[] = [];
  for (const d of plan.dias ?? []) {
    if (d.escenario !== escenario) continue;
    const visitas = d.visitas.map((dane) => {
      const s = sede.get(dane);
      return { dane, sede: s?.sede ?? dane, municipio: s?.municipio ?? "" };
    });
    const tr = (porDia.get(`${d.cuadrilla}|${d.dia_corrido}`) ?? []).sort(
      (a, b) => a.properties.orden - b.properties.orden,
    );
    const viaje = (r: RasgoTramo): Paso => ({
      tipo: "viaje",
      momento: r.properties.momento,
      min: r.properties.min,
      km: r.properties.km,
      rec: preparaRecorrido(r.geometry.coordinates),
    });
    // La secuencia del día: tramo, inspección, (tramo, inspección), tramo.
    const pasos: Paso[] = [];
    tr.forEach((r, i) => {
      pasos.push(viaje(r));
      if (i < visitas.length) pasos.push({ tipo: "inspeccion", dane: visitas[i].dane });
    });
    guion.push({
      diaCorrido: d.dia_corrido,
      semana: d.semana,
      dia: d.dia,
      cuadrilla: d.cuadrilla,
      visitas,
      saleDe: d.sale_de,
      duermeEn: d.duerme_en,
      fueraDeBase: d.fuera_de_base,
      minCarretera: d.min_carretera,
      kmCarretera: d.km,
      pasos,
    });
  }
  return guion.sort((a, b) => a.diaCorrido - b.diaCorrido
    || a.cuadrilla.localeCompare(b.cuadrilla));
}

/** Dónde va una cuadrilla, y cuánto lleva acumulado, en un instante del día.
 *
 * `t` son minutos de jornada desde que arranca el día, no una hora del reloj. No
 * se muestra una hora en pantalla porque sería inventarla: lo que está medido es
 * cuánto dura cada trayecto, no a qué hora ocurre cada cosa.
 */
export type Estado = {
  fase: "manana" | "inspeccion" | "entre" | "tarde" | "fin";
  punto: [number, number] | null;
  /** Minutos y kilómetros de carretera ya hechos ese día hasta el instante `t`. */
  minHechos: number;
  kmHechos: number;
  /** Cuántas escuelas del día ya se alcanzaron. */
  llegadas: number;
};

export function estadoEn(g: GuionDia, t: number, inspeccion: number): Estado {
  let reloj = 0;
  let minHechos = 0;
  let kmHechos = 0;
  let llegadas = 0;
  let ultimo: [number, number] | null = null;
  for (const p of g.pasos) {
    if (p.tipo === "viaje") {
      const fin = reloj + p.min;
      if (t < fin) {
        const f = p.min > 0 ? (t - reloj) / p.min : 1;
        return {
          fase: p.momento,
          punto: p.rec ? puntoEn(p.rec, f) : ultimo,
          minHechos: minHechos + p.min * f,
          kmHechos: kmHechos + p.km * f,
          llegadas,
        };
      }
      reloj = fin;
      minHechos += p.min;
      kmHechos += p.km;
      ultimo = p.rec ? puntoEn(p.rec, 1) : ultimo;
    } else {
      llegadas += 1;
      const fin = reloj + inspeccion;
      if (t < fin) {
        return { fase: "inspeccion", punto: ultimo, minHechos, kmHechos, llegadas };
      }
      reloj = fin;
    }
  }
  return { fase: "fin", punto: ultimo, minHechos, kmHechos, llegadas };
}

/** Cuánto dura el día más largo de una jornada, que es lo que hay que esperar
 *  antes de pasar al día siguiente: las tres cuadrillas salen el mismo día. */
export function largoDelDia(guion: GuionDia[], diaCorrido: number, inspeccion: number) {
  const hoy = guion.filter((g) => g.diaCorrido === diaCorrido);
  if (hoy.length === 0) return 0;
  return Math.max(...hoy.map((g) => jornada(g, inspeccion)));
}

/** Carretera más inspecciones de un día. */
export function jornada(g: GuionDia, inspeccion: number) {
  return g.minCarretera + inspeccion * g.visitas.length;
}
