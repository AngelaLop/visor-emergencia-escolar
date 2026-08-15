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
  /** Si la sede esta en la lista de focalizacion del PTIES. */
  ptie?: boolean;
  /** intervenida / programada / no_focalizada / no_ptie. El ano de
   *  intervencion llega hasta 2029, asi que estar focalizada no es estar ya
   *  intervenida. */
  ptie_estado?: string;
  ptie_anio?: number | null;
  /** Indice de vulnerabilidad de infraestructura declarada, de 0 a 5. Nulo en
   *  las sedes que el FFIE nunca visito: no haber sido visitada es no saber, y
   *  un cero ahi diria que esta bien. Ver FICHA_IVID en lib/datos.ts. */
  ivid?: number | null;
  ivid_techos?: number | null;
  ivid_muros?: number | null;
  ivid_pisos?: number | null;
  /** Cuantos de los tres elementos quedaron con severidad sin clasificar
   *  porque el rector marco "Otro" y ninguna casilla. */
  ivid_sin_clasificar?: number | null;
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

/** Quien afirma un dano. Los tres emisores no dicen lo mismo y por eso no
 *  comparten simbolo.
 *
 *  hot      Foto ciudadana por WhatsApp, curada una por una. Confirmar
 *           significa que alguien emparejo la foto con la sede, no que la sede
 *           este danada.
 *  oficial  Reporte de una entidad. Tiene dos emisores, que comparten tarjeta y
 *           color y se separan por `emisor`: el MEN, con su capa publica, y el
 *           BID, con el reporte del PTIES.
 *  noticia  Declaracion de una autoridad recogida por un medio.
 */
export type FuenteDano = "hot" | "oficial" | "noticia";

/** Quien emite el reporte dentro de su fuente.
 *
 *  Existe porque `oficial` dejo de ser una sola entidad. MEN y BID no dicen lo
 *  mismo de las mismas sedes: en Riosucio el PTIES cerro dos sedes sin dano y
 *  la capa del MEN las declara en afectacion parcial. Fundirlos en un solo
 *  rotulo borraria esa discrepancia, que es informacion.
 */
export type EmisorDano = "MEN" | "BID" | "HOT" | "";

/** Los cuatro estados posibles, cerrados a proposito.
 *
 *  `colapso`  Se vino abajo un elemento estructural: muros, techos, fachada, un
 *             aula, un area entera del predio. El cielorraso no cuenta, que es
 *             acabado y no estructura.
 *  `dano`     Afectacion que no llega a lo anterior: grietas, fisuras,
 *             dilataciones, cielorrasos caidos, tuberia rota.
 *  `sin_dano` Alguien fue a mirar y no encontro nada. No sobra: borrarlo
 *             obligaria a volver a preguntar.
 *  `sin_verificar`  Lo que afirma una foto ciudadana confirmada, que es
 *             exactamente nada sobre el estado del edificio.
 *
 *  El umbral de `colapso` estuvo sin escribir hasta el 13 de agosto de 2026 y
 *  eso costo caro: la casilla marcaba 14 sedes cuando las escuelas que de
 *  verdad se cayeron eran 2. El resto venia del inventario de la Alcaldia de
 *  Manizales, que titula "Colapso parcial infraestructura" a entradas que
 *  describen un cielorraso caido. La linea quedo en la estructura porque
 *  respeta ese vocabulario sin vaciarlo de sentido. Ver
 *  `scripts/35_criterio_colapso_alcance.py`.
 *
 *  Lo que este umbral todavia no separa: Calima, donde el edificio cayo sobre
 *  los estudiantes y murieron cinco niños, y una fachada caida en un colegio
 *  evacuado a tiempo. Las dos son `colapso`.
 */
export type EstadoDano = "colapso" | "dano" | "sin_dano" | "sin_verificar";

/** Sobre que se afirma.
 *
 *  Es la distincion que decide si el punto se puede leer como "esta escuela" o
 *  como "alguna de estas". El reporte del PTIES nombra instituciones que llegan
 *  a tener 30 sedes repartidas en 28,7 km.
 */
export type AlcanceDano = "sede" | "institucion" | "solo_principal"
  | "sin_principal";

/** Un dano reportado sobre una sede. Lo arma `scripts/27_danos_reportados.py`.
 *
 * Trae su propia coordenada en vez de buscarla en la coleccion de sedes: hay
 * dano reportado fuera de la grilla del ShakeMap, y si dependiera del archivo
 * de sedes ese caso no se podria dibujar.
 */
export type Dano = {
  id: string;
  /** El reporte del que sale. Varias sedes pueden compartirlo. */
  reporte: string;
  fuente: FuenteDano;
  emisor?: EmisorDano;
  estado: EstadoDano;
  /** El desglose fino dentro del estado, que es lo que abren los botones de
   *  colapso y de daño. Solo lo distingue el MEN. Vacio significa que ese estado
   *  no tiene desglose (`sin_dano`, `sin_verificar`); las fuentes que afirman
   *  colapso o daño sin precisar llevan `colapso_sd` y `dano_sd`. */
  subtipo?: string;
  /** La frase textual del MEN, sin traducir. Los cuatro estados del visor son
   *  cerrados y el MEN usa ocho categorias, asi que esta es la unica forma de
   *  que la ficha diga lo que dijo la fuente y no lo que nosotros entendimos. */
  estado_men?: string;
  /** La calificacion que el propio MEN le pone a su coordenada. */
  confianza_geo_men?: string;
  /** Si el punto se dibuja con la coordenada de la capa del MEN porque el
   *  directorio no tiene la de esa sede. */
  coord_del_men?: boolean;
  alcance: AlcanceDano;
  dane: string;
  sede: string;
  establecimiento?: string;
  mpio: string;
  depto: string;
  /** Nulos cuando la sede queda fuera de la grilla del ShakeMap del USGS. Nulo
   *  no es cero: significa que de ahi el modelo del sismo no dice nada, y por
   *  eso esas sedes no se dibujan. */
  mmi: number | null;
  banda: number | null;
  matricula: number;
  matricula_es_de_2022?: boolean;
  encuestada?: boolean;
  lon: number | null;
  lat: number | null;
  fecha: string;
  /** Quien lo afirma, con nombre. Sin esto el punto no se dibuja con cita. */
  quien: string;
  cargo?: string;
  cita?: string;
  medio?: string;
  url?: string;
  url_foto?: string;
  titular?: string;
  texto_reporte?: string;
  impacto_ptie?: string;
  afectacion_humana?: string;
  institucion_reportada?: string;
  /** Cuantas sedes tiene la institucion sobre la que se afirmo. */
  n_sedes_institucion?: number;
};

/** Del mas grave al menos grave. Ordena las listas que se leen de arriba abajo,
 *  y desempata entre reportes de la misma fuente. Ya no decide sola quien pinta
 *  la sede: para eso esta `mandaSobre`. */
export const GRAVEDAD: Record<EstadoDano, number> = {
  colapso: 3,
  dano: 2,
  sin_verificar: 1,
  sin_dano: 0,
};

/** Quien manda cuando dos fuentes hablan de la misma sede.
 *
 *  Hasta el 14 de agosto de 2026 mandaba el estado mas grave, sin mirar quien
 *  lo decia, y eso dejaba a una nota de prensa tapando el "sin afectacion" con
 *  el que el MEN cerro esa misma sede despues de ir a mirarla. Ahora una
 *  entidad que verifico pesa mas que un medio, y un medio mas que una foto
 *  ciudadana que no afirma nada del edificio.
 */
export const PRECEDENCIA_FUENTE: Record<FuenteDano, number> = {
  oficial: 2,
  noticia: 1,
  hot: 0,
};

/** Si el reporte `a` desplaza a `b` como el que pinta la sede.
 *
 *  Primero la fuente, y solo dentro de la misma fuente la gravedad. Vive aqui
 *  porque cuatro sitios del visor deciden lo mismo (el mapa, las dos cuentas
 *  del panel y la lista de sedes) y cuando la regla estaba escrita cuatro veces
 *  bastaba con cambiar tres para que el mapa y el contador dejaran de coincidir.
 *
 *  Es la misma regla que aplica `scripts/27_danos_reportados.py` al armar el
 *  archivo. Las dos tienen que decir lo mismo.
 */
export function mandaSobre(a: Dano, b: Dano): boolean {
  const pa = PRECEDENCIA_FUENTE[a.fuente] ?? 0;
  const pb = PRECEDENCIA_FUENTE[b.fuente] ?? 0;
  if (pa !== pb) return pa > pb;
  return GRAVEDAD[a.estado] > GRAVEDAD[b.estado];
}

/** El reporte que pinta cada sede, uno por codigo DANE. */
export function reportePorSede(danos: Dano[]): Map<string, Dano> {
  const manda = new Map<string, Dano>();
  for (const d of danos) {
    const y = manda.get(d.dane);
    if (!y || mandaSobre(d, y)) manda.set(d.dane, d);
  }
  return manda;
}

export const NOMBRE_FUENTE: Record<FuenteDano, string> = {
  hot: "Registro fotográfico HOT",
  oficial: "Reportes oficiales (MEN y BID)",
  noticia: "Noticias",
};

/** Como se nombra cada emisor en pantalla. */
export const NOMBRE_EMISOR: Record<string, string> = {
  MEN: "Ministerio de Educación Nacional",
  BID: "BID, reporte del PTIES",
  HOT: "ChatMap (HOT)",
};

/** De cuando es la capa del MEN que dibuja el mapa, y donde vive el original.
 *
 *  Lo escribe `scripts/27_danos_reportados.py` al lado de los danos. Sirve para
 *  dos cosas: fechar en pantalla lo que se esta viendo, y comparar contra el
 *  servicio para avisar cuando el MEN edito despues de nuestra descarga.
 */
export type MetaMen = {
  /** Ultima edicion de la capa segun el MEN, no el dia en que la bajamos. */
  fecha_capa: string;
  descargada: string;
  last_edit_date_ms: number | null;
  url_servicio: string;
  tablero: string;
  /** Las sedes del universo priorizado, con estado o sin el. */
  universo: number;
  /** Las que declaran algo distinto de "No aporta informacion". */
  con_estado: number;
};

/** Los subtipos de cada estado, de mas grave a menos grave.
 *
 *  Es el orden en que hay que ir a mirar y el orden en que se dibujan las
 *  pastillas. `_sd` va siempre al final: no es el caso menos grave, es el que no
 *  se sabe, y ponerlo entre medias diria que ocupa un lugar en la escala.
 *
 *  La clave lleva el estado por delante a proposito. Sin eso "parcial" seria a
 *  la vez un colapso parcial y una afectacion parcial, y la lista de subtipos
 *  encendidos no podria distinguirlos: apagar uno apagaria el otro.
 *
 *  Solo `colapso` y `dano` tienen desglose. `sin_dano` y `sin_verificar` no lo
 *  necesitan: no hay grados de "alguien fue y no encontro nada".
 */
export const SUBTIPOS_POR_ESTADO: Record<string, string[]> = {
  colapso: ["colapso_total", "colapso_parcial", "colapso_sd"],
  dano: ["dano_riesgo", "dano_parcial", "dano_menor", "dano_sin_definir",
    "dano_sd"],
};

/** Todos los subtipos en una sola lista, que es como viaja el filtro. */
export const SUBTIPOS = Object.values(SUBTIPOS_POR_ESTADO).flat();

/** Como se llama cada subtipo en pantalla. Sale de la frase del MEN, acortada
 *  para que quepa en una pastilla. */
export const NOMBRE_SUBTIPO: Record<string, string> = {
  colapso_total: "colapso total",
  colapso_parcial: "colapso parcial",
  colapso_sd: "sin especificar",
  dano_riesgo: "riesgo inminente",
  dano_parcial: "afectación parcial",
  dano_menor: "afectación menor",
  dano_sin_definir: "sin definir el impacto",
  dano_sd: "sin especificar",
};

/** Lo que dice el globo del mapa y la ficha cuando hay subtipo. Para los `_sd`
 *  no aporta nada sobre el estado, asi que se cae al nombre del estado. */
export function nombreFino(estado: EstadoDano, subtipo?: string): string {
  if (!subtipo || subtipo.endsWith("_sd")) return NOMBRE_ESTADO[estado];
  return NOMBRE_SUBTIPO[subtipo] ?? NOMBRE_ESTADO[estado];
}

export const NOMBRE_ESTADO: Record<EstadoDano, string> = {
  colapso: "colapso",
  dano: "daño",
  sin_dano: "sin daño",
  sin_verificar: "sin verificar",
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

/** Qué es el MMI, dentro del bloque del MMI.
 *
 * Antes esto se leía en dos sitios y ninguno era el bueno: aquí iba una escala
 * de lectura grado por grado, y la advertencia de que el MMI es sacudida
 * estimada y no daño observado estaba pegada al pie de la pantalla, lejos del
 * control al que se refiere.
 *
 * La escala grado por grado se fue porque la lista de bandas ya la dice, y con
 * ventaja: cada casilla lleva su nota al lado ("caen objetos", "empieza el daño
 * material") y se lee mientras se prende. Repetirlo en prosa era decir dos veces
 * lo mismo, una de ellas donde nadie la estaba mirando.
 */
export const EXPLICACION_MMI =
  "El MMI (la intensidad de Mercalli) mide qué tan fuerte se sintió el sismo " +
  "en cada zona. La magnitud 7,4 es un solo número para todo el sismo; la " +
  "intensidad cambia de un municipio a otro según la distancia y el tipo de " +
  "suelo. La estima un modelo del Servicio Geológico de Estados Unidos (USGS) " +
  "con reportes de la gente y estaciones sismológicas: es sacudida estimada, " +
  "no daño observado, y nadie fue a verificarla en terreno.";

/** La escala está publicada por el Servicio Geológico de Estados Unidos. */
export const FUENTE_MMI = {
  texto: "Escala de intensidad de Mercalli modificada, USGS",
  url: "https://www.usgs.gov/programs/earthquake-hazards/modified-mercalli-intensity-scale",
};

export type Filtros = {
  bandas: number[];
  /** Valores de `zona` del SIMAT, en mayuscula. Se llamaba `areas` y filtraba
   *  esto mismo, que es justo la confusion que hay que evitar: `area_class` es
   *  otra columna, de tres categorias y con 4.066 nulos. */
  zonas: string[];
  vigencias: string[];
  pties: string[];
  /** Categorias del indice de vulnerabilidad, de 0 a 4. Ver `categoriaIvid`. */
  ividCategorias: number[];
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
  zonas: [],
  // Vacio es "todas", incluidas las que ya no operan. Una escuela liquidada con
  // el edificio en pie sigue importando despues de un sismo: puede ser
  // albergue o puede caerse. Lo que no puede es aportar alumnos que ya no
  // estan, y de eso se encarga la matricula de 2024, no este filtro.
  vigencias: [],
  // Vacio es "todas". El PTIES marca 72 sedes en todo el pais y 35 en
  // esta zona: abrir filtrando por ellas escondería el mapa entero.
  pties: [],
  // Vacio es "todas las visitadas". El filtro aparece dentro de la vista de
  // visitadas, que es la unica donde todas las sedes en juego tienen indice.
  ividCategorias: [],
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
