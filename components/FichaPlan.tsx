"use client";

/** La ficha de una escuela del plan de campo, en el recuadro de la derecha.
 *
 * Junta lo que la cuadrilla puede saber antes de salir, en el orden en que lo
 * necesita: quién es la escuela, en qué estado la dejó el último concepto, qué
 * se ve en las fotos, por dónde se entra y qué del formulario IDIGER ya se
 * puede llevar lleno. El día y la ruta no van aquí: están en el mapa, en la
 * simulación y en el Excel.
 *
 * Tres advertencias van escritas en pantalla porque cambian la lectura:
 *
 *  - Un concepto sin dictamen aprobado por la mesa no está en firme. Es la
 *    regla del propio tablero del Valle («solo el dictamen ubica»).
 *  - Las fotos del reporte son del rector, después del sismo. Las del FFIE son
 *    de 2022, antes. Las fichas de inspección del tablero no traen fotos.
 *  - El predio es un candidato del catastro, con su veredicto al lado. Las
 *    áreas llevan una confianza (alta, media o baja) que calcula el script 78
 *    con ese veredicto y con los m² construidos por alumno.
 */

import { useEffect } from "react";

import Imagen from "@/components/Imagen";
import { Info, Tarjeta } from "@/components/Piezas";
import { COLOR_CONCEPTO, colorCuadrilla } from "@/lib/plan";
import type { Plan, SedePlan } from "@/lib/plan";

/** Tres tonos de una sola rampa: más lleno, más confianza. No se usa el
 *  verde-amarillo-rojo porque ese ya es la escala de habitabilidad de arriba. */
const TONO_CONFIANZA: Record<string, React.CSSProperties> = {
  alta: { background: "var(--tinta)", color: "var(--superficie)" },
  media: { background: "var(--tinta-3)", color: "var(--superficie)" },
  baja: {
    background: "transparent",
    color: "var(--tinta-2)",
    border: "1px dashed var(--tinta-3)",
  },
};

/** Cuántas fotos del reporte se muestran de entrada. Hay sedes con más de
 *  diez, y el recuadro tiene que seguir siendo una ficha. */
const FOTOS_VISIBLES = 4;

export default function FichaPlan({
  sede,
  plan,
  onCierra,
}: {
  sede: SedePlan;
  plan: Plan;
  onCierra: () => void;
}) {
  // Escape cierra: el recuadro tapa parte del mapa y el botón no puede ser la
  // única salida.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCierra();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onCierra]);

  const color = sede.concepto ? COLOR_CONCEPTO[sede.concepto] : null;
  const enFirme = sede.dictamen === "aprobado por la mesa";
  const fotos = sede.fotos_reporte ?? [];
  const ffie = sede.fotos_ffie ?? [];
  const tablero = plan.tablero_valle;

  return (
    <Tarjeta estilo={{ borderColor: colorCuadrilla(sede.cuadrilla, false) }}>
      <div className="px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold leading-tight">{sede.sede}</h2>
            <p className="text-[11px]" style={{ color: "var(--tinta-2)" }}>
              {sede.institucion}
            </p>
          </div>
          <button
            onClick={onCierra}
            className="shrink-0 rounded border px-1.5 text-[10px]"
            style={{ borderColor: "var(--linea)", color: "var(--tinta-3)" }}
          >
            cerrar
          </button>
        </div>

        <Bloque titulo="Identificación">
          <Dato k="código DANE" v={sede.dane_propuesto} />
          <Dato k="municipio" v={sede.municipio} />
          {sede.grupo && sede.grupo !== "BID (43)" && (
            <Dato k="la aporta" v={`Secretaría de ${sede.grupo}`} />
          )}
          {sede.en_revision && (
            <p className="text-[10px]" style={{ color: "var(--critico)" }}>
              Coordenada provisional, en revisión.
            </p>
          )}
          <Dato k="dirección" v={sede.direccion ?? "—"} />
          {sede.zona_libro && <Dato k="zona" v={sede.zona_libro.toLowerCase()} />}
          {sede.matricula_libro != null && (
            <Dato k="matrícula" v={sede.matricula_libro.toLocaleString("es-CO")} />
          )}
          {sede.especialidad_visita && (
            <Dato k="especialidad de la visita" v={sede.especialidad_visita.toLowerCase()} />
          )}
        </Bloque>

        <Bloque
          titulo="Estado"
          nota={`Concepto de habitabilidad del tablero de la Secretaría de Educación del Valle, consultado el ${tablero.consultado} y sin cambios desde el ${tablero.sin_cambios_desde}. Es la escala del formulario IDIGER. Según la regla del propio tablero, un concepto solo está en firme cuando la mesa de revisión lo aprueba.`}
        >
          {color && sede.concepto ? (
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded px-2 py-0.5 text-[12px] font-semibold"
                style={{ background: color.fondo, color: color.tinta }}
              >
                {sede.concepto}
              </span>
              <span
                className="text-[11px]"
                style={{ color: enFirme ? "var(--tinta-2)" : "var(--critico)" }}
              >
                {sede.dictamen ?? "sin dictamen"}
                {!enFirme && " · no está en firme"}
              </span>
            </div>
          ) : (
            <p className="text-[11px]" style={{ color: "var(--tinta-2)" }}>
              Sin concepto técnico en el tablero del Valle.
            </p>
          )}
          {sede.estado_men_actual && (
            <Dato
              k="según el MEN"
              v={`${sede.estado_men_actual.toLowerCase()}${
                sede.nivel_men_actual ? ` · nivel ${sede.nivel_men_actual.toLowerCase()}` : ""
              }`}
            />
          )}
          {sede.fichas && sede.fichas.length > 0 && (
            <ul className="mt-1 flex flex-col gap-0.5 text-[11px]">
              {sede.fichas.map((f) => (
                <li key={f.ficha} className="flex justify-between gap-2">
                  <span className="num">{f.ficha}</span>
                  <span className="text-right" style={{ color: "var(--tinta-2)" }}>
                    {f.concepto.toLowerCase()} · {f.tipo.toLowerCase()} ·{" "}
                    {f.dictamen || "sin dictamen"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {sede.declaracion_rector && (
            <Dato k="lo que declaró el rector" v={sede.declaracion_rector.toLowerCase()} />
          )}
          {sede.observacion_rector && (
            <p className="mt-1 text-[11px] leading-snug" style={{ color: "var(--tinta-2)" }}>
              «{sede.observacion_rector}»
            </p>
          )}
        </Bloque>

        <Bloque
          titulo="Fotos"
          nota="Las del reporte son las que subió el rector al diagnóstico del Valle, después del sismo. Las del FFIE son de la encuesta de 2022, antes del sismo, y sirven para comparar. Las fichas de inspección del tablero no traen fotos."
        >
          {fotos.length === 0 && ffie.length === 0 && (
            <p className="text-[11px]" style={{ color: "var(--tinta-2)" }}>
              Ninguna fuente trae fotos de esta sede.
            </p>
          )}
          {fotos.length > 0 && (
            <>
              <p className="text-[10px]" style={{ color: "var(--tinta-3)" }}>
                Reporte del rector · {fotos.length}{" "}
                {fotos.length === 1 ? "foto" : "fotos"}
              </p>
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                {fotos.slice(0, FOTOS_VISIBLES).map((f, i) => (
                  <figure key={`${f.url}-${i}`}>
                    <a href={f.url} target="_blank" rel="noreferrer">
                      <Imagen
                        url={f.url}
                        alt={`${f.zona} en ${sede.sede}`}
                        className="h-24 w-full rounded object-cover"
                      />
                    </a>
                    <figcaption
                      className="mt-0.5 text-[9px] leading-tight"
                      style={{ color: "var(--tinta-2)" }}
                      title={f.descripcion}
                    >
                      {f.zona.toLowerCase()}
                    </figcaption>
                  </figure>
                ))}
              </div>
              {fotos.length > FOTOS_VISIBLES && (
                <p className="mt-1 text-[10px]" style={{ color: "var(--tinta-3)" }}>
                  y {fotos.length - FOTOS_VISIBLES} más en el Excel descargable.
                </p>
              )}
            </>
          )}
          {ffie.length > 0 && (
            <>
              <p className="mt-2 text-[10px]" style={{ color: "var(--tinta-3)" }}>
                FFIE {sede.fecha_encuesta ? `· ${sede.fecha_encuesta}` : "· 2022"} ·
                antes del sismo
              </p>
              <div className="mt-1 grid grid-cols-3 gap-1.5">
                {ffie.map((u) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer">
                    <Imagen
                      url={u}
                      alt={`Foto del FFIE de ${sede.sede}`}
                      className="h-16 w-full rounded object-cover"
                    />
                  </a>
                ))}
              </div>
            </>
          )}
        </Bloque>

        <Bloque titulo="Por dónde se entra">
          <Dato k="vía" v={sede.nombre_util ?? "sin nombre en ninguna fuente"} />
          {sede.tipo_acceso && <Dato k="tipo de vía" v={sede.tipo_acceso} />}
          {sede.sinc_categoria && (
            <Dato
              k="categoría en el SINC"
              v={`${sede.sinc_categoria}${sede.sinc_competencia ? ` · ${sede.sinc_competencia}` : ""}`}
            />
          )}
          <div className="mt-1 flex items-start gap-2 text-[11px]">
            <span
              className="shrink-0 rounded px-1.5 py-0.5 font-semibold"
              style={{
                background: sede.acceso_dificil ? "var(--critico)" : "var(--plano)",
                color: sede.acceso_dificil ? "#ffffff" : "var(--tinta)",
              }}
            >
              {sede.acceso_dificil ? "acceso difícil" : "acceso fácil"}
            </span>
            {sede.acceso_razon && (
              <span className="leading-snug" style={{ color: "var(--tinta-2)" }}>
                {sede.acceso_razon}
              </span>
            )}
          </div>
        </Bloque>

        <Bloque
          titulo="Formulario IDIGER, caja 1"
          nota="El producto 2 del TdR es el formulario de inspección de edificaciones después de un sismo. Su primera caja pide la identificación de la edificación. Aquí va lo que ya se sabe de escritorio; el resto lo llena el ingeniero en sitio."
        >
          <Dato k="nombre" v={sede.sede} />
          <Dato k="dirección" v={sede.direccion ?? "—"} />
          <Dato
            k="coordenada"
            v={`${sede.lat_final.toFixed(5)}, ${sede.lon_final.toFixed(5)}`}
          />
          <Dato
            k="predio candidato"
            v={sede.predio ? `${sede.predio} (dirección catastral)` : "sin cruce en el catastro"}
          />
          {sede.veredicto_catastro && (
            <Dato k="cruce con el catastro" v={sede.veredicto_catastro} />
          )}
          {sede.terreno_m2 != null && (
            <Dato
              k="área de terreno"
              v={`${Math.round(sede.terreno_m2).toLocaleString("es-CO")} m²`}
            />
          )}
          {sede.construida_m2 != null && (
            <Dato
              k="área construida"
              v={`${Math.round(sede.construida_m2).toLocaleString("es-CO")} m²`}
            />
          )}
          {sede.confianza_areas && sede.confianza_areas !== "sin dato" && (
            <div className="mt-1 flex items-start gap-2 text-[11px]">
              <span
                className="shrink-0 rounded px-1.5 py-0.5 font-semibold"
                style={TONO_CONFIANZA[sede.confianza_areas] ?? TONO_CONFIANZA.baja}
              >
                confianza {sede.confianza_areas}
              </span>
              <span className="leading-snug" style={{ color: "var(--tinta-2)" }}>
                {sede.confianza_areas_razon}
              </span>
            </div>
          )}
        </Bloque>
      </div>
    </Tarjeta>
  );
}

function Bloque({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-2 border-t pt-2" style={{ borderColor: "var(--linea)" }}>
      <h3
        className="text-[10px] uppercase tracking-wide"
        style={{ color: "var(--tinta-3)" }}
      >
        {titulo}
        {nota && <Info texto={nota} ancho />}
      </h3>
      <div className="mt-1 flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[11px]">
      <span className="shrink-0" style={{ color: "var(--tinta-3)" }}>
        {k}
      </span>
      <span className="text-right">{v}</span>
    </div>
  );
}
