"use client";

/** La ficha de cruce, que es el producto real de este visor.
 *
 * Es el caso que motivó el proyecto, automatizado. El 10 de agosto un ciudadano
 * mandó por WhatsApp la foto de un aula con el techo caído en Quibdó. Contestar
 * de qué escuela era exigió cruzar a mano el directorio oficial, la encuesta del
 * FFIE y OpenStreetMap. Lo que salió de ahí no fue un punto en el mapa sino un
 * contraste: la sede tenía 1.533 estudiantes, nunca había sido encuestada y su
 * coordenada oficial estaba a 328 metros de donde de verdad está.
 *
 * Por eso la ficha muestra con el mismo peso lo que se sabe y lo que no. Una
 * ficha que solo listara los datos disponibles daría la impresión de que las
 * casillas vacías son detalles, y son el hallazgo.
 */

import { useEffect } from "react";

import Imagen from "@/components/Imagen";
import { COLOR_FUENTE } from "@/components/Mapa";
import {
  CALIDAD_COORD,
  NOMBRE_AREA,
  NOMBRE_QUINTIL,
  NOMBRE_ZONA,
  CORTE_ESTRUCTURAL,
  SIGNIFICADO_MMI,
  alumnos,
  miles,
} from "@/lib/datos";
import { GRAVEDAD, NOMBRE_ESTADO, NOMBRE_FUENTE } from "@/lib/tipos";
import type { Dano, Reporte, Sede } from "@/lib/tipos";

type Props = {
  sede: Sede;
  reportes: Reporte[];
  danos: Dano[];
  onCerrar: () => void;
};

export default function FichaSede({ sede, reportes, danos, onCerrar }: Props) {
  // Escape cierra. En el telefono la ficha tapa el mapa, asi que el boton de
  // cerrar no puede ser la unica salida.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onCerrar]);

  const verificada = sede.calidad_coord === "gps_validated";
  // Las sedes que llegan desde un daño y no desde la colección no tienen MMI,
  // porque están fuera de la grilla del USGS. Ver `sedeAbierta` en app/page.tsx.
  const conMmi = Number.isFinite(sede.mmi);
  const mios = reportes.filter(
    (r) => r.es_escuela === "si" && r.dane_asignado === sede.dane,
  );
  // Del mas grave al menos grave. Si el alcalde dice que colapso y el reporte
  // oficial dice que la institucion tuvo danos, lo primero que hay que leer es
  // el colapso.
  const misDanos = danos
    .filter((d) => d.dane === sede.dane)
    .sort((a, b) => GRAVEDAD[b.estado] - GRAVEDAD[a.estado]);

  return (
    <div
      className="pointer-events-auto flex max-h-[70svh] w-full flex-col overflow-y-auto overscroll-contain rounded border shadow-lg md:max-h-[calc(100svh-9rem)] md:w-[360px]"
      style={{
        background: "var(--superficie)",
        borderColor: "var(--borde)",
      }}
    >
      <div
        className="sticky top-0 flex items-start gap-2 border-b px-4 py-3"
        style={{ background: "var(--superficie)", borderColor: "var(--linea)" }}
      >
        <div className="flex-1">
          <h2 className="text-base font-semibold leading-tight">{sede.sede}</h2>
          <p className="text-xs" style={{ color: "var(--tinta-2)" }}>
            {sede.establecimiento}
          </p>
          <p className="text-xs" style={{ color: "var(--tinta-2)" }}>
            {sede.mpio}, {sede.depto}
            {sede.secretaria ? `. Secretaría de ${sede.secretaria}` : ""}
          </p>
          <p className="num mt-0.5 text-xs" style={{ color: "var(--tinta-3)" }}>
            Código DANE {sede.dane}
          </p>
        </div>
        <button
          onClick={onCerrar}
          aria-label="Cerrar la ficha"
          title="Cerrar (Esc)"
          className="-mr-1 shrink-0 rounded-full border px-2 py-0.5 text-base leading-tight"
          style={{ borderColor: "var(--linea)", color: "var(--tinta-2)" }}
        >
          ×
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 py-3">
        <div>
          <div className="num text-xl font-semibold">{miles(alumnos(sede))}</div>
          <div className="text-xs" style={{ color: "var(--tinta-2)" }}>
            estudiantes{" "}
            <span style={{ color: "var(--tinta-3)" }}>
              {sede.matricula_2024 != null ? "(2024)" : "(2022)"}
            </span>
          </div>
          {sede.vigencia_2024 === "no_opera" && (
            <div className="mt-1 text-xs" style={{ color: "var(--sede-ignota)" }}>
              El C-600 de 2024 la declara sin operar.
            </div>
          )}
          {sede.ptie && (
            <div className="mt-1 text-xs" style={{ color: "var(--cima)" }}>
              {sede.ptie_estado === "intervenida"
                ? `PTIES, intervenida en ${sede.ptie_anio}`
                : sede.ptie_estado === "programada"
                  ? `PTIES, intervención programada para ${sede.ptie_anio}`
                  : "En el listado del PTIES, sin focalizar"}
            </div>
          )}
        </div>
        <div>
          {/* Sin MMI no es "cero sacudida", es que la grilla del USGS no llega
              hasta ahí. Poner un número inventado sería peor que no poner
              ninguno, así que se dice qué falta y por qué. */}
          {conMmi ? (
            // Dos decimales y no uno. Con uno, una sede de 6,49 se mostraba
            // como "6,5", que es tambien el nombre de la banda de arriba, y el
            // mapa la pintaba en la de 6,0. El numero contradecia la mancha en
            // 1.972 sedes. El valor exportado tiene dos decimales: se muestra
            // como es.
            <div className="num text-xl font-semibold">
              {sede.nivel}{" "}
              <span className="text-sm">
                ({sede.mmi.toFixed(2).replace(".", ",")})
              </span>
            </div>
          ) : (
            <div className="text-xl font-semibold" style={{ color: "var(--tinta-3)" }}>
              sin dato
            </div>
          )}
          <div className="text-xs" style={{ color: "var(--tinta-2)" }}>
            intensidad estimada
          </div>
        </div>
      </div>

      <p className="px-4 pb-3 text-xs" style={{ color: "var(--tinta-2)" }}>
        {conMmi ? (
          <>
            MMI {sede.nivel}: {SIGNIFICADO_MMI[sede.nivel] ?? "sin descripción"}.
            Es la sacudida que estima el modelo del USGS, no daño observado.
          </>
        ) : (
          <>
            Esta sede queda fuera de la grilla del ShakeMap del USGS, que cubre
            de latitud 1,77 a 7,9. No es que no se haya sentido el sismo: es que
            el modelo no llega hasta aquí.
          </>
        )}
      </p>

      {misDanos.length > 0 && (
        <Seccion titulo="Lo que se ha reportado después del sismo">
          {misDanos.map((d) => (
            <Declaracion key={d.id} dano={d} />
          ))}
          <p className="mt-1 text-xs" style={{ color: "var(--tinta-3)" }}>
            Ninguno de estos reportes es una inspección técnica. Dicen quién
            afirmó qué y cuándo, que es todo lo que se sabe hoy.
          </p>
        </Seccion>
      )}

      <Seccion titulo="Estado declarado antes del sismo">
        {sede.encuestada ? (
          <>
            {sede.ivid != null && (
              <div className="mb-2">
                <div className="flex items-baseline gap-2">
                  {/* El numero se colorea por el peor de los tres elementos y
                      no por su propio valor. Una sede con el piso hundido y lo
                      demas sano promedia 0,83, y pintada por ese 0,83 se veria
                      sana. La linea de abajo dice donde esta el compromiso. */}
                  <span
                    className="num text-2xl font-semibold leading-none"
                    style={{ color: tonoIvid(peorElemento(sede)) }}
                  >
                    {sede.ivid.toFixed(2).replace(".", ",")}
                  </span>
                  <span className="text-xs" style={{ color: "var(--tinta-2)" }}>
                    índice de vulnerabilidad, de 0 a 5
                  </span>
                </div>
                {comprometidos(sede).length > 0 && (
                  <div
                    className="mt-1 text-xs font-medium"
                    style={{ color: TONO.estructural }}
                  >
                    Compromiso estructural en {lista(comprometidos(sede))}.
                  </div>
                )}
              </div>
            )}
            <Dato k="techos" v={sede.techos} p={sede.ivid_techos} />
            <Dato k="muros" v={sede.muros} p={sede.ivid_muros} />
            <Dato k="pisos" v={sede.pisos} p={sede.ivid_pisos} />
            <Dato k="fecha de la encuesta" v={sede.fecha_encuesta} />
            <p className="mt-1 text-xs" style={{ color: "var(--tinta-3)" }}>
              Lo declaró el rector en la encuesta del FFIE. Es una declaración,
              no una inspección técnica. El puntaje de cada elemento va de 0 a 5;
              desde 2,5 hay algo estructural comprometido.
            </p>
          </>
        ) : (
          <p
            className="rounded border px-3 py-2 text-xs"
            style={{ borderColor: "var(--sede-ignota)", color: "var(--tinta-2)" }}
          >
            <strong style={{ color: "var(--sede-ignota)" }}>
              Nunca fue encuestada.
            </strong>{" "}
            No hay ninguna declaración previa sobre el estado de esta sede. Con{" "}
            <span className="num">{miles(sede.matricula)}</span> estudiantes, es una sede sobre la que no se puede decir nada sin ir.
          </p>
        )}
      </Seccion>

      <Seccion titulo="Confianza de la ubicación">
        <p className="text-xs" style={{ color: "var(--tinta-2)" }}>
          <strong
            style={{ color: verificada ? "var(--tinta)" : "var(--critico)" }}
          >
            {verificada ? "Coordenada verificada" : "Coordenada sin verificar"}
          </strong>
          {": "}
          {CALIDAD_COORD[sede.calidad_coord ?? ""] ?? "sin control de calidad"}.
          {!verificada &&
            " Antes de despachar a alguien conviene confirmar la dirección: hay sedes con la coordenada oficial corrida cientos de metros."}
        </p>
      </Seccion>

      <Seccion titulo="Contexto">
        {/* Las dos filas dicen dónde está la escuela y no dicen lo mismo. La
            zona la declara el SIMAT y nunca falta. El área la calcula un modelo
            de población sobre un kilómetro cuadrado, distingue el centro
            poblado de la vereda dispersa y falta en una de cada seis sedes. Van
            en este orden y con esas etiquetas para que se puedan leer sin
            confundirlas, y el vacío se muestra como vacío. */}
        <Dato k="zona (SIMAT)" v={NOMBRE_ZONA[sede.zona ?? ""] ?? sede.zona} />
        <Dato
          k="área (WorldPop)"
          v={NOMBRE_AREA[sede.area_class ?? ""] ?? sede.area_class}
        />
        <Dato
          k="quintil de riqueza"
          v={sede.rwi_q != null ? NOMBRE_QUINTIL[sede.rwi_q] : undefined}
        />
      </Seccion>

      {sede.foto1 && (
        <Seccion titulo="Foto previa del FFIE">
          <Imagen
            url={sede.foto1}
            alt={`Fotografía de ${sede.sede}, tomada por el operador del FFIE`}
            className="w-full rounded border"
            style={{ borderColor: "var(--linea)" }}
          />
          <p className="mt-1 text-xs" style={{ color: "var(--tinta-3)" }}>
            La tomó el operador del FFIE en la visita, antes del sismo. Sirve para
            comparar contra lo que llegue hoy.
          </p>
        </Seccion>
      )}

      {mios.length > 0 && (
        <Seccion titulo={`Reportes ciudadanos (${mios.length})`}>
          {mios.map((r) => {
            const c = r.candidatas.find((x) => x.dane === r.dane_asignado);
            return (
              <div key={r.id} className="mb-3">
                {r.url_foto && (
                  <Imagen
                    url={r.url_foto}
                    alt="Fotografía enviada por un ciudadano"
                    className="w-full rounded border"
                    style={{ borderColor: "var(--linea)" }}
                  />
                )}
                <p className="mt-1 text-xs" style={{ color: "var(--tinta-2)" }}>
                  {r.texto}
                </p>
                <p className="text-xs" style={{ color: "var(--tinta-3)" }}>
                  {r.fecha}
                  {c ? `, reportado a ${c.dist_m} m de esta sede` : ""}, lo
                  asignó {r.revisado_por || "alguien sin registrar"}
                </p>
              </div>
            );
          })}
          <p className="text-xs" style={{ color: "var(--tinta-3)" }}>
            Una persona confirmó que la foto corresponde a esta escuela. No es una
            inspección: nadie de la entidad ha ido todavía.
          </p>
        </Seccion>
      )}
    </div>
  );
}

/** Una declaración sobre esta sede, con quién la hizo y sus palabras.
 *
 * La cita va entera y entre comillas. Un visor que afirma que una escuela se
 * cayó tiene que poder mostrar la frase exacta y de quién es, o no está
 * informando sino repitiendo.
 */
function Declaracion({ dano: d }: { dano: Dano }) {
  const color = COLOR_FUENTE[d.fuente];
  const deGrupo = d.alcance !== "sede" && (d.n_sedes_institucion ?? 1) > 1;

  return (
    <div
      className="mb-2 border-l-2 pl-2.5"
      style={{ borderColor: color }}
    >
      <div className="flex items-baseline gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color }}>
          {NOMBRE_ESTADO[d.estado]}
        </span>
        <span className="text-[10px]" style={{ color: "var(--tinta-3)" }}>
          {NOMBRE_FUENTE[d.fuente]}, {d.fecha}
        </span>
      </div>

      {deGrupo ? (
        <p className="mt-0.5 text-xs" style={{ color: "var(--tinta-2)" }}>
          El reporte no habla de esta sede sino de{" "}
          {d.institucion_reportada ?? "su institución"}, que tiene{" "}
          <span className="num">{d.n_sedes_institucion}</span> sedes. Lo que se
          afirmó es que el daño está en alguna de ellas, sin decir en cuál.
        </p>
      ) : d.estado === "sin_verificar" ? (
        <p className="mt-0.5 text-xs" style={{ color: "var(--tinta-2)" }}>
          Una persona confirmó que la fotografía corresponde a esta sede. No dice
          nada sobre el estado del edificio.
        </p>
      ) : null}

      {d.cita && (
        <p className="mt-1 text-xs italic" style={{ color: "var(--tinta)" }}>
          «{d.cita}»
        </p>
      )}
      {d.quien && (
        <p className="text-[11px]" style={{ color: "var(--tinta-2)" }}>
          {d.quien}
          {d.cargo ? `, ${d.cargo}` : ""}
          {d.medio ? `. ${d.medio}` : ""}
        </p>
      )}
      {d.afectacion_humana && (
        <p className="mt-0.5 text-[11px]" style={{ color: "var(--critico)" }}>
          {d.afectacion_humana}
        </p>
      )}
      {d.impacto_ptie && (
        <p className="mt-0.5 text-[11px]" style={{ color: "var(--tinta-3)" }}>
          PTIES: {d.impacto_ptie}
        </p>
      )}
      {d.url && !d.url_foto && (
        <a
          href={d.url}
          target="_blank"
          rel="noreferrer"
          className="mt-0.5 inline-block text-[11px] underline"
          style={{ color }}
        >
          {d.titular ?? "ver la fuente"} ↗
        </a>
      )}
    </div>
  );
}

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t px-4 py-3" style={{ borderColor: "var(--linea)" }}>
      <div
        className="mb-1.5 text-xs font-medium uppercase tracking-wide"
        style={{ color: "var(--tinta-3)" }}
      >
        {titulo}
      </div>
      {children}
    </div>
  );
}

function Dato({
  k,
  v,
  p,
}: {
  k: string;
  v?: string | null;
  /** Puntaje del elemento, si lo tiene. Va coloreado por su propia gravedad,
   *  que a nivel de elemento es un corte exacto y no una aproximacion. */
  p?: number | null;
}) {
  return (
    <div className="flex gap-2 py-0.5 text-xs">
      <span className="w-36 shrink-0" style={{ color: "var(--tinta-3)" }}>
        {k}
        {p != null && (
          <span
            className="num ml-1.5 font-semibold"
            style={{ color: tonoIvid(p) }}
          >
            {p.toFixed(1).replace(".", ",")}
          </span>
        )}
      </span>
      <span style={{ color: v ? "var(--tinta)" : "var(--tinta-3)" }}>
        {v || "sin dato"}
      </span>
    </div>
  );
}

/** Los tres tonos de gravedad de un elemento.
 *
 * Familia del violeta de carencia, que en este mapa ya significa "algo le falta
 * a esta escuela". Nunca de la rampa verde a rojo, que es la sacudida del
 * sismo: un tono no puede significar dos cosas en la misma pantalla.
 */
const TONO = {
  bien: "var(--tinta-3)",
  deterioro: "var(--vuln-deterioro)",
  estructural: "var(--vuln-estructural)",
};

/** El corte de 2,5 es exacto por elemento: sin nada estructural marcado un
 *  elemento no pasa de 2, y con algo estructural el minimo es 2,5. */
function tonoIvid(p: number | null | undefined): string {
  if (p == null) return "var(--tinta-3)";
  if (p === 0) return TONO.bien;
  return p >= CORTE_ESTRUCTURAL ? TONO.estructural : TONO.deterioro;
}

function peorElemento(s: Sede): number {
  return Math.max(s.ivid_techos ?? 0, s.ivid_muros ?? 0, s.ivid_pisos ?? 0);
}

/** Que elementos tienen compromiso estructural, por nombre. */
function comprometidos(s: Sede): string[] {
  return (
    [
      ["techos", s.ivid_techos],
      ["muros", s.ivid_muros],
      ["pisos", s.ivid_pisos],
    ] as [string, number | null | undefined][]
  )
    .filter(([, v]) => v != null && v >= CORTE_ESTRUCTURAL)
    .map(([k]) => k);
}

function lista(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? "";
  return `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;
}
