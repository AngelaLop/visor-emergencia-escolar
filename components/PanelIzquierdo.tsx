"use client";

/** Las tarjetas de la izquierda, apiladas como en un mapa de navegación.
 *
 * El orden es el orden en que se contesta la pregunta operativa. Primero qué
 * pasó y dónde, enseguida lo que la ciudadanía ya reportó, que es hoy la razón
 * de ser de la herramienta, después qué se está viendo en el mapa, después qué
 * subconjunto de sedes interesa y por último qué se sabe de esas sedes. Cada
 * tarjeta se pliega, porque en una emergencia nadie mira las cinco a la vez.
 *
 * La tarjeta de intensidad hace dos cosas con un solo control: dibuja la banda y
 * deja pasar sus escuelas. Que sea la misma casilla es deliberado. Si el mapa
 * pintara una zona de MMI 5,0 mientras la lista cuenta otra cosa, los dos
 * números de la pantalla dejarían de hablar del mismo territorio.
 */

import { useRef, useState } from "react";

import CaracteristicasAfectadas from "@/components/CaracteristicasAfectadas";
import { TarjetaMapaBase } from "@/components/ControlDerecho";
import { MarcaGitHub } from "@/components/Iconos";
import { Info, Tarjeta } from "@/components/Piezas";
import { COLOR_BANDA, COLOR_FUENTE, svgEpicentro } from "@/components/Mapa";
import type { Capas } from "@/components/Mapa";
import {
  FICHA_IVID,
  NOMBRE_IVID,
  NOMBRE_PTIE,
  NOMBRE_QUINTIL,
  NOMBRE_VIGENCIA,
  NOMBRE_ZONA,
  TONO_IVID,
  FUENTES_DEL_VISOR,
  danoMarcado,
  danosMarcados,
  horaLocal,
  sinRecorteDeBanda,
  miles,
} from "@/lib/datos";
import type { Resumen } from "@/lib/datos";
import {
  BANDAS,
  FILTROS_INICIALES,
  EXPLICACION_MMI,
  FUENTE_MMI,
  GRAVEDAD,
  NOMBRE_EMISOR,
  NOMBRE_ESTADO,
  EMISOR_CORTO,
  NOMBRE_FUENTE,
  NOMBRE_SUBTIPO,
  PRECEDENCIA_FUENTE,
  SUBTIPOS_POR_ESTADO,
  reportePorSede,
} from "@/lib/tipos";
import type {
  Dano,
  EmisorDano,
  EstadoDano,
  Evento,
  Filtros,
  FuenteDano,
  MapaBase,
  MetaMen,
  RasgoSede,
  Reporte,
  Resalte,
  Sede,
  Tema,
} from "@/lib/tipos";

type Props = {
  evento: Evento | null;
  filtros: Filtros;
  onFiltros: (f: Filtros) => void;
  capas: Capas;
  onCapas: (c: Capas) => void;
  resumen: Resumen;
  /** La misma selección sin los sub-filtros de la última tarjeta. */
  resumenAmplio: Resumen;
  tema: Tema;
  secretarias: string[];
  /** Los valores de `zona` presentes en los datos, para pintar los botones. */
  zonas: string[];
  reportes: Reporte[];
  /** Las sedes que la selección deja pasar, o sea exactamente las que el mapa
   *  está dibujando. Las usa el buscador por nombre. */
  sedes: RasgoSede[];
  /** Sedes con daño afirmado cuyo subtipo está apagado. Siguen en `sedes`
   *  para no rehacer las 26 mil en cada clic; el buscador las salta. */
  ocultas: Set<string>;
  /** Todos los daños con coordenada, dependan o no de la selección de sedes.
   *  Los arma `danosVisibles`. */
  danos: Dano[];
  /** Cuántas sedes con reporte no tienen coordenada, o sea las únicas que no
   *  hay forma de dibujar. Ya no es "las que la selección deja fuera": la
   *  selección dejó de tapar reportes. */
  danosFuera: number;
  /** De cuándo es la capa del MEN que se está dibujando. Nulo si el archivo de
   *  daños todavía no la trae. */
  metaMen: MetaMen | null;
  /** La marca de la última edición del MEN, solo cuando es posterior a nuestra
   *  descarga. Nulo significa que estamos al día o que el servicio no contestó,
   *  y en los dos casos la pantalla no dice nada. */
  edicionMen: number | null;
  onIrASede: (dane: string) => void;
  onExportar: () => void;
  /** Cuántas sedes del país entero encuestó el FFIE. */
  encuestadasPais: number;
  mapaBase: MapaBase;
  onMapaBase: (m: MapaBase) => void;
  /** El universo de la tarjeta de caracteristicas: un reporte por sede, solo los
   *  que el mapa dibuja. Lo calcula `page.tsx` con `danosMarcados` y lo pasa
   *  hecho, para que la version de telefono y la de la columna derecha describan
   *  exactamente las mismas sedes. */
  danosMarcados: Dano[];
  /** El directorio por codigo DANE, para mirar la ficha de cada sede reportada.
   *  En pantalla angosta la tarjeta de caracteristicas se dibuja desde aqui. */
  porDane: Map<string, Sede>;
  resalte: Resalte | null;
  onResalte: (r: Resalte | null) => void;
  caracteristicas: boolean;
  onCaracteristicas: (v: boolean) => void;
};

export default function PanelIzquierdo(p: Props) {
  // En el teléfono la pila de tarjetas es una hoja que sube desde abajo y
  // arranca recogida, para que lo primero que se vea sea el mapa.
  const [hojaAbierta, setHojaAbierta] = useState(false);

  return (
    <div
      className={
        // `pointer-events-none` solo desde `md`. En el telefono esta hoja es lo
        // que hay que poder arrastrar, y un contenedor que desplaza pero no
        // recibe punteros no se deja recorrer con el dedo en WebKit: el gesto
        // no encuentra a quien moverse. En escritorio si hace falta, porque la
        // columna de 360 px ocupa toda la altura y por debajo de las tarjetas
        // tiene que poder hacerse clic en el mapa.
        "pointer-events-auto overscroll-contain md:pointer-events-none " +
        "z-10 flex flex-col gap-2 overflow-y-auto " +
        // El relleno inferior deja pasar la escala y la atribucion del mapa,
        // que van fijas abajo y se comian la ultima tarjeta.
        "fixed inset-x-0 bottom-0 px-2 pb-8 " +
        (hojaAbierta ? "max-h-[88svh] " : "max-h-[38svh] ") +
        // `inset-y-0` fija arriba y abajo, y eso es lo que acota la columna a
        // la altura de la pantalla para que se desplace por dentro. Sin el
        // borde inferior crecia hacia abajo y el que terminaba desplazandose
        // era el documento entero.
        "md:absolute md:inset-y-0 md:left-0 md:right-auto " +
        "md:max-h-none md:w-[360px] md:p-3 md:pb-10"
      }
    >
      {/* El asa ocupa todo el ancho y es opaca. Como pastilla estrecha se
          quedaba flotando sobre el texto de la tarjeta que pasaba por debajo,
          y tapaba palabras sueltas en mitad de un parrafo. Ahora es el borde
          superior de la hoja: lo que se desplaza desaparece detras de ella,
          que es como se comporta cualquier hoja que sube desde abajo. */}
      <button
        onClick={() => setHojaAbierta(!hojaAbierta)}
        aria-label={hojaAbierta ? "Recoger el panel" : "Desplegar el panel"}
        className="pointer-events-auto sticky top-0 z-20 -mx-2 flex h-7 shrink-0 items-center justify-center px-2 md:hidden"
      >
        <span
          className="flex h-full w-full items-center justify-center rounded-t-lg"
          style={{
            background: "var(--superficie)",
            boxShadow: "0 -1px 4px rgba(0,0,0,.15)",
          }}
        >
          <span
            className="block h-1 w-10 rounded-full"
            style={{ background: "var(--tinta-3)" }}
          />
        </span>
      </button>

      <div className="pointer-events-auto flex flex-col gap-2">
        {/* El titulo del visor va siempre arriba: es la tarjeta que dice que es
            esta pantalla y de que evento habla, y debajo de un filtro se leeria
            como un apartado del filtro.

            La de visualizacion sube al segundo puesto el 21 de agosto de 2026.
            Estaba tercera, debajo de los daños, y eso invertia el orden en que
            se usa la pantalla: lo primero que hace quien llega es decidir que
            territorio esta mirando, y para eso tenia que pasar de largo la
            tarjeta mas alta de las cuatro.

            Los daños se fueron a la franja derecha el mismo dia, a probar. Esta
            columna contesta "que estoy mirando" y la de la derecha "que salio",
            y los reportes son lo segundo: cuelgan del conteo de sedes, no de
            los filtros. La dibuja `app/page.tsx`.

            En el telefono no: alli la franja derecha es una barra arriba, y con
            los daños dentro el mapa se quedaba en una tira de dos centimetros
            entre esa barra y la hoja de abajo. Asi que en pantalla angosta la
            tarjeta se queda en su sitio de siempre. Son dos instancias y cada
            una lleva su propio estado de desplegada, pero solo una se dibuja a
            la vez, y no hay ninguna decision del usuario que valga la pena
            arrastrar de un ancho de pantalla al otro. */}
        <TarjetaEvento {...p} />
        <TarjetaCapas {...p} />
        <div className="md:hidden">
          <TarjetaDanos {...p} />
          {/* La de caracteristicas va pegada debajo de la de daños, aqui y en la
              columna derecha. Son hermanas y comparten universo: la de arriba
              dice quien reporta que, esta dice que clase de escuelas son. */}
          <div className="mt-2">
            <CaracteristicasAfectadas
              danos={p.danosMarcados}
              porDane={p.porDane}
              resalte={p.resalte}
              onResalte={p.onResalte}
              abierta={p.caracteristicas}
              onAbierta={p.onCaracteristicas}
              secretarias={p.filtros.secretarias}
            />
          </div>
          <div className="mt-2">
            <TarjetaMapaBase mapaBase={p.mapaBase} onMapaBase={p.onMapaBase} />
          </div>
        </div>
        <TarjetaCaracteristicas {...p} />
      </div>
    </div>
  );
}

/** Cuántas sedes de una fuente se listan sin desplazamiento. Pasado ese número
 *  la lista se desplaza por dentro: son tres fuentes en la misma tarjeta y una
 *  con doce sedes empujaría las otras dos fuera de la pantalla. */
const MAX_FILAS_VISIBLES = 4;

/** Cuántos resultados del buscador se listan. Pasado ese número el problema no
 *  es la lista sino la búsqueda: quien escribe "escuela" y recibe mil filas
 *  tiene que escribir algo más, no desplazarse mil veces. */
const MAX_HALLADAS = 30;

// ------------------------------------------------------------- 1. evento --

function TarjetaEvento({ evento }: Props) {
  return (
    <Tarjeta>
      <div className="flex items-start gap-2 px-4 pt-3">
        <div className="flex-1">
          <h1 className="text-sm font-semibold tracking-wide">
            VISOR ESCOLAR DE EMERGENCIA
            <Info
              texto={FUENTES_DEL_VISOR}
              tono="var(--cima)"
              ancho
            />
          </h1>
          <p className="text-xs" style={{ color: "var(--tinta-3)" }}>
            Sedes educativas oficiales de{" "}
            <strong style={{ color: "var(--tinta-2)" }}>Colombia</strong>
          </p>
          <span
            className="mt-0.5 inline-flex items-center gap-1.5 text-[10px]"
            style={{ color: "var(--tinta-3)" }}
          >
            <a
              // El repositorio del analisis es privado y a un visitante le
              // devuelve un 404. Este es el codigo de lo que esta mirando.
              href="https://github.com/AngelaLop/visor-emergencia-escolar"
              target="_blank"
              rel="noreferrer"
              title="Código del visor en GitHub"
              className="inline-flex"
              style={{ color: "inherit" }}
            >
              <MarcaGitHub alto={12} />
            </a>
            <a
              href="https://angelalop.github.io/AngelaLopezS/"
              target="_blank"
              rel="noreferrer"
              title="Portafolio de Angela López"
              style={{ color: "inherit" }}
            >
              AngelaLop
            </a>
          </span>
        </div>
      </div>

      <div className="flex items-start gap-3 px-4 pb-3 pt-2">
        <span
          className="shrink-0"
          dangerouslySetInnerHTML={{ __html: svgEpicentro(38) }}
        />
        <div className="min-w-0">
          {evento ? (
            <>
              <p className="text-sm font-medium">
                Sismo de magnitud {String(evento.magnitud).replace(".", ",")} a{" "}
                {evento.descripcion}
                <Info
                  texto={`Un sismo tan profundo reparte la sacudida sobre un área mucho más amplia que uno superficial. Por eso bajo el epicentro la intensidad es ${String(evento.mmi_epicentro ?? "").replace(".", ",")} y el máximo del mapa, ${String(evento.mmi_maximo ?? "").replace(".", ",")}, cae unos 44 km al sureste: la sacudida más fuerte no ocurre sobre la vertical del foco.`}
                />
              </p>
              <p className="num text-xs" style={{ color: "var(--tinta-2)" }}>
                {horaLocal(evento.origen_utc)}, hora de Colombia
              </p>
              <p className="num text-xs" style={{ color: "var(--tinta-2)" }}>
                Profundidad {String(evento.profundidad_km).replace(".", ",")} km
              </p>
            </>
          ) : (
            <p className="text-xs" style={{ color: "var(--tinta-3)" }}>
              cargando el evento…
            </p>
          )}
        </div>
      </div>
    </Tarjeta>
  );
}

// ------------------------------------------------------------- 2. daños --

/** Los emisores de la fuente oficial, en el orden en que mandan.
 *
 * La Secretaria del Valle primero porque es la que responde por sus escuelas y
 * desplaza al MEN cuando las dos hablan de la misma sede. Ver
 * PRECEDENCIA_EMISOR en lib/tipos.ts.
 *
 * HOT no esta aqui: es su propia fuente, con su propio color y su propio
 * bloque. Y las noticias tampoco tienen emisor, porque una nota de prensa no es
 * una entidad que reporte sino alguien citando a una autoridad.
 */
const OFICIALES: EmisorDano[] = ["SE_VALLE", "MEN", "BID"];

/** Las filas del desglose de cada estado, que no son una por subtipo.
 *
 * "sin definir el impacto" y "sin especificar" se fusionan en una sola fila el
 * 21 de agosto de 2026. En el archivo son dos cosas distintas y siguen
 * siéndolo: `dano_sin_definir` es una categoría que el MEN escribe así, y
 * `dano_sd` son los reportes de prensa y del PTIES que afirman daño sin
 * precisar. Pero en pantalla las dos contestan lo mismo, que es lo único que
 * importa a quien está decidiendo a dónde ir: hay daño y nadie ha dicho de qué
 * tamaño. Dos filas para eso, una debajo de la otra y con nombres que hay que
 * leer dos veces para distinguir, pedían una decisión que no cambia nada.
 *
 * La distinción no se pierde. El subtipo sigue entero en el archivo, la ficha de
 * cada sede dice la frase textual de su fuente, y `nombreFino` sigue tratando
 * los `_sd` aparte. Lo que se fusiona es la casilla, y encender o apagar esta
 * fila enciende o apaga los dos subtipos a la vez.
 *
 * El de colapso se renombra a "sin definir" por lo mismo: era la única fila que
 * seguía llamándose "sin especificar", y con la de daño ya fusionada las dos
 * ideas iguales tenían dos nombres distintos.
 */
const FILAS_SUBTIPO: Record<string, { nombre: string; subtipos: string[] }[]> = {
  colapso: [
    { nombre: NOMBRE_SUBTIPO.colapso_total, subtipos: ["colapso_total"] },
    { nombre: NOMBRE_SUBTIPO.colapso_parcial, subtipos: ["colapso_parcial"] },
    { nombre: "sin definir", subtipos: ["colapso_sd"] },
  ],
  dano: [
    { nombre: NOMBRE_SUBTIPO.dano_riesgo, subtipos: ["dano_riesgo"] },
    { nombre: NOMBRE_SUBTIPO.dano_parcial, subtipos: ["dano_parcial"] },
    { nombre: NOMBRE_SUBTIPO.dano_menor, subtipos: ["dano_menor"] },
    { nombre: "sin definir", subtipos: ["dano_sin_definir", "dano_sd"] },
  ],
};

/** Lo que esta tarjeta necesita del estado, y nada mas.
 *
 * Se nombra aparte porque desde el 21 de agosto de 2026 la tarjeta ya no vive
 * dentro de esta columna: la dibuja `app/page.tsx` en la franja derecha. Pedir
 * el `Props` entero obligaria a esa pagina a pasarle catorce campos que no usa.
 */
export type PropsDanos = Pick<
  Props,
  | "capas"
  | "onCapas"
  | "filtros"
  | "reportes"
  | "danos"
  | "danosFuera"
  | "metaMen"
  | "edicionMen"
  | "onIrASede"
>;

export function TarjetaDanos({
  capas,
  onCapas,
  filtros,
  reportes,
  danos,
  danosFuera,
  metaMen,
  edicionMen,
  onIrASede,
}: PropsDanos) {
  // Recogida al abrir: la primera pantalla tiene que dejar ver el mapa, y quien
  // llega buscando los reportes los despliega de un clic.
  const [abierta, setAbierta] = useState(false);
  // Los dos desgloses arrancan plegados.
  //
  // "Con daño" abria desplegado, con el argumento de que es la casilla mas
  // poblada y su numero grande no dice si son grietas o muros partidos. Sigue
  // siendo verdad, pero desde que la tarjeta de caracteristicas cuelga debajo la
  // cuenta cambio: la columna derecha tiene que dejar ver las cuatro casillas de
  // estado y el encabezado de la tarjeta de abajo sin desplazarse, y cuatro
  // pastillas finas de mas lo impedian. El desglose sigue a un clic.
  const [desglosado, setDesglosado] = useState<EstadoDano | null>(null);
  // "si" sin tilde es el valor que guarda el CSV de curaduria: es un codigo,
  // no prosa, y cambiarlo romperia las filas ya revisadas.
  const pendientes = reportes.filter((r) => !r.es_escuela.trim());

  // Una sede, una fila. En Calima El Darien hablaron el alcalde y la rectora:
  // son dos declaraciones sobre el mismo predio y listarlas dos veces diria que
  // hay dos escuelas caidas. Se queda la mas grave, que es la que manda el color
  // y la insignia. Las demas siguen enteras en la ficha de la sede.
  //
  // Las sedes sin dano no entran a esta lista. Esta tarjeta es de danos
  // reportados y una sede de la que se dijo que esta bien no es un dano. El dato
  // no se pierde: sigue en el archivo y la ficha de esa sede lo muestra.
  // La lista muestra lo mismo que el mapa dibuja, ni una fila mas: `danos` trae
  // todo reporte con coordenada, que es exactamente lo que se pinta. Una fila
  // sin punto mandaría a buscar en el mapa algo que no está.
  // El recorte de intensidad, aplicado a todo lo que esta tarjeta cuenta y
  // lista. Es lo que sostiene la promesa de los comentarios de aquí abajo: que
  // el número del encabezado y las filas de cada fuente son exactamente los
  // puntos del mapa. Con la casilla "ver todas las sedes reportadas" apagada, el
  // mapa dibuja solo los reportes de las bandas encendidas, así que contar los
  // demás mandaría a buscar puntos que no están.
  //
  // Una sede sin banda nunca pasa el recorte. Son las cinco que caen fuera de la
  // grilla del ShakeMap del USGS, donde no hay intensidad estimada de ningún
  // valor, así que no pertenecen a ninguna selección de bandas.
  const enBanda = (d: Dano) =>
    capas.danosTodasLasBandas
    || (d.banda != null && filtros.bandas.includes(d.banda));
  const danosDibujados = danos.filter(enBanda);

  const porFuente = (f: FuenteDano) =>
    [...reportePorSede(danosDibujados.filter((d) => d.fuente === f)).values()];

  // Igual que `porFuente` pero dentro de la fuente oficial, que tiene dos
  // emisores. Se cuentan aparte porque MEN y BID no dicen lo mismo de las mismas
  // sedes y sumarlos borraria la discrepancia.
  const porEmisor = (e: EmisorDano) =>
    [...reportePorSede(danosDibujados.filter((d) => d.emisor === e)).values()];

  // Las sedes que reportan MEN y BID a la vez. La tarjeta las cuenta una vez y
  // el desglose las cuenta en las dos lineas, asi que sin decirlo el desglose
  // suma mas que su propio encabezado. Hoy son cuatro, y en dos de ellas los dos
  // emisores no dicen lo mismo: en Riosucio el PTIES las cerro sin daño y el MEN
  // las pone en afectacion parcial.
  /** Lo que aporta una fuente que ninguna de mas peso ya cubre.
   *
   * La tarjeta de noticias contaba sus 173 sedes, y de esas 71 las reporta
   * tambien el MEN, que es quien pinta el punto. Ese numero decia entonces
   * cuantas sedes salieron en prensa, que es una pregunta sobre los medios y no
   * sobre el terreno. La pregunta util es que escuelas conocemos solo por la
   * prensa, porque son las que el reporte oficial todavia no ha visitado.
   *
   * Se mide contra las fuentes de mas precedencia, no contra el MEN a secas: es
   * la misma regla que decide quien pinta, asi que las propias de cada bloque no
   * se solapan entre si y suman exactamente las sedes distintas.
   */
  const aporte = (f: FuenteDano) => {
    const mias = new Set(
      danosDibujados.filter((d) => d.fuente === f).map((d) => d.dane));
    const mando = PRECEDENCIA_FUENTE[f] ?? 0;
    const cubiertas = new Set(
      danosDibujados
        .filter((d) => (PRECEDENCIA_FUENTE[d.fuente] ?? 0) > mando
          && mias.has(d.dane))
        .map((d) => d.dane));
    const enMen = new Set(
      danosDibujados.filter((d) => d.emisor === "MEN").map((d) => d.dane));
    return {
      propias: mias.size - cubiertas.size,
      cubiertas: cubiertas.size,
      // Hoy las 71 que le quita el bloque de noticias son todas del MEN. Se
      // comprueba en vez de suponerlo: si alguna llegara a estar solo en el
      // reporte del BID, el rotulo diria MEN de una sede que el MEN no nombra.
      todasDelMen: [...cubiertas].every((k) => enMen.has(k)),
    };
  };

  // Cuantas sedes reportan mas de un emisor oficial. Se cuenta el exceso y no
  // las sedes repetidas: una sede que reportan los tres se cuenta una vez en el
  // encabezado y tres en el desglose, asi que sobra dos, no una.
  const sedesEnAmbosOficiales = (() => {
    const cuantos = new Map<string, number>();
    for (const e of OFICIALES) {
      for (const d of porEmisor(e)) {
        cuantos.set(d.dane, (cuantos.get(d.dane) ?? 0) + 1);
      }
    }
    return [...cuantos.values()].reduce((a, n) => a + n - 1, 0);
  })();

  /** Prender o apagar un emisor de la fuente oficial.
   *
   * No se puede apagar el ultimo. Sin ninguno encendido, la fuente oficial
   * quedaria con su numero en el encabezado y sin un solo punto en el mapa, y
   * eso se lee como un error del visor y no como un filtro. Para no ver
   * reportes oficiales esta la casilla de la capa de reportes, que ya existe.
   */
  const alternaEmisor = (clave: string) => {
    const prendido = capas.emisores.includes(clave);
    const resto = capas.emisores.filter((x) => x !== clave);
    if (prendido && !OFICIALES.some((e) => e !== clave && resto.includes(e))) {
      return;
    }
    onCapas({ ...capas, emisores: prendido ? resto : [...resto, clave] });
  };

  // En cuanto se pasan los bloques de fuente respecto de las sedes distintas.
  //
  // Los bloques cuentan sedes por fuente, asi que una sede que reportan el MEN y
  // una noticia esta en los dos y sus numeros suman mas que las sedes distintas.
  // Hasta que entro la capa del MEN el solape era de una sola sede y la suma
  // parecia cuadrar por casualidad.
  //
  // Se cuenta el exceso y no cuantas sedes se repiten, que no es lo mismo: una
  // sede que esta en las tres fuentes se repite una vez y sobra dos. Hoy hay
  // exactamente una asi, la Anexa al Carrasquilla de Quibdo, y contando sedes
  // repetidas la resta se quedaba corta en uno.
  const excesoDeLosBloques = (() => {
    const cuantas = new Map<string, Set<string>>();
    for (const d of danosDibujados) {
      if (!cuantas.has(d.dane)) cuantas.set(d.dane, new Set());
      cuantas.get(d.dane)!.add(d.fuente);
    }
    return [...cuantas.values()].reduce((a, s) => a + s.size - 1, 0);
  })();
  const sedesDe = (ds: Dano[]) => ds.length;
  const matriculaDe = (ds: Dano[]) => ds.reduce((a, d) => a + d.matricula, 0);
  const marcado = (e: EstadoDano) => capas.estadosDano.includes(e);
  // Si el reporte se esta dibujando, que es estado marcado y subtipo encendido.
  // Va aparte de `marcado` porque las dos preguntas no son la misma: la casilla
  // de "con daño" puede estar marcada con solo uno de sus cuatro desgloses
  // encendido, y entonces el estado pasa pero el reporte no se dibuja.
  const dibujado = (d: Dano) =>
    danoMarcado(d, capas.estadosDano, capas.subtipos);
  const alternar = (es: EstadoDano[]) => {
    const prendido = es.every(marcado);
    const resto = capas.estadosDano.filter((x) => !es.includes(x));
    onCapas({ ...capas, estadosDano: prendido ? resto : [...resto, ...es] });
  };

  // Una sede, el reporte que la pinta, para poder contar por casilla sin que una
  // sede con dos reportes cuente dos veces.
  const peorPorSede = (ds: Dano[]) => [...reportePorSede(ds).values()];
  const peores = peorPorSede(danosDibujados);

  // El numero del encabezado cuenta exactamente los puntos que hay en el mapa,
  // ni uno mas. Si contara otra cosa, quien cuente los puntos creeria que le
  // faltan. Por eso mira las casillas: una sede cuyo estado esta desmarcado no
  // se dibuja y no se cuenta.
  //
  // Se cuenta sobre `peores`, o sea sobre el reporte que gana la sede, y no
  // sobre todos sus reportes. Mientras mando la gravedad las dos formas daban lo
  // mismo, porque el ganador era siempre el mas grave: si algun reporte era
  // colapso o daño, el ganador tambien lo era. Con la primacia de la fuente eso
  // dejo de cumplirse. La Sultana y San Juan Bautista de La Salle, en Manizales,
  // las pinta el MEN como sin daño y ademas tienen una noticia que afirma daño:
  // contando por reporte suelto entraban al total, y el mapa dibujaba dos puntos
  // menos que los que decia el encabezado.
  //
  // Mira tambien el desglose, no solo el estado. Con "con daño" marcada y de sus
  // cuatro desgloses solo "riesgo inminente", el mapa dibuja 184 puntos y el
  // encabezado decia 1.595.
  // La misma funcion que usa `page.tsx` para armar el universo de la tarjeta de
  // caracteristicas. Las dos tienen que decir el mismo numero, y con una sola
  // regla no hay forma de que se separen.
  const marcadas = danosMarcados(danosDibujados, capas.estadosDano,
                                 capas.subtipos);
  const sedesConReporte = marcadas.length;
  // Sin recortar, que es contra lo que se mide cuanto se esta dejando fuera.
  const peoresTodos = peorPorSede(danos);
  // El numero de cada casilla cuenta lo que hay dentro del recorte, marcada o
  // no. Que no mire su propia casilla es deliberado y es lo contrario del
  // encabezado: en una casilla apagada el numero dice cuanto apareceria al
  // prenderla, que es lo unico que hace util prenderla. Si contara lo visible,
  // toda casilla apagada diria cero.
  //
  // El recorte de intensidad si lo aplica, y por la misma razon: prender una
  // casilla hace aparecer justo esos puntos y no los de las bandas apagadas.
  // Cuantos quedan fuera del recorte se dice aparte, en la casilla de ver todas
  // las sedes reportadas, que es donde se puede hacer algo al respecto.
  const nColapso = peores.filter((d) => d.estado === "colapso").length;
  // Los subtipos se cuentan sobre `peores`, igual que la casilla que los
  // agrupa, para que el desglose sume exactamente lo que dice su casilla. Recibe
  // la lista y no un subtipo suelto porque "sin definir" agrupa dos.
  const nPorSubtipo = (ts: string[]) =>
    peores.filter((d) => ts.includes(d.subtipo ?? "")).length;
  const subtipoMarcado = (t: string) => capas.subtipos.includes(t);
  /** Prender o apagar una fila del desglose, que puede llevar más de un subtipo.
   *
   * Los de una misma fila se mueven juntos: con uno encendido y otro apagado la
   * casilla no podría decir la verdad ni marcada ni sin marcar.
   */
  const alternaSubtipo = (estado: EstadoDano, ts: string[]) => {
    const prendido = ts.every(subtipoMarcado);
    const resto = capas.subtipos.filter((x) => !ts.includes(x));
    // No se puede apagar el último de un estado: sin ningún subtipo encendido su
    // casilla quedaría marcada y sin pintar nada, que se lee como un error del
    // mapa y no como un filtro. Apagar el estado entero es lo que hace la
    // casilla de arriba, y ya existe.
    const hermanos = SUBTIPOS_POR_ESTADO[estado] ?? [];
    if (prendido
      && !hermanos.some((h) => !ts.includes(h) && resto.includes(h))) return;
    onCapas({ ...capas, subtipos: prendido ? resto : [...resto, ...ts] });
  };
  const nDano = peores.filter((d) => d.estado === "dano").length;
  // Lo que se está dibujando de cada estado, no el total. La casilla apagada
  // sigue diciendo el total, que es cuántas aparecerían al prenderla. La
  // prendida tiene que decir las que de verdad están en el mapa: si "Con daño"
  // queda en 1.595 con solo "riesgo inminente" marcado, se lee como si el
  // recorte no existiera.
  const nColapsoVisible = peores.filter(
    (d) => d.estado === "colapso" && dibujado(d)).length;
  const nDanoVisible = peores.filter(
    (d) => d.estado === "dano" && dibujado(d)).length;
  const nSinDano = peores.filter((d) => d.estado === "sin_dano").length;
  const nSinVerificar = peores.filter(
    (d) => d.estado === "sin_verificar").length;

  // Aqui se calculaba el agregado de la verificacion tecnica, que se fue con su
  // recuadro. Lo que quedaba de la operacion del Valle vive ahora colgado de la
  // secretaria, en la tarjeta de capas, que es donde la pregunta tiene sujeto.

  // Inspeccionadas no es una casilla: es la suma de las que afirman daño mas
  // las que afirman que no lo hay. El denominador solo aparece cuando quien
  // mira prendio las tres, y por eso nunca se ve una tasa que nadie pidio.
  const inspeccionadas =
    marcado("colapso") && marcado("dano") && marcado("sin_dano")
      ? `${miles(nColapso + nDano)} de `
        + `${miles(nColapso + nDano + nSinDano)} revisadas`
      : null;

  // Cuantos de los puntos dibujados caen donde el mapa no esta pintando
  // intensidad. Hay que decirlo, porque asi como esta se lee como un error: el
  // visor abre en MMI 6,0 y 6,5, y de las 189 sedes con reporte y coordenada
  // hay 91 fuera de esas dos bandas, 88 de ellas con la casilla de colapso o la
  // de daño prendidas, que son las dos que abren. Son puntos de color sobre el
  // mapa base pelado, sin mancha debajo y sin el punto de la sede al lado. Ya
  // paso antes con otro nombre: cuando la capa dependia de la seleccion, esas
  // mismas sedes no se dibujaban y nadie podia enterarse de que existian.
  //
  // La banda nula es otra cosa y va contada aparte en la nota: son las cinco
  // sedes que caen fuera de la grilla del ShakeMap del USGS, donde no hay
  // intensidad estimada de ningun valor.
  //
  // Cero cuando el recorte no esta recortando: sin ninguna banda encendida, o
  // con una secretaria elegida, el mapa dibuja todos los puntos a plena tinta y
  // esta casilla ofreceria destapar unos puntos atenuados que no existen. Es la
  // misma regla que usa el mapa para no atenuar, y por eso vive en un solo sitio.
  const fueraDeBanda = sinRecorteDeBanda(filtros) ? 0 : peoresTodos.filter(
    (d) => dibujado(d)
      && (d.banda == null || !filtros.bandas.includes(d.banda)),
  ).length;
  const todasLasBandas = capas.danosTodasLasBandas;

  /** Las cuatro casillas, en orden de gravedad, que es el orden en que hay que
   *  ir a mirar. Colapso y daño son las dos que el MEN precisa, y por eso son
   *  las dos que abren un desglose. */
  const casillas: {
    estado: EstadoDano;
    nombre: string;
    n: number;
    nota: string;
    conDesglose?: boolean;
  }[] = [
    {
      estado: "colapso",
      nombre: "Colapso",
      n: marcado("colapso") ? nColapsoVisible : nColapso,
      nota: "la fuente afirma que la edificación se vino abajo, entera o en parte",
      conDesglose: true,
    },
    {
      estado: "dano",
      nombre: "Con daño",
      n: marcado("dano") ? nDanoVisible : nDano,
      nota: "daño declarado por alguna de las fuentes, sin llegar a colapso",
      conDesglose: true,
    },
    {
      estado: "sin_dano",
      nombre: "Sin daño",
      n: nSinDano,
      nota: "alguien fue a mirar y no encontró afectación. No es lo mismo que no tener reporte.",
    },
    {
      estado: "sin_verificar",
      nombre: "Sin verificar",
      n: nSinVerificar,
      nota: "hay una foto emparejada con la sede, pero nadie ha evaluado el edificio",
    },
  ];

  return (
    <Tarjeta>
      {/* El encabezado en dos filas. Arriba los tres puntos de fuente y los dos
          interruptores; abajo el titulo con su cifra, con los 208 px enteros
          para el.

          En una sola fila los puntos y los dos botones se comian 66 px de los
          208, y lo que quedaba partia "Daños reportados en SE" en tres lineas
          con el numero flotando al lado de la segunda. Los puntos no son
          adorno: dicen que aqui hay tres fuentes distintas antes de desplegar
          nada, y por eso no se van, se suben. */}
      <div className="flex items-center gap-2 px-4 pt-2.5">
        <span className="flex flex-1 gap-1">
          {(["hot", "oficial", "noticia"] as FuenteDano[]).map((f) => (
            <span
              key={f}
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: COLOR_FUENTE[f] }}
              title={NOMBRE_FUENTE[f]}
            />
          ))}
        </span>
        <button
          onClick={() => onCapas({ ...capas, reportes: !capas.reportes })}
          aria-label={capas.reportes ? "ocultar en el mapa" : "mostrar en el mapa"}
          title={capas.reportes ? "ocultar en el mapa" : "mostrar en el mapa"}
          className="text-xs leading-none"
          style={{ color: "var(--tinta-3)" }}
        >
          {capas.reportes ? "◉" : "○"}
        </button>
        <button
          onClick={() => setAbierta(!abierta)}
          className="text-xs leading-none"
          style={{ color: "var(--tinta-3)" }}
          aria-label={abierta ? "plegar" : "desplegar"}
        >
          {abierta ? "▾" : "▸"}
        </button>
      </div>
      <button
        onClick={() => setAbierta(!abierta)}
        className="flex w-full items-baseline gap-1.5 px-4 pt-0.5 pb-2 text-left text-sm font-medium"
      >
        <span>Daños reportados en SE</span>
        <span className="num text-xs" style={{ color: "var(--tinta-3)" }}>
          ({miles(sedesConReporte)})
        </span>
      </button>

      {/* Las cuatro casillas van fuera del plegado: son el filtro de la capa y
          tienen que poder tocarse sin desplegar la tarjeta entera.

          El colapso tiene casilla propia y no va sumado a "con daño". Son la
          misma escala pero no la misma pregunta: quien reparte cuadrillas
          busca los edificios caidos y no quiere leerlos mezclados con las 112
          filas que hablan de grietas. Van en orden de gravedad, que es el
          orden en que hay que ir a mirar. */}
      {/* En columna desde el 21 de agosto de 2026, y con el desglose de cada
          una colgando de su propia casilla. En fila envolvente caian dos y dos,
          y con la tarjeta a 240 px la fila se rompia por donde tocara: "Sin
          daño" podia quedar arriba al lado de "Colapso" y "Con daño" debajo,
          que es leer la escala de gravedad en zigzag. Y el desglose se dibujaba
          al final de las cuatro, asi que no se sabia de cual de las dos
          colgaban las casillas finas. */}
      <div className="flex flex-col gap-1 px-4 pb-2">
        {casillas.map((c) => (
          <div key={c.estado} className="flex flex-col gap-1">
            <Casilla
              activa={marcado(c.estado)}
              onAlternar={() => alternar([c.estado])}
              nombre={c.nombre}
              n={c.n}
              nota={c.nota}
              onDesglose={c.conDesglose
                ? () =>
                  setDesglosado(desglosado === c.estado ? null : c.estado)
                : undefined}
              desglosado={desglosado === c.estado}
            />
            {/* "Sin definir" no es un descarte ni una categoría floja: son los
                reportes de prensa y del PTIES que afirman colapso o daño sin
                precisar más, y los que el MEN dejó con el impacto sin definir.
                Sin esa fila, abrir el desglose habría borrado del mapa esos
                casos sin que nadie lo pidiera. */}
            {desglosado === c.estado && (
              <div className="flex flex-col gap-1 pb-1 pl-4">
                {(FILAS_SUBTIPO[c.estado] ?? []).map((f) => (
                  <Casilla
                    key={f.subtipos.join("+")}
                    activa={marcado(c.estado) && f.subtipos.every(subtipoMarcado)}
                    onAlternar={() => alternaSubtipo(c.estado, f.subtipos)}
                    nombre={f.nombre}
                    n={nPorSubtipo(f.subtipos)}
                    nota={f.subtipos.length > 1
                      ? "el MEN la deja con el impacto sin definir, o la fuente afirma el daño sin precisar más"
                      : f.subtipos[0].endsWith("_sd")
                        ? "la fuente lo afirma sin precisar más. Solo el MEN clasifica el impacto."
                        : `el MEN clasifica la sede como ${f.nombre}`}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
        {inspeccionadas && (
          <span className="num text-[11px]" style={{ color: "var(--tinta-3)" }}>
            {inspeccionadas}
          </span>
        )}
      </div>

      {/* Aqui vivio la caja de verificacion tecnica y se fue el 21 de agosto de
          2026, leyendo las fichas.

          Contaba 16 sedes con concepto tecnico disponible y 514 sin el, y las
          dos cifras eran ciertas, pero la caja afirmaba mas de lo que el dato
          aguanta. La casilla del formulario pregunta si el concepto esta
          disponible, no si alguien reviso la sede despues del sismo: puede ser
          de antes, y de hecho 12 de esas 16 sedes declaran en la casilla de al
          lado que todavia requieren visita tecnica. Un recuadro titulado
          "verificacion tecnica" se lee como "estas ya estan revisadas", y eso no
          es lo que dice el archivo.

          El campo no se borro. Sigue en `danos.json` y sigue en la ficha de cada
          sede, que es donde se lee junto a la casilla de visita pendiente y no
          se puede confundir con un balance del departamento. Lo que se quito es
          el agregado, porque agregar es justo lo que este dato no permite. */}

      <AvisoMen edicion={edicionMen} />

      {/* La opcion de soltar el recorte de intensidad, pegada al numero que la
          justifica. Va aqui y no en la tarjeta de capas porque es una decision
          sobre esta capa, y porque el numero de sedes que se estan quedando
          fuera es lo que hace entender para que sirve.

          Apagada, el mapa cuenta una sola cosa: intensidad, escuelas y reportes
          hablan del mismo territorio. Encendida, aparecen todos los reportes,
          incluidos los de las cinco sedes que ni siquiera tienen banda porque
          caen fuera de la grilla del ShakeMap, y los que quedan fuera del
          recorte se dibujan atenuados para que se note cuales son. */}
      {fueraDeBanda > 0 && (
        <div className="px-4 pb-2">
          <button
            onClick={() =>
              onCapas({ ...capas, danosTodasLasBandas: !todasLasBandas })
            }
            className="flex w-full items-start gap-2 text-left text-[11px]"
            style={{ color: "var(--tinta-3)" }}
          >
            <span
              className="mt-px flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border text-[9px] leading-none"
              style={{
                borderColor: todasLasBandas ? "var(--tinta)" : "var(--linea)",
                background: todasLasBandas ? "var(--tinta)" : "transparent",
                color: "var(--superficie)",
              }}
            >
              {todasLasBandas ? "✓" : ""}
            </span>
            <span>
              Ver todas las sedes reportadas.{" "}
              {todasLasBandas ? (
                <>
                  <span className="num">{miles(fueraDeBanda)}</span> sedes caen
                  fuera de las bandas encendidas y se dibujan atenuadas.
                </>
              ) : (
                <>
                  Hay <span className="num">{miles(fueraDeBanda)}</span> sedes
                  con reporte fuera de las bandas encendidas que ahora no se
                  dibujan.
                </>
              )}
            </span>
          </button>
        </div>
      )}

      {abierta && (
        <div className="px-4 pb-3">
          <BloqueFuente
            fuente="hot"
            danos={porFuente("hot")}
            sedes={sedesDe(porFuente("hot"))}
            matricula={matriculaDe(porFuente("hot"))}
            aporte={aporte("hot")}
            onIrASede={onIrASede}
            nota="Fotografías enviadas por WhatsApp, recogidas con el Humanitarian OpenStreetMap Team (HOT) y curadas una por una contra el directorio oficial. Aparecer aquí significa que una persona verificó que la fotografía corresponde a esa sede. No significa que la sede esté dañada."
            vacio={
              <>
                Todavía no hay ningún reporte confirmado.
                {pendientes.length > 0 ? (
                  <>
                    {" "}
                    Hay <span className="num">{miles(pendientes.length)}</span>{" "}
                    esperando revisión en{" "}
                    <a href="/triaje" className="underline">
                      la bandeja de triaje
                    </a>
                    .
                  </>
                ) : null}
              </>
            }
          />

          {/* El canal de reporte es el de HOT, no uno propio. Duplicarlo daria
              una segunda cola que nadie revisa. Va del color de HOT y no del
              acento de la interfaz: el boton pertenece a esa fuente, y el color
              es lo que lo dice sin tener que explicarlo.

              Desde el 14 de agosto de 2026 ese color es el turquesa, que antes
              era el rojo. Queda mas cerca del turquesa de CIMA de la interfaz
              (#60bfb9) de lo que estaba el rojo, pero no se confunden: este es
              mucho mas saturado y mas oscuro, y el de CIMA no aparece en esta
              tarjeta. */}
          <a
            href="https://chatmap.hotosm.org/"
            target="_blank"
            rel="noreferrer"
            className="mb-4 flex items-center justify-center gap-2 rounded border px-3 py-2 text-xs font-medium"
            style={{
              borderColor: COLOR_FUENTE.hot,
              color: COLOR_FUENTE.hot,
            }}
          >
            Reportar daños en SE
            <span aria-hidden="true">↗</span>
          </a>

          {/* Los dos emisores oficiales van desglosados y no sumados. No dicen
              lo mismo de las mismas sedes: en Riosucio el PTIES cerró dos sedes
              sin daño y la capa del MEN las declara en afectación parcial.
              Sumarlos borraría esa discrepancia, que es información. */}
          <BloqueFuente
            fuente="oficial"
            danos={porFuente("oficial")}
            sedes={sedesDe(porFuente("oficial"))}
            matricula={matriculaDe(porFuente("oficial"))}
            onIrASede={onIrASede}
            desglose={OFICIALES.map((e) => ({
              clave: e,
              nombre: EMISOR_CORTO[e] ?? e,
              sedes: sedesDe(porEmisor(e)),
              matricula: matriculaDe(porEmisor(e)),
            }))}
            emisoresActivos={capas.emisores}
            onAlternarEmisor={alternaEmisor}
            // Sin esto los dos emisores suman más que el total de la tarjeta y
            // no hay dónde leer por qué. Son las sedes que reportan los dos, y
            // en la tarjeta se cuentan una sola vez.
            solape={sedesEnAmbosOficiales}
            nota="Tres emisores, y se pueden apagar uno a uno. La Secretaría del Valle consolidó lo que declararon sus rectores con corte al 16 de agosto, y manda sobre el MEN cuando las dos hablan de la misma sede: es la entidad que responde por esas escuelas. Su archivo no trae código DANE, así que el emparejamiento con el directorio lo hicimos nosotros y cada sede dice en su ficha con qué regla. El MEN publica una capa con el estado físico sede por sede y el código ya puesto; ese estado sale de una encuesta a rectores que no es exhaustiva, así que una sede sin reporte no es una sede sin daño. El BID aporta el reporte del equipo PTIES con corte al 10 de agosto."
            pie={<PieMen meta={metaMen} edicion={edicionMen} />}
            vacio="Todavía no hay ningún reporte oficial cargado."
          />

          <BloqueFuente
            fuente="noticia"
            danos={porFuente("noticia")}
            sedes={sedesDe(porFuente("noticia"))}
            matricula={matriculaDe(porFuente("noticia"))}
            aporte={aporte("noticia")}
            onIrASede={onIrASede}
            nota="Declaraciones de autoridades recogidas por medios. Cada una guarda quién lo dijo, con nombre y cargo, la fecha y la cita textual. Es la única fuente que hasta hoy afirma el daño de una sede concreta."
            vacio="Todavía no hay ninguna noticia cargada."
          />

          {/* Qué cuenta cada bloque. Sin esta línea el número entre paréntesis
              no se entiende, y con él los tres bloques suman exactamente las
              sedes distintas en vez de pasarse en 72, que es lo que hacían
              cuando cada uno contaba todas las suyas. */}
          {excesoDeLosBloques > 0 && (
            <p
              className="border-t pt-2 text-[11px] leading-relaxed"
              style={{ borderColor: "var(--linea)", color: "var(--tinta-3)" }}
            >
              Cada bloque cuenta las sedes que aporta y que no cubre ya una
              fuente de más peso; entre paréntesis, las suyas que sí. Una sede
              que salió en prensa y que el MEN también reporta se cuenta en el
              bloque oficial, que es quien pinta su punto. Así los tres bloques
              suman las sedes distintas, y el encabezado de la tarjeta deja fuera
              las que ninguna casilla marcada incluye.
            </p>
          )}
        </div>
      )}

    </Tarjeta>
  );
}

/** Una fuente de reporte, con su encabezado, su nota y su lista.
 *
 * Las tres se dibujan igual a proposito. Lo unico que cambia es el color del
 * punto y lo que dice la nota, porque lo que hay que poder comparar de un
 * vistazo es quien lo afirma y con que fuerza, no el formato de la tarjeta.
 */
function BloqueFuente({
  fuente,
  danos,
  sedes,
  matricula,
  nota,
  vacio,
  desglose,
  solape,
  aporte,
  pie,
  emisoresActivos,
  onAlternarEmisor,
  onIrASede,
}: {
  fuente: FuenteDano;
  danos: Dano[];
  sedes: number;
  matricula: number;
  nota: string;
  vacio: React.ReactNode;
  /** Los emisores de esta fuente, cuando tiene más de uno. Va debajo del
   *  encabezado y sin desplegar, porque decir de quién es cada mitad del número
   *  no puede costar un clic. */
  desglose?: { clave: string; nombre: string; sedes: number; matricula: number }[];
  /** Cuántas sedes reportan más de un emisor de esta fuente. La tarjeta las
   *  cuenta una vez y el desglose las cuenta en cada línea, así que el desglose
   *  suma más que su encabezado y hay que decir por qué. */
  solape?: number;
  /** Cuántas sedes aporta esta fuente que ninguna de más peso ya cubre, y
   *  cuántas de las suyas ya están en un reporte oficial. Cuando viene, el
   *  encabezado muestra el aporte y deja el resto entre paréntesis: lo que
   *  importa de la prensa es la escuela que solo ella conoce. */
  aporte?: { propias: number; cubiertas: number; todasDelMen: boolean };
  /** Lo que se dice al final, después de la lista. Hoy solo lo usa la fuente
   *  oficial, para fechar la capa del MEN. */
  pie?: React.ReactNode;
  /** Que emisores estan encendidos, y como apagarlos. Cuando vienen, las lineas
   *  del desglose dejan de ser cifras y pasan a ser el filtro: es donde ya esta
   *  escrito cuanto aporta cada uno, y separar el numero de su interruptor
   *  obligaria a buscar en otra tarjeta lo que aqui se acaba de leer. */
  emisoresActivos?: string[];
  onAlternarEmisor?: (clave: string) => void;
  onIrASede: (dane: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  // Del mas grave al menos grave, y dentro de eso de mayor a menor matricula.
  // Es el orden en que hay que ir a mirar.
  const orden = [...danos].sort(
    (a, b) =>
      GRAVEDAD[b.estado] - GRAVEDAD[a.estado] || b.matricula - a.matricula,
  );

  return (
    <div className="mb-4">
      {/* Las cifras van en su propia linea y con la palabra entera. Abreviado a
          "est." se confundia con estimados, que es justo lo que no son: son
          alumnos contados. */}
      <div className="mb-1.5 flex items-start gap-2">
        <span
          className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: COLOR_FUENTE[fuente] }}
        />
        <span className="flex-1">
          <span className="block text-xs font-medium">
            {NOMBRE_FUENTE[fuente]}
          </span>
          <span className="num block text-xs" style={{ color: "var(--tinta-2)" }}>
            {miles(aporte ? aporte.propias : sedes)}{" "}
            {(aporte ? aporte.propias : sedes) === 1 ? "sede" : "sedes"}
            {aporte && aporte.cubiertas > 0 && (
              <span style={{ color: "var(--tinta-3)" }}>
                {" (+"}{miles(aporte.cubiertas)}{" con reporte "}
                {aporte.todasDelMen ? "MEN" : "oficial"}{")"}
              </span>
            )}
            {" · "}
            {miles(matricula)} {matricula === 1 ? "estudiante" : "estudiantes"}
          </span>
        </span>
        <button
          onClick={() => setAbierto(!abierto)}
          style={{ color: "var(--tinta-3)" }}
          aria-label={abierto ? "plegar la fuente" : "desplegar la fuente"}
        >
          {abierto ? "▾" : "▸"}
        </button>
      </div>

      {/* Fuera del plegado: quién emite cada parte del número es parte del
          número, no un detalle que haya que ir a buscar. */}
      {desglose && desglose.some((x) => x.sedes > 0) && (
        <div className="mb-2 ml-4.5 flex flex-col gap-0.5">
          {desglose.filter((x) => x.sedes > 0).map((x) => {
            const activo = !emisoresActivos || emisoresActivos.includes(x.clave);
            const cifra = (
              <>
                <span className="font-medium">{x.nombre}</span>{" "}
                {miles(x.sedes)} {x.sedes === 1 ? "sede" : "sedes"}
                {" · "}
                {miles(x.matricula)}{" "}
                {x.matricula === 1 ? "estudiante" : "estudiantes"}
              </>
            );
            if (!onAlternarEmisor) {
              return (
                <span key={x.clave} className="num text-[11px]"
                      style={{ color: "var(--tinta-3)" }}>
                  {cifra}
                </span>
              );
            }
            return (
              <button
                key={x.clave}
                onClick={() => onAlternarEmisor(x.clave)}
                aria-pressed={activo}
                title={activo
                  ? `Dejar de dibujar lo que reporta ${x.nombre}`
                  : `Volver a dibujar lo que reporta ${x.nombre}`}
                className="num flex items-center gap-1.5 text-left text-[11px]"
                style={{ color: activo ? "var(--tinta-2)" : "var(--tinta-3)",
                         opacity: activo ? 1 : 0.6 }}
              >
                <span
                  className="flex h-3 w-3 shrink-0 items-center justify-center rounded-sm border text-[8px] leading-none"
                  style={{
                    borderColor: activo ? "var(--acento)" : "var(--linea)",
                    background: activo ? "var(--acento)" : "transparent",
                    color: "var(--superficie)",
                  }}
                >
                  {activo ? "✓" : ""}
                </span>
                <span>{cifra}</span>
              </button>
            );
          })}
          {solape != null && solape > 0 && (
            <span className="text-[11px]" style={{ color: "var(--tinta-3)" }}>
              <span className="num">{miles(solape)}</span>{" "}
              {solape === 1
                ? "sede la reporta mas de uno, y arriba cuenta una vez"
                : "sedes las reporta mas de uno, y arriba cuentan una vez"}
            </span>
          )}
        </div>
      )}

      {abierto && (
        <>
          <p
            className="mb-2 text-[11px] leading-relaxed"
            style={{ color: "var(--tinta-3)" }}
          >
            {nota}
          </p>
          {orden.length === 0 ? (
            <p
              className="rounded border px-3 py-2 text-xs"
              style={{ borderColor: "var(--linea)", color: "var(--tinta-2)" }}
            >
              {vacio}
            </p>
          ) : (
            // Hasta cuatro sedes la lista va entera. Con más se desplaza por
            // dentro, para que una fuente con doce sedes no empuje las otras dos
            // fuera de la pantalla. `overscroll-contain` corta el encadenamiento:
            // sin él, al llegar al final de esta lista el gesto seguiría
            // moviendo la columna entera de tarjetas.
            <div
              className={
                orden.length > MAX_FILAS_VISIBLES
                  ? "max-h-[26rem] overflow-y-auto overscroll-contain pr-1"
                  : undefined
              }
            >
              {orden.map((d) => (
                <FilaDano key={d.id} dano={d} onIrASede={onIrASede} />
              ))}
            </div>
          )}
          {pie}
        </>
      )}
    </div>
  );
}

/** De cuándo es la capa del MEN, y si el MEN ya la editó después.
 *
 * Existe porque el mapa dibuja una copia congelada y no el servicio en vivo.
 * Esa decisión es deliberada: si el visor consultara al MEN para pintarse, un
 * cambio de esquema o una despublicación dejarían la pantalla sin capa en plena
 * emergencia, y no quedaría registro de qué decía el reporte cada día. El precio
 * de congelar es que la copia envejece, y este pie es lo que impide que
 * envejezca en silencio.
 *
 * Cuando el servicio no contesta no se dibuja ningún aviso. Callar es correcto:
 * no sabemos si hay desfase, y decir "puede que esté desactualizado" sin
 * saberlo sería sembrar una duda que no viene de ningún dato.
 */
function PieMen({ meta, edicion }: {
  meta: MetaMen | null;
  edicion: number | null;
}) {
  if (!meta) return null;
  return (
    <p
      className="mt-2 border-t pt-2 text-[11px] leading-relaxed"
      style={{ borderColor: "var(--linea)", color: "var(--tinta-3)" }}
    >
      La capa del MEN es del{" "}
      <span className="num">{fechaLarga(meta.fecha_capa)}</span> y cubre{" "}
      <span className="num">{miles(meta.con_estado)}</span> sedes con estado
      declarado sobre un universo priorizado de{" "}
      <span className="num">{miles(meta.universo)}</span>.{" "}
      <a
        href={meta.tablero}
        target="_blank"
        rel="noreferrer"
        className="underline"
      >
        Tablero del MEN ↗
      </a>
    </p>
  );
}

/** El aviso de que la capa del MEN se quedó atrás.
 *
 * Va al nivel de la tarjeta y no dentro del bloque de la fuente oficial, que es
 * donde vivía primero. Ahí quedaba a dos clics: desplegar la tarjeta y desplegar
 * la fuente. Una advertencia de que lo que se está mirando ya no es lo último
 * que dijo la fuente no puede estar escondida detrás de dos gestos.
 *
 * No ocupa espacio cuando no hay nada que decir, que es lo normal: solo aparece
 * si el servicio contestó y contestó que hay algo más nuevo.
 */
function AvisoMen({ edicion }: { edicion: number | null }) {
  if (edicion == null) return null;
  return (
    <p
      className="mx-4 mb-2 rounded border px-2.5 py-1.5 text-[11px] leading-relaxed"
      style={{
        borderColor: COLOR_FUENTE.oficial,
        color: COLOR_FUENTE.oficial,
      }}
    >
      El MEN actualizó su capa el{" "}
      <span className="num">
        {fechaLarga(new Date(edicion).toISOString().slice(0, 10))}
      </span>
      , después de la descarga que dibuja este mapa. Lo que se ve todavía no
      incluye ese cambio.
    </p>
  );
}

/** "2026-08-13" a "13 de agosto". El año sobra: todo este visor habla de un
 *  solo evento y de los días que le siguieron. */
function fechaLarga(iso: string): string {
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
    "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const [, m, d] = iso.split("-");
  if (!m || !d) return iso;
  return `${Number(d)} de ${MESES[Number(m) - 1]}`;
}

/** Fuente, estado y matrícula, que es lo que se pidió que dijera cada fila.
 *
 * El aviso de alcance no es un adorno. Cuando el reporte habla de la
 * institución, la fila tiene que decir en cuántas sedes puede estar el daño, o
 * quien la lea entenderá que está en esta.
 */
function FilaDano({
  dano: d,
  onIrASede,
}: {
  dano: Dano;
  onIrASede: (dane: string) => void;
}) {
  const color = COLOR_FUENTE[d.fuente];
  const deGrupo = d.alcance !== "sede" && (d.n_sedes_institucion ?? 1) > 1;

  return (
    <button
      onClick={() => onIrASede(d.dane)}
      className="mb-2 block w-full overflow-hidden rounded border text-left"
      style={{ borderColor: "var(--linea)" }}
    >
      {d.url_foto && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={d.url_foto}
          alt="Fotografía enviada por un ciudadano"
          className="h-36 w-full object-cover"
          style={{ background: "var(--plano)" }}
          loading="lazy"
        />
      )}
      <span className="block px-2.5 py-2">
        <span className="mb-0.5 flex items-center gap-1.5">
          <Insignia estado={d.estado} color={color} />
          <span className="flex-1 text-xs font-medium">{d.sede}</span>
        </span>
        <span className="num block text-[10px]" style={{ color: "var(--tinta-3)" }}>
          Código DANE {d.dane}
        </span>
        <span className="num block text-xs" style={{ color: "var(--tinta-2)" }}>
          {miles(d.matricula)} estudiantes
          {d.matricula_es_de_2022 ? " (2022)" : ""}
        </span>
        <span className="block text-xs" style={{ color: "var(--tinta-2)" }}>
          {d.mpio}, {d.depto}
        </span>
        {deGrupo && (
          <span className="mt-0.5 block text-[10px]" style={{ color }}>
            El reporte habla de {d.institucion_reportada ?? "la institución"}. El
            daño puede estar en cualquiera de sus{" "}
            <span className="num">{d.n_sedes_institucion}</span> sedes.
          </span>
        )}
        {d.encuestada === false && (
          <span
            className="block text-[10px]"
            style={{ color: "var(--sede-ignota)" }}
          >
            Nunca fue encuestada
          </span>
        )}
        <span className="block text-[10px]" style={{ color: "var(--tinta-3)" }}>
          {d.fecha}
          {d.quien ? `, ${d.quien}` : ""}
          {d.cargo ? `, ${d.cargo}` : ""}
        </span>
      </span>
    </button>
  );
}

function Insignia({ estado, color }: { estado: EstadoDano; color: string }) {
  const hueco = estado === "sin_dano" || estado === "sin_verificar";
  return (
    <span
      className="shrink-0 rounded px-1.5 py-px text-[10px] font-medium uppercase tracking-wide"
      style={{
        background: hueco ? "transparent" : color,
        color: hueco ? color : "#fff",
        border: `1px solid ${color}`,
      }}
    >
      {NOMBRE_ESTADO[estado]}
    </span>
  );
}

// -------------------------------------------------------------- 3. capas --

function TarjetaCapas({
  filtros,
  onFiltros,
  capas,
  onCapas,
  resumen,
  secretarias,
  zonas,
  sedes,
  ocultas,
  danos,
  onIrASede,
}: Props) {
  const [abierta, setAbierta] = useState(true);
  // Las tres filas abren desplegadas menos la de sedes. La de secretaria porque
  // es la primera decision de la pantalla, y la de intensidad porque es la que
  // explica el color del mapa. La de sedes guarda el buscador y los siete
  // filtros, y ninguno de los dos se necesita antes de haber elegido territorio.
  const [secretariaAbierta, setSecretariaAbierta] = useState(true);
  const [sedesAbierta, setSedesAbierta] = useState(false);
  const [intensidadAbierta, setIntensidadAbierta] = useState(true);
  const [masFiltros, setMasFiltros] = useState(false);
  const set = (p: Partial<Filtros>) => onFiltros({ ...filtros, ...p });
  const alternaLista = (lista: string[], v: string) =>
    lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v];

  const conSecretaria = filtros.secretarias.length > 0;

  /** Elegir una secretaria cambia a que pregunta responde la pantalla.
   *
   * Sin secretaria, la pregunta es del sismo: donde sacudio fuerte y que hay
   * dentro. Con una secretaria elegida, la pregunta es de esa entidad: cuantas
   * escuelas tiene, cuales estan reportadas y cuales no. En la segunda pregunta
   * el recorte de intensidad estorba, porque esconde escuelas que son suyas por
   * un motivo que no tiene que ver con ella.
   *
   * Asi que las bandas se vacian y dejan de recortar. Vaciarlas no esconde nada:
   * con una secretaria elegida la banda ya no reparte sedes, solo pinta la
   * mancha, y eso lo decide `pasa` en `lib/datos.ts`. El mapa abre limpio, con
   * las escuelas de la entidad sobre el mapa base, y las seis casillas en blanco
   * dicen la verdad: no hay ninguna mancha encima.
   *
   * Antes se encendian las seis, que tambien equivalia a no recortar, pero
   * mentia en pantalla. Las casillas aparecian marcadas y el pais entero
   * quedaba cubierto de color encima de la linea del territorio; y si se apagaba
   * la capa para poder ver algo, quedaban marcadas sin pintar nada. En los dos
   * casos el control decia una cosa y el mapa otra.
   *
   * La capa se queda habilitada a proposito. Es lo que hace que marcar una banda
   * se vea al instante: con la capa apagada, la casilla se marcaba y no pasaba
   * nada.
   *
   * Al quitar la ultima secretaria se vuelve al arranque, 6,0 y 6,5, y no a
   * ninguna ni a todas: dejar el recorte cambiado convertiria un rodeo por una
   * secretaria en un cambio permanente del mapa que nadie pidio.
   */
  const eligeSecretaria = (v: string) => {
    const lista = alternaLista(filtros.secretarias, v);
    const primera = !conSecretaria && lista.length > 0;
    const ninguna = conSecretaria && lista.length === 0;
    set({
      secretarias: lista,
      ...(primera ? { bandas: [] } : {}),
      ...(ninguna ? { bandas: FILTROS_INICIALES.bandas } : {}),
    });
    if (primera) {
      onCapas({ ...capas, intensidad: true });
      setIntensidadAbierta(false);
      setMasFiltros(true);
    }
    if (ninguna) {
      onCapas({ ...capas, intensidad: true });
      setIntensidadAbierta(true);
      setMasFiltros(false);
    }
  };

  const limpiaSecretarias = () => {
    set({ secretarias: [], bandas: FILTROS_INICIALES.bandas });
    onCapas({ ...capas, intensidad: true });
    setIntensidadAbierta(true);
    setMasFiltros(false);
  };

  const alterna = (b: number) =>
    onFiltros({
      ...filtros,
      bandas: filtros.bandas.includes(b)
        ? filtros.bandas.filter((x) => x !== b)
        : [...filtros.bandas, b],
    });

  return (
    <Tarjeta>
      <Encabezado
        titulo="Visualiza Sedes Educativas (SE) por"
        abierta={abierta}
        onAlternar={() => setAbierta(!abierta)}
      />
      {abierta && (
        <div className="pb-2">
          {/* Las tres filas al mismo nivel desde el 21 de agosto de 2026: mismo
              tamaño de letra, mismo caret para plegar y mismo ojo para dejar de
              dibujar. Antes la secretaria era una etiqueta de 10 px sobre un
              desplegable, la intensidad una fila con caret y las sedes una fila
              sin caret, y las tres cosas eran el mismo tipo de decision leida de
              tres formas distintas.

              La secretaria va primera porque no es un filtro sobre las escuelas
              sino el recorte de jurisdiccion de la pantalla: recorta las sedes,
              los puntos de dano y las dos cuentas de arriba a la derecha.

              Su ojo apaga solo la linea punteada del territorio. El recorte
              sigue en pie con la linea apagada; lo que se apaga es el dibujo del
              limite, que es de geoBoundaries 2020 y a veces estorba encima de la
              mancha de intensidad. */}
          <FilaCapa
            nombre="Secretaría de educación"
            activa={capas.territorio}
            onAlternar={() =>
              onCapas({ ...capas, territorio: !capas.territorio })}
            plegada={!secretariaAbierta}
            onPlegar={() => setSecretariaAbierta(!secretariaAbierta)}
          />
          {secretariaAbierta && (
            <div className="px-4 pb-2 pl-8">
              <Desplegable
                opciones={secretarias}
                elegidas={filtros.secretarias}
                onAlternar={eligeSecretaria}
                onLimpiar={limpiaSecretarias}
              />
            </div>
          )}

          {/* El nombre volvio a ser "Sedes educativas" a secas. Estuvo unas
              horas como "sin daño", que describia bien lo que se ve al apagar la
              capa, pero decia de menos: la fila no es solo el interruptor de un
              dibujo, es donde se busca una escuela por nombre y donde viven los
              siete filtros que deciden cuales se cuentan. */}
          <FilaCapa
            nombre="Sedes educativas"
            activa={capas.sedes}
            onAlternar={() => onCapas({ ...capas, sedes: !capas.sedes })}
            muestra={<Gota color="var(--sede-base)" />}
            plegada={!sedesAbierta}
            onPlegar={() => setSedesAbierta(!sedesAbierta)}
          />
          {sedesAbierta && (
            <div className="px-4 pt-1 pb-2 pl-8">
              <BuscadorSede
                sedes={sedes}
                ocultas={ocultas}
                onIrASede={onIrASede}
                conFiltros={filtros.secretarias.length > 0
                  || filtros.zonas.length > 0
                  || filtros.quintiles.length > 0
                  || filtros.matriculaMin > 0
                  || filtros.bandas.length < BANDAS.length
                  || ocultas.size > 0}
              />

              {/* Los filtros de la sede cuelgan de esta fila. Antes vivian en
                  una tarjeta aparte y quedaba sin decir que recortan exactamente
                  esos puntos y ningun otro.

                  Los siete estan detras del mismo clic desde el 21 de agosto de
                  2026. Antes zona, matricula y quintil quedaban siempre a la
                  vista porque son los que se usan para acotar a donde ir, pero
                  con la lista de secretarias arriba y las bandas debajo la
                  tarjeta abria con tres controles que nadie habia pedido
                  todavia. Lo primero que se decide es el territorio; los cortes
                  vienen despues.

                  Se abren solos al elegir una secretaria. Ahi la pregunta deja
                  de ser del sismo y pasa a ser de la entidad, y estos son los
                  cortes con los que se reparte el trabajo dentro de su
                  territorio. */}
              <button
                onClick={() => setMasFiltros(!masFiltros)}
                className="mt-2 text-xs underline"
                style={{ color: "var(--tinta-2)" }}
              >
                {masFiltros ? "Menos filtros" : "Más filtros"}
              </button>
              <BloqueFiltros
                abierto={masFiltros}
                filtros={filtros}
                set={set}
                alternaLista={alternaLista}
                zonas={zonas}
                resumen={resumen}
                capas={capas}
                onCapas={onCapas}
              />
            </div>
          )}

          <FilaCapa
            nombre="Intensidad del sismo"
            ayuda={EXPLICACION_MMI}
            fuente={FUENTE_MMI}
            activa={capas.intensidad}
            onAlternar={() => onCapas({ ...capas, intensidad: !capas.intensidad })}
            plegada={!intensidadAbierta}
            onPlegar={() => setIntensidadAbierta(!intensidadAbierta)}
          />
          {intensidadAbierta && (
            <div className="pb-1">
              <div className="flex gap-3 px-4 pb-1 pl-8 text-[10px]">
                <button
                  onClick={() =>
                    onFiltros({ ...filtros, bandas: BANDAS.map((b) => b.banda) })
                  }
                  className="underline"
                  style={{ color: "var(--tinta-3)" }}
                >
                  Seleccionar todas
                </button>
                <button
                  onClick={() => onFiltros({ ...filtros, bandas: [] })}
                  className="underline"
                  style={{ color: "var(--tinta-3)" }}
                >
                  Quitar todas
                </button>
              </div>
              {[...BANDAS].reverse().map((b) => {
                const on = filtros.bandas.includes(b.banda);
                return (
                  <button
                    key={b.banda}
                    onClick={() => alterna(b.banda)}
                    className="flex w-full items-center gap-2 px-4 py-1 pl-8 text-xs"
                  >
                    <span
                      className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border text-[9px] leading-none"
                      style={{
                        borderColor: on ? "var(--tinta)" : "var(--linea)",
                        background: on ? "var(--tinta)" : "transparent",
                        color: "var(--superficie)",
                      }}
                    >
                      {on ? "✓" : ""}
                    </span>
                    <span
                      className="inline-block h-3 w-5 shrink-0 rounded-sm"
                      style={{
                        background: COLOR_BANDA[b.banda],
                        opacity: on ? 1 : 0.35,
                      }}
                    />
                    <span className="num" style={{ color: "var(--tinta-2)" }}>
                      MMI {b.etiqueta}
                    </span>
                    <span
                      className="ml-auto truncate text-[10px]"
                      style={{ color: "var(--tinta-3)" }}
                    >
                      {b.nota}
                    </span>
                  </button>
                );
              })}
              {/* Con una secretaría elegida la banda deja de repartir sedes y
                  solo pinta, así que la frase de siempre dejaría de ser cierta
                  justo donde más se lee. */}
              <p
                className="px-4 pt-1 pl-8 text-[10px] leading-relaxed"
                style={{ color: "var(--tinta-3)" }}
              >
                {conSecretaria ? (
                  <>
                    El mapa pinta qué tan fuerte se sintió el sismo en cada zona.
                    Con una secretaría elegida, encender una banda solo dibuja la
                    mancha encima: no hace aparecer ni desaparecer sedes, porque
                    las de la entidad se muestran todas.
                  </>
                ) : (
                  <>
                    El mapa pinta qué tan fuerte se sintió el sismo en cada zona y
                    muestra las sedes educativas que quedaron dentro.
                    Encender una banda decide las dos cosas a la vez: la mancha
                    del mapa y las sedes que se cuentan.
                  </>
                )}{" "}
                La línea punteada marca hasta dónde llega la grilla del USGS, no
                hasta dónde llegó el temblor.
              </p>
            </div>
          )}

        </div>
      )}
    </Tarjeta>
  );
}

/** Los siete cortes que deciden que sedes se cuentan.
 *
 * Salio de dentro de `TarjetaCapas` el 21 de agosto de 2026, cuando la fila de
 * sedes paso a guardar tambien el buscador. Con las dos cosas en linea la
 * funcion pasaba de trescientas lineas de JSX y no habia como ver donde
 * terminaba un control y empezaba el siguiente.
 *
 * No decide nada: recibe `filtros` y el `set` de quien lo dibuja. Aqui solo
 * estan los controles y la explicacion de cada uno.
 */
function BloqueFiltros({
  abierto,
  filtros,
  set,
  alternaLista,
  zonas,
  resumen,
  capas,
  onCapas,
}: {
  abierto: boolean;
  filtros: Filtros;
  set: (p: Partial<Filtros>) => void;
  alternaLista: (lista: string[], v: string) => string[];
  zonas: string[];
  resumen: Resumen;
  capas: Capas;
  onCapas: (c: Capas) => void;
}) {
  if (!abierto) return null;
  return (
              <div className="mt-2">
                {/* Zona y no "área": el área de tres categorías es otra columna
                    y vive en la ficha de cada sede. Con el mismo nombre para
                    las dos, quien filtra aquí cree que está filtrando aquello. */}
                <Etiqueta>Zona</Etiqueta>
                <div className="mb-3">
                  <Chips>
                    {zonas.map((z) => (
                      <Opcion
                        key={z}
                        activo={filtros.zonas.includes(z)}
                        onClick={() =>
                          set({ zonas: alternaLista(filtros.zonas, z) })
                        }
                      >
                        {NOMBRE_ZONA[z] ?? z}
                      </Opcion>
                    ))}
                  </Chips>
                </div>

                <div className="mb-1 text-xs" style={{ color: "var(--tinta-3)" }}>
                  Matrícula mínima:{" "}
                  <span className="num">{miles(filtros.matriculaMin)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1000}
                  step={25}
                  value={filtros.matriculaMin}
                  onChange={(e) => set({ matriculaMin: Number(e.target.value) })}
                  className="w-full"
                />

                <div
                  className="mt-2 mb-1 text-xs"
                  style={{ color: "var(--tinta-3)" }}
                >
                  Quintil de riqueza del entorno
                  <Info texto="Quintiles nacionales del índice de riqueza relativa de Meta, calculados sobre las 52.823 sedes del país. El primer quintil reúne el 20 % de las sedes en los entornos más pobres. Las sedes sin el dato quedan por fuera si se elige un quintil." />
                </div>
                <div className="mb-3">
                  <Chips>
                    {[1, 2, 3, 4, 5].map((q) => (
                      <Opcion
                        key={q}
                        activo={filtros.quintiles.includes(q)}
                        onClick={() =>
                          set({
                            quintiles: filtros.quintiles.includes(q)
                              ? filtros.quintiles.filter((x) => x !== q)
                              : [...filtros.quintiles, q],
                          })
                        }
                      >
                        {NOMBRE_QUINTIL[q]}
                      </Opcion>
                    ))}
                  </Chips>
                </div>

                <Etiqueta oracion>
                  <span className="text-[11px]">Vigencia de la sede</span>
                  <Info
                    texto="El marco de sedes es el SIMAT de 2022 y ya tiene cuatro años. El C-600 de 2024 declara la novedad de cada sede, y ahí se ve cuáles se liquidaron, se fusionaron, quedaron duplicadas o inactivas. Aparecen todas por defecto: una escuela cerrada con el edificio en pie sigue importando después de un sismo. Lo que ya no aporta es matrícula, y de eso se encarga el dato de 2024. Que una sede no haya reportado no significa que haya cerrado."
                  />
                </Etiqueta>
                <div className="mb-3">
                  <Chips>
                    {["opera", "no_opera", "sin_reporte"].map((v) => (
                      <Opcion
                        key={v}
                        activo={filtros.vigencias.includes(v)}
                        onClick={() =>
                          set({ vigencias: alternaLista(filtros.vigencias, v) })
                        }
                      >
                        {NOMBRE_VIGENCIA[v] ?? v}
                      </Opcion>
                    ))}
                  </Chips>
                </div>

                <Etiqueta oracion>
                  <span className="text-[11px]">Programa PTIES</span>
                  <Info
                    texto="El PTIES focaliza 72 establecimientos de educación media en todo el país. Su listado da un código de sede por cada uno, y 35 de esas sedes caen en esta zona. El archivo trae el año de intervención y llega hasta 2029, así que estar focalizada no es estar ya intervenida: son 10 intervenidas y 24 programadas dentro de la selección. La marca va sobre el código que el archivo lista y no se extiende a las demás sedes del mismo establecimiento."
                  />
                </Etiqueta>
                <div className="mb-3">
                  <Chips>
                    {["intervenida", "programada", "no_ptie"].map((v) => (
                      <Opcion
                        key={v}
                        activo={filtros.pties.includes(v)}
                        onClick={() => set({ pties: alternaLista(filtros.pties, v) })}
                      >
                        {NOMBRE_PTIE[v] ?? v}
                      </Opcion>
                    ))}
                  </Chips>
                </div>

                <label className="mt-2 flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={filtros.resaltarCoordDudosa}
                    onChange={(e) => set({ resaltarCoordDudosa: e.target.checked })}
                  />
                  <span style={{ color: "var(--tinta-2)" }}>
                    Resaltar las coordenadas sin verificar (
                    <span className="num">{miles(resumen.sinCoordVerificada)}</span>{" "}
                    en la selección)
                  </span>
                </label>

                {/* La capa de huellas es un interruptor de dibujo, no un filtro,
                    y por eso estaba fuera con las demas capas. Baja aqui porque
                    se toca una vez al mes: solo aparece desde el zoom 15, o sea
                    cuando ya se esta mirando un predio concreto. */}
                <label className="mt-3 flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={capas.huellas}
                    onChange={(e) =>
                      onCapas({ ...capas, huellas: e.target.checked })
                    }
                  />
                  <span style={{ color: "var(--tinta-2)" }}>
                    Huellas de edificio (desde el zoom 15)
                  </span>
                </label>
              </div>
  );
}

/** Encontrar una escuela por su nombre y llegar hasta ella.
 *
 * Existe porque hasta hoy no habia forma de contestar la pregunta mas simple de
 * la pantalla: donde esta esta sede. Habia que reconocerla entre cinco mil
 * puntos, o adivinar que combinacion de filtros la dejaba sola.
 *
 * Busca sobre la seleccion que hay en pantalla y no sobre las 52.823 del pais.
 * Un resultado que el mapa no esta dibujando mandaria a buscar un punto que no
 * existe; cuando la seleccion esta recortada se dice, para que quien no
 * encuentre su escuela sepa que puede estar detras de un filtro y no ausente.
 *
 * Tres caracteres antes de listar nada. Con uno solo la lista trae miles de
 * filas y no ayuda a elegir.
 */
function BuscadorSede({
  sedes,
  ocultas,
  onIrASede,
  conFiltros,
}: {
  sedes: RasgoSede[];
  ocultas: Set<string>;
  onIrASede: (dane: string) => void;
  /** Si algun filtro esta recortando la seleccion. Cambia lo que dice la
   *  pantalla cuando no hay ninguna coincidencia. */
  conFiltros: boolean;
}) {
  const [busca, setBusca] = useState("");
  const q = busca.trim().toLowerCase();
  const buscando = q.length >= 3;
  // El nombre del establecimiento tambien cuenta: quien busca "Carrasquilla"
  // esta pensando en el colegio, y sus sedes anexas no llevan ese nombre.
  const halladas = buscando
    ? sedes.filter((f) => {
      if (ocultas.has(f.properties.dane)) return false;
      const s = f.properties;
      return s.sede.toLowerCase().includes(q)
        || s.mpio.toLowerCase().includes(q)
        || (s.establecimiento ?? "").toLowerCase().includes(q)
        || s.dane.startsWith(q);
    })
    : [];

  return (
    <div>
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar sede por nombre, municipio o código DANE"
        className="w-full rounded border px-2 py-1 text-[11px]"
        style={{
          borderColor: "var(--linea)",
          background: "var(--superficie)",
        }}
      />

      {buscando && halladas.length === 0 && (
        <p className="pt-1.5 text-[10px] leading-relaxed"
           style={{ color: "var(--tinta-3)" }}>
          Ninguna sede de la selección coincide.
          {conFiltros
            ? " Puede existir y estar fuera de los filtros encendidos."
            : ""}
        </p>
      )}

      {halladas.length > 0 && (
        <>
          <div
            className="mt-1 max-h-44 overflow-y-auto overscroll-contain rounded border"
            style={{ borderColor: "var(--linea)" }}
          >
            {halladas.slice(0, MAX_HALLADAS).map((f) => (
              <button
                key={f.properties.dane}
                onClick={() => onIrASede(f.properties.dane)}
                className="block w-full border-b px-2 py-1 text-left last:border-b-0"
                style={{ borderColor: "var(--linea)" }}
                title="ir a esta sede y abrir su ficha"
              >
                <span className="block truncate text-[11px]">
                  {f.properties.sede}
                </span>
                <span
                  className="block truncate text-[10px]"
                  style={{ color: "var(--tinta-3)" }}
                >
                  {f.properties.mpio} ·{" "}
                  <span className="num">{miles(f.properties.matricula)}</span>{" "}
                  alumnos
                </span>
              </button>
            ))}
          </div>
          <p className="pt-1 text-[10px]" style={{ color: "var(--tinta-3)" }}>
            <span className="num">{miles(halladas.length)}</span>{" "}
            {halladas.length === 1 ? "coincidencia" : "coincidencias"}
            {halladas.length > MAX_HALLADAS && (
              <>
                , se listan las primeras{" "}
                <span className="num">{MAX_HALLADAS}</span>
              </>
            )}
            . Al hacer clic el mapa vuela a la sede y abre su ficha.
          </p>
        </>
      )}
    </div>
  );
}

// ------------------------------- 5. caracteristicas antes del sismo --

/** Lo que se sabia de estas sedes antes del 10 de agosto.
 *
 * Dos fuentes y dos fechas distintas, y conviene no mezclarlas: la encuesta del
 * FFIE es una declaracion del rector de hace cuatro anos, y el C-600 es un
 * registro administrativo del ano pasado. Ninguna de las dos dice nada sobre el
 * estado de la sede despues del sismo.
 *
 * El relato ("de la seleccion, N fueron visitadas y el X % declaro averia") se
 * calcula sobre la seleccion sin los botones de esta tarjeta. Si se calculara
 * sobre lo filtrado, al elegir "nunca visitadas" diria que cero de cero fueron
 * visitadas y que el 0 % declaro averia, que es una frase sin sentido.
 */
function TarjetaCaracteristicas({
  filtros,
  onFiltros,
  resumen,
  resumenAmplio,
  encuestadasPais,
}: Props) {
  const [abierta, setAbierta] = useState(false);
  const set = (p: Partial<Filtros>) => onFiltros({ ...filtros, ...p });
  const alterna = (l: number[], v: number) =>
    l.includes(v) ? l.filter((x) => x !== v) : [...l, v];
  const base = resumenAmplio;

  return (
    // El acento de esta tarjeta es el turquesa de CIMA y no el azul del resto.
    // Se redefine la variable aqui en vez de tocar `Opcion` y las pestañas,
    // porque esos mismos componentes los usa la tarjeta de capas, que sigue en
    // azul. Una variable heredada cambia todo lo de dentro y nada de fuera.
    <Tarjeta estilo={{ "--acento": "var(--cima)" } as React.CSSProperties}>
      <Encabezado
        titulo="Características de las SE antes del sismo"
        abierta={abierta}
        onAlternar={() => setAbierta(!abierta)}
      />
      {abierta && (
        <>
          <div className="flex border-b" style={{ borderColor: "var(--linea)" }}>
            {(
              [
                ["fisica", "Infraestructura"],
                ["servicios", "Servicios"],
              ] as const
            ).map(([id, nombre]) => (
              <button
                key={id}
                onClick={() => set({ tab: id })}
                className="flex-1 px-2 pb-2 pt-1 text-xs font-medium"
                style={{
                  color: filtros.tab === id ? "var(--acento)" : "var(--tinta-3)",
                  borderBottom:
                    filtros.tab === id
                      ? "2px solid var(--acento)"
                      : "2px solid transparent",
                }}
              >
                {nombre}
              </button>
            ))}
          </div>

          <div className="px-4 py-3">
            {filtros.tab === "fisica" ? (
              <>
                <p
                  className="mb-2 text-xs leading-relaxed"
                  style={{ color: "var(--tinta-2)" }}
                >
                  Entre noviembre de 2021 y febrero de 2022, el Fondo de
                  Financiamiento de la Infraestructura Educativa (FFIE) visitó{" "}
                  <span className="num">{miles(encuestadasPais)}</span> sedes del
                  país y le preguntó al rector por el estado de los techos, los
                  muros y los pisos.
                  <Info texto="La encuesta también recogió el material de la construcción, su edad y la fecha del último mantenimiento. Es una declaración del rector, no una inspección técnica, y es anterior al sismo: describe el punto de partida, no el daño de hoy." />
                </p>

                {base.encuestadas > 0 ? (
                  <p
                    className="mb-3 text-xs leading-relaxed"
                    style={{ color: "var(--tinta-2)" }}
                  >
                    De las{" "}
                    <span className="num font-semibold">{miles(base.sedes)}</span>{" "}
                    sedes seleccionadas,{" "}
                    <span className="num font-semibold">
                      {miles(base.encuestadas)}
                    </span>{" "}
                    fueron visitadas.
                  </p>
                ) : (
                  <p className="mb-3 text-xs" style={{ color: "var(--tinta-2)" }}>
                    Ninguna de las sedes seleccionadas fue visitada por el FFIE,
                    así que no hay nada declarado sobre su estado.
                  </p>
                )}

                <Etiqueta>Ver en el mapa</Etiqueta>
                <Segmentado ancho>
                  <Opcion
                    activo={filtros.fisica === "todas"}
                    onClick={() => set({ fisica: "todas" })}
                  >
                    Todas
                  </Opcion>
                  <Opcion
                    activo={filtros.fisica === "encuestadas"}
                    onClick={() => set({ fisica: "encuestadas" })}
                  >
                    Visitadas
                  </Opcion>
                  <Opcion
                    activo={filtros.fisica === "no_encuestadas"}
                    onClick={() => set({ fisica: "no_encuestadas" })}
                  >
                    Nunca visitadas
                  </Opcion>
                </Segmentado>

                {/* El indice solo aparece sobre las visitadas, porque es el
                    unico estado donde todas las sedes en juego lo tienen. El
                    promedio se calcula sobre `base`, la seleccion sin los
                    botones de esta tarjeta: si se calculara sobre lo filtrado,
                    marcar un nivel devolveria el nivel que se acaba de elegir. */}
                {filtros.fisica === "encuestadas" && base.ividN > 0 && (
                  <div
                    className="mt-3 rounded px-3 py-2"
                    style={{ background: "var(--plano)" }}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="num text-3xl font-semibold leading-none">
                        {base.ividMedia.toFixed(2).replace(".", ",")}
                      </span>
                      <span className="text-xs" style={{ color: "var(--tinta-2)" }}>
                        índice de vulnerabilidad declarada
                      </span>
                      <Info texto={FICHA_IVID} ancho />
                    </div>
                    <div className="mt-1 text-xs" style={{ color: "var(--tinta-2)" }}>
                      De 0 a 5, promedio de{" "}
                      <span className="num">{miles(base.ividN)}</span>{" "}
                      {base.ividN === 1 ? "sede visitada" : "sedes visitadas"} en
                      2021 y 2022.
                    </div>

                    {/* La misma forma que la lista de bandas de intensidad:
                        casilla, rotulo y a la derecha el dato que ayuda a
                        decidir. Alla es que significa esa banda; aca, cuantas
                        sedes recorta el nivel. */}
                    <div className="mt-2 flex gap-3 text-[10px]">
                      <button
                        onClick={() => set({ ividCategorias: [0, 1, 2, 3, 4] })}
                        className="underline"
                        style={{ color: "var(--tinta-3)" }}
                      >
                        Seleccionar todos
                      </button>
                      <button
                        onClick={() => set({ ividCategorias: [] })}
                        className="underline"
                        style={{ color: "var(--tinta-3)" }}
                      >
                        Quitar todos
                      </button>
                    </div>
                    {[0, 1, 2, 3, 4].map((c) => {
                      const on = filtros.ividCategorias.includes(c);
                      return (
                        <button
                          key={c}
                          onClick={() =>
                            set({
                              ividCategorias: alterna(filtros.ividCategorias, c),
                            })
                          }
                          className="flex w-full items-center gap-2 py-1 text-xs"
                        >
                          <span
                            className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border text-[9px] leading-none"
                            style={{
                              borderColor: on ? "var(--tinta)" : "var(--linea)",
                              background: on ? "var(--tinta)" : "transparent",
                              color: "var(--superficie)",
                            }}
                          >
                            {on ? "✓" : ""}
                          </span>
                          <span
                            className="inline-block h-3 w-5 shrink-0 rounded-sm"
                            style={{
                              background: TONO_IVID[c],
                              opacity: on ? 1 : 0.35,
                            }}
                          />
                          {/* El rotulo es el tramo del propio indice, como la
                              lista de intensidad rotula "MMI 6,5" con el valor
                              de la banda. No hace falta explicar que significa
                              el numero: es el mismo que muestra la ficha. */}
                          <span
                            className="num truncate text-left"
                            style={{ color: "var(--tinta-2)" }}
                          >
                            {NOMBRE_IVID[c]}
                          </span>
                          <span
                            className="num ml-auto text-[10px]"
                            style={{ color: "var(--tinta-3)" }}
                          >
                            {miles(base.ividPorCategoria[c])}
                          </span>
                        </button>
                      );
                    })}
                    <p
                      className="pt-1 text-[10px] leading-relaxed"
                      style={{ color: "var(--tinta-3)" }}
                    >
                      Abriendo una sede se ven los tres componentes del puntaje y
                      si su daño es deterioro o compromiso estructural.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                <p
                  className="mb-2 text-xs leading-relaxed"
                  style={{ color: "var(--tinta-2)" }}
                >
                  El formulario C-600 del DANE recoge cada año información
                  administrativa de las sedes educativas del país. El registro de
                  2024 dice cuáles contaban con energía eléctrica y con conexión a
                  internet antes del sismo.
                  <Info texto="Las sedes que no reportaron al C-600 de 2024 no se cuentan en ninguno de los dos grupos. No reportar no es lo mismo que no tener el servicio, y contar la ausencia de reporte como carencia inflaría la cifra." />
                </p>

                <p
                  className="mb-3 text-xs leading-relaxed"
                  style={{ color: "var(--tinta-2)" }}
                >
                  De las{" "}
                  <span className="num font-semibold">{miles(base.sedes)}</span>{" "}
                  sedes seleccionadas,{" "}
                  <span className="num font-semibold">
                    {miles(base.sinEnergia)}
                  </span>{" "}
                  ya estaban sin electricidad, con{" "}
                  <span className="num">{miles(base.matriculaSinEnergia)}</span>{" "}
                  estudiantes, y{" "}
                  <span className="num font-semibold">
                    {miles(base.sinInternet)}
                  </span>{" "}
                  sin internet, con{" "}
                  <span className="num">{miles(base.matriculaSinInternet)}</span>{" "}
                  estudiantes.
                </p>

                <Etiqueta>Ver en el mapa</Etiqueta>
                <Fila etiqueta="Electricidad">
                  <Segmentado ancho>
                    <Opcion
                      activo={filtros.energia === "todas"}
                      onClick={() => set({ energia: "todas" })}
                    >
                      Todas
                    </Opcion>
                    <Opcion
                      activo={filtros.energia === "con"}
                      onClick={() => set({ energia: "con" })}
                    >
                      Con
                    </Opcion>
                    <Opcion
                      activo={filtros.energia === "sin"}
                      onClick={() => set({ energia: "sin" })}
                    >
                      Sin
                    </Opcion>
                  </Segmentado>
                </Fila>

                <Fila etiqueta="Internet">
                  <Segmentado ancho>
                    <Opcion
                      activo={filtros.internet === "todas"}
                      onClick={() => set({ internet: "todas" })}
                    >
                      Todas
                    </Opcion>
                    <Opcion
                      activo={filtros.internet === "con"}
                      onClick={() => set({ internet: "con" })}
                    >
                      Con
                    </Opcion>
                    <Opcion
                      activo={filtros.internet === "sin"}
                      onClick={() => set({ internet: "sin" })}
                    >
                      Sin
                    </Opcion>
                  </Segmentado>
                </Fila>
              </>
            )}

          </div>
        </>
      )}
    </Tarjeta>
  );
}

// ------------------------------------------------------------- piezas --

function Encabezado({
  titulo,
  abierta,
  onAlternar,
}: {
  titulo: string;
  abierta: boolean;
  onAlternar: () => void;
}) {
  return (
    <button
      onClick={onAlternar}
      className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium"
    >
      <span>{titulo}</span>
      <span style={{ color: "var(--tinta-3)" }}>{abierta ? "▾" : "▸"}</span>
    </button>
  );
}

function FilaCapa({
  nombre,
  nota,
  ayuda,
  fuente,
  activa,
  onAlternar,
  muestra,
  plegada,
  onPlegar,
}: {
  nombre: string;
  nota?: string;
  ayuda?: string;
  fuente?: { texto: string; url: string };
  activa: boolean;
  onAlternar: () => void;
  muestra?: React.ReactNode;
  plegada?: boolean;
  onPlegar?: () => void;
}) {
  return (
    <>
      <div
        className="flex items-center gap-2 px-4 py-1.5 text-xs"
        style={{ opacity: activa ? 1 : 0.45 }}
      >
        {onPlegar ? (
          <button
            onClick={onPlegar}
            className="w-3 shrink-0"
            style={{ color: "var(--tinta-3)" }}
            aria-label={plegada ? "desplegar" : "plegar"}
          >
            {plegada ? "▸" : "▾"}
          </button>
        ) : (
          <span className="w-3 shrink-0">{muestra}</span>
        )}
        <span className="min-w-0 flex-1 truncate">
          {nombre}
          {nota && (
            <span style={{ color: "var(--tinta-3)" }}> ({nota})</span>
          )}
        </span>
        {/* Con caret la muestra de color pasa a la derecha, porque el hueco de
            la izquierda ya lo ocupa el caret. Meterla al lado del nombre
            correria el rotulo de esa fila y las tres del panel dejarian de
            arrancar en la misma columna, que es justo lo que las hace leerse al
            mismo nivel. */}
        {onPlegar && muestra && <span className="shrink-0">{muestra}</span>}
        {ayuda && <Info texto={ayuda} fuente={fuente} />}
        <button
          onClick={onAlternar}
          aria-label={activa ? "ocultar en el mapa" : "mostrar en el mapa"}
          title={activa ? "ocultar en el mapa" : "mostrar en el mapa"}
          style={{ color: "var(--tinta-3)" }}
        >
          {activa ? "◉" : "○"}
        </button>
      </div>
    </>
  );
}

function Etiqueta({
  children,
  oracion,
}: {
  children: React.ReactNode;
  /** Deja el rotulo tal cual se escribio, sin volverlo versalita. Las etiquetas
   *  de una o dos palabras se leen bien en mayuscula; una frase entera, no. */
  oracion?: boolean;
}) {
  return (
    <div
      className={
        "mb-1 text-[10px] font-medium tracking-wide" +
        (oracion ? "" : " uppercase")
      }
      style={{ color: "var(--tinta-3)" }}
    >
      {children}
    </div>
  );
}

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 grid grid-cols-[76px_1fr] items-center gap-2">
      <div
        className="text-[10px] font-medium uppercase tracking-wide"
        style={{ color: "var(--tinta-3)" }}
      >
        {etiqueta}
      </div>
      <div>{children}</div>
    </div>
  );
}

/** Botones sueltos que bajan de línea. El grupo pegado no sirve para Área: sus
 * cuatro opciones no caben en el ancho de la tarjeta y se salían de la caja. */
function Chips({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1">{children}</div>;
}

function Segmentado({
  children,
  ancho,
}: {
  children: React.ReactNode;
  ancho?: boolean;
}) {
  return (
    <div
      className={`inline-flex overflow-hidden rounded border ${ancho ? "w-full" : ""}`}
      style={{ borderColor: "var(--linea)" }}
    >
      {children}
    </div>
  );
}

function Opcion({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 whitespace-nowrap rounded border px-2 py-1 text-[11px]"
      style={{
        borderColor: activo ? "var(--acento)" : "var(--linea)",
        background: activo ? "var(--plano)" : "transparent",
        color: activo ? "var(--acento)" : "var(--tinta-2)",
        fontWeight: activo ? 600 : 400,
      }}
    >
      {children}
    </button>
  );
}

function Desplegable({
  opciones,
  elegidas,
  onAlternar,
  onLimpiar,
}: {
  opciones: string[];
  elegidas: string[];
  onAlternar: (v: string) => void;
  onLimpiar: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busca, setBusca] = useState("");
  const visibles = opciones.filter((o) =>
    o.toLowerCase().includes(busca.toLowerCase()),
  );

  return (
    <div className="relative">
      <button
        onClick={() => setAbierto(!abierto)}
        className="flex w-full items-center justify-between rounded border px-2 py-1 text-[11px]"
        style={{ borderColor: "var(--linea)", background: "var(--superficie)" }}
      >
        <span style={{ color: elegidas.length ? "var(--acento)" : "var(--tinta-2)" }}>
          {elegidas.length === 0
            ? "Todas"
            : elegidas.length === 1
              ? elegidas[0]
              : `${elegidas.length} secretarías`}
        </span>
        <span style={{ color: "var(--tinta-3)" }}>{abierto ? "▲" : "▼"}</span>
      </button>

      {abierto && (
        <div
          className="absolute z-20 mt-1 w-full rounded border shadow-lg"
          style={{ background: "var(--superficie)", borderColor: "var(--borde)" }}
        >
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar"
            className="w-full border-b px-2 py-1.5 text-xs"
            style={{ borderColor: "var(--linea)", background: "transparent" }}
          />
          <div className="max-h-48 overflow-y-auto p-1">
            {visibles.map((o) => (
              <label
                key={o}
                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs"
              >
                <input
                  type="checkbox"
                  checked={elegidas.includes(o)}
                  onChange={() => onAlternar(o)}
                />
                <span>{o}</span>
              </label>
            ))}
            {!visibles.length && (
              <p className="px-1.5 py-2 text-xs" style={{ color: "var(--tinta-3)" }}>
                Nada coincide
              </p>
            )}
          </div>
          <div
            className="flex justify-between border-t px-2 py-1.5 text-xs"
            style={{ borderColor: "var(--linea)" }}
          >
            <button
              onClick={onLimpiar}
              className="underline"
              style={{ color: "var(--tinta-2)" }}
            >
              Limpiar
            </button>
            <button
              onClick={() => setAbierto(false)}
              className="underline"
              style={{ color: "var(--tinta-2)" }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


function Mini({ n, matricula, texto }: { n: number; matricula: number; texto: string }) {
  return (
    <div>
      <div
        className="num text-lg font-semibold leading-none"
        style={{ color: n ? "var(--sede-ignota)" : "var(--tinta-3)" }}
      >
        {miles(n)}
      </div>
      <div className="text-xs" style={{ color: "var(--tinta-2)" }}>
        {texto}
      </div>
      <div className="num text-[10px]" style={{ color: "var(--tinta-3)" }}>
        {miles(matricula)} estudiantes
      </div>
    </div>
  );
}

/** La silueta del pin de sede, en chiquito, para la fila de la capa. */
function Gota({ color }: { color: string }) {
  return (
    <svg width="9" height="12" viewBox="0 0 26 34" aria-hidden="true">
      <path
        d="M13 1.2 C7.6 1.2 3.4 5.4 3.4 10.6 C3.4 17.2 13 26 13 26 C13 26 22.6 17.2 22.6 10.6 C22.6 5.4 18.4 1.2 13 1.2 Z"
        fill={color}
      />
    </svg>
  );
}

/** Una casilla de estado: nombre, cuántas sedes y si está prendida.
 *
 *  Llevaba un punto gris a la izquierda, relleno o hueco segun el estado
 *  afirmara daño o no. Se quito: el punto usaba `--tinta-2` para las cuatro
 *  casillas, o sea el mismo gris, asi que no distinguia nada por color, y al
 *  ponerse al 40 % de opacidad en las apagadas quedaba igual que un radio
 *  button desactivado. La casilla ya dice si esta prendida con el borde, el
 *  fondo y el color del texto, que son tres señales; el punto era una cuarta
 *  que contradecia a las otras.
 */
function Casilla({
  activa, onAlternar, nombre, n, nota, onDesglose, desglosado,
}: {
  activa: boolean;
  onAlternar: () => void;
  nombre: string;
  n: number;
  nota: string;
  /** Si esta casilla abre un desglose más fino. Lo usan "Colapso" y "Con
   *  daño", que son los dos estados que el MEN precisa. */
  onDesglose?: () => void;
  desglosado?: boolean;
}) {
  // El chevron va en la misma fila pero como botón aparte. Anidar botones no es
  // HTML válido y el navegador se queda con el de fuera, así que tocar el
  // desglose habría apagado la casilla entera.
  //
  // Casilla de verdad y no una píldora, desde el 21 de agosto de 2026. La
  // píldora dice "esto es una etiqueta que se puede encender" y estas cuatro
  // filas son lo contrario: un filtro que arranca con dos de cuatro marcadas y
  // que decide qué dibuja el mapa. Puestas en columna se veía mejor el problema,
  // porque cada píldora medía lo que medía su texto y los números quedaban en
  // cuatro columnas distintas. Con la casilla y el número al final de la fila,
  // los cuatro se leen uno debajo del otro, que es como se compara.
  //
  // El visto es el mismo cuadrado de 3,5 que usan las bandas de intensidad en la
  // columna izquierda. Es el mismo tipo de decisión y tiene que verse igual.
  return (
    <span className="flex w-full items-center text-[11px]">
      <button
        onClick={onAlternar}
        title={nota}
        aria-pressed={activa}
        className="flex min-w-0 flex-1 items-center gap-2 py-0.5 text-left"
      >
        <span
          className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border text-[9px] leading-none"
          style={{
            borderColor: activa ? "var(--tinta)" : "var(--linea)",
            background: activa ? "var(--tinta)" : "transparent",
            color: "var(--superficie)",
          }}
        >
          {activa ? "✓" : ""}
        </span>
        <span
          className="min-w-0 flex-1 truncate"
          style={{ color: activa ? "var(--tinta)" : "var(--tinta-3)" }}
        >
          {nombre}
        </span>
        <span className="num shrink-0" style={{ color: "var(--tinta-3)" }}>
          {miles(n)}
        </span>
      </button>
      {/* El hueco del caret se reserva siempre, tenga desglose o no. Sin eso los
          números de las filas con caret quedaban 12 px a la izquierda de los de
          las que no lo tienen, y la columna que se acaba de conseguir se
          rompía en la mitad de la lista. */}
      {onDesglose ? (
        <button
          onClick={onDesglose}
          className="w-3 shrink-0"
          style={{ color: "var(--tinta-3)" }}
          aria-expanded={desglosado}
          aria-label={desglosado
            ? `plegar el desglose de ${nombre.toLowerCase()}`
            : `abrir el desglose de ${nombre.toLowerCase()}`}
          title={desglosado
            ? "plegar el desglose"
            : "separar por la clasificación del MEN"}
        >
          {desglosado ? "▾" : "▸"}
        </button>
      ) : (
        <span className="w-3 shrink-0" />
      )}
    </span>
  );
}
