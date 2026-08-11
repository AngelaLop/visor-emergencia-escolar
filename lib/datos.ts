/** Carga, filtrado y agregacion de los datos del evento.
 *
 * Todo lo que muestra el visor sale de `public/datos/`, que produce
 * `scripts/23_visor_datos.py`. Aqui no se calcula nada nuevo sobre las sedes:
 * solo se filtra y se suma. Si un numero de esta pantalla no cuadra con el
 * informe, el problema esta aguas arriba y no aqui.
 */

import type {
  ColeccionSedes,
  Evento,
  Filtros,
  RasgoSede,
  Reporte,
  Sede,
} from "./tipos";

export async function cargaEvento(): Promise<Evento> {
  const r = await fetch("datos/evento.json");
  if (!r.ok) throw new Error("no se pudo leer datos/evento.json");
  return r.json();
}

export async function cargaSedes(): Promise<ColeccionSedes> {
  const r = await fetch("datos/sedes_evento.geojson");
  if (!r.ok) throw new Error("no se pudo leer datos/sedes_evento.geojson");
  return r.json();
}

export async function cargaContornos(): Promise<unknown> {
  const r = await fetch("datos/contornos_mmi.geojson");
  if (!r.ok) throw new Error("no se pudo leer datos/contornos_mmi.geojson");
  return r.json();
}

/** El contorno del país. Si falta, el mapa sigue funcionando sin él. */
export async function cargaColombia(): Promise<unknown | null> {
  const r = await fetch("datos/colombia.geojson");
  return r.ok ? r.json() : null;
}

export async function cargaBordeGrilla(): Promise<unknown> {
  const r = await fetch("datos/borde_grilla.geojson");
  if (!r.ok) throw new Error("no se pudo leer datos/borde_grilla.geojson");
  return r.json();
}

/** Los reportes ya curados.
 *
 * Corriendo en local, la ruta `api/reportes` abre el CSV de curaduria y
 * devuelve la cola entera, pendientes incluidos. Publicado, ese CSV no existe
 * dentro del despliegue y la ruta devuelve vacio: ahi entra el archivo
 * estatico, que solo trae los confirmados. Sin cola no hay nada que mostrar, y
 * eso tambien es un estado normal.
 */
export async function cargaReportes(): Promise<Reporte[]> {
  try {
    const r = await fetch("api/reportes");
    if (r.ok) {
      const d = await r.json();
      if (d.reportes?.length) return d.reportes;
    }
  } catch {
    // La ruta puede no existir en una exportacion estatica.
  }
  try {
    const r = await fetch("datos/reportes.json");
    if (!r.ok) return [];
    const d = await r.json();
    return d.reportes ?? [];
  } catch {
    return [];
  }
}

/** Las huellas de una sede, que solo existen para las que estan en MMI VI o mas. */
export async function cargaHuellas(dane: string): Promise<unknown | null> {
  const r = await fetch(`datos/huellas/${dane}.geojson`);
  if (!r.ok) return null;
  return r.json();
}

// ---------------------------------------------------------------- filtrado --

export function pasa(s: Sede, f: Filtros): boolean {
  // La banda de intensidad manda: si no esta prendida en el control de capas,
  // la sede ni se dibuja ni se cuenta. Es la misma particion que pinta el mapa.
  if (!f.bandas.includes(s.banda)) return false;
  if (f.secretarias.length && !f.secretarias.includes(s.secretaria ?? "")) {
    return false;
  }
  if (f.areas.length && !f.areas.includes(s.zona ?? "")) {
    return false;
  }
  if (f.vigencias.length && !f.vigencias.includes(s.vigencia_2024 ?? "sin_reporte")) {
    return false;
  }

  if (f.tab === "fisica") {
    if (f.fisica === "encuestadas" && !s.encuestada) return false;
    if (f.fisica === "no_encuestadas" && s.encuestada) return false;
  }

  if (f.tab === "servicios") {
    // Sin reporte del C-600 no se puede afirmar ni que tiene ni que le falta el
    // servicio, asi que la sede queda fuera de los dos filtros explicitos.
    if (f.energia === "con" && s.energia_2024 !== true) return false;
    if (f.energia === "sin" && s.energia_2024 !== false) return false;
    if (f.internet === "con" && s.internet_2024 !== true) return false;
    if (f.internet === "sin" && s.internet_2024 !== false) return false;
  }

  if (s.matricula < f.matriculaMin) return false;
  // El quintil sin elegir no filtra. Elegido, una sede sin RWI queda fuera:
  // no se puede afirmar que pertenezca a un quintil que no se le calculo.
  if (f.quintiles.length && (s.rwi_q == null || !f.quintiles.includes(s.rwi_q))) {
    return false;
  }
  return true;
}

export function filtra(col: ColeccionSedes, f: Filtros): RasgoSede[] {
  return col.features.filter((x) => pasa(x.properties, f));
}

/** Los alumnos que se le cuentan hoy a una sede.
 *
 * El marco de sedes es el SIMAT 2022 y su matricula tambien. Cuatro anos
 * despues eso sobreestima: en la zona del sismo, el C-600 de 2024 cuenta
 * 2.699.863 alumnos donde el SIMAT de 2022 contaba 2.875.055. Asi que manda el
 * dato de 2024 cuando existe.
 *
 * Cuando no existe se usa el de 2022, y no cero. Que una sede no haya
 * reportado al C-600 no significa que se haya quedado sin alumnos, y ponerle
 * cero seria afirmar algo que nadie afirmo. El resumen lleva la cuenta de
 * cuantas sedes estan en ese caso para poder decirlo en pantalla.
 */
export function alumnos(s: Sede): number {
  return s.matricula_2024 ?? s.matricula ?? 0;
}

export type Resumen = {
  sedes: number;
  matricula: number;
  /** Sedes de la seleccion cuya matricula viene de 2022 porque no hay dato de
   *  2024. Se muestra para no dar por homogeneo un numero que no lo es. */
  matriculaDe2022: number;
  /** Sedes que el C-600 de 2024 declara liquidadas, fusionadas, duplicadas o
   *  inactivas. */
  noOperan: number;
  encuestadas: number;
  nuncaEncuestadas: number;
  matriculaIgnota: number;
  techosDanados: number;
  murosDanados: number;
  pisosDanados: number;
  sinEnergia: number;
  matriculaSinEnergia: number;
  sinInternet: number;
  matriculaSinInternet: number;
  sinCoordVerificada: number;
  municipios: number;
  secretarias: number;
};

export function resume(rasgos: RasgoSede[]): Resumen {
  const mpios = new Set<string>();
  const etc = new Set<string>();
  const r: Resumen = {
    sedes: rasgos.length,
    matricula: 0,
    matriculaDe2022: 0,
    noOperan: 0,
    encuestadas: 0,
    nuncaEncuestadas: 0,
    matriculaIgnota: 0,
    techosDanados: 0,
    murosDanados: 0,
    pisosDanados: 0,
    sinEnergia: 0,
    matriculaSinEnergia: 0,
    sinInternet: 0,
    matriculaSinInternet: 0,
    sinCoordVerificada: 0,
    municipios: 0,
    secretarias: 0,
  };
  for (const x of rasgos) {
    const s = x.properties;
    const m = alumnos(s);
    r.matricula += m;
    if (s.matricula_2024 == null) r.matriculaDe2022 += 1;
    if (s.vigencia_2024 === "no_opera") r.noOperan += 1;
    mpios.add(`${s.depto}|${s.mpio}`);
    if (s.secretaria) etc.add(s.secretaria);
    if (s.encuestada) {
      r.encuestadas += 1;
      // Las tres columnas son 1 cuando el rector declaro al menos una
      // condicion de dano en ese elemento, y 0 cuando declaro que esta bien.
      if (s.techos_danado) r.techosDanados += 1;
      if (s.muros_danado) r.murosDanados += 1;
      if (s.pisos_danado) r.pisosDanados += 1;
    } else {
      r.nuncaEncuestadas += 1;
      r.matriculaIgnota += m;
    }
    // Se cuenta el `false` explicito, no el ausente: sin reporte del C-600 no
    // se sabe, y contar la ignorancia como carencia infla la cifra.
    if (s.energia_2024 === false) {
      r.sinEnergia += 1;
      r.matriculaSinEnergia += m;
    }
    if (s.internet_2024 === false) {
      r.sinInternet += 1;
      r.matriculaSinInternet += m;
    }
    if (s.calidad_coord !== "gps_validated") r.sinCoordVerificada += 1;
  }
  r.municipios = mpios.size;
  r.secretarias = etc.size;
  return r;
}

// ------------------------------------------------------------ vocabulario --

/** Lo que significa cada grado de la escala de Mercalli modificada. */
export const SIGNIFICADO_MMI: Record<string, string> = {
  III: "se siente en interiores, sin daño",
  IV: "lo sienten muchos, sin daño",
  V: "lo sienten todos, caen objetos, daño insignificante",
  VI: "daño leve, cae el repello y la mampostería mal construida",
  VII: "daño moderado en la construcción corriente, considerable en la deficiente",
  VIII: "daño severo en la construcción corriente",
};

/** Los codigos del control de calidad de coordenada, dichos en castellano. */
export const CALIDAD_COORD: Record<string, string> = {
  gps_validated: "verificada con GPS en terreno",
  adm_mismatch: "el municipio del registro no coincide con el del punto",
  cluster_centroid: "centroide de un grupo de sedes, no de la sede",
  geocoder_disagrees: "el geocodificador ubica la sede en otro lugar",
  missing: "sin coordenada",
  geocoded_street: "geocodificada a partir de la dirección",
  geocoded_centroid: "centroide del municipio",
  boundary_zone: "sobre un límite administrativo",
};

export function diceCalidad(c?: string): string {
  if (!c) return "sin control de calidad";
  return CALIDAD_COORD[c] ?? c;
}

/** Como se nombra cada quintil de riqueza, sin decir el numero del indice. */
export const NOMBRE_QUINTIL: Record<number, string> = {
  1: "Q1 (más pobre)",
  2: "Q2",
  3: "Q3",
  4: "Q4",
  5: "Q5 (más rico)",
};

/** Las claves son los valores de `zona` del SIMAT, que vienen en mayuscula. Se
 *  muestran en minuscula porque son etiquetas de un boton, no un codigo. */
export const NOMBRE_AREA: Record<string, string> = {
  URBANA: "urbana",
  RURAL: "rural",
};

/** Las tres palabras que resumen la novedad declarada al C-600 de 2024. */
export const NOMBRE_VIGENCIA: Record<string, string> = {
  opera: "operaba en 2024",
  no_opera: "ya no operaba",
  sin_reporte: "no reportó",
};

export function miles(n: number): string {
  return n.toLocaleString("es-CO");
}

/** La hora del USGS viene en UTC. Quien coordina piensa en hora de Colombia,
 * que va cinco horas atrás, así que se muestra convertida y se dice cuál es. */
export function horaLocal(isoUtc: string): string {
  const d = new Date(isoUtc.endsWith("Z") ? isoUtc : `${isoUtc}Z`);
  return d.toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
