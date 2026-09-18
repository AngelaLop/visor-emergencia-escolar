"use client";

/** Cómo se construyó el plan, en un diálogo que se abre desde la leyenda.
 *
 * Las cifras que dependen del plan (horas por escenario y por cuadrilla) se
 * leen del propio `plan_campo.json`, para que no queden viejas si el plan se
 * vuelve a calcular. Las demás son de pasos anteriores que no cambian con el
 * plan, y cada una tiene su informe:
 *
 *   26 y 17 sedes, 12,9 km, 1,4 km, 7 y 4 sedes   coordenadas_bid_final.txt
 *   90,8 %, Yotoco 65 contra 90 min               ruteo_bid.txt
 *   18, 9 y 6 sedes                               acceso_sinc.txt
 *   8 de acceso difícil, 48,8 m                   coordenadas_bid_final.txt
 *   ciudades del corredor                         plan_campo.txt
 *
 * Va con `<dialog>` nativo: trae el foco, el fondo inerte y la tecla Escape sin
 * código propio.
 */

import { useEffect, useRef } from "react";

import { coma } from "@/lib/plan";
import type { Escenario, Plan } from "@/lib/plan";

/** La carpeta del Drive con el archivo de verificación de las 17 sedes. Va sin
 *  el `/u/0/` del enlace original, que ata la URL a la primera cuenta de Google
 *  abierta en el navegador de quien la copió. */
const CARPETA_VERIFICACION =
  "https://drive.google.com/drive/folders/17J3YCy_odUoWeljcwNkd8s5m_5eOomm-";

export default function FormaCalculo({
  plan,
  escenario,
  abierto,
  onCierra,
}: {
  plan: Plan;
  escenario: Escenario;
  abierto: boolean;
  onCierra: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  const grupos = new Map<string, number>();
  for (const s of plan.sedes) {
    if (s.escenario !== escenario) continue;
    const g = s.grupo ?? "BID (43)";
    grupos.set(g, (grupos.get(g) ?? 0) + 1);
  }
  const dias = (plan.dias ?? []).filter((d) => d.escenario === escenario);
  const cupos = plan.tdr.cuadrillas * plan.tdr.semanas_campo * 5;
  const libres = cupos - dias.length;
  const resumen = plan.escenarios.find((e) => e.escenario === escenario);
  const dosVisitas = dias.filter((d) => d.visitas.length === 2).length;
  const unaVisita = dias.length - dosVisitas;
  const total = dias.reduce((a, d) => a + d.min_carretera, 0);
  const porCuadrillaMin = new Map<string, number>();
  for (const d of dias) {
    porCuadrillaMin.set(d.cuadrilla, (porCuadrillaMin.get(d.cuadrilla) ?? 0) + d.min_carretera);
  }
  const cuadrillas = [...porCuadrillaMin.entries()].sort();
  const otrasGrupos = [...grupos.entries()].filter(([g]) => g !== "BID (43)");

  return (
    <dialog
      ref={ref}
      onClose={onCierra}
      // Un clic en el fondo cierra: el fondo es el propio diálogo.
      onClick={(e) => {
        if (e.target === ref.current) onCierra();
      }}
      className="m-auto max-h-[85dvh] w-[680px] max-w-[calc(100vw-32px)] rounded-lg border p-0 shadow-xl backdrop:bg-black/40"
      style={{
        background: "var(--superficie)",
        color: "var(--tinta)",
        borderColor: "var(--borde)",
      }}
    >
      <div className="flex items-start justify-between gap-2 border-b px-5 py-3"
           style={{ borderColor: "var(--linea)" }}>
        <h2 className="text-[16px] font-semibold">Forma de cálculo</h2>
        <button
          onClick={onCierra}
          className="rounded border px-2 py-0.5 text-[11px]"
          style={{ borderColor: "var(--linea)", color: "var(--tinta-2)" }}
        >
          cerrar
        </button>
      </div>

      <div className="flex flex-col gap-4 px-5 py-4 text-[13px] leading-relaxed"
           style={{ color: "var(--tinta-2)" }}>
        <Seccion titulo="1. Limpieza de coordenadas">
          <p>
            Las coordenadas de sede que entregó el MEN son las del SIMAT, el mismo
            registro de 2022 que ya trabajábamos en nuestro georepositorio. En los
            análisis anteriores comprobábamos que cada escuela cayera en su
            departamento y su municipio. Para este ejercicio hacía falta más: que
            la distancia real a cada sede se apartara lo menos posible. Por eso
            crucé esas coordenadas con las que tomaron los inspectores al llenar
            las fichas AIS en campo, y muchas veces no coincidían.
          </p>
          <p>
            Para no resolverlo a mano crucé cinco fuentes: el SIMAT, el GPS de las
            fichas AIS, el catastro, las huellas de edificación de Open Buildings
            y OpenStreetMap. Donde las fuentes concordaban, la coordenada quedó
            resuelta de forma automática (26 de las 43). Las otras 17 las revisé
            una por una, sobre imagen satelital y contra el predio catastral, y
            cada decisión quedó registrada en un{" "}
            <a
              href={CARPETA_VERIFICACION}
              target="_blank"
              rel="noreferrer"
              className="underline"
              style={{ color: "var(--acento)" }}
            >
              archivo de verificación en el Drive
            </a>
            .
          </p>
          <p>
            En siete de esas 17 la revisión movió el punto que proponía el cruce
            automático, hasta 12,9 km en un caso: en Alfredo Garrido Tovar
            (Riofrío) la ficha AIS apuntaba a otro corregimiento. Contra la
            coordenada del SIMAT, la final se aparta como máximo 1,4 km. En esas
            siete sedes cambió el punto donde la escuela se conecta a la vía, y en
            cuatro cambió el tipo de vía de acceso.
          </p>
        </Seccion>

        <Seccion titulo="2. Tiempos por carretera">
          <p>
            Con las coordenadas limpias medí el tiempo por carretera desde el
            centro de Cali y de Pereira hasta cada sede, con tres motores de
            ruteo. Los que trabajan solo sobre OpenStreetMap (OSRM y Valhalla)
            suponen la velocidad de cada vía a partir de su categoría, porque el
            90,8 % de los tramos del Valle no declara velocidad. Eso los vuelve
            optimistas: uno de ellos estimaba 65 minutos a una sede de Yotoco
            donde la referencia da 90.
          </p>
          <p>
            La referencia es Mapbox, que no supone la velocidad sino que usa
            velocidades observadas. Los otros dos quedaron como control, en las
            columnas finales del Excel de cotización.
          </p>
          <p>
            Mapbox responde distinto según la hora. Para que el número no cambie
            de una consulta a otra, cada trayecto se pide con hora fija: salida a
            las 7:00, de una escuela a otra a las 11:00 y regreso a las 16:00 de
            un martes. La línea que se dibuja en
            el mapa es el trazado de esa misma consulta, así que el dibujo y los
            minutos dicen lo mismo.
          </p>
        </Seccion>

        <Seccion titulo="3. Vías de acceso">
          <p>
            El tipo de vía es la clase, en OpenStreetMap, de la vía más cercana a
            la sede, que en las 43 queda a menos de 49 m. Se marca como acceso
            difícil el camino destapado o el camino rural sin categoría: son 8
            sedes. La clase no dice si la vía está pavimentada.
          </p>
          <p>
            El SINC del Ministerio de Transporte se usó solo para nombrar caminos
            rurales. En 18 de las 43 sedes su tramo municipal cae a menos de 100 m
            del punto, así que es la misma vía de entrada que muestra
            OpenStreetMap. Le puso nombre a 9 vías que OpenStreetMap dejaba en
            blanco, y 6 de esas 9 son de acceso difícil.
          </p>
        </Seccion>

        <Seccion titulo="4. Qué escuelas entran">
          <p>
            Las tres secciones de arriba hablan de las{" "}
            {grupos.get("BID (43)") ?? 43} sedes del préstamo: esas son las que
            pasaron por la limpieza de coordenadas. Las que se suman después no
            están en esa cuenta.
          </p>
          <p>
            El encargo original son {grupos.get("BID (43)") ?? 0} sedes del
            Valle. En la reunión del 16 de septiembre se decidió probar cuántas
            sedes más caben de las secretarías certificadas del consolidado,
            sacando secretarías completas si no alcanza el tiempo. Buenaventura
            quedó fuera.
            {otrasGrupos.length === 0
              ? " Este alcance es solo esas 43."
              : ` Este alcance suma ${otrasGrupos.map(([g, n]) => `${n} de ${g}`).join(", ")}.`}{" "}
            Una sede de Palmira quedó fuera porque ninguna fuente trae su
            coordenada. Las sedes nuevas no están en el tablero del Valle, así
            que su estado sale de la capa actual del MEN.
          </p>
        </Seccion>

        <Seccion titulo="5. Cuadrillas y calendario">
          <p>
            El TdR fija {plan.tdr.cuadrillas} cuadrillas por{" "}
            {plan.tdr.semanas_campo} semanas: {cupos} días-cuadrilla. Este
            alcance usa {resumen?.cuadrillas ?? "—"} cuadrillas y{" "}
            {resumen?.dias_campo ?? "—"} días ({dias.length}{" "}
            días de campo)
            {resumen
              ? resumen.en_tdr
                ? ", y cabe en el TdR"
                : ", y no cabe en el TdR"
              : ""}
            . Cada día tiene una o dos visitas: con inspecciones de 3 horas y
            una jornada de 8, dos visitas dejan 2 horas para manejar y una sola
            deja 5. La cuadrilla duerme en una de las siete ciudades del
            corredor o en una de cinco cabeceras con hoteles estables según el
            Registro Nacional de Turismo y sin daño grave en su casco urbano
            según el MEN. No vuelve a su base los fines de semana: el lunes
            sigue desde donde terminó el viernes.
            {resumen ? ` ${basesDelResumen(resumen.bases)}.` : ""}
          </p>
          <p>
            El plan lo arma un optimizador exacto (CP-SAT, de OR-Tools) en un
            solo paso: decide a la vez qué escuelas van juntas en un día, qué
            cuadrilla hace cada día, en qué orden y dónde duerme, con la regla
            de que el sitio donde termina un día es donde empieza el siguiente.
            Busca el menor tiempo total de carretera, con la regla de que cada
            municipio lo atiende una sola cuadrilla. Repartir sede por sede
            costaba lo mismo, pero partía municipios entre dos cuadrillas.
          </p>
          <p>
            Resultado: {dosVisitas} días con dos visitas y {unaVisita} con una
            {libres > 0
              ? ` (${libres === 1 ? "sobra un día-cuadrilla" : `sobran ${libres} días-cuadrilla`} del cupo del TdR)`
              : libres < 0
                ? ` (se pasa en ${-libres === 1 ? "un día-cuadrilla" : `${-libres} días-cuadrilla`} del cupo del TdR)`
                : ""}
            , {coma(total / 60)} h de carretera en total
            {resumen?.optimo_probado
              ? ", el mínimo posible con estas reglas"
              : resumen
                ? `; ningún plan con estas reglas baja de ${coma(resumen.cota_horas)} h`
                : ""}
            . Por cuadrilla: {cuadrillas
              .map(([c, m]) => `${c} ${coma(m / 60)} h`)
              .join(", ")}
            . La cuadrilla que maneja menos es la que hace más visitas, así que
            la jornada total queda pareja. El orden no prioriza por el estado
            de la escuela.
          </p>
          <p>
            El punto de cada ciudad es la mediana de las coordenadas de sus
            sedes urbanas. El plan nombra la ciudad, no el hotel: que haya cama
            hay que confirmarlo.
          </p>
        </Seccion>
      </div>
    </dialog>
  );
}

function basesDelResumen(bases: Record<string, string>): string {
  const por = new Map<string, string[]>();
  for (const [c, base] of Object.entries(bases)) {
    por.set(base, [...(por.get(base) ?? []), c]);
  }
  const trozos = [...por.entries()].map(([base, cs]) => {
    const cuales =
      cs.length === 1 ? cs[0] : `${cs.slice(0, -1).join(", ")} y ${cs.at(-1)}`;
    return `${cuales} ${cs.length === 1 ? "sale" : "salen"} de ${base}`;
  });
  return trozos.length === 1
    ? trozos[0]
    : `${trozos.slice(0, -1).join("; ")} y ${trozos.at(-1)}`;
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[13px] font-semibold" style={{ color: "var(--tinta)" }}>
        {titulo}
      </h3>
      {children}
    </section>
  );
}
