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
  /** Si el mapa está mostrando solo las escuelas con daño reportado, o sea con
   *  la capa de sedes apagada y la de reportes prendida. Cambia qué se está
   *  contando, y por eso tiene que cambiar también el rótulo: el mismo número
   *  bajo el mismo rótulo diría dos cosas distintas según una casilla que está
   *  en otra tarjeta. */
  soloDanos: boolean;
  onExportar: () => void;
};

export default function ControlDerecho({
  resumen,
  conDano,
  conDanoFuera,
  soloDanos,
  onExportar,
}: Props) {
  const rotulo = soloDanos
    ? "sedes educativas con daño reportado"
    : "sedes educativas seleccionadas";

  return (
    <div className="pointer-events-auto flex w-full flex-col gap-2 md:w-60">
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
              className="text-[11px] leading-tight md:hidden"
              style={{ color: "var(--tinta-2)" }}
            >
              {soloDanos ? "sedes con daño" : "sedes educativas"}
            </span>
          </div>
          <div
            className="hidden text-xs md:block"
            style={{ color: "var(--tinta-2)" }}
          >
            {rotulo}
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
                  ? ` La tarjeta de daños cuenta ${miles(conDano + conDanoFuera)}`
                    + `: las otras ${miles(conDanoFuera)} tienen reporte y no`
                    + " están en el marco de sedes de este visor, porque caen"
                    + " fuera de la grilla del USGS, no llegan a MMI 4,0 o no"
                    + " están en el SIMAT de 2022. El mapa las dibuja igual."
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
                con daño reportado
                {/* La marca de que hay una nota detrás. Sin ella el título del
                    navegador no se descubre, y esta es justo la cifra sobre la
                    que alguien va a querer preguntar. */}
                {conDanoFuera > 0 && (
                  <span style={{ color: "var(--tinta-3)" }}> ⓘ</span>
                )}
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
                `Matrícula del C-600 de 2024. ` +
                (resumen.matriculaDe2022 > 0
                  ? `${miles(resumen.matriculaDe2022)} de las ${miles(resumen.sedes)} ` +
                    `sedes no reportaron ese año y van con su matrícula del SIMAT 2022.`
                  : `Todas las sedes que se cuentan aquí reportaron ese año.`)
              }
            >
              {miles(resumen.matricula)}
            </span>
            <span
              className="text-[11px] leading-tight md:hidden"
              style={{ color: "var(--tinta-2)" }}
            >
              estudiantes
            </span>
          </div>
          <div
            className="hidden text-xs md:block"
            style={{ color: "var(--tinta-2)" }}
          >
            estudiantes
          </div>

          <div
            className="mt-2 hidden flex-wrap gap-x-3 text-[10px] md:flex"
            style={{ color: "var(--tinta-3)" }}
          >
            <span>
              <span className="num">{miles(resumen.municipios)}</span> municipios
            </span>
            <span>
              <span className="num">{miles(resumen.secretarias)}</span> secretarías
            </span>
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
          {soloDanos ? "Descargar las sedes con daño en CSV" : "Descargar la selección en CSV"}
        </button>
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
