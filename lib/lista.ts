/** La lista de sedes que pidió el MEN, caracterizada por el script 90.
 *
 * Es una vista de información, no de plan: dice dónde está cada sede, qué tan
 * confiable es su punto y lo que se sabe de ella (zona, acceso, estado
 * reportado, visita del FFIE). No lleva horas ni cuadrillas.
 */

export type Calidad =
  | "verificada"
  | "fuentes coinciden"
  | "fuentes no coinciden"
  | "una sola fuente"
  | "por confirmar en campo"
  | "sin coordenada";

export type SedeLista = {
  secretaria: string;
  departamento: string;
  municipio: string;
  institucion: string | null;
  sede: string;
  dane: string | null;
  con_codigo: boolean;
  lat: number | null;
  lon: number | null;
  calidad: Calidad;
  detalle_calidad: string;
  zona: string | null;
  matricula: number | null;
  estado_men: string | null;
  nivel_men: string | null;
  ffie_fecha: string | null;
  ffie_semaforo: string | null;
  tipo_acceso: string | null;
  acceso: "fácil" | "regular" | "difícil" | "sin medir";
  dist_via_m: number | null;
  calidad_coord: string | null;
  en_bid: boolean;
  en_plan: boolean;
};

export type ResumenLista = {
  secretaria: string;
  sedes: number;
  sin_codigo: number;
  sin_coordenada: number;
  confiable: number;
  con_duda: number;
  rural_pct: number;
  acceso_dificil_pct: number | null;
  acceso_medido: number;
  dispersion_km: number | null;
  critico_pct: number | null;
  con_estado: number;
  ffie: number;
  en_plan: number;
};

export type ListaMen = {
  generado: string;
  fuente: string;
  filas_listado: number;
  umbral_m: number;
  sedes: SedeLista[];
  resumen: ResumenLista[];
};

export async function cargaLista(): Promise<ListaMen> {
  const r = await fetch("datos/lista_men.json");
  if (!r.ok) throw new Error(`lista_men.json: ${r.status}`);
  return r.json();
}

/** Qué variable pinta el relleno de cada sede. Una sola a la vez. */
export type ColorLista = "zona" | "acceso" | "estado";

export const NOMBRE_COLOR: Record<ColorLista, string> = {
  zona: "Zona",
  acceso: "Acceso",
  // «Estado según el MEN» sonaba a dictamen del ministerio. Lo que hay es lo
  // que respondió cada colegio en la encuesta que el MEN consolidó, y eso
  // cambia cómo se lee el mapa. La fuente se dice en el Info de al lado.
  estado: "Daño declarado",
};

type Tono = { claro: string; oscuro: string };
const SIN_DATO: Tono = { claro: "#b9b8b1", oscuro: "#5c5b56" };

/** Las clases de cada variable, en el orden en que van en la leyenda. */
export const CLASES: Record<ColorLista, { clave: string; rotulo: string; tono: Tono }[]> = {
  zona: [
    { clave: "URBANA", rotulo: "Urbana", tono: { claro: "#3f6fb5", oscuro: "#7ea6e0" } },
    { clave: "RURAL", rotulo: "Rural", tono: { claro: "#b8741a", oscuro: "#e0a458" } },
    { clave: "", rotulo: "Sin dato", tono: SIN_DATO },
  ],
  acceso: [
    { clave: "fácil", rotulo: "Fácil (vía principal o calle)", tono: { claro: "#2f8a55", oscuro: "#6cc592" } },
    { clave: "regular", rotulo: "Regular (vía terciaria u otra)", tono: { claro: "#c79a1e", oscuro: "#e6c35c" } },
    { clave: "difícil", rotulo: "Difícil (destapado o sin categoría)", tono: { claro: "#b8432e", oscuro: "#e57e68" } },
    { clave: "sin medir", rotulo: "Sin medir (fuera de la red vial)", tono: SIN_DATO },
  ],
  estado: [
    { clave: "Critico", rotulo: "Crítico", tono: { claro: "#9e1b2f", oscuro: "#e0607a" } },
    { clave: "Moderado", rotulo: "Moderado", tono: { claro: "#d9622b", oscuro: "#f09062" } },
    { clave: "Bajo", rotulo: "Bajo", tono: { claro: "#e0b43c", oscuro: "#ecd07a" } },
    { clave: "Sin afectación", rotulo: "Sin afectación", tono: { claro: "#6f9e7e", oscuro: "#94c4a3" } },
    { clave: "", rotulo: "Nadie contestó", tono: SIN_DATO },
  ],
};

export function claseDe(s: SedeLista, c: ColorLista): string {
  if (c === "zona") return s.zona === "URBANA" || s.zona === "RURAL" ? s.zona : "";
  if (c === "acceso") return s.acceso;
  return s.nivel_men ?? "";
}

export function colorDe(s: SedeLista, c: ColorLista, oscuro: boolean): string {
  const k = claseDe(s, c);
  const t = CLASES[c].find((x) => x.clave === k)?.tono ?? SIN_DATO;
  return oscuro ? t.oscuro : t.claro;
}

/** El borde dice qué tan confiable es el punto. Sin borde: confiable. */
export const BORDE: Record<Calidad, { rotulo: string; tono: Tono | null; ancho: number }> = {
  "verificada": { rotulo: "Revisada a mano", tono: null, ancho: 0 },
  "fuentes coinciden": { rotulo: "Dos fuentes coinciden", tono: null, ancho: 0 },
  "fuentes no coinciden": {
    rotulo: "Las fuentes no coinciden",
    tono: { claro: "#c2255c", oscuro: "#f06595" }, ancho: 2.5,
  },
  "por confirmar en campo": {
    rotulo: "Revisada, confirmar en campo",
    tono: { claro: "#c2255c", oscuro: "#f06595" }, ancho: 2.5,
  },
  "una sola fuente": {
    rotulo: "Una sola fuente, sin contraste",
    tono: { claro: "#6b6a64", oscuro: "#b9b8b1" }, ancho: 2,
  },
  "sin coordenada": { rotulo: "Sin coordenada (no se dibuja)", tono: null, ancho: 0 },
};

/** Lo que se puede resaltar. Resaltar atenúa el resto, no lo esconde. */
export type Resalte = "duda" | "ffie" | "plan";

export const NOMBRE_RESALTE: Record<Resalte, string> = {
  duda: "Coordenada con duda",
  ffie: "Visitada por el FFIE",
  plan: "En el plan de campo",
};

export function cumple(s: SedeLista, r: Resalte): boolean {
  if (r === "duda") {
    return ["fuentes no coinciden", "una sola fuente", "por confirmar en campo"]
      .includes(s.calidad);
  }
  if (r === "ffie") return Boolean(s.ffie_fecha);
  return s.en_plan;
}
