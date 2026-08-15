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

import { MarcaGitHub } from "@/components/Iconos";
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
  horaLocal,
  miles,
} from "@/lib/datos";
import type { Resumen } from "@/lib/datos";
import {
  BANDAS,
  EXPLICACION_MMI,
  FUENTE_MMI,
  GRAVEDAD,
  NOMBRE_EMISOR,
  NOMBRE_ESTADO,
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
  MetaMen,
  Reporte,
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
        <TarjetaEvento {...p} />
        <TarjetaDanos {...p} />
        <TarjetaCapas {...p} />
        <TarjetaCaracteristicas {...p} />
      </div>
    </div>
  );
}

/** Cuántas sedes de una fuente se listan sin desplazamiento. Pasado ese número
 *  la lista se desplaza por dentro: son tres fuentes en la misma tarjeta y una
 *  con doce sedes empujaría las otras dos fuera de la pantalla. */
const MAX_FILAS_VISIBLES = 4;

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

function TarjetaDanos({
  capas,
  onCapas,
  filtros,
  reportes,
  danos,
  danosFuera,
  metaMen,
  edicionMen,
  onIrASede,
}: Props) {
  // Recogida al abrir: la primera pantalla tiene que dejar ver el mapa, y quien
  // llega buscando los reportes los despliega de un clic.
  const [abierta, setAbierta] = useState(false);
  // El desglose de colapso abre plegado. La distinción entre parcial y total
  // importa para decidir a dónde ir primero, pero son 120 sedes contra mil de
  // daño: desplegada por defecto, el filtro más fino de la pantalla ocuparía
  // el mismo espacio que el más grueso y la tarjeta se leería densa.
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

  const sedesEnAmbosOficiales = (() => {
    const men = new Set(porEmisor("MEN").map((d) => d.dane));
    return porEmisor("BID").filter((d) => men.has(d.dane)).length;
  })();

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
  const sedesConReporte = peores.filter((d) => marcado(d.estado)).length;
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
  // agrupa, para que el desglose sume exactamente lo que dice su casilla.
  const nPorSubtipo = (t: string) =>
    peores.filter((d) => (d.subtipo ?? "") === t).length;
  const subtipoMarcado = (t: string) => capas.subtipos.includes(t);
  const alternaSubtipo = (estado: EstadoDano, t: string) => {
    const prendido = subtipoMarcado(t);
    const resto = capas.subtipos.filter((x) => x !== t);
    // No se puede apagar el último de un estado: sin ningún subtipo encendido su
    // casilla quedaría marcada y sin pintar nada, que se lee como un error del
    // mapa y no como un filtro. Apagar el estado entero es lo que hace la
    // casilla de arriba, y ya existe.
    const hermanos = SUBTIPOS_POR_ESTADO[estado] ?? [];
    if (prendido && !hermanos.some((h) => h !== t && resto.includes(h))) return;
    onCapas({ ...capas, subtipos: prendido ? resto : [...resto, t] });
  };
  const nDano = peores.filter((d) => d.estado === "dano").length;
  const nSinDano = peores.filter((d) => d.estado === "sin_dano").length;
  const nSinVerificar = peores.filter(
    (d) => d.estado === "sin_verificar").length;

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
  const fueraDeBanda = peoresTodos.filter(
    (d) => marcado(d.estado)
      && (d.banda == null || !filtros.bandas.includes(d.banda)),
  ).length;
  const todasLasBandas = capas.danosTodasLasBandas;

  return (
    <Tarjeta>
      <div className="flex items-center gap-2 px-4 py-2.5">
        <button
          onClick={() => setAbierta(!abierta)}
          className="flex flex-1 items-center gap-2 text-left text-sm font-medium"
        >
          {/* Tres puntos y no uno: el encabezado ya dice que aqui hay tres
              emisores distintos, antes de desplegar nada. */}
          <span className="flex shrink-0 gap-0.5">
            {(["hot", "oficial", "noticia"] as FuenteDano[]).map((f) => (
              <span
                key={f}
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: COLOR_FUENTE[f] }}
              />
            ))}
          </span>
          <span>Daños Reportados en Sedes Educativas (SE)</span>
          <span className="num text-xs" style={{ color: "var(--tinta-3)" }}>
            ({miles(sedesConReporte)})
          </span>
        </button>
        <button
          onClick={() => onCapas({ ...capas, reportes: !capas.reportes })}
          aria-label={capas.reportes ? "ocultar en el mapa" : "mostrar en el mapa"}
          title={capas.reportes ? "ocultar en el mapa" : "mostrar en el mapa"}
          style={{ color: "var(--tinta-3)" }}
        >
          {capas.reportes ? "◉" : "○"}
        </button>
        <button
          onClick={() => setAbierta(!abierta)}
          style={{ color: "var(--tinta-3)" }}
          aria-label={abierta ? "plegar" : "desplegar"}
        >
          {abierta ? "▾" : "▸"}
        </button>
      </div>

      {/* Las cuatro casillas van fuera del plegado: son el filtro de la capa y
          tienen que poder tocarse sin desplegar la tarjeta entera.

          El colapso tiene casilla propia y no va sumado a "con daño". Son la
          misma escala pero no la misma pregunta: quien reparte cuadrillas
          busca los edificios caidos y no quiere leerlos mezclados con las 112
          filas que hablan de grietas. Van en orden de gravedad, que es el
          orden en que hay que ir a mirar. */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2">
        <Casilla
          activa={marcado("colapso")}
          onAlternar={() => alternar(["colapso"])}
          nombre="Colapso"
          n={nColapso}
          nota="la fuente afirma que la edificación se vino abajo, entera o en parte"
          onDesglose={() =>
            setDesglosado(desglosado === "colapso" ? null : "colapso")}
          desglosado={desglosado === "colapso"}
        />
        <Casilla
          activa={marcado("dano")}
          onAlternar={() => alternar(["dano"])}
          nombre="Con daño"
          n={nDano}
          nota="daño declarado por alguna de las fuentes, sin llegar a colapso"
          onDesglose={() => setDesglosado(desglosado === "dano" ? null : "dano")}
          desglosado={desglosado === "dano"}
        />
        <Casilla
          activa={marcado("sin_dano")}
          onAlternar={() => alternar(["sin_dano"])}
          nombre="Sin daño"
          n={nSinDano}
          nota="alguien fue a mirar y no encontró afectación. No es lo mismo que no tener reporte."
        />
        <Casilla
          activa={marcado("sin_verificar")}
          onAlternar={() => alternar(["sin_verificar"])}
          nombre="Sin verificar"
          n={nSinVerificar}
          nota="hay una foto emparejada con la sede, pero nadie ha evaluado el edificio"
        />
        {inspeccionadas && (
          <span className="num text-[11px]" style={{ color: "var(--tinta-3)" }}>
            {inspeccionadas}
          </span>
        )}
      </div>

      <AvisoMen edicion={edicionMen} />

      {/* El desglose de la casilla abierta. Sangrado y en tono apagado: es un
          filtro dentro de otro, y tiene que leerse como una rama de la casilla
          de arriba y no como una casilla más al mismo nivel.

          Solo uno a la vez. Con los dos desplegados son ocho pastillas en dos
          filas debajo de cuatro, y la tarjeta deja de leerse: quien abre el
          desglose de daño está mirando el daño, no las dos cosas.

          "Sin especificar" no es un descarte ni una categoría floja: son los
          reportes de prensa y del PTIES, que afirman colapso o daño y no
          precisan más. Solo el MEN precisa. Sin esa pastilla, abrir el desglose
          habría borrado del mapa esos casos sin que nadie lo pidiera. */}
      {desglosado && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2 pl-8">
          {(SUBTIPOS_POR_ESTADO[desglosado] ?? []).map((t) => (
            <Casilla
              key={t}
              activa={marcado(desglosado) && subtipoMarcado(t)}
              onAlternar={() => alternaSubtipo(desglosado, t)}
              nombre={NOMBRE_SUBTIPO[t]}
              n={nPorSubtipo(t)}
              nota={t.endsWith("_sd")
                ? "la fuente lo afirma sin precisar más. Solo el MEN hace esta distinción."
                : `el MEN clasifica la sede como ${NOMBRE_SUBTIPO[t]}`}
            />
          ))}
        </div>
      )}

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
            desglose={(["MEN", "BID"] as EmisorDano[]).map((e) => ({
              clave: e,
              nombre: NOMBRE_EMISOR[e] ?? e,
              sedes: sedesDe(porEmisor(e)),
              matricula: matriculaDe(porEmisor(e)),
            }))}
            // Sin esto los dos emisores suman más que el total de la tarjeta y
            // no hay dónde leer por qué. Son las sedes que reportan los dos, y
            // en la tarjeta se cuentan una sola vez.
            solape={sedesEnAmbosOficiales}
            nota="Dos emisores. El MEN publica una capa con el estado físico sede por sede y el código DANE ya puesto; ese estado sale de una encuesta a rectores que no es exhaustiva, así que una sede sin reporte no es una sede sin daño. El BID aporta el reporte del equipo PTIES con corte al 10 de agosto, que nombra instituciones y cuyas sedes se resolvieron una por una."
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
          {desglose.filter((x) => x.sedes > 0).map((x) => (
            <span
              key={x.clave}
              className="num text-[11px]"
              style={{ color: "var(--tinta-3)" }}
            >
              <span className="font-medium">{x.clave}</span>{" "}
              {miles(x.sedes)} {x.sedes === 1 ? "sede" : "sedes"}
              {" · "}
              {miles(x.matricula)}{" "}
              {x.matricula === 1 ? "estudiante" : "estudiantes"}
            </span>
          ))}
          {solape != null && solape > 0 && (
            <span className="text-[11px]" style={{ color: "var(--tinta-3)" }}>
              <span className="num">{miles(solape)}</span>{" "}
              {solape === 1
                ? "sede la reportan los dos, y arriba cuenta una vez"
                : "sedes las reportan los dos, y arriba cuentan una vez"}
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

/** La etiqueta del estado. Va del color de la fuente para no abrir un cuarto
 *  canal de color, y el "sin daño" va hueco porque no es una alerta. */
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
}: Props) {
  const [abierta, setAbierta] = useState(true);
  const [intensidadAbierta, setIntensidadAbierta] = useState(true);
  const [masFiltros, setMasFiltros] = useState(false);
  const set = (p: Partial<Filtros>) => onFiltros({ ...filtros, ...p });
  const alternaLista = (lista: string[], v: string) =>
    lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v];

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
        titulo="Capas"
        abierta={abierta}
        onAlternar={() => setAbierta(!abierta)}
      />
      {abierta && (
        <div className="pb-2">
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
              <p
                className="px-4 pt-1 pl-8 text-[10px] leading-relaxed"
                style={{ color: "var(--tinta-3)" }}
              >
                El mapa pinta qué tan fuerte se sintió el sismo en cada zona y
                muestra las sedes educativas que quedaron dentro.
                Encender una banda decide las dos cosas a la vez: la mancha del
                mapa y las sedes que se cuentan. La línea punteada marca hasta
                dónde llega la grilla del USGS, no hasta dónde llegó el temblor.
              </p>
            </div>
          )}

          <FilaCapa
            nombre="Sedes educativas"
            activa={capas.sedes}
            onAlternar={() => onCapas({ ...capas, sedes: !capas.sedes })}
            muestra={<Gota color="var(--sede-base)" />}
          />

          {/* Los filtros de la sede cuelgan de su propia capa. Antes vivian en
              una tarjeta aparte y quedaba sin decir que recortan exactamente
              esos puntos y ningun otro. */}
          <div className="px-4 pt-1 pb-2 pl-8">
            <Etiqueta>Secretaría</Etiqueta>
            <div className="mb-2">
              <Desplegable
                opciones={secretarias}
                elegidas={filtros.secretarias}
                onAlternar={(v) =>
                  set({ secretarias: alternaLista(filtros.secretarias, v) })
                }
                onLimpiar={() => set({ secretarias: [] })}
              />
            </div>

            <button
              onClick={() => setMasFiltros(!masFiltros)}
              className="text-xs underline"
              style={{ color: "var(--tinta-2)" }}
            >
              {masFiltros ? "Menos filtros" : "Más filtros"}
            </button>

            {masFiltros && (
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
                        onClick={() => set({ zonas: alternaLista(filtros.zonas, z) })}
                      >
                        {NOMBRE_ZONA[z] ?? z}
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
              </div>
            )}
          </div>

          <FilaCapa
            nombre="Huellas de edificio"
            nota="desde el zoom 15"
            activa={capas.huellas}
            onAlternar={() => onCapas({ ...capas, huellas: !capas.huellas })}
          />
        </div>
      )}
    </Tarjeta>
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

function Tarjeta({
  children,
  estilo,
}: {
  children: React.ReactNode;
  /** Permite redefinir variables de color para una tarjeta sola. Se usa para
   *  cambiar el acento sin tocar el de las demas, que comparten componentes. */
  estilo?: React.CSSProperties;
}) {
  return (
    <section
      className="rounded-lg border shadow-md"
      style={{
        background: "var(--superficie)",
        borderColor: "var(--borde)",
        ...estilo,
      }}
    >
      {children}
    </section>
  );
}

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

/** Un botón de información, que despliega su texto al pasar por encima.
 *
 * La explicación vive detrás del botón y no en la tarjeta porque es una nota al
 * pie: quien ya sabe por qué el epicentro no es el punto más sacudido no
 * necesita leerla cada vez que abre el visor.
 *
 * La nota se posiciona con coordenadas medidas del botón y no con `absolute`
 * dentro de la tarjeta. La columna de tarjetas tiene desplazamiento vertical, y
 * eso recorta cualquier cosa que se salga de sus 360 px: la nota aparecía
 * cortada por la mitad.
 */
function Info({
  texto,
  fuente,
  tono,
  ancho,
}: {
  texto: string;
  fuente?: { texto: string; url: string };
  /** Color del boton. Por defecto es el gris de nota al pie. Solo lo cambia el
   *  boton del titulo, que no explica un dato sino la plataforma entera. */
  tono?: string;
  /** Caja mas ancha y con parrafos. La usa la ficha tecnica del indice, que no
   *  es una nota al pie sino la definicion completa de como se construyo. */
  ancho?: boolean;
}) {
  // Dos estados y no uno: el clic deja la nota fija y el puntero solo la asoma.
  // Con una sola bandera, mover el mouse encima para hacer clic la abría y el
  // clic la volvía a cerrar en el mismo gesto.
  const [encima, setEncima] = useState(false);
  const [fijado, setFijado] = useState(false);
  const [caja, setCaja] = useState<
    { top: number; left: number; alto: number } | null
  >(null);
  const boton = useRef<HTMLButtonElement>(null);
  const abierto = encima || fijado;

  /** Coloca la nota dentro de la ventana, por los cuatro lados.
   *
   * Antes solo se cuidaba el borde derecho y la ficha tecnica, que es larga, se
   * salia por abajo: la caja se desplaza sola por dentro, pero la parte que
   * quedaba fuera de la pantalla no habia forma de alcanzarla. Ahora se calcula
   * el alto disponible y, si debajo del boton no cabe, la caja sube.
   */
  function ubica() {
    const r = boton.current?.getBoundingClientRect();
    if (!r) return;
    const MARGEN = 8;
    const w = ancho ? 384 : 288;
    const izq = Math.min(
      Math.max(MARGEN, r.left - 120),
      window.innerWidth - w - MARGEN,
    );
    const alto = Math.min(
      ancho ? 520 : 360,
      window.innerHeight - MARGEN * 2,
    );
    let top = r.bottom + 6;
    if (top + alto > window.innerHeight - MARGEN) {
      top = Math.max(MARGEN, window.innerHeight - alto - MARGEN);
    }
    setCaja({ top, left: Math.max(MARGEN, izq), alto });
  }

  return (
    <span className="ml-1 inline-block align-middle">
      <button
        ref={boton}
        onMouseEnter={() => {
          ubica();
          setEncima(true);
        }}
        onMouseLeave={() => setEncima(false)}
        onClick={() => {
          ubica();
          setFijado(!fijado);
        }}
        aria-label="Qué significa esto"
        className="rounded-full border px-1.5 text-[9px] leading-4"
        style={{
          borderColor: tono ?? "var(--linea)",
          color: tono ?? "var(--tinta-3)",
        }}
      >
        i
      </button>
      {abierto && caja && (
        <span
          className={
            "fixed z-50 block rounded border px-3 py-2 text-[11px] leading-relaxed shadow-lg " +
            (ancho ? "w-96 overflow-y-auto whitespace-pre-line" : "w-72")
          }
          style={{
            top: caja.top,
            left: caja.left,
            // El alto lo decide `ubica` con la ventana en la mano, no una
            // fraccion fija: con `70vh` la caja cabia en la pantalla pero
            // empezaba tan abajo que su final quedaba fuera.
            maxHeight: ancho ? caja.alto : undefined,
            background: "var(--superficie)",
            borderColor: "var(--borde)",
            color: "var(--tinta-2)",
            fontWeight: 400,
          }}
        >
          {texto}
          {fuente && (
            <>
              {" "}
              <a
                href={fuente.url}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {fuente.texto}
              </a>
              .
            </>
          )}
        </span>
      )}
    </span>
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
  // El chevron va dentro de la misma píldora pero como botón aparte. Anidar
  // botones no es HTML válido y el navegador se queda con el de fuera, así que
  // tocar el desglose habría apagado la casilla entera.
  return (
    <span
      className="flex items-center rounded-full border text-[11px]"
      style={{
        borderColor: activa ? "var(--acento)" : "var(--linea)",
        color: activa ? "var(--tinta)" : "var(--tinta-3)",
        background: activa ? "var(--plano)" : "transparent",
      }}
    >
      <button
        onClick={onAlternar}
        title={nota}
        aria-pressed={activa}
        className={`flex items-center gap-1.5 py-0.5 pl-2.5 ${
          onDesglose ? "pr-1" : "pr-2.5"}`}
      >
        {nombre}
        <span className="num" style={{ color: "var(--tinta-3)" }}>
          {miles(n)}
        </span>
      </button>
      {onDesglose && (
        <button
          onClick={onDesglose}
          className="py-0.5 pl-0.5 pr-1.5"
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
      )}
    </span>
  );
}
