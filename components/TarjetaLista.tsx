"use client";

/** Las tarjetas de la vista «Sedes pedidas»: qué pinta el mapa, qué se resalta
 *  y una tabla por secretaría que explica, sin rutas, por qué unas cuestan más
 *  que otras. Todo sale de `lista_men.json` (script 90). */

import { Info, Tarjeta } from "@/components/Piezas";
import {
  BORDE,
  CLASES,
  NOMBRE_COLOR,
  NOMBRE_RESALTE,
  claseDe,
  cumple,
  type Calidad,
  type ColorLista,
  type ListaMen,
  type Resalte,
} from "@/lib/lista";

const RESALTES: Resalte[] = ["duda", "ffie", "plan"];

export default function TarjetaLista({
  lista,
  color,
  onColor,
  resaltes,
  onResaltes,
  ocultas,
  onSolo,
  tema,
}: {
  lista: ListaMen;
  color: ColorLista;
  onColor: (c: ColorLista) => void;
  resaltes: Resalte[];
  onResaltes: (r: Resalte[]) => void;
  ocultas: string[];
  /** Deja solo esa secretaría en el mapa; null vuelve a todas. */
  onSolo: (s: string | null) => void;
  tema: "claro" | "oscuro";
}) {
  const oscuro = tema === "oscuro";
  const visibles = lista.sedes.filter((s) => !ocultas.includes(s.secretaria));
  const dibujadas = visibles.filter((s) => s.lat !== null);
  const conteo = (f: (x: (typeof visibles)[number]) => boolean) =>
    dibujadas.filter(f).length;
  const sinPunto = visibles.length - dibujadas.length;
  const unaSola = lista.resumen.length - ocultas.length === 1
    ? lista.resumen.find((r) => !ocultas.includes(r.secretaria))?.secretaria
    : null;
  // El script agrupa con `sort=False`, así que el orden es el del archivo del
  // MEN y no dice nada. De mayor a menor sí: la tabla existe para comparar.
  const filas = [...lista.resumen].sort((a, b) => b.sedes - a.sedes);
  const suma = (f: (r: (typeof filas)[number]) => number) =>
    filas.reduce((a, r) => a + f(r), 0);
  // Dónde están las sedes que no se pueden dibujar. El número solo, en el
  // encabezado, no lleva a ninguna parte.
  const sinPuntoDonde = filas
    .filter((r) => r.sin_coordenada > 0)
    .map((r) => `${r.secretaria} ${r.sin_coordenada}`)
    .join(", ");

  return (
    <>
      <Tarjeta>
        <div className="px-3 py-2">
          <h2 className="text-[12px] font-semibold">
            Requerimiento
            <Info
              texto={`Todas las sedes de la lista consolidada que pasó el MEN (${lista.filas_listado} filas, ${lista.sedes.length} sedes). Es una vista de información: dice dónde están y qué tan confiable es cada punto. Las horas y las cuadrillas están en «Plan de visitas».\n\nUn punto mal ubicado cambia el tiempo de viaje. Revisar a mano las que tienen borde es trabajo previo a cualquier plan que las incluya.`}
              ancho
            />
          </h2>
          <p className="num mt-0.5 text-[11px]" style={{ color: "var(--tinta-2)" }}>
            {visibles.length} sedes · {dibujadas.length} en el mapa
            {sinPunto > 0 && (
              <>
                {" "}· {sinPunto} sin coordenada
                <Info
                  texto={`Ninguna fuente trae punto para estas ${sinPunto}, así que no se dibujan y no entran en ningún cálculo de distancia. Están en ${sinPuntoDonde}. Conseguirles coordenada es trabajo previo a cualquier plan que las incluya.`}
                  ancho
                />
              </>
            )}
          </p>

          <h3 className="mt-2 text-[11px] font-semibold">
            Colorear por
            <Info
              texto={"Zona y Acceso describen dónde está la sede. Zona sale del SIMAT; Acceso, de medir la vía más cercana en la red vial, y donde la red no llega queda «sin medir».\n\nDaño declarado es lo que respondió el colegio en la encuesta que el MEN consolidó. No es el dictamen de un ingeniero: quien contesta es la sede, no una visita técnica. Donde dice «sin reporte» nadie contestó, que no es lo mismo que no tener daño."}
              ancho
            />
          </h3>
          <div className="mt-1 flex flex-wrap gap-1">
            {(Object.keys(NOMBRE_COLOR) as ColorLista[]).map((c) => (
              <button
                key={c}
                onClick={() => onColor(c)}
                className="rounded border px-2 py-0.5 text-[11px]"
                style={{
                  borderColor: c === color ? "var(--acento)" : "var(--linea)",
                  background: c === color ? "var(--plano)" : "transparent",
                  color: c === color ? "var(--acento)" : "var(--tinta)",
                  fontWeight: c === color ? 600 : 400,
                }}
              >
                {NOMBRE_COLOR[c]}
              </button>
            ))}
          </div>
          <ul className="mt-1.5 flex flex-col gap-0.5 text-[10.5px]">
            {CLASES[color].map((k) => {
              const n = conteo((s) => claseDe(s, color) === k.clave);
              if (n === 0) return null;
              return (
                <li key={k.clave || "nada"} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: oscuro ? k.tono.oscuro : k.tono.claro }}
                  />
                  <span className="flex-1">{k.rotulo}</span>
                  <span className="num" style={{ color: "var(--tinta-2)" }}>{n}</span>
                </li>
              );
            })}
          </ul>

          <h3 className="mt-2 text-[11px] font-semibold">
            Borde: calidad de la coordenada
            <Info
              texto={`Sin borde: el punto lo revisó una persona, o el listado del MEN y el SIMAT 2022 coinciden a menos de ${lista.umbral_m} m.\n\nBorde magenta: el listado y el SIMAT no coinciden (se dibuja el del listado), o la revisión dejó el punto para confirmar en campo.\n\nBorde gris: solo una fuente trae punto y no hay con qué contrastarlo.`}
              ancho
            />
          </h3>
          <ul className="mt-1 flex flex-col gap-0.5 text-[10.5px]">
            {(["verificada", "fuentes coinciden", "fuentes no coinciden",
               "por confirmar en campo", "una sola fuente"] as Calidad[]).map((q) => {
              const n = conteo((s) => s.calidad === q);
              if (n === 0) return null;
              const b = BORDE[q];
              return (
                <li key={q} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{
                      background: "var(--tinta-3)",
                      boxShadow: b.tono
                        ? `0 0 0 ${b.ancho / 1.5}px ${oscuro ? b.tono.oscuro : b.tono.claro}`
                        : "none",
                    }}
                  />
                  <span className="flex-1">{b.rotulo}</span>
                  <span className="num" style={{ color: "var(--tinta-2)" }}>{n}</span>
                </li>
              );
            })}
          </ul>

          <h3 className="mt-2 text-[11px] font-semibold">Resaltar</h3>
          <div className="mt-1 flex flex-col gap-0.5 text-[11px]">
            {RESALTES.map((r) => (
              <label key={r} className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={resaltes.includes(r)}
                  onChange={() => onResaltes(resaltes.includes(r)
                    ? resaltes.filter((x) => x !== r) : [...resaltes, r])}
                />
                <span className="flex-1">{NOMBRE_RESALTE[r]}</span>
                <span className="num" style={{ color: "var(--tinta-2)" }}>
                  {conteo((s) => cumple(s, r))}
                </span>
              </label>
            ))}
          </div>
        </div>
      </Tarjeta>

      <Tarjeta>
        <div className="px-3 py-2">
          <h2 className="text-[12px] font-semibold">
            Por secretaría
            <Info
              texto={"Lo que hace cara una visita, sin calcular rutas.\n\nRural: parte de las sedes en zona rural.\nDifícil: parte con acceso por camino destapado o sin categoría, entre las que se pudieron medir (la red vial no llega a Popayán ni al Caquetá).\nDispersión: distancia típica de cada sede al centro de las demás. Con sedes pegadas se hacen dos por día; con sedes dispersas, una.\nCrítico: parte en nivel crítico según la capa del MEN. Es urgencia, no costo.\nDuda: sedes con coordenada sin confirmar o sin coordenada.\n\nToca una fila para ver solo esa secretaría."}
              ancho
            />
          </h2>
          <table className="num mt-1 w-full text-[10.5px]">
            <thead style={{ color: "var(--tinta-2)" }}>
              <tr>
                <th className="text-left font-normal">secretaría</th>
                <th className="text-right font-normal">sedes</th>
                <th className="text-right font-normal">rural</th>
                <th className="text-right font-normal">difícil</th>
                <th className="text-right font-normal">disp.</th>
                <th className="text-right font-normal">crítico</th>
                <th className="text-right font-normal">duda</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((r) => {
                const activa = !ocultas.includes(r.secretaria);
                const duda = r.con_duda + r.sin_coordenada;
                return (
                  <tr
                    key={r.secretaria}
                    onClick={() => onSolo(unaSola === r.secretaria ? null : r.secretaria)}
                    className="cursor-pointer"
                    style={{
                      opacity: activa ? 1 : 0.4,
                      background: unaSola === r.secretaria ? "var(--plano)" : "transparent",
                    }}
                  >
                    <td className="py-0.5 text-left">
                      {r.secretaria}
                      {/* Un punto al lado de las que ponen sedes en el plan de
                          campo. Son la recomendación entera y en esta tabla
                          quedaban como dos filas más. */}
                      {r.en_plan > 0 && (
                        <span
                          className="ml-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
                          style={{ background: "var(--acento)" }}
                          title={`${r.en_plan} de sus ${r.sedes} sedes están en el plan de visitas`}
                        />
                      )}
                    </td>
                    <td className="text-right">{r.sedes}</td>
                    <td className="text-right"><Barra pct={r.rural_pct} /></td>
                    <td className="text-right">
                      {r.acceso_dificil_pct === null ? "—" : <Barra pct={r.acceso_dificil_pct} />}
                    </td>
                    <td className="text-right">
                      {r.dispersion_km === null ? "—" : `${r.dispersion_km.toLocaleString("es-CO")} km`}
                    </td>
                    <td className="text-right">
                      {r.critico_pct === null ? "—" : `${r.critico_pct} %`}
                    </td>
                    <td className="text-right" style={{ color: duda > 0 ? "var(--critico)" : undefined }}>
                      {duda}
                    </td>
                  </tr>
                );
              })}
              {/* Los totales, para poder verificar la columna sin sumarla a
                  mano. Los porcentajes no se totalizan: promediar los de cada
                  secretaría no da el del conjunto. */}
              <tr
                className="border-t font-semibold"
                style={{ borderColor: "var(--linea)" }}
              >
                <td className="py-0.5 text-left">las 14</td>
                <td className="text-right">{suma((r) => r.sedes)}</td>
                <td className="text-right" />
                <td className="text-right" />
                <td className="text-right" />
                <td className="text-right" />
                <td
                  className="text-right"
                  style={{ color: "var(--critico)" }}
                >
                  {suma((r) => r.con_duda + r.sin_coordenada)}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="mt-1.5 text-[9.5px]" style={{ color: "var(--tinta-3)" }}>
            El punto marca las {filas.filter((r) => r.en_plan > 0).length}{" "}
            secretarías que ponen sedes en el plan de visitas:{" "}
            {suma((r) => r.en_plan)} de {suma((r) => r.sedes)}.
          </p>
          <p className="mt-1 text-[9.5px]" style={{ color: "var(--tinta-3)" }}>
            Fuente: {lista.fuente}. Generado el {lista.generado}.
          </p>
        </div>
      </Tarjeta>
    </>
  );
}

/** Un porcentaje con una barra corta detrás, para leer la diferencia sin leer el número. */
function Barra({ pct }: { pct: number }) {
  return (
    <span className="relative inline-flex w-[46px] items-center justify-end">
      <span
        className="absolute left-0 top-1/2 h-[6px] -translate-y-1/2 rounded-sm"
        style={{ width: `${Math.max(2, pct * 0.46)}px`, background: "var(--linea)" }}
      />
      <span className="relative">{pct} %</span>
    </span>
  );
}
