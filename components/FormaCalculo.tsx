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

import type { Escenario, Plan } from "@/lib/plan";

/** La carpeta del Drive con el archivo de verificación de las 17 sedes. Va sin
 *  el `/u/0/` del enlace original, que ata la URL a la primera cuenta de Google
 *  abierta en el navegador de quien la copió. */
const CARPETA_VERIFICACION =
  "https://drive.google.com/drive/folders/17J3YCy_odUoWeljcwNkd8s5m_5eOomm-";

function horas(n: number): string {
  return n.toFixed(1).replace(".", ",");
}

export default function FormaCalculo({
  plan,
  abierto,
  onCierra,
}: {
  plan: Plan;
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

  const esc = (id: Escenario) => plan.escenarios.find((e) => e.escenario === id);
  const porCuadrilla = (id: Escenario, c: string) =>
    plan.sedes
      .filter((s) => s.escenario === id && s.cuadrilla === c)
      .reduce((a, s) => a + s.min_carretera_del_dia, 0) / 60;

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
            las 7:00 y regreso a las 16:00 de un martes. La línea que se dibuja en
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

        <Seccion titulo="4. Asignación de cuadrillas">
          <p>
            El TdR fija 3 cuadrillas, 5 visitas por cuadrilla por semana y 3
            semanas de campo: 45 cupos para 43 visitas, una visita por día. Cada
            sede sale de la base más cercana por carretera, 28 desde Cali y 15
            desde Pereira. Eso pide 2 cuadrillas en Cali y 1 en Pereira, que es el
            único reparto que cabe. Las 2 visitas de holgura quedan en Cali.
          </p>
          <p>
            Primero se ordena y después se optimiza. Las sedes de Cali se reparten
            en dos zonas con municipios enteros, escogiendo la partición que deja
            las sedes más juntas: la cuadrilla A al norte (Andalucía, Restrepo,
            Riofrío, Trujillo, Vijes y Yotoco) y la B al sur (Candelaria, Dagua,
            Florida y La Cumbre). La C atiende todo lo de Pereira. Dentro de cada
            zona, un optimizador exacto (CP-SAT, de OR-Tools) arma las tres
            semanas con el menor tiempo total de carretera: decide qué sedes van
            juntas, en qué orden y dónde duerme la cuadrilla. Cada semana sale de
            la base el lunes y vuelve el viernes.
          </p>
          <p>
            La zona lejana le toca entera a una cuadrilla, así que A maneja más
            que B: {horas(porCuadrilla("municipio", "A"))} h contra{" "}
            {horas(porCuadrilla("municipio", "B"))} h durmiendo en el municipio. El
            total no cambia con eso. Las semanas con 5 visitas van primero, para
            que el cupo libre quede al final y ahí se pueda recuperar un día
            perdido. El orden no prioriza por el estado de la escuela.
          </p>
        </Seccion>

        <Seccion titulo="5. Escenarios de pernoctación">
          <p>
            Los tres escenarios son el mismo modelo y solo cambia dónde se permite
            dormir: volver a la base cada noche ({horas(esc("base")?.horas_carretera ?? 0)} h
            de carretera), dormir en una ciudad principal del corredor, que son
            Palmira, Armenia, Tuluá, Cartago y Buga ({horas(esc("ciudad")?.horas_carretera ?? 0)} h),
            o dormir en la cabecera del municipio ({horas(esc("municipio")?.horas_carretera ?? 0)} h).
          </p>
          <p>
            El punto de cada pueblo es la mediana de las coordenadas de sus sedes
            urbanas. El plan nombra el pueblo, no el hotel: que haya cama hay que
            confirmarlo. Volviendo a la base cada noche cualquier calendario
            cuesta lo mismo, así que ese escenario usa el calendario del de
            municipio, escuela por escuela.
          </p>
        </Seccion>
      </div>
    </dialog>
  );
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
