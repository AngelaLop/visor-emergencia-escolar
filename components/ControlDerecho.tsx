"use client";

/** El control de las cifras y del mapa base.
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
  mapaBase: MapaBase;
  onMapaBase: (m: MapaBase) => void;
  onExportar: () => void;
};

export default function ControlDerecho({
  resumen,
  mapaBase,
  onMapaBase,
  onExportar,
}: Props) {
  const [capasAbiertas, setCapasAbiertas] = useState(false);

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
              sedes educativas
            </span>
          </div>
          <div
            className="hidden text-xs md:block"
            style={{ color: "var(--tinta-2)" }}
          >
            sedes educativas seleccionadas
          </div>

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
                  : `Todas las sedes de la selección reportaron ese año.`)
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
            aria-label="Descargar la selección en CSV"
            title="Descargar la selección en CSV"
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
          Descargar la selección en CSV
        </button>
      </section>

      <section
        className="relative rounded-lg border shadow-md"
        style={{ background: "var(--superficie)", borderColor: "var(--borde)" }}
      >
        <button
          onClick={() => setCapasAbiertas(!capasAbiertas)}
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

        {capasAbiertas && (
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
    </div>
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
