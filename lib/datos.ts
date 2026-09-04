/** Carga, filtrado y agregacion de los datos del evento.
 *
 * Todo lo que muestra el visor sale de `public/datos/`, que produce
 * `scripts/23_visor_datos.py`. Aqui no se calcula nada nuevo sobre las sedes:
 * solo se filtra y se suma. Si un numero de esta pantalla no cuadra con el
 * informe, el problema esta aguas arriba y no aqui.
 */

import { NIVELES, NIVELES_SUPERIOR, reportePorSede } from "./tipos";
import type {
  ColeccionIes,
  ColeccionSecretarias,
  ColeccionSedes,
  Dano,
  EstadoDano,
  Evento,
  Filtros,
  Ies,
  MetaMen,
  RasgoIes,
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

/** El territorio de cada secretaría de educación.
 *
 * Si falta, el mapa sigue funcionando y lo único que se pierde es la línea
 * punteada al elegir una entidad. Es una capa que se agrega sobre un mapa que ya
 * respondía su pregunta sin ella, igual que el contorno del país.
 */
export async function cargaSecretarias(): Promise<ColeccionSecretarias | null> {
  try {
    const r = await fetch("datos/secretarias.geojson");
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
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
/** Los daños reportados por las fuentes, ya unidos por el script 27.
 *
 * Si el archivo no está, el visor sigue funcionando sin la capa. Es una capa
 * que se agrega sobre un mapa que ya respondía su pregunta sin ella.
 *
 * Devuelve también `men`, que es de cuándo es la capa del MEN que se está
 * dibujando. Sin eso la pantalla no podría fechar lo que muestra, y un mapa de
 * emergencia que no sabe de cuándo es su propia capa no sirve para decidir.
 */
export async function cargaDanos(): Promise<{ danos: Dano[]; men: MetaMen | null }> {
  try {
    const r = await fetch("datos/danos.json");
    if (!r.ok) return { danos: [], men: null };
    const d = await r.json();
    return { danos: (d.danos ?? []) as Dano[], men: (d.men ?? null) as MetaMen | null };
  } catch {
    return { danos: [], men: null };
  }
}

/** Si el MEN editó su capa después de la descarga que dibuja el mapa.
 *
 * Es una sola consulta a la ficha del servicio, un par de kilobytes, y no baja
 * ningún dato: solo pregunta por `editingInfo.lastEditDate`. El mapa nunca
 * depende de que esta consulta responda. Si el MEN despublica la capa, cambia
 * el esquema o simplemente no contesta, el visor sigue dibujando su snapshot y
 * no avisa nada, que es el comportamiento correcto: el aviso es información
 * adicional, no una condición para pintar.
 *
 * El servicio responde con `Access-Control-Allow-Origin: *`, así que la consulta
 * sale directa del navegador y no hace falta pasarla por un proxy nuestro.
 */
export async function consultaEdicionMen(meta: MetaMen | null): Promise<number | null> {
  if (!meta?.url_servicio || meta.last_edit_date_ms == null) return null;
  try {
    const r = await fetch(`${meta.url_servicio}?f=json`, { cache: "no-store" });
    if (!r.ok) return null;
    const d = await r.json();
    const ultima = d?.editingInfo?.lastEditDate;
    if (typeof ultima !== "number") return null;
    return ultima > meta.last_edit_date_ms ? ultima : null;
  } catch {
    return null;
  }
}

export async function cargaHuellas(dane: string): Promise<unknown | null> {
  const r = await fetch(`datos/huellas/${dane}.geojson`);
  if (!r.ok) return null;
  return r.json();
}

/** Las instituciones de educación superior. 233 kB, capa opcional.
 *
 * No bloquea la pantalla y su fallo no la rompe: si el archivo no está, la
 * casilla de "Educación superior" no dibuja nada y el resto del visor sigue
 * igual. Es la misma promesa de `cargaColombia` y `cargaSecretarias`.
 */
export async function cargaIes(): Promise<ColeccionIes | null> {
  try {
    const r = await fetch("datos/ies.geojson");
    if (!r.ok) return null;
    return (await r.json()) as ColeccionIes;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- filtrado --

/** Las letras de los tres niveles que sí son un atributo de la sede. */
const LETRA_NIVEL: Record<string, string> = Object.fromEntries(
  NIVELES.filter((n) => n.letra).map((n) => [n.id, n.letra]),
);

/** Cuántas sedes de la colección no traen nivel declarado.
 *
 * Son las que entraron por el directorio del MEN y no están ni en el SIMAT 2022
 * ni en el C-600 2024. Quedan fuera en cuanto se marca un nivel, y el panel
 * dice cuántas son: un filtro que descarta en silencio escuelas de las que
 * consta que se dañaron sería el peor de los dos errores posibles aquí. */
export function sinNivel(rasgos: RasgoSede[]): number {
  return rasgos.reduce((n, x) => n + (x.properties.niveles ? 0 : 1), 0);
}

/** Si la sede pasa el recorte de nivel educativo.
 *
 * Tres reglas, y las tres siguen la misma línea que el resto de los filtros:
 *
 *  - Sin ninguna casilla marcada no recorta nada.
 *  - Con cualquier casilla de educación superior marcada no pasa ninguna sede.
 *    Pin de escuela y cuadrado de universidad juntos no se leen: el mapa pasa
 *    a ser de IES. Da igual que también esté marcada básica o media.
 *  - Una sede sin nivel declarado queda fuera en cuanto se marca cualquier
 *    nivel escolar. Es la misma regla del quintil de riqueza y del índice de
 *    vulnerabilidad: no se puede afirmar que pertenezca a un nivel que nadie le
 *    declaró.
 */
export function pasaNivel(s: Sede, f: Filtros): boolean {
  if (!f.niveles.length) return true;
  if (f.niveles.some((n) => NIVELES_SUPERIOR.includes(n))) return false;
  if (!s.niveles) return false;
  return f.niveles.some((n) => s.niveles!.includes(LETRA_NIVEL[n]));
}

/** Si el mapa está en educación superior. Ahí las escuelas no se pintan ni se
 *  cuentan: el recorte de la derecha pasa a ser de IES. */
export function verIes(f: Filtros): boolean {
  return f.niveles.includes("superior") || f.niveles.includes("superior_bid");
}

/** Lo que recorta una IES con daño, aparte de la secretaría y el BID.
 *
 * Vive aquí y no en el mapa porque el contador de la derecha tiene que decir
 * lo mismo que dibuja `filtroIes`. Si una casilla cambia allá y no acá, el
 * número y el mapa se pelean. */
export type RecorteDanoIes = {
  estadosDano: EstadoDano[];
  subtipos: string[];
  emisores: string[];
  danosTodasLasBandas: boolean;
};

function recortaBid(f: Filtros): boolean {
  return verIes(f) && !f.niveles.includes("superior");
}

function pasaSecretariaIes(p: Ies, f: Filtros): boolean {
  if (!f.secretarias.length) return true;
  return f.secretarias.includes(p.secretaria ?? "");
}

/** El inventario ocre: las 391, o las 33 del préstamo. */
export function pasaIesInventario(p: Ies, f: Filtros): boolean {
  if (recortaBid(f) && !p.bid) return false;
  return pasaSecretariaIes(p, f);
}

/** Las IES cuyo reporte gana y está prendido en la tarjeta de daños. */
export function pasaIesDano(p: Ies, f: Filtros, c: RecorteDanoIes): boolean {
  if (!p.dano_fuente || !p.dano_estado) return false;
  if (recortaBid(f) && !p.bid) return false;
  if (!pasaSecretariaIes(p, f)) return false;
  if (p.dano_estado === "sin_dano" || !c.estadosDano.includes(p.dano_estado)) {
    return false;
  }
  if (p.dano_subtipo && !c.subtipos.includes(p.dano_subtipo)) return false;
  if (p.dano_emisor && !c.emisores.includes(p.dano_emisor)) return false;
  if (!bandaEncendida(p.banda, f, c.danosTodasLasBandas)) return false;
  return true;
}

export function filtraIes(
  col: ColeccionIes | null,
  pasa: (p: Ies) => boolean,
): RasgoIes[] {
  if (!col) return [];
  return col.features.filter((x) => pasa(x.properties));
}

export function pasa(
  s: Sede,
  f: Filtros,
  conDano?: Set<string>,
  ocultas?: Set<string>,
): boolean {
  // Una sede cuyo reporte ganador afirma daño, y ese daño está apagado en la
  // tarjeta, no puede reaparecer como punto gris. Sin esto, apagar "afectación
  // parcial" quitaba el pin de color y dejaba la misma escuela en grafito: el
  // 26.591 no se movía y se leía como si el recorte no existiera.
  if (ocultas?.has(s.dane)) return false;
  // Con una secretaría elegida la banda deja de recortar y pasa a ser solo
  // pintura. Es el cambio de pregunta: mientras se mira el sismo, la banda es la
  // partición que decide de qué se está hablando; cuando se mira una entidad, sus
  // escuelas son suyas completas y la intensidad es un atributo más de cada una.
  // Esconder la mitad de un inventario porque el modelo dice que allí sacudió
  // menos deja a esa entidad sin poder ver su propio territorio.
  //
  // Así el control de bandas sigue sirviendo para lo que de verdad se le pide
  // ahí: pintar la mancha encima para leer qué parte del territorio recibió
  // cuánta sacudida. Encender una banda no hace aparecer sedes nuevas.
  const recortaPorBanda = f.secretarias.length === 0;

  // La banda de intensidad manda: si no esta prendida en el control de capas,
  // la sede ni se dibuja ni se cuenta. Es la misma particion que pinta el mapa.
  //
  // Con una excepcion: una sede que alguien reportó dañada se cuenta aunque su
  // banda esté apagada. Es el mismo argumento con el que la capa de daños dejó
  // de depender de la selección (ver `danosVisibles`): la banda es un modelo de
  // sacudida y el reporte es una fuente afirmando que esa escuela se dañó, así
  // que apagar el modelo no puede apagar la evidencia. Sin esta excepción, con
  // la pantalla abierta en 6,0 y 6,5, elegir una secretaría daba un conteo que
  // dejaba fuera escuelas cuyo punto de daño el mapa estaba dibujando.
  //
  // La excepción vale mientras haya un punto de daño. Con la capa de daños
  // apagada quien llama pasa el conjunto vacío (`danesAfirmado` en
  // `app/page.tsx`), y entonces recorta solo la banda: si el mapa no dibuja
  // reportes, la selección tampoco puede estar hecha de ellos.
  if (recortaPorBanda && !f.bandas.includes(s.banda) && !conDano?.has(s.dane)) {
    return false;
  }
  if (f.secretarias.length && !f.secretarias.includes(s.secretaria ?? "")) {
    return false;
  }
  if (f.zonas.length && !f.zonas.includes(s.zona ?? "")) {
    return false;
  }
  if (f.vigencias.length && !f.vigencias.includes(s.vigencia_2024 ?? "sin_reporte")) {
    return false;
  }
  if (f.pties.length && !f.pties.includes(s.ptie_estado ?? "no_ptie")) {
    return false;
  }
  // Sin encuesta no hay indice, y una sede sin indice no pertenece a ninguna
  // categoria de vulnerabilidad: queda fuera en cuanto se elige alguna. Es la
  // misma regla del filtro de quintil de riqueza.
  if (f.ividCategorias.length) {
    const cat = categoriaIvid(s);
    if (cat == null || !f.ividCategorias.includes(cat)) return false;
  }

  if (!pasaNivel(s, f)) return false;

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

  // Contra la matricula que la pantalla muestra, no contra la de 2022. `alumnos`
  // prefiere la del C-600 de 2024 y, en el Valle, la que publica su Secretaria.
  // Filtrando por `s.matricula` a secas, el deslizador recortaba por un numero
  // y la ficha ensenaba otro: una sede con 4 alumnos en 2022 y 40 hoy se caia
  // del mapa al pedir un minimo de 10.
  if (alumnos(s) < f.matriculaMin) return false;
  // El quintil sin elegir no filtra. Elegido, una sede sin RWI queda fuera:
  // no se puede afirmar que pertenezca a un quintil que no se le calculo.
  if (f.quintiles.length && (s.rwi_q == null || !f.quintiles.includes(s.rwi_q))) {
    return false;
  }
  return true;
}

export function filtra(
  col: ColeccionSedes,
  f: Filtros,
  conDano?: Set<string>,
  ocultas?: Set<string>,
): RasgoSede[] {
  return col.features.filter((x) => pasa(x.properties, f, conDano, ocultas));
}

/** Si el mapa esta dibujando este reporte: estado marcado y subtipo encendido.
 *
 * Es la misma regla que `filtroDanos` aplica en el mapa, escrita aparte para que
 * todo lo que cuenta sedes la use en vez de reescribirla. Estaba reescrita en
 * seis sitios y en los seis se habia quedado a medias, mirando solo el estado:
 * con "con daño" marcado y de su desglose solo "riesgo inminente", el mapa
 * dibujaba 184 puntos y el contador, la tarjeta, el resumen del Valle y el CSV
 * seguian hablando de 1.595 sedes.
 *
 * El subtipo vacio pasa siempre. Es el de `sin_dano` y `sin_verificar`, que no
 * tienen desglose, y tambien el de cualquier reporte que llegue sin clasificar:
 * exigirle estar en la lista lo borraria de la cuenta en cuanto alguien tocara
 * un desglose que no es el suyo.
 */
export function danoMarcado(
  d: Dano,
  estados: EstadoDano[],
  subtipos: string[],
): boolean {
  if (!estados.includes(d.estado)) return false;
  const t = d.subtipo ?? "";
  return t === "" || subtipos.includes(t);
}

/** Los codigos DANE de las sedes que el mapa esta dibujando con daño.
 *
 * Se calcula sobre los daños ya recortados por secretaría y por estado, que es
 * lo que de verdad se ve. Si se calculara sobre todos los daños cargados, el
 * conteo de sedes traería de vuelta escuelas cuyo punto la pantalla no dibuja.
 *
 * Aplica la precedencia de fuente, y esto es lo que arregla el 21 de agosto de
 * 2026. Antes miraba el estado de cualquier reporte de la sede, y con eso tres
 * escuelas contaban como dañadas mientras el mapa las pintaba sin daño: San
 * Juan Bautista de La Salle y La Sultana en Manizales, y el INEM Julián Motta
 * Salas en Neiva. En las tres el MEN dice que no hay daño y una noticia dice que
 * sí; la precedencia se queda con el MEN, que es quien pinta el punto, y el
 * conteo se quedaba con la noticia. De ahí salía que el pie de pantalla dijera
 * 1.794 sedes con daño mientras la tarjeta dibujaba 1.791 puntos.
 *
 * La regla es la del mapa: manda el reporte que gana, uno por sede. Lo que dijo
 * la otra fuente no se pierde, sigue entero en la ficha de la sede.
 */
export function danesConDano(
  danos: Dano[],
  estados: EstadoDano[],
  subtipos: string[],
): Set<string> {
  return new Set(
    [...reportePorSede(danos).values()]
      .filter((d) => danoMarcado(d, estados, subtipos))
      .map((d) => d.dane),
  );
}

/** Los daños que se dibujan. Una sola condición: que haya dónde dibujarlos.
 *
 * Esta capa era dependiente y ahora no lo es. Antes un punto de daño solo salía
 * si su sede había pasado la selección de la pantalla, y además si su banda
 * llegaba a `BANDA_MINIMA_DANO`. El argumento era que el mapa no debe contar dos
 * cosas a la vez: mostrando solo las visitadas por el FFIE, una sede nunca
 * visitada no debería seguir ahí con un punto encima.
 *
 * El argumento se cae cuando se mira qué son las dos capas. La intensidad y el
 * índice son modelo: dicen qué tan fuerte se estima que sacudió y qué tan
 * vulnerable se supone que es el edificio. El reporte es otra cosa, es una
 * fuente afirmando que esa escuela se dañó. Someter lo segundo a lo primero
 * hacía que apagar el modelo apagara la evidencia, que es al revés de como
 * debería funcionar: quien quiere ver solo lo reportado tiene que poder.
 *
 * En números, el acople escondía 68 de las 194 sedes con reporte. Cinco no
 * tienen coordenada, cinco caen fuera de la grilla del ShakeMap del USGS y 58
 * quedan bajo el piso de 5,5. Esas 58 son el caso feo: una fuente afirma daño,
 * el visor lo tiene cargado y quien mira no podía enterarse por ningún camino,
 * porque el aviso de "hay N sedes que la selección deja fuera" aplicaba el mismo
 * piso y tampoco las contaba.
 *
 * Del piso de intensidad, que estaba en 5,5, queda anotado el razonamiento
 * porque sigue siendo bueno y en algún momento habrá que decidir qué se hace con
 * él. Hasta 5,0 el USGS describe un sismo que se siente y que tumba objetos de
 * los estantes, no que agriete un edificio, así que un reporte de daño ahí es
 * más probable que sea deterioro previo que alguien miró por primera vez después
 * del sismo. El corte estaba en 5,5 y no en 5,0 por el único caso que tocaba:
 * las ocho sedes de la IEM Pablo VI, en López de Micay, están entre MMI 4,95 y
 * 5,07, y el reporte del PTIES habla de la institución y no de un predio, así
 * que o entraban las ocho o no entraba ninguna.
 *
 * Nada de eso justifica no dibujar el punto. Es una advertencia sobre cómo leer
 * un reporte de intensidad baja, y su lugar es la ficha de la sede, no un filtro
 * que lo borra del mapa sin decirlo.
 *
 * Lo que aquí NO se decide es el estado. Antes esta función descartaba los
 * "sin daño", con el argumento de que un punto que significa "ya preguntamos y
 * está bien" le quita espacio al que significa que se cayó. El argumento vale
 * para lo que se dibuja al abrir, y eso ya lo resuelve `CAPAS_INICIALES`, que
 * abre solo en colapso y daño. El estado lo filtran las casillas, que es donde
 * quien mira puede verlo y cambiarlo.
 *
 * La secretaría es la única excepción, y no contradice nada de lo anterior. Los
 * demás filtros son hipótesis sobre las escuelas: qué tan fuerte sacudió, qué
 * tan vulnerable es el edificio, si el FFIE la visitó. Elegir una secretaría no
 * es una hipótesis, es decir de quién se está hablando. Un mapa que dice estar
 * mirando el Valle del Cauca y dibuja un colapso en Manizales no muestra
 * evidencia de más: contradice su propio recorte.
 */
export function danosVisibles(danos: Dano[], secretarias: string[] = []): Dano[] {
  return danos.filter(
    (d) =>
      d.lon != null &&
      d.lat != null &&
      enSecretaria(d, secretarias),
  );
}

/** Si el daño cae dentro de las secretarías elegidas. Sin ninguna elegida, la
 *  pantalla no está recortada por jurisdicción y todo pasa. */
export function enSecretaria(d: Dano, secretarias: string[]): boolean {
  return !secretarias.length || secretarias.includes(d.secretaria ?? "");
}

/** Las sedes con reporte que no hay forma de dibujar, contadas por sede.
 *
 * Ya no es "las que la selección deja fuera", porque la selección dejó de tapar
 * reportes. Ahora es lo único que queda sin dibujar de verdad: las sedes con
 * reporte que no tienen coordenada. No hay filtro que las traiga ni forma de
 * ponerlas en un mapa, y por eso la tarjeta las declara en vez de callarlas.
 *
 * Antes este conteo aplicaba el mismo piso de intensidad que la capa, así que
 * las 58 sedes bajo 5,5 no se dibujaban y tampoco aparecían aquí: no había
 * ningún lugar de la pantalla donde constara que existían.
 *
 * Se cuenta por sede y no por reporte, y una sede solo queda fuera cuando
 * ninguno de sus reportes trae coordenada. La diferencia apareció con la capa
 * del MEN: cinco sedes de Manizales que salieron en prensa no tienen coordenada
 * en el directorio, y el MEN sí las ubica. Contando por reporte, esas cinco se
 * seguían declarando no dibujables mientras el mapa las estaba dibujando.
 */
export function danosFuera(danos: Dano[], secretarias: string[] = []): number {
  return sinCoordenada(danos, secretarias).sedes;
}

/** Las mismas sedes que `danosFuera`, y los estudiantes que hay detrás.
 *
 * La cuenta de sedes y la de alumnos salen del mismo recorrido a proposito. La
 * tarjeta de daños declara cuantas sedes no se pueden dibujar y el boton de
 * informacion de la cifra grande declara ademas su matricula: calculadas por
 * separado acabarian diciendo numeros que no se corresponden, que es como esta
 * pantalla ya se ha contradicho antes.
 *
 * La matricula se suma una vez por sede y no por reporte. Una sede que salio en
 * prensa y ademas la reporto el MEN tiene dos filas con la misma matricula, y
 * sumarlas diria que esa escuela tiene el doble de ninos.
 */
export function sinCoordenada(
  danos: Dano[],
  secretarias: string[] = [],
): { sedes: number; matricula: number } {
  const dentro = danos.filter((d) => enSecretaria(d, secretarias));
  const dibujables = new Set(
    dentro.filter((d) => d.lon != null && d.lat != null).map((d) => d.dane),
  );
  const vistas = new Map<string, number>();
  for (const d of dentro) {
    if (dibujables.has(d.dane) || vistas.has(d.dane)) continue;
    vistas.set(d.dane, d.matricula ?? 0);
  }
  let matricula = 0;
  vistas.forEach((m) => {
    matricula += m;
  });
  return { sedes: vistas.size, matricula };
}

/** Las sedes con daño reportado que el mapa está dibujando, como rasgos.
 *
 * Existe para que el recuento de arriba a la derecha pueda contar estas y no
 * las que pasan los filtros. Son dos preguntas distintas y hasta ahora la
 * pantalla solo sabía contestar la segunda: con la capa de sedes apagada y la
 * de reportes prendida, el mapa mostraba 189 puntos de daño y el contador
 * seguía diciendo cuántas sedes dejaban pasar las bandas de intensidad.
 *
 * Una sede, un rasgo. Cuando una sede tiene varios reportes se mira el más
 * grave, que es la misma regla con la que el mapa decide qué punto pintar
 * (`rasgosDano` en el mapa). Contar por reporte diría que Calima El Darién son
 * dos escuelas, porque ahí hablaron el alcalde y la rectora.
 *
 * De las 194 sedes con reporte, 10 no están en `sedes_evento.geojson`: cinco de
 * Manizales sin coordenada en el directorio, que quedan fuera desde la primera
 * línea porque no hay dónde dibujarlas, y cinco cuyo MMI no llega al 4,0 del
 * borde de la grilla del USGS (Barbacoas, Acevedo, Ubalá y dos de Elías). A
 * esas cinco se les arma el rasgo con lo que trae el propio daño, igual que hace
 * la ficha de sede. Si se dejaran fuera, el contador diría 184 mientras el mapa
 * dibuja 189 puntos, y quien los cuente creería que le faltan.
 *
 * El MMI de las armadas queda en NaN y no en cero: no es que no se hayan
 * sacudido, es que el modelo del sismo no llega hasta ahí.
 */
export function sedesConDano(
  col: ColeccionSedes | null,
  danos: Dano[],
  estados: EstadoDano[],
  subtipos: string[],
): RasgoSede[] {
  const peor = reportePorSede(danos.filter((d) => d.lon != null && d.lat != null));
  const enColeccion = new Map(
    (col?.features ?? []).map((f) => [f.properties.dane, f] as const),
  );
  const salida: RasgoSede[] = [];
  for (const d of peor.values()) {
    if (!danoMarcado(d, estados, subtipos)) continue;
    const f = enColeccion.get(d.dane);
    if (f) {
      salida.push(f);
      continue;
    }
    // Los nulos ya quedaron fuera arriba, pero al pasar por el mapa el
    // compilador pierde ese estrechamiento y hay que volver a decirlo.
    if (d.lon == null || d.lat == null) continue;
    salida.push({
      type: "Feature",
      properties: {
        dane: d.dane,
        sede: d.sede,
        establecimiento: d.establecimiento,
        mpio: d.mpio,
        depto: d.depto,
        // La entidad que responde por la sede. Viene en el propio reporte, y
        // sin copiarla aqui estas sedes desaparecian en cuanto alguien elegia
        // una secretaria: el filtro las leia sin entidad y las dejaba fuera de
        // su propio territorio.
        secretaria: d.secretaria,
        matricula: d.matricula,
        // El daño trae la matrícula ya resuelta con la misma regla de
        // `alumnos`: manda el C-600 de 2024 y cae al SIMAT de 2022 cuando la
        // sede no reportó. La bandera dice cuál de las dos es, y sin
        // devolverla aquí el resumen contaría estas cinco como si fueran de
        // 2024.
        matricula_2024: d.matricula_es_de_2022 ? null : d.matricula,
        encuestada: d.encuestada ?? false,
        mmi: NaN,
        nivel: "sin dato",
        banda: NaN,
      },
      geometry: { type: "Point", coordinates: [d.lon, d.lat] },
    });
  }
  return salida;
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

/** Ficha tecnica del IVID, tal como se lee detras del boton de informacion.
 *
 * Vive aqui y no incrustada en el componente porque describe una construccion
 * metodologica, no una decision de presentacion. Si el script 25 cambia, este
 * texto cambia con el.
 */
export const FICHA_IVID =
  "Qué mide. Cuánto daño declaró el rector en 2021 y 2022, sobre tres " +
  "elementos: techos, muros y pisos. Va de 0 a 5 y es el promedio simple de " +
  "los tres, que pesan igual.\n\n" +
  "De dónde sale. La encuesta del FFIE no preguntó gravedad. Preguntó qué " +
  "problemas hay, con casillas que se pueden marcar a la vez. Cada elemento " +
  "ofrece dos tipos de condición: deterioro (agrietado, humedad, material en " +
  "mal estado) y estructural (derruido, incompleto, inclinado, hundido). Los " +
  "hundimientos del piso cuentan como estructural porque hablan del suelo y de " +
  "la cimentación, no de un acabado gastado.\n\n" +
  "Cómo se calcula. Si el rector marcó que está en buen estado, el elemento " +
  "vale 0. Si no, vale 1 más un punto por la proporción de casillas de " +
  "deterioro que marcó, más tres puntos por la proporción de casillas " +
  "estructurales. Se divide por lo que cada elemento ofrece porque techos y " +
  "muros tienen dos casillas de deterioro y una estructural, y pisos al revés: " +
  "esa asimetría es del formulario, no de las escuelas.\n\n" +
  "Cómo se lee. El índice mide cuánto daño declaró el rector en total, no de " +
  "qué tipo. Dos sedes con el mismo puntaje pueden haber llegado ahí por " +
  "caminos distintos: una con algo estructural comprometido en un solo " +
  "elemento, otra con los tres deteriorados sin nada estructural. Las dos son " +
  "daño y por eso puntúan parecido; el índice no elige entre ellas. Cuál de " +
  "las dos es se ve abriendo la sede, donde van los tres elementos por " +
  "separado y se nombra el que tenga compromiso estructural.\n\n" +
  "Por elemento sí hay un corte exacto: 0 es buen estado, hasta 2 es " +
  "deterioro, y 2,5 o más significa siempre que hay algo estructural " +
  "comprometido.\n\n" +
  "Qué no es. No es una inspección ni una calificación de lo que se ve. Es una " +
  "declaración administrativa puesta en orden, hecha por el rector sobre su " +
  "propia sede, sin foto y frente a un fondo de infraestructura. Es anterior " +
  "al sismo: describe el punto de partida, no el daño de hoy.\n\n" +
  "Cobertura. Existe solo para las 15.150 sedes que el FFIE visitó. Las demás " +
  "quedan sin índice y no en cero: no haber sido visitada es no saber. Cuando " +
  "el rector marcó \"Otro\" sin ninguna casilla de severidad, el elemento suma " +
  "el 1 de base y queda contado aparte; su gravedad no se imputa.";

/** Un puntaje de elemento de 2,5 o mas significa compromiso estructural.
 *
 * El corte es exacto y no una convencion. Sin nada estructural marcado, un
 * elemento no pasa de 2. Con algo estructural, el minimo es 2,5 en pisos, que
 * ofrece dos casillas estructurales, y 4 en techos y muros, que ofrecen una.
 * Entre 2 y 2,5 no cae ningun elemento.
 */
export const CORTE_ESTRUCTURAL = 2.5;

/** Cuantos de los tres elementos tienen compromiso estructural.
 *
 * Es lo que ordena el filtro del mapa, en vez de tramos del promedio. El
 * promedio diluye: 872 sedes tienen algo estructural comprometido y aun asi
 * promedian menos de 2,0, o sea que por promedio caerian en "deterioro".
 */
export function estructurales(s: Sede): number {
  return [s.ivid_techos, s.ivid_muros, s.ivid_pisos].filter(
    (v) => v != null && v >= CORTE_ESTRUCTURAL,
  ).length;
}

/** El tramo del indice al que cae una sede, o null si nunca fue visitada.
 *
 * Son tramos de una unidad sobre el propio indice, no categorias de otra cosa.
 * El indice mide cuanto dano declaro el rector en total, y dos sedes con el
 * mismo valor pueden haber llegado ahi por caminos distintos: una con algo
 * estructural comprometido, otra con los tres elementos deteriorados. Las dos
 * formas son daño y por eso puntuan parecido. Cual de las dos es, lo dice la
 * ficha de la sede, que muestra los tres elementos por separado.
 */
export function categoriaIvid(s: Sede): number | null {
  if (s.ivid == null) return null;
  return s.ivid >= 4 ? 4 : Math.floor(s.ivid);
}

export const NOMBRE_IVID: Record<number, string> = {
  0: "0 a 0,99",
  1: "1 a 1,99",
  2: "2 a 2,99",
  3: "3 a 3,99",
  4: "4 a 5",
};

/** La rampa de los cinco tramos del índice, de menos a más daño declarado.
 *
 * Es una gradación de verdad, porque los tramos son del propio índice y están
 * ordenados. Una sola familia de tono, la del violeta de carencia, que en este
 * mapa ya significa que algo le falta a la escuela. Nunca la rampa de verde a
 * rojo, que es la sacudida del sismo: un tono no puede significar dos cosas en
 * la misma pantalla.
 *
 * Vive aquí y no en el panel porque la usan los dos, la leyenda de la tarjeta y
 * los puntos del mapa. Con una copia en cada sitio, un retoque de color dejaría
 * la leyenda diciendo una cosa y el mapa pintando otra.
 */
export const TONO_IVID: Record<number, string> = {
  0: "#cfc9ee",
  1: "#ada2e2",
  2: "#8a7bd5",
  3: "#6754c0",
  4: "#3d2c94",
};

export type Resumen = {
  sedes: number;
  matricula: number;
  /** Sedes de la seleccion cuya matricula viene de 2022 porque no hay dato de
   *  2024. Se muestra para no dar por homogeneo un numero que no lo es. */
  matriculaDe2022: number;
  /** Sedes que el C-600 de 2024 declara liquidadas, fusionadas, duplicadas o
   *  inactivas. */
  noOperan: number;
  /** Cuantas sedes de la seleccion tienen IVID. Solo las visitadas por el FFIE
   *  lo tienen, asi que el promedio se calcula sobre este denominador y no
   *  sobre el total seleccionado. */
  ividN: number;
  /** Promedio del IVID sobre `ividN`. Cero cuando no hay ninguna con indice, y
   *  por eso la pantalla se guia por `ividN` antes de mostrarlo. */
  ividMedia: number;
  /** Cuantas sedes hay en cada categoria de `categoriaIvid`, del 0 al 4. Lo usa
   *  la lista de chips para decir cuantas recorta cada uno. */
  ividPorCategoria: number[];
  encuestadas: number;
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
    ividN: 0,
    ividMedia: 0,
    ividPorCategoria: [0, 0, 0, 0, 0],
    encuestadas: 0,
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
    const cat = categoriaIvid(s);
    if (cat != null) {
      r.ividN += 1;
      // Se acumula la suma y al final se divide. Promediar promedios daria
      // otro numero.
      r.ividMedia += s.ivid ?? 0;
      r.ividPorCategoria[cat] += 1;
    }
    mpios.add(`${s.depto}|${s.mpio}`);
    if (s.secretaria) etc.add(s.secretaria);
    if (s.encuestada) r.encuestadas += 1;
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
  r.ividMedia = r.ividN ? r.ividMedia / r.ividN : 0;
  return r;
}

/** El mismo resumen, contado sobre IES y no sobre sedes.
 *
 * `sedes` es el número de instituciones. `matricula` es la suma de programas
 * vigentes: una IES no tiene matrícula SIMAT, y dejar ese campo en cero haría
 * que el panel derecho dijera "0 estudiantes" debajo de un recorte que sí
 * existe. El rótulo lo cambia `ControlDerecho` cuando `modoIes` está prendido.
 */
export function resumeIes(rasgos: RasgoIes[]): Resumen {
  const mpios = new Set<string>();
  const etc = new Set<string>();
  const r: Resumen = {
    sedes: rasgos.length,
    matricula: 0,
    matriculaDe2022: 0,
    noOperan: 0,
    ividN: 0,
    ividMedia: 0,
    ividPorCategoria: [0, 0, 0, 0, 0],
    encuestadas: 0,
    sinEnergia: 0,
    matriculaSinEnergia: 0,
    sinInternet: 0,
    matriculaSinInternet: 0,
    sinCoordVerificada: 0,
    municipios: 0,
    secretarias: 0,
  };
  for (const x of rasgos) {
    const p = x.properties;
    r.matricula += p.programas_vigentes ?? 0;
    mpios.add(`${p.depto}|${p.mpio}`);
    if (p.secretaria) etc.add(p.secretaria);
  }
  r.municipios = mpios.size;
  r.secretarias = etc.size;
  return r;
}

/** Índice de un marco ya filtrado, para restar sedes sin volver a recorrerlo.
 *
 * Un clic en un subtipo de daño no puede volver a filtrar las 26 mil sedes ni
 * a resumirlas: el recorte de bandas y secretaría no cambió. Lo que cambia es
 * un conjunto chico de códigos DANE que dejan de pintarse. Este índice deja
 * restarlos en tiempo proporcional a ese conjunto.
 */
export type IndiceMarco = {
  porDane: Map<string, RasgoSede>;
  resumen: Resumen;
  mpios: Map<string, number>;
  secretarias: Map<string, number>;
};

export function indiceMarco(rasgos: RasgoSede[]): IndiceMarco {
  const porDane = new Map<string, RasgoSede>();
  const mpios = new Map<string, number>();
  const secretarias = new Map<string, number>();
  for (const f of rasgos) {
    porDane.set(f.properties.dane, f);
    const mk = `${f.properties.depto}|${f.properties.mpio}`;
    mpios.set(mk, (mpios.get(mk) ?? 0) + 1);
    const sec = f.properties.secretaria;
    if (sec) secretarias.set(sec, (secretarias.get(sec) ?? 0) + 1);
  }
  return { porDane, resumen: resume(rasgos), mpios, secretarias };
}

/** El resumen del marco menos las sedes apagadas en la tarjeta de daños. */
export function resumeSin(indice: IndiceMarco, ocultas: Set<string>): Resumen {
  if (ocultas.size === 0) return indice.resumen;
  const quitar: RasgoSede[] = [];
  const mpios = new Map(indice.mpios);
  const secretarias = new Map(indice.secretarias);
  for (const dane of ocultas) {
    const f = indice.porDane.get(dane);
    if (!f) continue;
    quitar.push(f);
    const s = f.properties;
    const mk = `${s.depto}|${s.mpio}`;
    const nm = (mpios.get(mk) ?? 1) - 1;
    if (nm <= 0) mpios.delete(mk);
    else mpios.set(mk, nm);
    if (s.secretaria) {
      const ne = (secretarias.get(s.secretaria) ?? 1) - 1;
      if (ne <= 0) secretarias.delete(s.secretaria);
      else secretarias.set(s.secretaria, ne);
    }
  }
  if (quitar.length === 0) return indice.resumen;
  const q = resume(quitar);
  const b = indice.resumen;
  const ividN = b.ividN - q.ividN;
  return {
    sedes: b.sedes - q.sedes,
    matricula: b.matricula - q.matricula,
    matriculaDe2022: b.matriculaDe2022 - q.matriculaDe2022,
    noOperan: b.noOperan - q.noOperan,
    ividN,
    ividMedia: ividN ? (b.ividMedia * b.ividN - q.ividMedia * q.ividN) / ividN : 0,
    ividPorCategoria: b.ividPorCategoria.map((n, i) => n - q.ividPorCategoria[i]),
    encuestadas: b.encuestadas - q.encuestadas,
    sinEnergia: b.sinEnergia - q.sinEnergia,
    matriculaSinEnergia: b.matriculaSinEnergia - q.matriculaSinEnergia,
    sinInternet: b.sinInternet - q.sinInternet,
    matriculaSinInternet: b.matriculaSinInternet - q.matriculaSinInternet,
    sinCoordVerificada: b.sinCoordVerificada - q.sinCoordVerificada,
    municipios: mpios.size,
    secretarias: secretarias.size,
  };
}

/** Las del marco que siguen visibles. Solo se arma al exportar, no en cada clic. */
export function sinOcultas(
  rasgos: RasgoSede[],
  ocultas: Set<string>,
): RasgoSede[] {
  if (ocultas.size === 0) return rasgos;
  return rasgos.filter((f) => !ocultas.has(f.properties.dane));
}

/** Cuándo el recorte de intensidad no está recortando nada.
 *
 * Dos casos y los dos terminan igual: no hay un "dentro" contra el que
 * contrastar, así que ningún punto de daño puede dibujarse como "fuera".
 *
 * Con una secretaría elegida, porque allí la banda solo pinta y no reparte: lo
 * decide `pasa`, unas líneas más abajo en este mismo archivo.
 *
 * Y con ninguna banda encendida, porque "fuera del recorte" solo significa algo
 * cuando hay un dentro. Elegir una secretaría vacía las bandas a propósito, así
 * que este caso es el de todos los días.
 *
 * Vive aquí y no en el mapa porque lo preguntan dos sitios que tienen que decir
 * lo mismo: el mapa, para no atenuar, y la tarjeta de daños, para no ofrecer una
 * casilla que dice que hay puntos atenuados cuando no los hay. Escrita dos veces
 * se separaría, que es la forma en que este visor ya se ha contradicho antes.
 */
export function sinRecorteDeBanda(f: Filtros): boolean {
  return f.secretarias.length > 0 || f.bandas.length === 0;
}

/** Si este reporte cae dentro del recorte de intensidad.
 *
 * Es la regla que decide si un daño se cuenta y se dibuja sólido, y hasta el 25
 * de agosto de 2026 estaba escrita cuatro veces. Dos de las cuatro copias
 * ignoraban `sinRecorteDeBanda`, y el efecto era el peor posible: al apagar "ver
 * todas las sedes reportadas" con las bandas vacías, que es como abre el visor,
 * los contadores caían a cero mientras el mapa seguía dibujando dos mil puntos.
 * La pantalla decía 0 y enseñaba 2.000.
 *
 * Las tres condiciones, en orden:
 *
 *  1. `todasLasBandas`, la casilla de la tarjeta de daños. Encendida, el
 *     recorte no aplica y todo reporte entra.
 *  2. `sinRecorteDeBanda`. Con una secretaría elegida la banda deja de repartir
 *     y solo pinta; y sin ninguna banda encendida no hay un dentro contra el
 *     que contrastar. En los dos casos no hay recorte que aplicar.
 *  3. La banda de la sede está entre las encendidas. Una sede sin banda nunca
 *     pasa: son las que caen fuera de la grilla del ShakeMap, de las que el
 *     modelo no dice nada, así que no pertenecen a ninguna selección.
 *
 * `todasLasBandas` va como parámetro y no se lee de `Filtros` porque vive en
 * `Capas`. El mapa la pasa en `false` a propósito: allí la casilla la aplica
 * `filtroDanos` sobre la capa, y `en_seleccion` tiene que seguir diciendo si el
 * punto está dentro del recorte para poder atenuar el que no lo está.
 */
export function enBandaEncendida(
  d: Dano,
  f: Filtros,
  todasLasBandas: boolean,
): boolean {
  return bandaEncendida(d.banda, f, todasLasBandas);
}

/** La misma regla, sobre el valor de banda a secas.
 *
 * Existe porque no solo la piden los daños de sede. Una IES trae su banda en
 * `Ies.banda` y no es un `Dano`, y hasta el 25 de agosto de 2026 `pasaIesDano`
 * llevaba su propia copia, que conocía la mitad de la excepción: miraba si
 * había una secretaría elegida pero no si la lista de bandas estaba vacía. Con
 * la casilla "ver todas las sedes reportadas" apagada y ninguna banda marcada,
 * que es como abre el visor, esa copia rechazaba las once instituciones con
 * daño y no se dibujaba ni una. */
export function bandaEncendida(
  banda: number | null | undefined,
  f: Filtros,
  todasLasBandas: boolean,
): boolean {
  if (todasLasBandas) return true;
  if (sinRecorteDeBanda(f)) return true;
  return banda != null && f.bandas.includes(banda);
}

/** Si algún filtro está preguntando por un atributo de la sede.
 *
 * Zona, vigencia, PTIES, vulnerabilidad, quintil, matrícula, y los de las dos
 * pestañas de características. La banda y la secretaría no cuentan: la primera
 * es el recorte de intensidad y la segunda el de jurisdicción, y ninguna de las
 * dos es una propiedad que se le pregunte a la escuela.
 *
 * Existe para decidir si entran al conteo las sedes con reporte que no están en
 * el marco. Esas llegan del archivo de daños con nombre, municipio y matrícula y
 * nada más: no tienen zona, ni quintil, ni C-600. Mientras nadie pregunte por un
 * atributo se pueden contar sin afirmar nada de ellas; en cuanto alguien filtra
 * por zona, no hay forma honesta de decir si pasan el filtro, y quedan fuera por
 * la misma regla con la que `pasa` deja fuera a una sede sin quintil cuando se
 * elige un quintil.
 *
 * La matricula minima no esta en la lista, aunque tambien recorta. Es el unico
 * atributo que esas sedes si traen, porque viaja en el propio reporte de dano,
 * asi que se les puede aplicar y se les aplica en `page.tsx`. Tenerla aqui
 * borraba de la pantalla de arranque a todas las sedes fuera del marco, solo
 * por venir el visor con un minimo puesto.
 */
export function pideAtributos(f: Filtros): boolean {
  return f.zonas.length > 0
    || f.vigencias.length > 0
    || f.pties.length > 0
    || f.ividCategorias.length > 0
    // El nivel educativo es un atributo mas, y de los que menos cubren: una
    // sede que llega solo por el reporte de dano no esta en el SIMAT 2022 ni en
    // el C-600 2024, que son las dos fuentes del nivel.
    || f.niveles.length > 0
    || f.quintiles.length > 0
    || (f.tab === "fisica" && f.fisica !== "todas")
    || (f.tab === "servicios"
      && (f.energia !== "todas" || f.internet !== "todas"));
}

/** Los reportes que el mapa está dibujando: uno por sede, el que gana por
 *  precedencia, y solo si su estado y su subtipo están marcados.
 *
 * Existe para que la tarjeta de daños y la de características no cuenten cada
 * una por su lado. Son la misma lista: el número del encabezado de la primera es
 * el universo entero de la segunda, y si se calcularan aparte volveríamos a tener
 * dos reglas para la misma pregunta, que es exactamente el error que este visor
 * ya cometió cuatro veces.
 *
 * No mira la coordenada. Es a propósito y lo separa de `cuentaDanosMarcados`,
 * que sí: aquélla contesta cuántos puntos hay en el mapa, ésta contesta de qué
 * sedes estamos hablando. Una sede reportada sin coordenada sigue siendo una
 * sede reportada.
 */
export function danosMarcados(
  danos: Dano[],
  estados: EstadoDano[],
  subtipos: string[],
  /** El recorte de la izquierda, como conjunto de códigos DANE. Sin él la
   *  lista es todo lo que el mapa dibuja; con él, lo que además sobrevive a los
   *  filtros. Es el mismo parámetro y el mismo nombre que `cuentaDanosMarcados`,
   *  para que las dos puedan recibir `indice.porDane` y decir el mismo número.
   *
   *  La tarjeta de características lo pasa desde el 25 de agosto de 2026. Antes
   *  no, y por eso describía 2.046 sedes dijera lo que dijera el panel: marcar
   *  "media" dejaba el contador en 676 y la tarjeta seguía en 2.046, hablando de
   *  mil trescientas sedes que la pantalla ya no estaba contando. */
  enMarco?: Set<string> | Map<string, unknown>,
): Dano[] {
  return [...reportePorSede(danos).values()]
    .filter((d) => danoMarcado(d, estados, subtipos))
    .filter((d) => !enMarco || enMarco.has(d.dane));
}

/** Cuántos daños pintados están marcados y tienen coordenada.
 *
 * Un ganador por sede, la misma regla que `sedesConDano`, sin armar los
 * rasgos. `enMarco` recorta a las que también están en la selección. */
export function cuentaDanosMarcados(
  danos: Dano[],
  estados: EstadoDano[],
  subtipos: string[],
  enMarco?: Set<string> | Map<string, unknown>,
): number {
  let n = 0;
  const peor = reportePorSede(
    danos.filter((d) => d.lon != null && d.lat != null),
  );
  for (const d of peor.values()) {
    if (!danoMarcado(d, estados, subtipos)) continue;
    if (enMarco && !enMarco.has(d.dane)) continue;
    n += 1;
  }
  return n;
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
  // No es una verificación en terreno y por eso no dice "verificada". Es que la
  // del directorio caía fuera del municipio de la propia sede y la capa del MEN
  // publica otra que sí cae dentro. La lista de cuáles y por qué está en
  // `COORDENADAS_CORREGIDAS`, en `scripts/20_base_maestra.py`.
  corregida_men: "corregida con la coordenada de la capa del MEN",
  // Tampoco es una verificación en terreno. Alguien encontró la escuela sobre la
  // imagen satelital y dejó escrito quién, cuándo y con qué la reconoció, en
  // `COORDENADAS_CORREGIDAS`. La coordenada del directorio caía en otro
  // departamento.
  corregida_manual: "ubicada a mano sobre imagen satelital",
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
 *  muestran en minuscula porque son etiquetas de un boton, no un codigo.
 *
 *  `zona` es una declaracion administrativa y cubre las 26.591 sedes sin un solo
 *  nulo. Es la que filtra el mapa. No confundir con `area_class`, que es otra
 *  cosa y tiene su propio diccionario aqui abajo. */
export const NOMBRE_ZONA: Record<string, string> = {
  URBANA: "urbana",
  RURAL: "rural",
};

/** Las claves son los valores de `area_class`, que llegan en minuscula.
 *
 * No es la binaria del SIMAT sino un calculo sobre la grilla de poblacion de
 * WorldPop: urbana si la densidad llega a 300 hab/km² y la poblacion a 5.000;
 * no urbana si llega a 150 hab/km² y la poblacion queda entre 200 y 5.000;
 * dispersa el resto. La diferencia que aporta sobre `zona` es justamente la que
 * `zona` esconde, la de un centro poblado frente a una vereda dispersa, que
 * para llegar a una escuela es toda la diferencia.
 *
 * Hasta ahora este diccionario y el de `zona` eran uno solo, con las llaves en
 * mayuscula del SIMAT, asi que la busqueda nunca acertaba y la ficha imprimia
 * el valor crudo: 1.621 sedes decian `no_urbana`, con guion bajo.
 */
export const NOMBRE_AREA: Record<string, string> = {
  urbana: "urbana",
  no_urbana: "centro poblado",
  dispersa: "rural dispersa",
};

/** Estado de la sede frente al PTIES.
 *
 * "Focalizada" y "intervenida" no son lo mismo y por eso van separadas: el ano
 * de intervencion del archivo llega hasta 2029, asi que hay sedes en la
 * lista cuya obra todavia no empieza.
 */
export const NOMBRE_PTIE: Record<string, string> = {
  intervenida: "PTIES, ya intervenida",
  programada: "PTIES, programada",
  no_focalizada: "En la lista, sin focalizar",
  no_ptie: "Fuera del PTIES",
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

/** Las fuentes que usa el visor, para el botón del título.
 *
 * Vive aquí y no incrustada en el componente porque es un texto que se
 * desactualiza solo: cada vez que entra una fuente nueva hay que tocarlo, y
 * enterrado entre el JSX del encabezado nadie se acuerda. La última vez que pasó
 * fue el 14 de agosto de 2026, cuando entró la capa del MEN y el botón siguió
 * diciendo durante un rato que los emisores de reporte eran tres.
 *
 * Los números que aparecen aquí son los del archivo que dibuja esta pantalla. Si
 * cambian allí hay que cambiarlos aquí, que es la deuda conocida de tener la
 * cifra escrita en prosa.
 */
export const FUENTES_DEL_VISOR = `Este visor permite identificar espacialmente y obtener información actualizada de las escuelas afectadas por el sismo del 10 de agosto de 2026 en Colombia. Combina información de reportes oficiales del MEN, secretarías de educación y noticias con registros administrativos para permitir la caracterización de las escuelas. Ninguna de las 26.636 sedes que dibuja trae el concepto de un ingeniero: 43 sedes del Valle declaran que ya existe uno, pero el concepto mismo vive en el aplicativo de la Secretaría de Infraestructura y no en este mapa. Todo lo que se ve es declarado por alguien o estimado por un modelo, y cada punto dice quién lo afirma.

CÓMO SE USA
Elija una secretaría: recorta las sedes, los daños y las cuentas de la derecha. Las casillas de daño deciden qué se dibuja, y su número cuenta exactamente los puntos del mapa.
La tarjeta de características describe las sedes con daño que además pasan los filtros de la izquierda, que es lo mismo que cuenta la cifra grande. Al tocar un tramo se resalta en el mapa, recorta el bloque de "cómo están hoy" y se puede bajar en CSV.

CÓMO LEERLO
Una sede sin reporte no es una sede sin daño: nadie ha dicho nada de ella. La cobertura de las fuentes es muy desigual entre territorios.
La intensidad (MMI) es sacudida estimada por un modelo, no daño observado.
Un tramo gris siempre significa "no sabemos", nunca "no tiene".
Lo de "cómo están hoy" describe un momento, no una condición permanente.

QUIÉN REPORTA EL DAÑO — 2.046 sedes
Secretaría de Educación del Valle del Cauca. 903 sedes, corte al 22 de agosto, con 20 que solo trae el corte del 16. Consolidado de lo que declararon sus rectores, y única fuente que dice si la escuela está dando clase, qué porcentaje está afectado y qué pide. Manda sobre el MEN en sus sedes. Su archivo no trae código DANE: el emparejamiento lo hicimos nosotros y cada ficha dice con qué regla.
MEN. 1.739 sedes, corte al 15 de agosto. Su capa cubre 52.611 sedes y solo 2.525 declaran algo: las demás dicen "no aporta información". De esas 2.525, las que quedan dentro del alcance del sismo son las que se dibujan aquí. El estado sale de un formulario que el propio Ministerio declara no exhaustivo, así que una sede sin reporte no es una sede sin daño.
BID. 16 sedes. Reporte del equipo PTIES, corte al 10 de agosto.
Prensa. 178 sedes. Declaración de una autoridad, con nombre, cargo, fecha y cita textual.
ChatMap (HOT). 1 sede. Foto ciudadana emparejada con la sede; no afirma nada del edificio.

DÓNDE SACUDIÓ
ShakeMap del USGS. Sismo de magnitud 7,4 a 5 km al este de San José del Palmar, calibrado con 2 estaciones sismológicas y 239 reportes de personas para todo el país. Es una estimación de la zona, no una medición en la escuela.

REGISTROS ADMINISTRATIVOS, TODOS ANTERIORES AL SISMO
SIMAT 2022. El directorio de las 52.823 sedes oficiales del país, con zona, matrícula y coordenada. Es el marco: todo lo demás se pega encima. De aquí y del C-600 sale el nivel educativo de cada sede, unidos: 45 sedes no están en ninguna de las dos y quedan sin nivel declarado.
CIMA. Control de calidad de la coordenada: cuáles están verificadas y cuáles caen en otro municipio.
C-600 del DANE, 2024. Energía, internet, matrícula y si la sede sigue operando. 25.425 sedes. No pregunta por agua en ninguno de sus años.
Encuesta del FFIE, 2021 y 2022. Estado declarado por el rector de techos, muros y pisos, si hay agua y de dónde llega, y fotos de campo. 8.070 sedes.
Censo de Población y Vivienda 2018 del DANE. Acueducto y alcantarillado de las viviendas del área censal donde cae la sede, no del colegio; el área mediana tiene 66 viviendas. 5.278 sedes, en los seis departamentos con microdato descargado.
Índice de riqueza relativa de Meta. Quintiles nacionales del entorno, desde una grilla de 2,4 km. 21.346 sedes.
Open Buildings de Google. La huella del edificio, desde el zoom 15.
geoBoundaries 2020. El límite de los municipios de cada secretaría. Punteado porque es una referencia de hasta dónde mirar, no una frontera legal.
HECAA del Ministerio de Educación, consulta pública del SNIES. Las 391 instituciones de educación superior del país, con su domicilio declarado ante el SACES. El SNIES no publica coordenadas: las de este mapa las geocodificamos nosotros desde esa dirección, y cada punto dice con cuánta confianza. De 11 de las 391 hay dato de daño, y de ninguna de las otras 380. Las 11 salieron de prensa, salvo una del reporte del PTIES: ninguna fuente oficial de este visor cubre educación superior, porque el tablero del MEN y el de la Secretaría del Valle van de preescolar a media. Que una IES no aparezca reportada no dice nada sobre su estado.`;
