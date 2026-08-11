/** Tipos compartidos por el visor.
 *
 * Los nombres de campo son los que escribe `scripts/23_visor_datos.py`. Si
 * cambian alli hay que cambiarlos aqui: no hay esquema compartido entre Python
 * y TypeScript, y ese es el punto debil conocido de este montaje.
 */

export type Sede = {
  dane: string;
  sede: string;
  establecimiento?: string;
  mpio: string;
  depto: string;
  secretaria?: string;
  zona?: string;
  area_class?: string;
  matricula: number;
  /** Matricula del C-600 de 2024. Nula cuando la sede no reporto ese ano, que
   *  no es lo mismo que cero alumnos. */
  matricula_2024?: number | null;
  /** opera / no_opera / sin_reporte, segun la novedad declarada en el C-600 de
   *  2024. El marco de sedes es de 2022 y en cuatro anos hay escuelas que se
   *  liquidaron, se fusionaron o quedaron inactivas. */
  vigencia_2024?: string;
  rwi?: number;
  mmi: number;
  nivel: string;
  encuestada: boolean;
  techos?: string;
  muros?: string;
  pisos?: string;
  techos_danado?: number;
  muros_danado?: number;
  pisos_danado?: number;
  fecha_encuesta?: string;
  calidad_coord?: string;
  /** La banda de media unidad a la que pertenece: 4,0; 4,5 … 6,5. */
  banda: number;
  /** Quintil nacional de riqueza, 1 el mas pobre. */
  rwi_q?: number;
  n_fotos_usables?: number;
  foto1?: string;
  // Del C-600 de 2024. Ausentes cuando la sede no reporto ese ano, que no es lo
  // mismo que no tener el servicio.
  energia_2024?: boolean;
  internet_2024?: boolean;
};

export type RasgoSede = {
  type: "Feature";
  properties: Sede;
  geometry: { type: "Point"; coordinates: [number, number] };
};

export type ColeccionSedes = {
  type: "FeatureCollection";
  features: RasgoSede[];
};

export type Evento = {
  id: string;
  magnitud: number;
  descripcion: string;
  origen_utc: string;
  profundidad_km: number;
  epicentro: [number, number];
  calibracion: { reportes_ciudadanos: number; estaciones: number };
  exposicion_pager: { mmi: number[]; poblacion: number[] };
  fuente: string;
  descripcion_usgs?: string;
  mmi_epicentro?: number;
  mmi_maximo?: number;
  mmi_maximo_en?: [number, number];
};

/** Una sede candidata para un reporte, calculada por el script 24. */
export type Candidata = {
  dane: string;
  sede: string;
  mpio: string;
  depto: string;
  dist_m: number;
  matricula: number;
  mmi: number | null;
  encuestada: boolean;
  calidad_coord: string | null;
  foto1: string | null;
};

export type Reporte = {
  id: string;
  fecha: string;
  lat: number;
  lon: number;
  url_foto: string;
  texto: string;
  candidatas: Candidata[];
  es_escuela: string;
  dane_asignado: string;
  revisado_por: string;
  revisado_en: string;
  nota: string;
};

/** Las dos caracteristicas que el visor sabe describir de una sede. */
export type Tab = "fisica" | "servicios";

/** El mapa base arranca claro. El oscuro es una preferencia, no el estado por
 * defecto: en pantalla clara se distingue mejor el degradado de intensidad. */
export type Tema = "claro" | "oscuro";

/** Los mapas base disponibles. El tema de la interfaz sigue al mapa: con el
 * mapa oscuro, un panel blanco encandila. */
export type MapaBase = "claro" | "oscuro" | "calles" | "osm";

export const MAPAS_BASE: { id: MapaBase; nombre: string; nota: string }[] = [
  { id: "claro", nombre: "Claro", nota: "deja ver los datos encima" },
  { id: "oscuro", nombre: "Oscuro", nota: "para pantalla en sala de crisis" },
  { id: "calles", nombre: "Calles", nota: "más detalle urbano" },
  { id: "osm", nombre: "OpenStreetMap", nota: "el mapa completo de OSM" },
];

/** Las bandas de intensidad, de menor a mayor sacudida.
 *
 * Prender una banda hace dos cosas a la vez: dibuja la mancha en el mapa y deja
 * pasar sus escuelas. Son la misma particion, y separarlas seria mentir sobre
 * que se esta contando.
 */
export const BANDAS = [
  { banda: 4.0, etiqueta: "4,0", nota: "se siente, sin daño" },
  { banda: 4.5, etiqueta: "4,5", nota: "se siente, sin daño" },
  { banda: 5.0, etiqueta: "5,0", nota: "caen objetos" },
  { banda: 5.5, etiqueta: "5,5", nota: "caen objetos" },
  { banda: 6.0, etiqueta: "6,0", nota: "empieza el daño material" },
  { banda: 6.5, etiqueta: "6,5", nota: "daño material esperado" },
];

export const EXPLICACION_MMI =
  "La magnitud 7,4 es un solo número para todo el sismo. La intensidad, en " +
  "cambio, dice qué tan fuerte se sintió en cada lugar, y cambia de un " +
  "municipio a otro según la distancia y el tipo de suelo. Se lee así: en 4 " +
  "las lámparas se mueven y la gente lo siente adentro; en 5 lo siente todo el " +
  "mundo y se caen cosas de los estantes; desde 6 empieza el daño material, " +
  "se desprende el repello y se agrieta la mampostería mal construida. Estos " +
  "valores los estima un modelo del USGS a partir de reportes de la gente y de " +
  "estaciones sismológicas; nadie fue a verificarlos en terreno.";

/** La escala está publicada por el Servicio Geológico de Estados Unidos. */
export const FUENTE_MMI = {
  texto: "Escala de intensidad de Mercalli modificada, USGS",
  url: "https://www.usgs.gov/programs/earthquake-hazards/modified-mercalli-intensity-scale",
};

export type Filtros = {
  bandas: number[];
  areas: string[];
  vigencias: string[];
  secretarias: string[];
  quintiles: number[];
  matriculaMin: number;
  tab: Tab;
  fisica: "todas" | "encuestadas" | "no_encuestadas";
  energia: "todas" | "con" | "sin";
  internet: "todas" | "con" | "sin";
  resaltarCoordDudosa: boolean;
};

export const FILTROS_INICIALES: Filtros = {
  // Abre en 6,0 y 6,5, que es donde el USGS situa el inicio del dano
  // estructural visible. Las bandas mas bajas quedan a un clic.
  bandas: [6.0, 6.5],
  areas: [],
  // Vacio es "todas", incluidas las que ya no operan. Una escuela liquidada con
  // el edificio en pie sigue importando despues de un sismo: puede ser
  // albergue o puede caerse. Lo que no puede es aportar alumnos que ya no
  // estan, y de eso se encarga la matricula de 2024, no este filtro.
  vigencias: [],
  secretarias: [],
  quintiles: [],
  matriculaMin: 0,
  tab: "fisica",
  // Todas de un color mientras nadie pregunte nada: el mapa no debe empezar
  // afirmando una distincion que el usuario no pidio.
  fisica: "todas",
  energia: "todas",
  internet: "todas",
  resaltarCoordDudosa: false,
};
