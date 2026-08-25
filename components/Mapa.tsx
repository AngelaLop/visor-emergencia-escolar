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
 *  - La educacion superior es un cuadrado ocre, y el ocre no esta en ninguna de
 *    las otras rampas. La forma es lo que hace el trabajo: pin para la sede
 *    escolar, circulo para el reporte de dano, cuadrado para la IES. Hueco
 *    cuando el geocodificador solo pudo devolver el centro del municipio, que
 *    es el mismo recurso del pin hueco de la sede nunca encuestada.
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
import { useEffect, useRef, useState } from "react";

import { cargaHuellas, miles, sinRecorteDeBanda, TONO_IVID } from "@/lib/datos";
import {
  BANDAS,
  NOMBRE_EMISOR,
  NOMBRE_FUENTE,
  nombreFino,
  reportePorSede,
  EMISORES,
  SUBTIPOS,
} from "@/lib/tipos";
import type { EstadoDano } from "@/lib/tipos";
import type {
  ColeccionIes,
  ColeccionSecretarias,
  Dano,
  Evento,
  Filtros,
  MapaBase,
  RasgoSede,
  Resalte,
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

/** El ambar del resalte, y el tono al que se apaga todo lo demas.
 *
 * Ambar y no un paso de la rampa turquesa de la tarjeta: en el mapa ya viven los
 * tres colores de fuente de dano, y uno de ellos, el cian de ChatMap, es de la
 * misma familia que esa rampa. Medido contra los tres con el validador de la
 * paleta: la peor pareja a vision normal queda en 26,4 y el contraste sobre la
 * superficie clara en 3,31:1. Sobre la oscura, 8,87:1. */
export const RESALTE = { claro: "#b88100", oscuro: "#e3b23c" };

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
 * El magenta vuelve a `noticia` el 14 de agosto de 2026, y con el HOT pasa al
 * turquesa. Es la vuelta atras de un cambio anterior, y conviene decir por que
 * ese cambio dejo de tener sentido en vez de borrarlo.
 *
 * El magenta se habia retirado porque no se separaba del rojo de HOT: los dos
 * tonos tienen la misma luminosidad y la misma temperatura, y a pocos pixeles de
 * radio con halo blanco se volvian el mismo punto. Ese argumento se apoyaba en
 * que HOT era entonces el emisor con mas puntos del mapa. Hoy HOT tiene una sola
 * sede y el rojo sale de la capa: al cambiarlo por el turquesa, el par que
 * chocaba deja de existir y el magenta queda libre para la fuente que si tiene
 * volumen.
 *
 * Con lo que queda, los tres se separan bien. El magenta de `noticia` esta fuera
 * de la rampa de intensidad, que no llega al morado por ningun lado. El turquesa
 * de `hot` y el azul de `oficial` se separan por saturacion y brillo, y son el
 * mismo par que ya convivia cuando el turquesa estaba en `noticia`.
 *
 * El rojo no desaparece del archivo: `REPORTE` sigue marcando el halo de
 * coordenada sin verificar, que es otra capa y nunca se dibuja a la vez que esta.
 *
 * Los tres van con halo blanco porque sobre la mancha de intensidad cualquier
 * tono solido se pierde.
 */
export const COLOR_FUENTE: Record<string, string> = {
  hot: "#0aa2b8",
  oficial: "#1558a6",
  noticia: "#b5177e",
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
  /** Los codigos DANE que sobreviven a los filtros de la izquierda.
   *
   * Se usa para atenuar, no para quitar. Un filtro de atributo (zona, quintil,
   * matricula, vigencia) dice algo del registro administrativo de la sede, no
   * del dano: apagar un atributo no puede apagar la evidencia de que alguien
   * afirmo que esa escuela se cayo. Asi el mapa sigue mostrando todo el dano
   * reportado y marca cual esta dentro de la seleccion, que es lo que cuenta la
   * cifra de la derecha.
   *
   * La secretaria es la excepcion y no pasa por aqui: esa si recorta de verdad,
   * en `danosVisibles`, porque elegir una entidad es decir de que territorio se
   * esta hablando y no filtrar por un atributo. */
  danesSeleccion: Set<string>;
  /** Los DANE con algun reporte, para que el filtro de la lista los distinga. */
  danesConReporte: string[];
  colombia: unknown | null;
  /** El territorio de cada secretaria, un rasgo por entidad. Lo produce el
   *  script 44 y solo se dibuja el de las secretarias elegidas. */
  secretarias: ColeccionSecretarias | null;
  /** Las 391 instituciones de educacion superior. Se dibujan solo con la
   *  casilla "Educacion superior" marcada, y esa casilla es lo unico que las
   *  decide: la banda de intensidad no las recorta. Ver `exporta_ies` en
   *  `scripts/23_visor_datos.py`. */
  ies: ColeccionIes | null;
  filtros: Filtros;
  capas: Capas;
  mapaBase: MapaBase;
  tema: Tema;
  seleccion: string | null;
  /** La sede a la que hay que volar. El contador hace que tocar dos veces la
   *  misma tarjeta vuelva a mover el mapa. */
  foco: { dane: string; n: number } | null;
  onSeleccion: (dane: string | null) => void;
  /** Sedes que ya se dibujan como pin de daño. El punto gris no va debajo.
   *
   * Viaja como filtro de capa, no rehaciendo la fuente. Reescribir 26 mil
   * rasgos en cada casilla de daño era lo que dejaba el mapa trabado. */
  danesConPin: string[];
  /** El subconjunto que la tarjeta de caracteristicas esta resaltando, o `null`.
   *
   * Viaja como conjunto de codigos DANE ya resuelto y no como una expresion
   * sobre un atributo, porque las tres clases de fila de esa tarjeta preguntan
   * por cosas que no viven en el mismo sitio: la zona esta en la sede, el
   * acueducto del entorno se calculo aparte y el estado operativo esta en el
   * reporte. Con el conjunto resuelto en React, el mapa no tiene que saber de
   * donde salio.
   *
   * Resaltar no recorta: las demas sedes no desaparecen, se apagan. Lo hace en
   * dos movimientos, bajar la opacidad de las capas de dano y volver a dibujar
   * encima las resaltadas en ambar. */
  resalte: Resalte | null;
  /** Si los controles del mapa se van al lado izquierdo.
   *
   * Al desplegar la tarjeta de caracteristicas la columna derecha pasa de 240 a
   * 360 px y se come la esquina donde viven el zoom, el boton de volver al
   * inicio y la escala. No se puede mover un control en MapLibre: hay que
   * quitarlo y volver a anadirlo en la otra posicion, y por eso las tres
   * instancias se guardan. */
  controlesIzquierda: boolean;
};

type Expr = maplibregl.ExpressionSpecification;

/** El filtro de la capa de daños: que estado, que subtipo de colapso y si se
 *  respeta el recorte de intensidad.
 *
 *  Vive aqui arriba porque se pide en dos momentos distintos, al montar las
 *  capas y al tocar una casilla, y hasta el 14 de agosto de 2026 cada momento
 *  tenia su propia copia de la regla. Con dos copias, agregar el subtipo de
 *  colapso en una sola habria dejado el mapa filtrando bien hasta el primer
 *  clic y mal despues.
 *
 *  El subtipo vacio pasa siempre. Es el de `sin_dano` y `sin_verificar`, que no
 *  tienen desglose: si se les exigiera estar en la lista de subtipos encendidos,
 *  desaparecerian del mapa en cuanto alguien tocara cualquiera de los dos
 *  desgloses. Los colapsos y daños de fuentes que no precisan no caen aqui, van
 *  con `colapso_sd` y `dano_sd` y tienen su propia pastilla.
 */
function filtroDanos(estados: EstadoDano[], todas: boolean,
                     subtipos: string[], emisores: string[]): Expr {
  const porEstado: Expr =
    ["in", ["get", "estado"], ["literal", estados]] as Expr;
  const porSubtipo: Expr = ["any",
    ["==", ["get", "subtipo"], ""],
    ["in", ["get", "subtipo"], ["literal", subtipos]]] as Expr;
  // El emisor vacio pasa siempre. Es el de las noticias, que no son una
  // entidad: exigirles estar en la lista las borraria del mapa en cuanto
  // alguien apagara cualquier emisor oficial.
  const porEmisor: Expr = ["any",
    ["==", ["get", "emisor"], ""],
    ["in", ["get", "emisor"], ["literal", emisores]]] as Expr;
  const base: Expr = ["all", porEstado, porSubtipo, porEmisor] as Expr;
  return todas ? base : (["all", base, ["get", "en_seleccion"]] as Expr);
}

/** Esconde del grafito las sedes que ya tienen pin de daño.
 *
 *  `null` cuando la lista va vacía: MapLibre entiende "sin filtro" y no
 *  "filtro que no deja pasar a nadie". */
function filtroSinGris(danes: string[]): Expr | null {
  if (danes.length === 0) return null;
  return ["!", ["in", ["get", "dane"], ["literal", danes]]] as Expr;
}

/** El filtro de la capa de resalte: lo mismo que dibujan las capas de dano, y
 *  ademas estar en el conjunto resaltado.
 *
 *  Con `null` o con el conjunto vacio devuelve un filtro que no deja pasar a
 *  nadie, que es justo lo que hace falta: sin resalte no hay nada que pintar en
 *  ambar. Es lo contrario de `filtroSinGris`, donde la lista vacia significa "no
 *  escondas nada". */
function filtroResalte(c: Capas, danes: string[] | null): Expr {
  const lista = danes ?? [];
  if (lista.length === 0) return ["==", ["literal", 1], ["literal", 0]] as Expr;
  const conDano = c.estadosDano.filter((e) => e !== "sin_dano");
  return ["all",
    filtroDanos(conDano, c.danosTodasLasBandas, c.subtipos, c.emisores),
    ["in", ["get", "dane"], ["literal", lista]]] as Expr;
}

/** Que se dibuja encima del mapa base. Lo maneja la tarjeta de capas. */
export type Capas = {
  intensidad: boolean;
  sedes: boolean;
  /** La linea punteada del territorio de las secretarias elegidas.
   *
   * Existe para que la fila de "Secretaría de educación" tenga el mismo ojo que
   * las otras dos del panel. No cambia que sedes se cuentan: el recorte de
   * jurisdiccion lo hace `filtros.secretarias` y sigue en pie con la linea
   * apagada. Lo unico que apaga es el dibujo del limite, que es de 2020 y a
   * veces estorba encima de la mancha de intensidad. */
  territorio: boolean;
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
   * Abre encendido desde el 21 de agosto de 2026. Estuvo apagado y el argumento
   * era de dibujo: los puntos fuera de las bandas aparecían sobre el mapa base
   * pelado, sin mancha debajo, y eso no se lee como "aquí hay un reporte que el
   * modelo no explica" sino como que el mapa está mal. Ese argumento ya está
   * atendido: lo de fuera del recorte se dibuja atenuado en vez de sólido, así
   * que se distingue sin desaparecer.
   *
   * Lo que lo decidió es otra cosa. Con reportes oficiales de tres emisores, la
   * intensidad dejó de ser la herramienta con la que se pronostica el daño y
   * pasó a ser una característica más de la sede. Un mapa que abre escondiendo
   * escuelas reportadas porque el modelo dice que ahí no sacudió fuerte tiene el
   * orden al revés. Ver la casilla "ver todas las sedes reportadas" en la
   * tarjeta de daños, que sigue existiendo para volver a apretar el recorte. */
  danosTodasLasBandas: boolean;
  /** Cuales subtipos se dibujan, de los dos estados que tienen desglose.
   *
   * Es una sola lista y no una por estado porque las claves ya llevan el estado
   * por delante: `colapso_parcial` y `dano_parcial` son distintas, asi que
   * apagar una no toca la otra.
   *
   * Solo el MEN precisa el subtipo. Las demas fuentes dicen "colapso" o "daño" y
   * ya, y esas van en `colapso_sd` y `dano_sd`, que son un subtipo mas de esta
   * lista y no un descarte: sin ellos, abrir un desglose habria borrado del mapa
   * los reportes de prensa sin que nadie lo pidiera.
   *
   * Abre con todos encendidos, o sea sin filtrar nada, y los desgloses viven
   * plegados detras de su casilla. La distincion importa para decidir a donde ir
   * primero, pero desplegada por defecto el filtro mas fino de la pantalla
   * ocuparia mas espacio que el mas grueso. */
  subtipos: string[];
  /** Que emisores de la fuente oficial se dibujan.
   *
   * Existe desde que `oficial` dejo de ser dos entidades que decian casi lo
   * mismo. La Secretaria del Valle aporta 570 sedes y manda sobre el MEN cuando
   * las dos hablan de la misma, asi que hace falta poder ver el mapa de una sola
   * de ellas: cuantas escuelas aporta la secretaria que el MEN no tiene es
   * exactamente la pregunta que se hace al empezar a trabajar con un territorio.
   *
   * Las noticias no estan en la lista y no les afecta. Su `emisor` es vacio
   * porque una nota de prensa no es una entidad que reporte, es alguien
   * citando a una autoridad, y quien la emite ya se lee en la ficha.
   *
   * Abre con todos encendidos: el mapa no debe empezar escondiendo una fuente. */
  emisores: string[];
};

export const CAPAS_INICIALES: Capas = {
  intensidad: true,
  // Apagada al abrir. Con `reportes` encendida y esta apagada se activa
  // `soloDanos` en `app/page.tsx`, que es el modo en el que la cuenta grande de
  // la derecha pasa a ser "sedes educativas con dano reportado" en vez de
  // "seleccionadas". Junto con las bandas vacias, el visor abre mostrando solo
  // las escuelas que una fuente reporto danadas, y no las 26.591 que el modelo
  // de sacudida deja dentro del recorte.
  //
  // No desaparece nada: la fila "Sedes educativas" del panel izquierdo la
  // vuelve a encender de un clic, y es la misma fila donde viven el buscador
  // por nombre y los siete filtros de sede.
  sedes: false,
  territorio: true,
  reportes: true,
  huellas: true,
  estadosDano: ["colapso", "dano"],
  danosTodasLasBandas: true,
  subtipos: SUBTIPOS,
  emisores: [...EMISORES],
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
/** El color de la educacion superior.
 *
 * Ocre oscuro, que es un hueco real en la paleta: la rampa de intensidad va de
 * verde a rojo, las sedes son grafito o la escala lila del indice, y los tres
 * emisores de dano son cian, azul y magenta. Ninguno de esos tonos se confunde
 * con este a la escala a la que se dibujan. */
export const COLOR_IES = "#7a5024";

/** El cuadrado de la IES. Con esquinas rectas, que es lo que la separa.
 *
 * El simbolo y no el color es lo que hace el trabajo. En este mapa la forma ya
 * es un canal: pin con gorro para la sede escolar, circulo para el reporte de
 * dano. Una universidad no es ninguna de las dos y por eso no puede llevar
 * ninguno de los dos simbolos, por mucho que se le cambie el tono.
 *
 * `hueco` es la coordenada de poca confianza: la que el geocodificador no supo
 * resolver a una direccion y devolvio como centro de municipio. Es el mismo
 * recurso con el que el pin hueco marca la sede que nunca fue encuestada, y por
 * el mismo motivo: no es un grado del dato, es la ausencia de una afirmacion.
 */
function creaCuadro(color: string, hueco: boolean): ImageData {
  const R = 2;
  const lado = 18;
  const c = document.createElement("canvas");
  c.width = lado * R;
  c.height = lado * R;
  const x = c.getContext("2d")!;
  x.scale(R, R);
  const m = 3;
  const s = lado - m * 2;
  if (hueco) {
    x.fillStyle = "#ffffff";
    x.fillRect(m, m, s, s);
    x.strokeStyle = color;
    x.lineWidth = 2.2;
    x.strokeRect(m, m, s, s);
  } else {
    x.fillStyle = color;
    x.fillRect(m, m, s, s);
    x.strokeStyle = "#ffffff";
    x.lineWidth = 1.4;
    x.strokeRect(m, m, s, s);
  }
  return x.getImageData(0, 0, c.width, c.height);
}

/** Si el mapa dibuja las instituciones de educacion superior.
 *
 * Lo decide una sola casilla del filtro de nivel y nada mas. La banda de
 * intensidad no entra: es la particion del inventario de sedes, y estas 391
 * instituciones no salen de ese inventario. */
function verIes(f: Filtros): boolean {
  return f.niveles.includes("superior") || f.niveles.includes("superior_bid");
}

/** Que IES se dibujan, de las que la capa tiene.
 *
 * Con "Educacion superior" marcada, todas. Con solo "Educacion superior - BID",
 * las 33 del prestamo. Con las dos, todas: la casilla mas amplia gana, que es
 * como se comportan las demas listas de este visor, y es lo unico que no
 * sorprende al marcar una segunda casilla.
 *
 * Va como filtro de capa y no rehaciendo la fuente, igual que las bandas y los
 * estados de dano: son 391 rasgos y volver a construir el GeoJSON en cada clic
 * haria parpadear el mapa sin ninguna ganancia. */
function filtroIes(f: Filtros): Expr | undefined {
  if (f.niveles.includes("superior")) return undefined;
  return ["==", ["get", "bid"], true] as Expr;
}

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
  secretarias,
  evento,
  sedes,
  ies,
  danos,
  danesSeleccion,
  danesConReporte,
  filtros,
  capas,
  mapaBase,
  tema,
  seleccion,
  foco,
  onSeleccion,
  danesConPin,
  resalte,
  controlesIzquierda,
}: Props) {
  const div = useRef<HTMLDivElement>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const listo = useRef(false);
  /** Cuantas veces se han montado las capas. Sube al terminar cada montaje, y
   *  con eso vuelven a correr los efectos que escriben en el mapa. Ver
   *  `cuandoListo`. */
  const [generacion, setGeneracion] = useState(0);
  const controles = useRef<maplibregl.IControl[]>([]);
  const ladoControles = useRef<"bottom-left" | "bottom-right">("bottom-right");
  const cacheHuellas = useRef(new Map<string, unknown>());
  const marcaEpicentro = useRef<maplibregl.Marker | null>(null);
  /** Si la corrida anterior tenia territorio dibujado. Distingue "se quito la
   *  secretaria", que devuelve el encuadre, de "todavia no hay ninguna", que no
   *  toca el mapa. */
  const habiaTerritorio = useRef(false);
  /** Que secretarias estaban elegidas la ultima vez que este efecto movio la
   *  camara. Sirve para separar "cambio la seleccion" de "se remontaron las
   *  capas": lo primero tiene que encuadrar y lo segundo solo redibujar. */
  const ultimaSeleccion = useRef("");
  // Cambiar de tema recarga el estilo entero y con el se van todas las fuentes,
  // asi que hay que poder volver a montarlas con los datos que hubiera.
  const datos = useRef({ contornos, bordeGrilla, colombia, secretarias, sedes,
    ies, danos, danesSeleccion, danesConReporte, danesConPin, filtros, capas,
    tema, controlesIzquierda });
  datos.current = { contornos, bordeGrilla, colombia, secretarias, sedes,
    ies, danos, danesSeleccion, danesConReporte, danesConPin, filtros, capas,
    tema, controlesIzquierda };
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
    const peor = reportePorSede(datos.current.danos);
    // Fuera las que no tienen coordenada. Son 5 sedes de Manizales cuyo
    // `lat`/`lon` es nulo en el directorio, y el script 27 ya las cuenta como
    // no dibujables. Sin este filtro entraban a la fuente GeoJSON con
    // `coordinates: [null, null]`, que MapLibre acepta sin quejarse y deja el
    // punto en un sitio que no existe.
    const bandas = datos.current.filtros.bandas;
    // La misma pregunta que hace la tarjeta de danos para decidir si ofrece la
    // casilla de "ver todas las sedes reportadas". Una sola regla, en
    // `lib/datos.ts`, porque las dos tienen que decir lo mismo.
    const sinRecorte = sinRecorteDeBanda(datos.current.filtros);
    return [...peor.values()].filter((d) => d.lon != null && d.lat != null)
      .map((d) => ({
      type: "Feature" as const,
      properties: {
        id: d.id,
        dane: d.dane,
        sede: d.sede,
        mpio: d.mpio,
        fuente: d.fuente,
        emisor: d.emisor ?? "",
        estado: d.estado,
        // Vacio solo en los estados sin desglose. Lo que la fuente no precisa
        // va en `colapso_sd` o `dano_sd`, que son un subtipo mas y no un dato
        // faltante.
        subtipo: d.subtipo ?? "",
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
        //
        // Con una secretaria elegida no hay recorte que hacer visible: alli la
        // banda solo pinta y no reparte (ver `pasa` en `lib/datos.ts`). Atenuar
        // contra una lista que no recorta dejaria todos los puntos translucidos
        // sin que nada lo explique.
        // Dos condiciones, y las dos atenuan igual: que la sede caiga en las
        // bandas encendidas, y que sobreviva a los filtros de atributo de la
        // izquierda. Estaba solo la primera, asi que marcar "rural" recortaba
        // la cifra de la derecha a 1.252 mientras el mapa seguia dibujando los
        // 2.049 puntos, sin que nada dijera cuales eran los 1.252.
        en_seleccion: (sinRecorte
            || (d.banda != null && bandas.includes(d.banda)))
          && datos.current.danesSeleccion.has(d.dane),
      },
      geometry: {
        type: "Point" as const,
        coordinates: [d.lon, d.lat] as [number, number],
      },
    }));
  }

  /** Los territorios de las secretarias elegidas, y su caja comun.
   *
   * Sin ninguna elegida devuelve la coleccion vacia y `caja` nula, que es lo
   * que apaga la linea y deja el mapa quieto. No es lo mismo que "todas": con
   * las 63 lineas encima el mapa queda rayado y ninguna dice nada.
   *
   * La caja sale de la propiedad `caja` que ya trae cada rasgo y no de recorrer
   * la geometria. El script 44 la calculo una vez; algunos de estos poligonos
   * son de miles de vertices y recorrerlos en cada clic no aporta precision.
   */
  function territorioElegido() {
    const d = datos.current;
    const elegidas = d.filtros.secretarias;
    const rasgos = (d.secretarias?.features ?? []).filter((f) =>
      elegidas.includes(f.properties.secretaria),
    );
    let caja: [number, number, number, number] | null = null;
    for (const f of rasgos) {
      const c = f.properties.caja;
      if (!c) continue;
      caja = caja
        ? [Math.min(caja[0], c[0]), Math.min(caja[1], c[1]),
           Math.max(caja[2], c[2]), Math.max(caja[3], c[3])]
        : [...c];
    }
    return {
      coleccion: { type: "FeatureCollection" as const, features: rasgos },
      caja,
    };
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
    // Los dos cuadrados de la educacion superior. No dependen del color de sede
    // ni del tema: son de otra capa y de otra fuente, y su color es fijo.
    for (const [nombre, hueco] of [["ies-lleno", false], ["ies-hueco", true]] as
      [string, boolean][]) {
      if (m.hasImage(nombre)) m.removeImage(nombre);
      m.addImage(nombre, creaCuadro(COLOR_IES, hueco), { pixelRatio: 2 });
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
    // Sembrada con la seleccion que haya, y no vacia. Cambiar de mapa base
    // recarga el estilo y vuelve a pasar por aqui: con `VACIA` la linea del
    // territorio desaparecia al cambiar de mapa y no habia forma de recuperarla
    // sin volver a elegir la secretaria.
    m.addSource("territorio", {
      type: "geojson",
      data: territorioElegido().coleccion as never,
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
    // Sembrada con lo que haya llegado. `ies.geojson` entra fuera del grupo
    // bloqueante, asi que al montar las capas puede estar todavia en vuelo, y
    // el efecto de mas abajo la rellena cuando aterrice.
    m.addSource("ies", {
      type: "geojson",
      data: { type: "FeatureCollection",
              features: d.ies?.features ?? [] } as never,
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

    // El territorio de la secretaria elegida, punteado y suave.
    //
    // Punteado a proposito. Es la union de los municipios donde la secretaria
    // tiene sedes, dibujada con el limite de geoBoundaries de 2020, y eso no es
    // una frontera legal: si un municipio cambio de entidad certificada despues,
    // esta linea no se entera. Una linea solida diria "hasta aqui llega su
    // jurisdiccion" y seria una afirmacion mas fuerte que el dato.
    //
    // Sin relleno. Una mancha encima de la de intensidad haria que los dos
    // tonos se sumaran y la banda de MMI dejaria de leerse, que es justo lo que
    // esta pantalla no puede permitirse.
    m.addLayer({
      id: "territorio",
      type: "line",
      source: "territorio",
      // Se siembra desde `capas` y no se deja en el valor por defecto. Cambiar
      // de mapa base recarga el estilo y vuelve a pasar por aqui: con la linea
      // apagada, volvia a aparecer sola.
      layout: { visibility: visible(d.capas.territorio) },
      paint: {
        "line-color": d.tema === "claro" ? "#1c5cab" : "#86b6ef",
        "line-width": 1.4,
        "line-opacity": 0.75,
        "line-dasharray": [2, 2],
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
      filter: filtroSinGris(d.danesConPin) as never,
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
      filter: filtroSinGris(d.danesConPin) as never,
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
      filter: filtroSinGris(d.danesConPin) as never,
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

    // Educacion superior. Ver `creaCuadro`: cuadrado lleno cuando la coordenada
    // salio de una direccion, hueco cuando el geocodificador solo pudo dar el
    // centro del municipio.
    m.addLayer({
      id: "ies-punto",
      type: "symbol",
      source: "ies",
      ...(filtroIes(d.filtros) ? { filter: filtroIes(d.filtros) } : {}),
      layout: {
        visibility: visible(verIes(d.filtros)),
        "icon-image": ["case",
          ["==", ["get", "geo_precision"], "centroide_municipio"],
          "ies-hueco", "ies-lleno"] as Expr,
        "icon-size": ["interpolate", ["linear"], ["zoom"], 5, 0.4, 9, 0.7, 14, 1],
        "icon-allow-overlap": true,
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
    const filtroEstado = filtroDanos;
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
      filter: filtroEstado(conDano(d.capas), d.capas.danosTodasLasBandas,
                           d.capas.subtipos, d.capas.emisores),
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
        // Encogido en la misma proporcion que el punto, para que el cambio de
        // punto a pin en el zoom 9 no se lea como un salto de tamaño.
        "icon-size": ["interpolate", ["linear"], ["zoom"], 9, 0.46, 14, 0.78],
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
      filter: filtroEstado(conDano(d.capas), d.capas.danosTodasLasBandas,
                           d.capas.subtipos, d.capas.emisores),
      layout: { visibility: visible(d.capas.reportes) },
      paint: {
        // Bajados el 14 de agosto de 2026, con la entrada de la capa del MEN.
        // Estaban dimensionados para 194 sedes con reporte y ahora son 1.080: a
        // radio 5 con halo de 2 px, el Valle y el Eje Cafetero se cerraban en
        // una costra azul donde no se distinguia ni cuantos puntos habia ni el
        // degradado de intensidad que va debajo.
        //
        // El halo blanco se adelgaza pero no se quita. Es lo unico que separa
        // estos puntos de la mancha de intensidad, y sin el se pierden justo en
        // las bandas altas, que es donde hacen falta.
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 3.2, 14, 6.5],
        "circle-color": porFuente as never,
        "circle-opacity": atenua(0.95, 0.35) as never,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.3,
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
        d.capas.danosTodasLasBandas, d.capas.subtipos, d.capas.emisores),
      layout: { visibility: visible(d.capas.reportes) },
      paint: {
        // Un pelo menor que el punto lleno, como estaba antes: el hueco no
        // afirma daño y no tiene que competir con el que si.
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"], 5, 2.8, 14, 5.4,
        ] as never,
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-color": porFuente as never,
        "circle-stroke-width": 1.3,
        "circle-stroke-opacity": atenua(0.9, 0.35) as never,
      },
    });

    // Las resaltadas, encima de todo lo demas y en ambar.
    //
    // Se dibujan otra vez en vez de recolorear las capas de abajo, porque una de
    // ellas es de simbolos y su color vive dentro del icono: teñir un pin
    // obligaria a registrar un juego de iconos por cada color posible. Con una
    // capa aparte, el resalte funciona igual de lejos y de cerca.
    //
    // Lleva el mismo filtro de estado que las capas de dano. Sin el, apagar una
    // casilla dejaria el punto ambar de una sede que el mapa ya no dibuja.
    m.addLayer({
      id: "danos-resalte",
      type: "circle",
      source: "danos",
      filter: filtroResalte(d.capas, null),
      layout: { visibility: visible(d.capas.reportes) },
      paint: {
        // Exactamente el mismo tamano que el punto de dano, incluido su halo.
        // No es una capa distinta a los ojos de quien mira: es el mismo punto
        // cambiado de color, y cualquier otro tamano lo convertiria en otra cosa.
        // Estuvo de 4,2 a 8 y el ambar tapaba el punto en vez de marcarlo; luego
        // por debajo, y entonces desaparecia entre los demas. Si estos numeros
        // cambian, tienen que cambiar los dos a la vez: ver `danos-punto`.
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 3.2, 14, 6.5],
        "circle-color": RESALTE[d.tema],
        "circle-opacity": 0.95,
        "circle-stroke-color": d.tema === "claro" ? "#ffffff" : "#0b0b0b",
        "circle-stroke-width": 1.3,
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
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 6.5, 14, 11],
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-color": porFuente as never,
        "circle-stroke-width": 2,
        // El anillo no se atenua. Marca la sede que esta abierta en la ficha, y
        // esa se abre a proposito: si quien mira pidio ver una sede de una banda
        // apagada, el anillo tiene que decirle donde esta.
        "circle-stroke-opacity": 0.9,
      },
    });

    listo.current = true;
    // Sube la generacion en vez de disparar un evento. Lo segundo obligaba a
    // encolar el trabajo pendiente en listeners de un solo uso, y esos listeners
    // se quedaban con los valores del render en que se registraron.
    setGeneracion((g) => g + 1);
  }

  useEffect(() => {
    if (!div.current || mapa.current) return;
    const m = new maplibregl.Map({
      container: div.current,
      style: ESTILO[mapaBase],
      ...VISTA_INICIAL,
      attributionControl: { compact: true },
    });
    // Se guardan las tres instancias porque mudarlas de esquina obliga a
    // quitarlas y volver a anadirlas con la misma instancia. El lado inicial es
    // el que corresponda a como abre la pantalla, no siempre la derecha: si la
    // tarjeta de caracteristicas ya venia desplegada, anadirlos a la derecha y
    // mudarlos despues los haria saltar a la vista.
    controles.current = [
      new maplibregl.NavigationControl({ showCompass: false }),
      new ControlInicio(() => alClic.current(null)),
      new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }),
    ];
    ladoControles.current = datos.current.controlesIzquierda
      ? "bottom-left" : "bottom-right";
    for (const c of controles.current) m.addControl(c, ladoControles.current);
    mapa.current = m;

    const emergente = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 12,
    });

    m.on("load", () => {
      montaCapas(m);

      // Las de sede y daño: el globo al pasar y la ficha al hacer clic.
      const capasFicha = ["danos-pin", "danos-punto", "danos-sin",
        "sedes-pin", "sedes-punto"];
      // La de educación superior solo tiene globo. No hay ficha que abrir: de
      // estas 391 instituciones no se sabe nada del estado físico, y una ficha
      // con seis campos administrativos y ningún dato de daño prometería una
      // profundidad que no existe. Lo que sí hay (nombre, dirección, sector,
      // programas, confianza de la coordenada) cabe en el globo.
      const capasIes = ["ies-punto"];
      const capasClic = [...capasFicha, ...capasIes];
      for (const capa of capasFicha) {
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

      for (const capa of capasIes) {
        m.on("mouseenter", capa, () => (m.getCanvas().style.cursor = "pointer"));
        m.on("mouseleave", capa, () => {
          m.getCanvas().style.cursor = "";
          emergente.remove();
        });
        m.on("mousemove", capa, (e) => {
          const f = e.features?.[0];
          if (!f) return;
          emergente.setLngLat(e.lngLat)
            .setHTML(textoIes(f.properties as Record<string, unknown>))
            .addTo(m);
        });
        // Sin `click`. Un clic sobre una IES cae en el manejador general de
        // abajo, que limpia la selección: es lo correcto, porque la ficha de la
        // derecha habla de sedes escolares y dejarla abierta con una
        // universidad debajo del cursor diría que la ficha es de ella.
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
      // Los controles se van con el mapa. Sin vaciar la lista, el efecto que los
      // muda de esquina intentaria quitarselos a un mapa que ya no existe.
      controles.current = [];
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

  /** Escribe en el mapa, y solo si hay donde escribir.
   *
   * Antes esto encolaba: cuando el estilo no estaba montado, guardaba el trabajo
   * en un `m.once("visor:listo")` para hacerlo al terminar. Parecia inofensivo y
   * no lo era. El listener se quedaba con los valores del render en que se
   * registro, asi que al dispararse escribia lo que era cierto entonces y no lo
   * que era cierto al montar. En la primera carga eso significa la coleccion de
   * sedes vacia, que es la que hay antes de que bajen los 17,3 MB de
   * `sedes_evento.geojson`: el mapa se quedaba con cero sedes grises y sin nada
   * que volviera a escribirlas encima. En el telefono, donde ese archivo tarda
   * mas en convertirse en 26.591 rasgos, pasaba siempre.
   *
   * Ahora no encola: si no hay donde escribir, no escribe. Lo que hace que el
   * trabajo no se pierda es `generacion`, que sube al terminar cada montaje y
   * esta en las dependencias de todos los efectos que llaman aqui. Al montarse
   * las capas, cada efecto vuelve a correr con los valores de ese momento.
   */
  function cuandoListo(fn: (m: maplibregl.Map) => void) {
    const m = mapa.current;
    if (!m || !listo.current) return;
    fn(m);
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
  }, [contornos, bordeGrilla, colombia, generacion]);

  /** Muda el zoom, el boton de inicio y la escala a la otra esquina.
   *
   * MapLibre no sabe mover un control: hay que quitarlo y volver a anadirlo, y
   * con la misma instancia, porque `removeControl` compara por identidad. De ahi
   * que las tres se guarden al crear el mapa.
   *
   * Solo cuando de verdad cambia de lado. Este efecto corre tambien al remontar
   * las capas, y quitar y poner los controles en cada corrida los haria
   * parpadear sin motivo.
   *
   * No usa `cuandoListo`: los controles no dependen de que el estilo haya
   * terminado de cargar, viven en el DOM del contenedor y no en las capas.
   */
  useEffect(() => {
    const m = mapa.current;
    if (!m || controles.current.length === 0) return;
    const lado = controlesIzquierda ? "bottom-left" : "bottom-right";
    if (lado === ladoControles.current) return;
    ladoControles.current = lado;
    for (const c of controles.current) {
      m.removeControl(c);
      m.addControl(c, lado);
    }
  }, [controlesIzquierda]);

  useEffect(() => {
    cuandoListo((m) => {
      const f = m.getSource("sedes") as maplibregl.GeoJSONSource | undefined;
      if (f) f.setData({ type: "FeatureCollection", features: sedes } as never);
    });
  }, [sedes, generacion]);

  useEffect(() => {
    cuandoListo((m) => {
      if (!m.getLayer("sedes-punto")) return;
      const f = filtroSinGris(danesConPin);
      m.setFilter("sedes-punto", f);
      m.setFilter("sedes-pin", f);
      m.setFilter("sedes-realce", f);
    });
  }, [danesConPin, generacion]);

  /** La linea del territorio y el encuadre, cuando cambia la secretaria elegida.
   *
   * El encuadre va aqui y no en el panel porque solo el mapa sabe su tamano. La
   * columna de tarjetas mide 360 px y flota encima del mapa, asi que un
   * `fitBounds` centrado deja media secretaria debajo del panel. Se le pasa el
   * relleno de 380 px por la izquierda, y solo en pantalla ancha: en el telefono
   * el panel no esta al lado sino abajo.
   *
   * Al quitar la ultima secretaria se vuelve a la vista inicial. Es la misma
   * decision que toma `limpiaSecretarias` con las bandas: un rodeo por una
   * secretaria no deja el mapa encuadrado en un sitio que nadie pidio.
   *
   * Pero solo si la seleccion de verdad cambio. Este efecto corre tambien cuando
   * llega el geojson de territorios, que baja despues del primer dibujo, y cada
   * vez que se remontan las capas al cambiar de mapa base. En esas dos corridas
   * hay que redibujar la linea y no tocar la camara: mover el mapa ahi se lleva
   * por delante el zoom que hubiera puesto quien esta mirando.
   */
  useEffect(() => {
    cuandoListo((m) => {
      const f = m.getSource("territorio") as maplibregl.GeoJSONSource | undefined;
      if (!f) return;
      const { coleccion, caja } = territorioElegido();
      f.setData(coleccion as never);
      const habia = habiaTerritorio.current;
      habiaTerritorio.current = caja != null;

      // La linea se vuelve a dibujar en cada montaje, la camara no. Sin esta
      // separacion, cambiar de mapa base reencuadraba en la secretaria y se
      // llevaba por delante el zoom que hubiera puesto quien esta mirando.
      const clave = filtros.secretarias.join("|");
      const cambio = clave !== ultimaSeleccion.current;
      ultimaSeleccion.current = clave;
      if (!cambio) return;

      if (!caja) {
        if (habia) m.easeTo({ ...VISTA_INICIAL, duration: 600 });
        return;
      }
      const ancha = window.innerWidth >= 768;
      m.fitBounds([[caja[0], caja[1]], [caja[2], caja[3]]], {
        padding: { top: 40, bottom: 40, right: 40, left: ancha ? 380 : 40 },
        // Antioquia con sus 117 municipios va de latitud 5,4 a 8,9 y el ajuste
        // exacto la deja al borde del recuadro. El tope evita el otro extremo:
        // una secretaria de un solo municipio, como Armenia, se iria a zoom 13
        // y se perderia el contexto de por donde queda.
        maxZoom: 11,
        duration: 800,
      });
    });
  }, [secretarias, filtros.secretarias, generacion]);

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
  }, [danos, danesSeleccion, filtros.bandas, generacion]);

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
    // Las casillas de daño no entran: rehacer los pines en cada clic era lo
    // que trababa el mapa. Color, IVID y bandas sí, porque cambian el dibujo
    // de las 26 mil.
  }, [filtros, capas.sedes, capas.intensidad, tema, generacion]);

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
      ver("territorio", capas.territorio);
      ver("danos-punto", capas.reportes);
      ver("danos-pin", capas.reportes);
      ver("danos-sin", capas.reportes);
      ver("danos-resalte", capas.reportes);
      ver("huellas-relleno", capas.huellas);
      ver("huellas-linea", capas.huellas);
      // No tiene fila propia con ojo en el panel: la enciende y la apaga la
      // casilla "Educación superior" del filtro de nivel.
      ver("ies-punto", verIes(filtros));
      // El recorte del BID vive aqui y no en la visibilidad: la capa esta
      // encendida en los dos casos y lo que cambia es cuantos cuadrados pinta.
      // `undefined` limpia el filtro, que es como se vuelve a las 391.
      m.setFilter("ies-punto", filtroIes(filtros));
    });
  }, [capas.intensidad, capas.sedes, capas.territorio, capas.reportes,
      capas.huellas, filtros, generacion]);

  // La colección de IES llega fuera del grupo bloqueante de `page.tsx`, así que
  // puede aterrizar después de que las capas estén montadas.
  useEffect(() => {
    cuandoListo((m) => {
      const f = m.getSource("ies") as maplibregl.GeoJSONSource | undefined;
      f?.setData({ type: "FeatureCollection",
                   features: ies?.features ?? [] } as never);
    });
  }, [ies, generacion]);

  useEffect(() => {
    cuandoListo((m) => {
      if (!m.getLayer("danos-pin")) return;
      // Los estados se filtran aqui y no rehaciendo la fuente: son mil y pico
      // puntos y volver a construir el GeoJSON en cada casilla haria parpadear
      // el mapa.
      const sinDano = capas.estadosDano.includes("sin_dano");
      const conDanoAhora = capas.estadosDano.filter((e) => e !== "sin_dano");
      const conRecorte = (estados: EstadoDano[]): Expr =>
        filtroDanos(estados, capas.danosTodasLasBandas, capas.subtipos,
                    capas.emisores);
      m.setFilter("danos-pin", conRecorte(conDanoAhora));
      m.setFilter("danos-punto", conRecorte(conDanoAhora));
      m.setFilter("danos-sin", conRecorte(sinDano ? ["sin_dano"] : []));
      if (m.getLayer("danos-resalte")) {
        m.setFilter("danos-resalte",
                    filtroResalte(capas, resalte ? [...resalte.danes] : null));
      }
    });
  }, [capas.estadosDano, capas.subtipos, capas.emisores,
      capas.danosTodasLasBandas, capas, resalte, generacion]);

  /** El resalte: apagar el resto y volver a dibujar encima las elegidas.
   *
   * Apagar y no esconder. Las sedes que quedan fuera del resalte siguen en el
   * mapa, translucidas: la pregunta que contesta un resalte es cuales de estas
   * cumplen la condicion, y para contestarla hay que poder ver las otras. Es la
   * misma decision que ya tomo `atenua` con el recorte de bandas.
   *
   * Se apaga con un numero suelto y no con una expresion sobre el conjunto. Con
   * quinientos y pico codigos dentro de un `in`, cada clic obligaria a MapLibre
   * a evaluarlo rasgo por rasgo; asi la capa de abajo baja entera y la de arriba
   * repone a las resaltadas a plena fuerza.
   */
  useEffect(() => {
    cuandoListo((m) => {
      if (!m.getLayer("danos-punto")) return;
      const hay = resalte != null && resalte.danes.size > 0;
      const atenua = (dentro: number, fuera: number): Expr =>
        ["case", ["get", "en_seleccion"], dentro, fuera] as Expr;
      m.setPaintProperty("danos-punto", "circle-opacity",
                         atenua(hay ? 0.18 : 0.95, hay ? 0.08 : 0.35) as never);
      m.setPaintProperty("danos-punto", "circle-stroke-opacity",
                         atenua(hay ? 0.2 : 1, hay ? 0.1 : 0.4) as never);
      m.setPaintProperty("danos-pin", "icon-opacity",
                         atenua(hay ? 0.2 : 1, hay ? 0.1 : 0.4) as never);
      m.setPaintProperty("danos-sin", "circle-stroke-opacity",
                         atenua(hay ? 0.2 : 0.9, hay ? 0.1 : 0.35) as never);
      m.setPaintProperty("danos-resalte", "circle-color", RESALTE[tema]);
      m.setPaintProperty("danos-resalte", "circle-stroke-color",
                         tema === "claro" ? "#ffffff" : "#0b0b0b");
    });
  }, [resalte, tema, generacion]);

  useEffect(() => {
    cuandoListo((m) => {
      if (!m.getLayer("sedes-seleccion")) return;
      m.setFilter("sedes-seleccion", ["==", ["get", "dane"], seleccion ?? ""]);
      m.setFilter("danos-seleccion", ["==", ["get", "dane"], seleccion ?? ""]);
    });
  }, [seleccion, generacion]);

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
  // En la fuente oficial manda el emisor. "Reportes oficiales (MEN y BID)" en un
  // globo de tres lineas diria que lo afirman los dos, y son dos entidades que
  // se contradicen en algunas sedes.
  const emisor = String(p.emisor ?? "");
  const fuente = (emisor && NOMBRE_EMISOR[emisor])
    ? NOMBRE_EMISOR[emisor]
    : NOMBRE_FUENTE[p.fuente as keyof typeof NOMBRE_FUENTE] ?? "";
  // El subtipo manda cuando lo hay: "riesgo inminente" dice mucho mas que
  // "daño", que es lo que decia antes el globo de esas 107 sedes.
  const estado = nombreFino(p.estado as EstadoDano, String(p.subtipo ?? ""));
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

/** Cómo se salió esta coordenada, dicho con palabras y no con un puntaje.
 *
 * "Puntaje 93,9" no le dice nada a nadie. Lo que hay que poder leer es si el
 * punto está sobre una dirección o sobre el centro del pueblo, porque de eso
 * depende si tiene sentido acercarse a mirarlo. */
const DICE_GEO: Record<string, string> = {
  calle: "Ubicada por su dirección",
  centroide: "Ubicación aproximada",
  incierto: "Ubicación poco precisa",
  centroide_municipio: "Sin dirección resuelta: el punto es el centro del municipio",
};

function textoIes(p: Record<string, unknown>): string {
  const prec = String(p.geo_precision ?? "");
  const puntaje = p.geo_score == null
    ? ""
    : ` (puntaje ${Number(p.geo_score).toFixed(1).replace(".", ",")})`;
  const mmi = p.mmi == null
    ? "Fuera de la grilla del ShakeMap"
    : `Intensidad MMI ${Number(p.mmi).toFixed(2).replace(".", ",")}`;
  const programas = p.programas_vigentes == null
    ? ""
    : `<span class="num">${miles(Number(p.programas_vigentes))}</span> programas vigentes<br>`;
  return (
    `<strong>${p.nombre}</strong><br>${p.mpio}, ${p.depto}<br>` +
    `${p.caracter ?? ""}, ${String(p.sector ?? "").toLowerCase()}` +
    `${p.bid ? " · <strong>CO-L1288</strong>" : ""}<br>` +
    (p.direccion ? `${p.direccion}<br>` : "") +
    programas +
    `${mmi}<br>` +
    `<em>${DICE_GEO[prec] ?? "Ubicación geocodificada"}${puntaje}. ` +
    `Sin datos de estado físico.</em>`
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
