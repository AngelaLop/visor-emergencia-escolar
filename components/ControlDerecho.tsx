"use client";

/** El control de las cifras.
 *
 * En pantalla ancha va arriba a la derecha, en columna: equilibra la columna de
 * tarjetas de la izquierda y deja a la vista las dos cifras que alguien lee de
 * reojo mientras habla.
 *
 * En el teléfono va como barra angosta arriba, con las dos cifras en una sola
 * línea. Ahí lo escaso es el alto, no el ancho, y una tarjeta apilada se comería
 * el mapa.
 */

import { useState } from "react";

import { PinSede } from "@/components/Iconos";
import { Info } from "@/components/Piezas";
import { miles } from "@/lib/datos";
import type { Resumen } from "@/lib/datos";
import { MAPAS_BASE } from "@/lib/tipos";
import type { MapaBase } from "@/lib/tipos";

type Props = {
  resumen: Resumen;
  /** Cuántas de las sedes contadas tienen daño reportado.
   *
   * Va debajo del número grande y no en otra tarjeta porque es la lectura que
   * le falta: el número de arriba dice cuántas escuelas caben en el recorte de
   * la pantalla, y sin esta línea no había forma de saber cuántas de ellas son
   * las que hay que ir a mirar. Se nota sobre todo trabajando con una sola
   * secretaría, que es cuando las dos cifras se pueden leer de un vistazo. */
  conDano: number;
  /** Cuántas sedes con daño dibuja el mapa que no están en la selección.
   *
   * Es la diferencia entre esta cifra y la del encabezado de la tarjeta de
   * daños, y hay que poder leerla: dos números distintos para lo que parece la
   * misma pregunta, en dos esquinas de la misma pantalla, hacen desconfiar de
   * las dos. Son sedes con reporte que no están en el marco que exporta el
   * script 23, y el mapa las dibuja igual porque una fuente afirmando que una
   * escuela se cayó no depende de que nuestro marco la tenga. */
  conDanoFuera: number;
  /** Si el mapa está mostrando solo las instituciones con daño reportado, o sea
   *  con la capa de sedes apagada y la de reportes prendida. Cambia qué se está
   *  contando, y por eso tiene que cambiar también el rótulo. */
  soloDanos: boolean;
  /** Si el recorte de la pantalla es de instituciones de educación superior.
   *
   * Cambia el rótulo y lo que se cuenta debajo del número: programas vigentes
   * en vez de estudiantes. Sin esto, con educación superior marcada el panel
   * seguía diciendo "sedes educativas seleccionadas" y el número era cero,
   * porque `pasaNivel` deja fuera a todas las escuelas. */
  modoIes: boolean;
  /** Las sedes con daño que no se pueden dibujar porque nadie tiene su punto.
   *
   * No están filtradas: ninguna fuente sabe dónde quedan, ni el SIMAT de 2022,
   * ni el directorio del MEN de 2026, ni la capa del Ministerio. Sin coordenada
   * no hay punto, así que quedan fuera del mapa y del número grande.
   *
   * Se dicen en pantalla porque callarlas convierte el contador en una
   * afirmación falsa: quien lo lee entiende "estas son todas". */
  sinCoordenada: { sedes: number; matricula: number };
  /** El tramo resaltado desde la tarjeta de características, si hay uno.
   *
   * El resalte no recorta el mapa: allí las demás sedes siguen dibujadas, en
   * gris, porque la pregunta que contesta es cuáles de estas cumplen la
   * condición y para contestarla hay que ver las otras. Pero sí tiene que llegar
   * hasta aquí, porque es el recorte con el que alguien quiere bajarse el CSV, y
   * un botón que dice "descargar la selección" tiene que decir cuál.
   *
   * Por eso se muestra como una línea aparte y no reemplazando el número grande:
   * el número grande cuenta lo que hay en el mapa y tiene que seguir haciéndolo.
   * Las dos cifras conviven escritas, y así ninguna de las dos miente. */
  resalte: { n: number; etiqueta: string } | null;
  onExportar: () => void;
  /** Baja solo las resaltadas. Nulo cuando no hay resalte. */
  onExportarResalte: (() => void) | null;
};

/** El aviso de las sedes que no se pueden dibujar.
 *
 * Escrito una vez y usado en las dos anchuras. Duplicado, el texto de la version
 * de telefono se habria quedado viejo la primera vez que alguien tocara el otro.
 */
function AvisoSinCoordenada({ n }: { n: { sedes: number; matricula: number } }) {
  return (
    <Info
      texto={
        `${miles(n.sedes)} sedes con daño no entran en este número: ninguna `
        + "fuente tiene su coordenada, así que no hay punto que dibujar. "
        + `Detrás hay ${miles(n.matricula)} estudiantes.`
      }
    />
  );
}

export default function ControlDerecho({
  resumen,
  conDano,
  conDanoFuera,
  soloDanos,
  modoIes,
  sinCoordenada,
  resalte,
  onExportar,
  onExportarResalte,
}: Props) {
  const rotulo = modoIes
    ? (soloDanos
      ? "instituciones de educación superior con daño reportado"
      : "instituciones de educación superior seleccionadas")
    : (soloDanos
      ? "sedes educativas con daño reportado"
      : "sedes educativas seleccionadas");
  const rotuloCorto = modoIes
    ? (soloDanos ? "IES con daño" : "educación superior")
    : (soloDanos ? "sedes con daño" : "sedes educativas");
  const rotuloSegundo = modoIes ? "programas vigentes" : "estudiantes";

  return (
    <div className="pointer-events-auto flex w-full flex-col gap-2">
      <section
        className="rounded-lg border shadow-md"
        style={{ background: "var(--superficie)", borderColor: "var(--borde)" }}
      >
        <div className="flex items-center gap-3 px-3 py-2 md:block md:px-4 md:pt-3 md:pb-2">
          <div className="flex items-center gap-2">
            <PinSede alto={22} />
            <span className="num text-2xl font-semibold leading-none md:text-3xl">
              {miles(resumen.sedes)}
            </span>
            <span
              className="flex items-center gap-1 text-[11px] leading-tight md:hidden"
              style={{ color: "var(--tinta-2)" }}
            >
              {rotuloCorto}
              {/* Tambien en telefono. Vivia solo en el rotulo ancho, que es
                  `hidden md:flex`, asi que en pantalla angosta nada declaraba
                  las sedes que no se pueden dibujar. */}
              {sinCoordenada.sedes > 0 && !modoIes && <AvisoSinCoordenada n={sinCoordenada} />}
            </span>
          </div>
          <div
            className="hidden items-center gap-1 text-xs md:flex"
            style={{ color: "var(--tinta-2)" }}
          >
            {rotulo}
            {sinCoordenada.sedes > 0 && !modoIes && <AvisoSinCoordenada n={sinCoordenada} />}
          </div>

          {/* Solo cuando hay alguna. Una línea que dice "0 con daño reportado"
              ocupa el mismo espacio para no decir nada, y en la mayoría de los
              recortes de la pantalla ese sería el caso. Tampoco se muestra
              cuando el mapa ya está enseñando solo daños: ahí el número grande
              es ese mismo, y repetirlo debajo se leería como otra cifra. */}
          {!soloDanos && conDano > 0 && (
            <div
              className="mt-1 flex items-baseline gap-1.5"
              title={
                "Sedes de la selección que el mapa dibuja con daño."
                + (conDanoFuera > 0
                  ? ` La capa de daños dibuja ${miles(conDano + conDanoFuera)}`
                    + `: las otras ${miles(conDanoFuera)} tienen reporte y no`
                    + " están en el listado de sedes de este visor. Son de tres"
                    + " clases y solo dos tienen que ver con el sismo: las que"
                    + " el directorio no sabe dónde quedan, y cuyo punto se"
                    + " dibuja con la coordenada que publica el MEN; las que"
                    + " caen fuera de la grilla del ShakeMap del USGS, que no"
                    + " llega hasta allí; y las que quedan por debajo de MMI"
                    + " 4,0, que es el mínimo que exporta este visor. El mapa"
                    + " las dibuja igual, porque una fuente afirmando que una"
                    + " escuela se cayó no depende de que nuestro listado la"
                    + " tenga. Con todas las bandas de intensidad apagadas sí"
                    + " entran al conteo: ahí no se está preguntando por la"
                    + " intensidad de nadie."
                  : "")
              }
            >
              <span
                className="num text-sm font-semibold leading-none"
                style={{ color: "var(--critico)" }}
              >
                {miles(conDano)}
              </span>
              <span
                className="text-[11px] leading-tight"
                style={{ color: "var(--tinta-2)" }}
              >
                {/* El rótulo cambia cuando debajo aparece la segunda cifra.
                    Con las dos en pantalla, "con daño reportado" a secas ya no
                    distingue: las dos lo están, y lo que las separa es que ésta
                    cuenta solo dentro de la selección. La nota queda en la de
                    abajo, que es la que necesita explicación. */}
                {conDanoFuera > 0
                  ? "con daño, dentro de la selección"
                  : "con daño reportado"}
              </span>
            </div>
          )}

          {/* Las dos cifras de daño, una debajo de la otra y con la misma
              forma. Estuvo como una resta, "+47 fuera del listado = 1.791
              dibujadas", y no se entendía: obligaba a hacer la cuenta para
              descubrir que la de arriba y la de abajo contestan preguntas
              distintas. Dos líneas paralelas lo dicen sin aritmética, porque lo
              único que cambia entre ellas es el rótulo, que es justo donde está
              la diferencia.

              Antes de eso la resta ni siquiera se veía: vivía dentro del `title`
              mientras la pantalla mostraba 1.744 aquí y 1.791 en las tarjetas de
              abajo, a diez centímetros, sin nada visible que dijera por qué. */}
          {!soloDanos && conDano > 0 && conDanoFuera > 0 && (
            <div
              className="mt-0.5 flex items-baseline gap-1.5"
              title={
                `${miles(conDanoFuera)} sedes con reporte que el listado de este`
                + " visor no trae, así que el mapa las dibuja y el conteo de"
                + " arriba no las incluye."
              }
            >
              <span
                className="num text-sm font-semibold leading-none"
                style={{ color: "var(--critico)" }}
              >
                {miles(conDano + conDanoFuera)}
              </span>
              <span
                className="text-[11px] leading-tight"
                style={{ color: "var(--tinta-2)" }}
              >
                con daño, dibujadas en el mapa
                {/* La marca de que hay una nota detrás. Sin ella el título del
                    navegador no se descubre, y ésta es justo la cifra sobre la
                    que alguien va a querer preguntar. */}
                <span style={{ color: "var(--tinta-3)" }}> ⓘ</span>
              </span>
            </div>
          )}

          {/* El resalte va debajo de las dos de daño y no entre ellas: no es
              otra forma de contar lo mismo, es un recorte que alguien pidió. */}
          {resalte && (
            <div
              className="mt-1 flex items-baseline gap-1.5"
              title={
                "El tramo encendido en la tarjeta de características. En el mapa"
                + " van en ámbar y las demás siguen dibujadas, apagadas. El botón"
                + " de descarga de abajo baja exactamente estas."
              }
            >
              <span
                className="num text-sm font-semibold leading-none"
                style={{ color: "var(--resalte)" }}
              >
                {miles(resalte.n)}
              </span>
              <span
                className="min-w-0 flex-1 truncate text-[11px] leading-tight"
                style={{ color: "var(--tinta-2)" }}
              >
                {resalte.etiqueta}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 md:mt-2 md:block">
            {/* La matricula es la del C-600 de 2024. Para las sedes que no
                reportaron ese ano se usa la del SIMAT 2022, porque no haber
                reportado no es haberse quedado sin alumnos. El titulo lo dice
                en vez de callarlo: es un numero de dos anos distintos. */}
            <span
              className="num text-xl font-semibold leading-none"
              title={
                modoIes
                  ? "Programas vigentes declarados ante el HECAA. No es matrícula de estudiantes: una IES no tiene código DANE de sede."
                  : (`Matrícula del C-600 de 2024. ` +
                    (resumen.matriculaDe2022 > 0
                      ? `${miles(resumen.matriculaDe2022)} de las ${miles(resumen.sedes)} ` +
                        `sedes no reportaron ese año y van con su matrícula del SIMAT 2022.`
                      : `Todas las sedes que se cuentan aquí reportaron ese año.`))
              }
            >
              {miles(resumen.matricula)}
            </span>
            <span
              className="text-[11px] leading-tight md:hidden"
              style={{ color: "var(--tinta-2)" }}
            >
            {rotuloSegundo}
            </span>
          </div>
          <div
            className="hidden text-xs md:block"
            style={{ color: "var(--tinta-2)" }}
          >
            {rotuloSegundo}
          </div>

          <div
            className="mt-2 hidden flex-wrap gap-x-3 text-[10px] md:flex"
            style={{ color: "var(--tinta-3)" }}
          >
            <span>
              <span className="num">{miles(resumen.municipios)}</span> municipios
            </span>
            {!modoIes && (
              <span>
                <span className="num">{miles(resumen.secretarias)}</span> secretarías
              </span>
            )}
          </div>

          {/* En el teléfono la descarga es un icono al final de la barra. */}
          <button
            onClick={onExportar}
            disabled={!resumen.sedes}
            aria-label={`Descargar en CSV las ${rotulo}`}
            title={`Descargar en CSV las ${rotulo}`}
            className="ml-auto shrink-0 disabled:opacity-40 md:hidden"
            style={{ color: "var(--tinta-3)" }}
          >
            <IconoDescarga />
          </button>
        </div>

        <button
          onClick={onExportar}
          disabled={!resumen.sedes}
          className="hidden w-full items-center gap-1.5 border-t px-4 py-2 text-[11px] disabled:opacity-40 md:flex"
          style={{ borderColor: "var(--linea)", color: "var(--tinta-3)" }}
        >
          <IconoDescarga />
          {modoIes
            ? (soloDanos
              ? "Descargar las IES con daño en CSV"
              : "Descargar la selección en CSV")
            : (soloDanos
              ? "Descargar las sedes con daño en CSV"
              : "Descargar la selección en CSV")}
        </button>

        {/* El segundo botón, y no uno solo que cambie de destino. Con un botón
            que a veces baja una cosa y a veces otra, quien lo pulsa tiene que
            acordarse de qué había encendido; con dos, el archivo que va a salir
            está escrito en el botón que se pulsa. */}
        {resalte && onExportarResalte && (
          <button
            onClick={onExportarResalte}
            disabled={!resalte.n}
            className="hidden w-full items-center gap-1.5 border-t px-4 py-2 text-[11px] disabled:opacity-40 md:flex"
            style={{ borderColor: "var(--linea)", color: "var(--resalte)" }}
          >
            <IconoDescarga />
            Descargar las <span className="num">{miles(resalte.n)}</span>{" "}
            resaltadas en CSV
          </button>
        )}
      </section>
    </div>
  );
}

/** El selector del mapa de fondo.
 *
 * Vive debajo de la tarjeta de daños, no pegado al conteo. El conteo y los
 * daños son la lectura de la pantalla; el mapa base es una preferencia y no
 * tiene que competir con esas dos cifras por el primer vistazo.
 */
export function TarjetaMapaBase({
  mapaBase,
  onMapaBase,
}: {
  mapaBase: MapaBase;
  onMapaBase: (m: MapaBase) => void;
}) {
  const [abierta, setAbierta] = useState(false);
  return (
    <section
      className="rounded-lg border shadow-md"
      style={{ background: "var(--superficie)", borderColor: "var(--borde)" }}
    >
      <button
        onClick={() => setAbierta(!abierta)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs md:py-2"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M8 1.5 1.5 5 8 8.5 14.5 5 8 1.5ZM1.5 8 8 11.5 14.5 8M1.5 11 8 14.5 14.5 11"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
        <span className="flex-1 text-left" style={{ color: "var(--tinta-2)" }}>
          Mapa base
        </span>
        <span style={{ color: "var(--tinta-3)" }}>
          {MAPAS_BASE.find((m) => m.id === mapaBase)?.nombre}
        </span>
      </button>

      {abierta && (
        <div className="border-t pb-1" style={{ borderColor: "var(--linea)" }}>
          {MAPAS_BASE.map((m) => (
            <button
              key={m.id}
              onClick={() => onMapaBase(m.id)}
              className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-xs"
              style={{
                color: mapaBase === m.id ? "var(--acento)" : "var(--tinta-2)",
                fontWeight: mapaBase === m.id ? 600 : 400,
              }}
            >
              <span className="w-3 shrink-0">{mapaBase === m.id ? "◉" : "○"}</span>
              <span className="flex-1">{m.nombre}</span>
              <span
                className="hidden text-[10px] sm:inline"
                style={{ color: "var(--tinta-3)" }}
              >
                {m.nota}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function IconoDescarga() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M8 1v9M4.5 7L8 10.5 11.5 7M2 13.5h12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
