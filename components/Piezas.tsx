"use client";

/** Las piezas que comparten dos tarjetas o más.
 *
 * Vivían dentro de `PanelIzquierdo.tsx`, que es donde nacieron. Salieron cuando
 * la tarjeta de características dejó de estar metida dentro de la de daños y pasó
 * a ser hermana suya: al necesitar la misma concha y el mismo botón de nota,
 * importarlas de allí habría cerrado un ciclo entre los dos archivos.
 *
 * Aquí solo va lo que de verdad usan varios. Lo que sirve a una sola tarjeta se
 * queda con ella, que es donde se lee al lado de lo que explica.
 */

import { useRef, useState } from "react";

export function Tarjeta({
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
export function Info({
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
