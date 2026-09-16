"use client";

/** El plan de campo, puesto a correr.
 *
 * LO QUE ESTA PANTALLA NO ES. No es una orden de trabajo ni dice quién tiene que
 * ir a dónde. Es una demostración: así se pueden acomodar las rutas, esto demora
 * cada día, y esto suma al final. Sirve para que quien tiene que cotizar el
 * trabajo pueda evaluarlo, no para que alguien la obedezca.
 *
 * POR QUÉ SE REPRODUCE EN VEZ DE DIBUJARSE. Nueve semanas-cuadrilla dibujadas a
 * la vez encima de un mapa son un plato de espagueti y no se lee ninguna. El
 * mismo plan corriendo día por día, con las tres cuadrillas moviéndose a la vez
 * y un contador que sube, se entiende sin explicación: se ve dónde se va el
 * tiempo, se ve qué días son largos, y al final el mapa queda dibujado entero
 * pero se llegó a él viéndolo construirse.
 *
 * LOS TRES ESCENARIOS SON EL CONTROL PRINCIPAL. Con una visita por día no hay
 * recorrido que optimizar dentro del día: lo único que mueve el total es dónde
 * duerme la cuadrilla. Y eso depende de lo que cueste una noche de hotel, que no
 * sabemos. Así que la pantalla no escoge: deja correr los tres y que se vea la
 * diferencia en el contador.
 *
 * LA INSPECCIÓN ES UN CONTROL, NO UN DATO. Cuánto dura una inspección no lo
 * sabemos y el TdR lo esquiva. En vez de inventar una cifra, la pantalla la pone
 * como perilla: quien mira la mueve y ve cuántos días se salen de la jornada.
 *
 * DE DÓNDE SALE CADA CIFRA. Los tiempos son de Mapbox, saliendo a las 7 de la
 * mañana y volviendo a las 4 de la tarde de un día hábil. Las líneas del mapa
 * son el trazado real de esa misma consulta, no rectas entre puntos. La ficha de
 * cada escuela trae lo que el formulario del IDIGER pide en su primera caja y
 * nosotros ya sabemos sin ir.
 */

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Info, Tarjeta } from "@/components/Piezas";
import FichaPlan from "@/components/FichaPlan";
import FormaCalculo from "@/components/FormaCalculo";
import type { Movil } from "@/components/MapaPlan";
import {
  DIAS_DE_CAMPO,
  INSPECCION_MIN_DEFECTO,
  INSPECCION_RANGO,
  JORNADA_MIN,
  MIN_DIA_APRETADO,
  NOMBRE_ESCENARIO,
  armaGuion,
  cargaPlan,
  cargaTramos,
  colorCuadrilla,
  cuadrillas,
  estadoEn,
  hm,
  largoDelDia,
} from "@/lib/plan";
import type {
  ColeccionTramos,
  Escenario,
  GuionDia,
  Plan,
} from "@/lib/plan";

const MapaPlan = dynamic(() => import("@/components/MapaPlan"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm">
      cargando el mapa…
    </div>
  ),
});

const ORDEN: Escenario[] = ["base", "ciudad", "municipio"];

/** A qué ritmo corre el reloj: minutos de jornada por segundo de pantalla.
 *
 * Con 240, un día de cuatro horas de trabajo pasa en un segundo y las tres
 * semanas completas duran algo menos de un minuto. Es el ritmo al que se alcanza
 * a ver cada movimiento sin que la demostración se haga larga.
 */
const RITMOS = [120, 240, 480];

const DIAS_SEMANA = ["lunes", "martes", "miércoles", "jueves", "viernes"];
const NOCHES_POR_SEMANA = 4;
/** Lo que ocupa el panel de simulación desde el borde inferior, medido en
 *  pantalla: 227 px más el margen. La ficha termina antes y el mapa lo
 *  descuenta al encuadrar la simulación. */
const ALTO_SIMULACION = 235;

/** Cómo leer la simulación: el mapa en movimiento y la cuadrícula de abajo.
 *  Vive en el ícono del título del panel, que es donde se mira mientras corre. */
const COMO_LEER_SIMULACION = [
  "En la cuadrícula, cada columna es un día de campo y cada fila una cuadrilla. La barra de color son las horas de carretera y la gris, encima, la inspección; la línea punteada marca una jornada de 8 horas. Toca una casilla para saltar a ese día.",
  "Al darle reproducir, el círculo grande con letra es la cuadrilla en movimiento. El número dentro del pin de una escuela es el día de campo en que se visita, del 1 al 15 (semana 1: días 1 a 5; semana 2: 6 a 10; semana 3: 11 a 15). Es el orden del recorrido, no una prioridad.",
  "Rombo lleno, la base. Cuadrado hueco, el poblado donde se duerme: hueco porque el plan nombra el pueblo, no el hotel.",
  "Línea llena, la ida a la escuela. Punteada, el regreso de la tarde. Las líneas son el trazado real por carretera, no rectas entre puntos. Cerca en el mapa no es cerca por carretera: hay sedes a tres kilómetros en línea recta y a media hora de camino.",
].join("\n\n");
/** Los controles del mapa abajo a la derecha: zoom, casa, escala y la
 *  atribución, medidos en pantalla. */
const ALTO_CONTROLES = 150;

/** Cuánto lleva acumulado el plan hasta un instante dado. */
function acumulado(guion: GuionDia[], dia: number, t: number, inspeccion: number) {
  let min = 0;
  let km = 0;
  let visitas = 0;
  let noches = 0;
  for (const g of guion) {
    if (g.diaCorrido < dia) {
      min += g.minManana + g.minTarde;
      km += g.kmManana + g.kmTarde;
      visitas += 1;
      if (g.fueraDeBase) noches += 1;
      continue;
    }
    if (g.diaCorrido > dia) continue;
    const e = estadoEn(g, t, inspeccion);
    min += e.minHechos;
    km += e.kmHechos;
    // La visita se cuenta al llegar, no al terminar el día: es lo que la
    // cuadrilla ya tiene hecho en ese momento.
    if (e.fase !== "manana") visitas += 1;
    if (e.fase === "fin" && g.fueraDeBase) noches += 1;
  }
  return { min, km, visitas, noches };
}

export default function PaginaPlan() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [tramos, setTramos] = useState<ColeccionTramos | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [escenario, setEscenario] = useState<Escenario>("municipio");
  const [inspeccion, setInspeccion] = useState(INSPECCION_MIN_DEFECTO);
  const [cuadrilla, setCuadrilla] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [tema, setTema] = useState<"claro" | "oscuro">("claro");

  const [corriendo, setCorriendo] = useState(false);
  // Al entrar no corre nada: se ve el plan completo, con las escuelas del color
  // de su cuadrilla. Se sale del reposo al reproducir o al escoger un día.
  const [enPausaInicial, setEnPausaInicial] = useState(true);
  // La simulación día por día va apagada al entrar. Apagada, la pantalla es el
  // plan completo y nada más.
  const [simular, setSimular] = useState(false);
  const [formaCalculo, setFormaCalculo] = useState(false);
  const reposo = !simular || enPausaInicial;
  const arranca = useCallback((v: boolean) => {
    if (v) setEnPausaInicial(false);
    setCorriendo(v);
  }, []);
  const [ritmo, setRitmo] = useState(RITMOS[1]);
  // El reloj vive en una referencia y no en el estado porque avanza sesenta
  // veces por segundo. `tic` es lo único que se pone en estado, y solo existe
  // para que React vuelva a dibujar.
  const reloj = useRef({ dia: 1, t: 0 });
  const [, setTic] = useState(0);

  useEffect(() => {
    document.documentElement.dataset.theme = tema === "oscuro" ? "dark" : "light";
  }, [tema]);

  useEffect(() => {
    cargaPlan().then(setPlan).catch((e) => setError(String(e)));
    cargaTramos().then(setTramos).catch((e) => setError(String(e)));
  }, []);

  const guion = useMemo(
    () => (plan && tramos ? armaGuion(plan, tramos, escenario) : []),
    [plan, tramos, escenario],
  );

  const insRef = useRef(inspeccion);
  insRef.current = inspeccion;
  const ritmoRef = useRef(ritmo);
  ritmoRef.current = ritmo;
  const guionRef = useRef(guion);
  guionRef.current = guion;

  // El reloj. Avanza minutos de jornada y al acabarse el día más largo pasa al
  // siguiente: las tres cuadrillas salen el mismo día, así que la que termina
  // temprano espera, y esa espera también es información.
  useEffect(() => {
    if (!corriendo || guion.length === 0) return;
    let anterior = performance.now();
    let vivo = true;
    const paso = (ahora: number) => {
      if (!vivo) return;
      const dt = Math.min((ahora - anterior) / 1000, 0.1);
      anterior = ahora;
      const r = reloj.current;
      r.t += dt * ritmoRef.current;
      let largo = largoDelDia(guionRef.current, r.dia, insRef.current);
      while (r.t >= largo && r.dia < DIAS_DE_CAMPO) {
        r.t -= largo;
        r.dia += 1;
        largo = largoDelDia(guionRef.current, r.dia, insRef.current);
      }
      if (r.dia >= DIAS_DE_CAMPO && r.t >= largo) {
        r.t = largo;
        setCorriendo(false);
      }
      setTic((x) => x + 1);
      requestAnimationFrame(paso);
    };
    const id = requestAnimationFrame(paso);
    return () => {
      vivo = false;
      cancelAnimationFrame(id);
    };
  }, [corriendo, guion.length]);

  const { dia, t } = reloj.current;
  // Qué le toca hoy a cada cuadrilla. No depende del reloj dentro del día: lo
  // que se mueve con `t` es la posición, que se calcula aparte.
  const hoy = useMemo(
    () => guion.filter((g) => g.diaCorrido === dia),
    [guion, dia],
  );

  const moviles: Movil[] = hoy.map((g) => {
    const e = estadoEn(g, t, inspeccion);
    return { cuadrilla: g.cuadrilla, punto: e.punto, fase: e.fase };
  });

  const visitadas = useMemo(() => {
    const s = new Set<string>();
    for (const g of guion) {
      if (g.diaCorrido < dia) s.add(g.dane);
      else if (g.diaCorrido === dia && t >= g.minManana) s.add(g.dane);
    }
    return s;
    // El reloj entra redondeado a cinco minutos de jornada a propósito. Esto
    // alimenta un redibujo del mapa, y rehacerlo sesenta veces por segundo para
    // que una escuela se prenda unos milisegundos antes no compra nada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guion, dia, Math.floor(t / 5)]);

  const cuenta = acumulado(guion, dia, t, inspeccion);
  const totalPlan = useMemo(() => {
    const min = guion.reduce((a, g) => a + g.minManana + g.minTarde, 0);
    const km = guion.reduce((a, g) => a + g.kmManana + g.kmTarde, 0);
    return { min, km };
  }, [guion]);

  const reinicia = useCallback(() => {
    reloj.current = { dia: 1, t: 0 };
    setCorriendo(false);
    setEnPausaInicial(true);
    setTic((x) => x + 1);
  }, []);

  const cierraFicha = useCallback(() => setSeleccion(null), []);

  const vaAlDia = useCallback((d: number) => {
    reloj.current = { dia: d, t: 0 };
    setEnPausaInicial(false);
    setTic((x) => x + 1);
  }, []);

  const sede = useMemo(
    () =>
      plan?.sedes.find(
        (s) => s.escenario === escenario && s.dane_propuesto === seleccion,
      ) ?? null,
    [plan, escenario, seleccion],
  );

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <div className="absolute inset-0">
        <MapaPlan
          plan={plan}
          tramos={tramos}
          escenario={escenario}
          diaActual={dia}
          moviles={reposo ? [] : moviles}
          visitadas={visitadas}
          reposo={reposo}
          simulando={simular}
          altoSimulacion={ALTO_SIMULACION}
          cuadrilla={cuadrilla}
          seleccion={seleccion}
          onSelecciona={setSeleccion}
          tema={tema}
        />
      </div>

      <div
        // La columna usa todo el alto: el panel de simulación arranca a su
        // derecha, así que no la tapa. En el teléfono sí la tapa, y ahí se
        // acorta.
        className={`pointer-events-none absolute left-0 top-0 z-10 flex w-[380px] max-w-full flex-col gap-2 overflow-y-auto p-3 ${
          simular ? "max-h-[calc(100dvh-265px)] md:max-h-dvh" : "max-h-dvh"
        }`}
      >
        <div className="pointer-events-auto flex flex-col gap-2">
          <Encabezado plan={plan} tema={tema} onTema={setTema} />
          {error && (
            <Tarjeta>
              <p className="px-3 py-2 text-[12px]" style={{ color: "var(--critico)" }}>
                {error}. Hay que correr los scripts 77 y 78 antes de abrir esta
                pantalla.
              </p>
            </Tarjeta>
          )}
          {plan && (
            <TarjetaResumen
              guion={guion}
              escenario={escenario}
              cuadrillasPlan={cuadrillas(plan)}
              cuadrilla={cuadrilla}
              onCuadrilla={setCuadrilla}
            />
          )}
          {plan && (
            <TarjetaEscenarios
              plan={plan}
              escenario={escenario}
              onEscenario={(e) => {
                setEscenario(e);
                setSeleccion(null);
                reinicia();
              }}
            />
          )}
          {plan && (
            <TarjetaInspeccion
              valor={inspeccion}
              onValor={setInspeccion}
              guion={guion}
            />
          )}
          {plan && (
            <TarjetaSimular
              activo={simular}
              onActivo={(v) => {
                if (!v) reinicia();
                setSimular(v);
              }}
            />
          )}
          {plan && !reposo && (
            <TarjetaContador
              cuenta={cuenta}
              total={totalPlan}
              dia={dia}
              sedes={plan.tdr.sedes}
            />
          )}
          {!reposo && hoy.length > 0 && (
            <TarjetaHoy
              hoy={hoy}
              t={t}
              inspeccion={inspeccion}
              seleccion={seleccion}
              onSelecciona={setSeleccion}
            />
          )}
          {plan && (
            <TarjetaLeyenda plan={plan} onFormaCalculo={() => setFormaCalculo(true)} />
          )}
        </div>
      </div>

      {/* La ficha va en un recuadro propio a la derecha: aparece al escoger una
          escuela y se va al cerrarla, sin mover las tarjetas de la izquierda. */}
      {/* La vuelta al visor nacional, siempre arriba a la derecha. */}
      <Link
        href="/"
        className="absolute right-3 top-3 z-30 rounded-lg border px-3 py-1.5 text-[12px] font-semibold shadow-md"
        style={{
          background: "var(--superficie)",
          borderColor: "var(--borde)",
          color: "var(--acento)",
        }}
      >
        ← Visor nacional
      </Link>

      {plan && sede && (
        <div
          // Arranca debajo del botón del visor nacional.
          className="pointer-events-none absolute right-0 top-12 z-20 w-[400px] max-w-full overflow-y-auto p-3"
          // Termina antes de los controles del mapa (zoom, casa y escala), que
          // van abajo a la derecha: tapados, no había cómo volver a la vista
          // inicial con la ficha abierta, que es justo cuando se necesita.
          style={{
            maxHeight: simular
              ? `calc(100dvh - ${ALTO_SIMULACION + 48}px)`
              : `calc(100dvh - ${48 + ALTO_CONTROLES}px)`,
          }}
        >
          <div className="pointer-events-auto">
            <FichaPlan sede={sede} plan={plan} onCierra={cierraFicha} />
          </div>
        </div>
      )}

      {plan && (
        <FormaCalculo
          plan={plan}
          abierto={formaCalculo}
          onCierra={() => setFormaCalculo(false)}
        />
      )}

      {plan && simular && guion.length > 0 && (
        <BarraTiempo
          guion={guion}
          cuadrillasPlan={cuadrillas(plan)}
          dia={reposo ? 0 : dia}
          t={t}
          inspeccion={inspeccion}
          corriendo={corriendo}
          onCorriendo={arranca}
          ritmo={ritmo}
          onRitmo={setRitmo}
          onReinicia={reinicia}
          onDia={vaAlDia}
          cuadrilla={cuadrilla}
          onCuadrilla={setCuadrilla}
        />
      )}
    </main>
  );
}

function Encabezado({
  plan,
  tema,
  onTema,
}: {
  plan: Plan | null;
  tema: "claro" | "oscuro";
  onTema: (t: "claro" | "oscuro") => void;
}) {
  return (
    <Tarjeta>
      <div className="flex items-start justify-between gap-2 px-3 py-2">
        <div>
          <h1 className="text-[15px] font-semibold leading-tight">
            Visitas en campo
          </h1>
          <p className="text-[11px]" style={{ color: "var(--tinta-2)" }}>
            {plan
              ? `${plan.tdr.sedes} sedes · ${plan.tdr.cuadrillas} cuadrillas · ${plan.tdr.semanas_campo} semanas`
              : "cargando…"}
            <Info
              texto={
                "Esto no es una orden de trabajo ni dice quién tiene que ir a dónde. Es una demostración de cómo se pueden acomodar las rutas y de cuánto demora cada día, para poder evaluar lo que cuesta.\n\nEl TdR fija 3 cuadrillas, 5 visitas por cuadrilla por semana y 3 semanas de campo: 45 cupos para 43 visitas. Cinco visitas en cinco días son una visita por día, así que dentro del día no hay recorrido que optimizar. Lo único que mueve el total de carretera es dónde duerme la cuadrilla."
              }
              ancho
            />
          </p>
          {/* Una sola opción por ahora: las 43 sedes son todas de la SE del
              Valle. El menú queda para cuando entren otras secretarías. */}
          <label className="mt-2 flex items-center gap-2 text-[11px]">
            <span style={{ color: "var(--tinta-2)" }}>Secretaría</span>
            <select
              value="VALLE"
              onChange={() => {}}
              className="rounded border px-1.5 py-0.5 text-[11px]"
              style={{
                borderColor: "var(--linea)",
                background: "var(--superficie)",
                color: "var(--tinta)",
              }}
            >
              <option value="VALLE">Valle del Cauca</option>
            </select>
          </label>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => onTema(tema === "claro" ? "oscuro" : "claro")}
            className="rounded border px-2 py-1 text-[10px]"
            style={{ borderColor: "var(--linea)", color: "var(--tinta-2)" }}
          >
            {tema === "claro" ? "oscuro" : "claro"}
          </button>
        </div>
      </div>
    </Tarjeta>
  );
}

/** El contador que sube. Es el instrumento principal de la pantalla. */
function TarjetaContador({
  cuenta,
  total,
  dia,
  sedes,
}: {
  cuenta: { min: number; km: number; visitas: number; noches: number };
  total: { min: number; km: number };
  dia: number;
  sedes: number;
}) {
  const semana = Math.floor((dia - 1) / 5) + 1;
  const enSemana = ((dia - 1) % 5) + 1;
  return (
    <Tarjeta>
      <div className="px-3 py-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px]" style={{ color: "var(--tinta-3)" }}>
            semana {semana} · {DIAS_SEMANA[enSemana - 1]} · día {dia} de{" "}
            {DIAS_DE_CAMPO}
          </span>
          <span className="num text-[11px]" style={{ color: "var(--tinta-3)" }}>
            {cuenta.visitas} de {sedes} visitas
          </span>
        </div>
        <div className="mt-1 flex items-end gap-4">
          <div>
            <span className="num block text-[28px] font-semibold leading-none">
              {(cuenta.min / 60).toFixed(1)}
            </span>
            <span className="text-[10px]" style={{ color: "var(--tinta-2)" }}>
              horas de carretera
            </span>
          </div>
          <div>
            <span className="num block text-[28px] font-semibold leading-none">
              {Math.round(cuenta.km).toLocaleString("es-CO")}
            </span>
            <span className="text-[10px]" style={{ color: "var(--tinta-2)" }}>
              kilómetros
            </span>
          </div>
          <div>
            <span className="num block text-[28px] font-semibold leading-none">
              {cuenta.noches}
            </span>
            <span className="text-[10px]" style={{ color: "var(--tinta-2)" }}>
              noches fuera
            </span>
          </div>
        </div>
        <div
          className="mt-2 h-[3px] w-full overflow-hidden rounded-full"
          style={{ background: "var(--linea)" }}
        >
          <div
            className="h-[3px] rounded-full"
            style={{
              width: `${total.min > 0 ? (cuenta.min / total.min) * 100 : 0}%`,
              background: "var(--acento)",
            }}
          />
        </div>
        <p className="mt-1 text-[10px]" style={{ color: "var(--tinta-3)" }}>
          Al terminar: {(total.min / 60).toFixed(0)} h y{" "}
          {Math.round(total.km).toLocaleString("es-CO")} km. Solo carretera, sin
          la inspección.
        </p>
      </div>
    </Tarjeta>
  );
}

/** El interruptor de la simulación. Apagado por defecto: la pantalla abre con
 *  el plan completo y el recorrido día por día es algo que se pide. */
function TarjetaSimular({
  activo,
  onActivo,
}: {
  activo: boolean;
  onActivo: (v: boolean) => void;
}) {
  return (
    <Tarjeta>
      <label className="flex cursor-pointer items-center gap-2 px-3 py-2">
        <input
          type="checkbox"
          checked={activo}
          onChange={(e) => onActivo(e.target.checked)}
        />
        <span className="text-[12px] font-semibold">Simular recorridos diarios</span>
      </label>
    </Tarjeta>
  );
}

/** La vista de entrada: el plan completo del escenario, sin reproducir.
 *
 * Los totales son los del plan entero y, debajo, cuánto le toca a cada
 * cuadrilla. Es lo que hace evidente el reparto antes de verlo moverse: qué
 * cuadrilla carga con más carretera y cuál duerme más fuera.
 */
function TarjetaResumen({
  guion,
  escenario,
  cuadrillasPlan,
  cuadrilla,
  onCuadrilla,
}: {
  guion: GuionDia[];
  escenario: Escenario;
  cuadrillasPlan: string[];
  cuadrilla: string | null;
  onCuadrilla: (c: string | null) => void;
}) {
  const suma = (gs: GuionDia[]) => ({
    sedes: gs.length,
    min: gs.reduce((a, g) => a + g.minManana + g.minTarde, 0),
    km: gs.reduce((a, g) => a + g.kmManana + g.kmTarde, 0),
    noches: gs.filter((g) => g.fueraDeBase).length,
    // Cada semana deja a lo sumo 4 noches fuera: de lunes a jueves. El viernes
    // se vuelve a la base.
    posibles: NOCHES_POR_SEMANA * new Set(gs.map((g) => `${g.cuadrilla}|${g.semana}`)).size,
  });
  const total = suma(guion);
  const porCuadrilla = cuadrillasPlan.map((c) => ({
    c,
    ...suma(guion.filter((g) => g.cuadrilla === c)),
  }));
  // La base de cada cuadrilla es de donde sale el primer día.
  const bases = new Map(
    guion.filter((g) => g.diaCorrido === 1).map((g) => [g.cuadrilla, g.saleDe]),
  );
  return (
    <Tarjeta>
      <div className="px-3 py-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px]" style={{ color: "var(--tinta-3)" }}>
            plan completo · {NOMBRE_ESCENARIO[escenario].toLowerCase()}
          </span>
          <span className="num text-[11px]" style={{ color: "var(--tinta-3)" }}>
            {total.sedes} sedes · {DIAS_DE_CAMPO} días
          </span>
        </div>
        <div className="mt-1 flex items-end gap-4">
          <div>
            <span className="num block text-[28px] font-semibold leading-none">
              {(total.min / 60).toFixed(1)}
            </span>
            <span className="text-[10px]" style={{ color: "var(--tinta-2)" }}>
              horas de carretera
            </span>
          </div>
          <div>
            <span className="num block text-[28px] font-semibold leading-none">
              {Math.round(total.km).toLocaleString("es-CO")}
            </span>
            <span className="text-[10px]" style={{ color: "var(--tinta-2)" }}>
              kilómetros
            </span>
          </div>
          <div>
            <span className="num block text-[28px] font-semibold leading-none">
              {total.noches}
              <span className="text-[13px] font-normal" style={{ color: "var(--tinta-3)" }}>
                {" "}de {total.posibles}
              </span>
            </span>
            <span className="text-[10px]" style={{ color: "var(--tinta-2)" }}>
              noches fuera
              <Info
                texto={`Se suman las noches de las tres cuadrillas. Cada cuadrilla trabaja de lunes a viernes y el viernes vuelve a su base, así que pasa a lo sumo 4 noches fuera por semana: 12 en las tres semanas. Con tres cuadrillas el tope es ${total.posibles}.`}
                ancho
              />
            </span>
          </div>
        </div>
        <table className="num mt-2 w-full text-[11px]">
          <thead>
            <tr style={{ color: "var(--tinta-3)" }}>
              <th className="text-left font-normal">cuadrilla</th>
              <th className="text-right font-normal">sedes</th>
              <th className="text-right font-normal">horas</th>
              <th className="text-right font-normal">km</th>
              <th className="text-right font-normal">noches</th>
            </tr>
          </thead>
          <tbody>
            {porCuadrilla.map((f) => (
              <tr
                key={f.c}
                onClick={() => onCuadrilla(cuadrilla === f.c ? null : f.c)}
                className="cursor-pointer"
                style={{ opacity: cuadrilla !== null && cuadrilla !== f.c ? 0.4 : 1 }}
              >
                <td className="py-0.5">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: colorCuadrilla(f.c, false) }}
                    />
                    <span className="font-semibold">{f.c}</span>
                    <span style={{ color: "var(--tinta-3)" }}>
                      desde {bases.get(f.c)}
                    </span>
                  </span>
                </td>
                <td className="text-right">{f.sedes}</td>
                <td className="text-right">{(f.min / 60).toFixed(1)}</td>
                <td className="text-right">
                  {Math.round(f.km).toLocaleString("es-CO")}
                </td>
                <td className="text-right">
                  {f.noches}
                  <span style={{ color: "var(--tinta-3)" }}> de {f.posibles}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-[10px]" style={{ color: "var(--tinta-3)" }}>
          Solo carretera, sin la inspección. Tocar una cuadrilla deja solo sus
          escuelas en el mapa.
        </p>
        <a
          href={`datos/plan_cuadrillas_${escenario}.xlsx`}
          download={`visitas_por_cuadrilla_${escenario}.xlsx`}
          className="mt-2 inline-block rounded border px-2 py-1 text-[11px]"
          style={{ borderColor: "var(--acento)", color: "var(--acento)" }}
        >
          Descargar escuelas por cuadrilla (Excel)
        </a>
      </div>
    </Tarjeta>
  );
}

/** Los tres escenarios de dónde se duerme.
 *
 * La barra de cada uno es la misma magnitud, horas de carretera, en una sola
 * serie: no necesita leyenda ni color de categoría, así que va en tinta y no en
 * un tono que compita con las cuadrillas del mapa.
 */
function TarjetaEscenarios({
  plan,
  escenario,
  onEscenario,
}: {
  plan: Plan;
  escenario: Escenario;
  onEscenario: (e: Escenario) => void;
}) {
  const peor = Math.max(...plan.escenarios.map((e) => e.horas_carretera));
  const base = plan.escenarios.find((e) => e.escenario === "base");
  return (
    <Tarjeta>
      <div className="px-3 py-2">
        <h2 className="text-[12px] font-semibold">
          Escenarios
          <Info
            texto={
              "Los tres son el mismo plan y lo único que cambia es dónde se le permite pasar la noche. La base propia está permitida en los tres: si volver a Cali sale mejor que quedarse en el pueblo, el plan lo escoge.\n\nLo que cuesta una noche de hotel y un viático no está en ninguna fuente de este proyecto, así que la escogencia no se hace aquí. Lo que se muestra es qué se ahorra y a cambio de cuántas noches.\n\nEl plan nombra el poblado, no el hotel. Que haya cama hay que confirmarlo."
            }
            ancho
          />
        </h2>
        <p className="text-[10px]" style={{ color: "var(--tinta-2)" }}>
          Pernoctación: dónde duerme la cuadrilla
        </p>
        <div className="mt-2 flex flex-col gap-1">
          {ORDEN.map((id) => {
            const e = plan.escenarios.find((x) => x.escenario === id);
            if (!e) return null;
            const activo = id === escenario;
            const ahorro = base ? base.horas_carretera - e.horas_carretera : 0;
            return (
              <button
                key={id}
                onClick={() => onEscenario(id)}
                className="rounded border px-2 py-1.5 text-left"
                style={{
                  borderColor: activo ? "var(--acento)" : "var(--linea)",
                  background: activo ? "var(--plano)" : "transparent",
                }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className="text-[12px]"
                    style={{
                      color: activo ? "var(--acento)" : "var(--tinta)",
                      fontWeight: activo ? 600 : 400,
                    }}
                  >
                    {NOMBRE_ESCENARIO[id]}
                  </span>
                  <span className="num text-[12px] font-semibold">
                    {e.horas_carretera.toFixed(0)} h
                  </span>
                </div>
                <div
                  className="mt-1 h-[3px] w-full rounded-full"
                  style={{ background: "var(--linea)" }}
                >
                  <div
                    className="h-[3px] rounded-full"
                    style={{
                      width: `${(e.horas_carretera / peor) * 100}%`,
                      background: activo ? "var(--acento)" : "var(--tinta-3)",
                    }}
                  />
                </div>
                <p className="num mt-1 text-[10px]" style={{ color: "var(--tinta-2)" }}>
                  {e.noches_fuera} noches fuera ·{" "}
                  {Math.round(e.km).toLocaleString("es-CO")} km
                  {ahorro > 0.05 && ` · ahorra ${ahorro.toFixed(0)} h`}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </Tarjeta>
  );
}

/** La perilla de la inspección: el dato que no tenemos, puesto como control. */
function TarjetaInspeccion({
  valor,
  onValor,
  guion,
}: {
  valor: number;
  onValor: (v: number) => void;
  guion: GuionDia[];
}) {
  const largos = guion.filter(
    (g) => g.minManana + g.minTarde + valor > JORNADA_MIN,
  ).length;
  return (
    <Tarjeta>
      <div className="px-3 py-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[12px] font-semibold">
            Duración estimada de la inspección
            <Info
              texto={
                "No lo sabemos, y no se puede deducir. El TdR lo esquiva al fijar 5 visitas por cuadrilla por semana: ese número ya trae la inspección adentro, pero no la separa del desplazamiento.\n\nEn vez de inventar una cifra, aquí es una perilla. Muévala y mire cuántos días se salen de una jornada de ocho horas. Las ocho horas también son un supuesto nuestro, no del TdR."
              }
              ancho
            />
          </h2>
          <span className="num text-[12px] font-semibold">
            {(valor / 60).toFixed(1)} h
          </span>
        </div>
        <input
          type="range"
          min={INSPECCION_RANGO[0]}
          max={INSPECCION_RANGO[1]}
          step={30}
          value={valor}
          onChange={(e) => onValor(Number(e.target.value))}
          className="mt-1 w-full"
          aria-label="Duración de la inspección"
        />
        <p className="text-[10px]" style={{ color: "var(--tinta-2)" }}>
          Con {(valor / 60).toFixed(1)} h de inspección,{" "}
          <span style={{ color: largos > 0 ? "var(--critico)" : "var(--tinta-2)" }}>
            {largos} de {guion.length} días
          </span>{" "}
          pasan de una jornada de ocho horas.
        </p>
      </div>
    </Tarjeta>
  );
}

/** Qué está haciendo cada cuadrilla en este momento. */
function TarjetaHoy({
  hoy,
  t,
  inspeccion,
  seleccion,
  onSelecciona,
}: {
  hoy: GuionDia[];
  t: number;
  inspeccion: number;
  seleccion: string | null;
  onSelecciona: (d: string | null) => void;
}) {
  const DICE = {
    manana: "va en camino",
    inspeccion: "inspeccionando",
    tarde: "de regreso",
    fin: "terminó",
  } as const;
  return (
    <Tarjeta>
      <div className="px-3 py-2">
        <h2 className="text-[12px] font-semibold">Hoy</h2>
        <ul className="mt-1 flex flex-col gap-1">
          {hoy.map((g) => {
            const e = estadoEn(g, t, inspeccion);
            const activa = g.dane === seleccion;
            const total = g.minManana + g.minTarde;
            return (
              <li key={g.cuadrilla}>
                <button
                  onClick={() => onSelecciona(activa ? null : g.dane)}
                  className="w-full rounded border px-2 py-1 text-left"
                  style={{
                    borderColor: activa
                      ? colorCuadrilla(g.cuadrilla, false)
                      : "var(--linea)",
                    background: activa ? "var(--plano)" : "transparent",
                  }}
                >
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                      style={{ background: colorCuadrilla(g.cuadrilla, false) }}
                    >
                      {g.cuadrilla}
                    </span>
                    <span className="truncate text-[11px] font-medium">{g.sede}</span>
                  </div>
                  <p className="text-[10px]" style={{ color: "var(--tinta-3)" }}>
                    {g.municipio} · {DICE[e.fase]} · {hm(total)} de carretera
                  </p>
                  <p className="text-[10px]" style={{ color: "var(--tinta-3)" }}>
                    sale de {g.saleDe} · duerme en {g.duermeEn}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Tarjeta>
  );
}

/** La leyenda que vale siempre: lo que está en el mapa aunque no corra nada. */
function TarjetaLeyenda({
  plan,
  onFormaCalculo,
}: {
  plan: Plan;
  onFormaCalculo: () => void;
}) {
  return (
    <Tarjeta>
      <div className="px-3 py-2">
        <h2 className="text-[12px] font-semibold">Cómo leer el mapa</h2>
        <ul
          className="mt-1 flex flex-col gap-1 text-[10px]"
          style={{ color: "var(--tinta-2)" }}
        >
          <li>Los rombos negros son las bases de salida: Cali y Pereira.</li>
          <li>
            El área sombreada con contorno oscuro es el territorio de la
            Secretaría de Educación del Valle: 34 municipios, donde están las 43
            sedes. Los 8 municipios sin sombra tienen secretaría propia (Cali,
            Buenaventura, Buga, Cartago, Jamundí, Palmira, Tuluá y Yumbo). Al
            pasar el cursor, el mapa dice de quién es cada municipio.
          </li>
        </ul>
        <button
          onClick={onFormaCalculo}
          className="mt-2 text-[11px] underline"
          style={{ color: "var(--acento)" }}
        >
          Forma de cálculo
        </button>
        <p className="mt-1 text-[9px]" style={{ color: "var(--tinta-3)" }}>
          Generado el {plan.generado}.
        </p>
      </div>
    </Tarjeta>
  );
}

/** La barra de abajo: los controles y las quince columnas del campo.
 *
 * Cada columna es un día y cada fila una cuadrilla. La barra de una casilla es
 * la jornada de ese día, con la carretera abajo y la inspección encima, medida
 * contra la línea de las ocho horas. Así se ve de un vistazo cuáles son los días
 * largos y en qué semana están.
 */
function BarraTiempo({
  guion,
  cuadrillasPlan,
  dia,
  t,
  inspeccion,
  corriendo,
  onCorriendo,
  ritmo,
  onRitmo,
  onReinicia,
  onDia,
  cuadrilla,
  onCuadrilla,
}: {
  guion: GuionDia[];
  cuadrillasPlan: string[];
  dia: number;
  t: number;
  inspeccion: number;
  corriendo: boolean;
  onCorriendo: (v: boolean) => void;
  ritmo: number;
  onRitmo: (v: number) => void;
  onReinicia: () => void;
  onDia: (d: number) => void;
  cuadrilla: string | null;
  onCuadrilla: (c: string | null) => void;
}) {
  const dias = Array.from({ length: DIAS_DE_CAMPO }, (_, i) => i + 1);
  const porClave = new Map(guion.map((g) => [`${g.cuadrilla}|${g.diaCorrido}`, g]));
  // La escala deja la jornada de ocho horas al 70 % del alto, para que un día
  // que se pase tenga a dónde crecer y se vea que se pasó.
  const ALTO = 38;
  const escala = (min: number) => (min / JORNADA_MIN) * (ALTO * 0.7);
  const largoHoy = largoDelDia(guion, dia, inspeccion);

  return (
    // A la derecha de la columna de tarjetas y a la izquierda de los controles
    // del mapa: centrado sobre la pantalla entera tapaba el final de la columna.
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 px-3 pb-1 md:left-[368px] md:right-[112px]">
      <div className="pointer-events-auto">
        <Tarjeta>
          <div className="px-3 py-2">
            <h2 className="mb-1.5 text-[12px] font-semibold">
              Simulación
              <Info texto={COMO_LEER_SIMULACION} ancho />
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => onCorriendo(!corriendo)}
                className="rounded px-3 py-1.5 text-[12px] font-semibold text-white"
                style={{ background: "var(--acento)" }}
              >
                {corriendo ? "pausa" : "reproducir"}
              </button>
              <button
                onClick={onReinicia}
                className="rounded border px-2 py-1.5 text-[11px]"
                style={{ borderColor: "var(--linea)", color: "var(--tinta-2)" }}
              >
                volver al inicio
              </button>
              <div className="flex items-center gap-1">
                {RITMOS.map((r, i) => (
                  <button
                    key={r}
                    onClick={() => onRitmo(r)}
                    className="rounded border px-2 py-1 text-[10px]"
                    style={{
                      borderColor: ritmo === r ? "var(--acento)" : "var(--linea)",
                      color: ritmo === r ? "var(--acento)" : "var(--tinta-3)",
                    }}
                  >
                    ×{[1, 2, 4][i]}
                  </button>
                ))}
              </div>
              <span className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => onCuadrilla(null)}
                  className="rounded border px-2 py-1 text-[10px]"
                  style={{
                    borderColor: cuadrilla === null ? "var(--acento)" : "var(--linea)",
                    color: cuadrilla === null ? "var(--acento)" : "var(--tinta-3)",
                  }}
                >
                  las tres
                </button>
                {cuadrillasPlan.map((c) => (
                  <button
                    key={c}
                    onClick={() => onCuadrilla(cuadrilla === c ? null : c)}
                    className="flex items-center gap-1 rounded border px-2 py-1 text-[10px]"
                    style={{
                      borderColor:
                        cuadrilla === c ? colorCuadrilla(c, false) : "var(--linea)",
                      color: "var(--tinta-2)",
                    }}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: colorCuadrilla(c, false) }}
                    />
                    {c}
                  </button>
                ))}
              </span>
            </div>

            <div className="mt-4 flex gap-1">
              <div className="relative flex w-[60px] shrink-0 flex-col justify-end gap-0.5 pb-4">
                {/* El título del eje va fuera del flujo: si ocupara alto, la
                    columna de etiquetas crecería y las filas quedarían corridas
                    respecto de las casillas. */}
                <span
                  className="pointer-events-none absolute right-0 -top-3 text-[9px]"
                  style={{ color: "var(--tinta-3)" }}
                >
                  horas
                </span>
                {cuadrillasPlan.map((c) => (
                  <span
                    key={c}
                    className="relative flex items-center gap-1 text-[10px] font-semibold"
                    style={{ height: ALTO }}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: colorCuadrilla(c, false) }}
                    />
                    {c}
                    {/* El eje de cada fila: 0 abajo y 8 a la altura de la línea
                        punteada de las casillas. */}
                    <span
                      className="num pointer-events-none absolute right-1 text-[8px] font-normal leading-none"
                      style={{
                        bottom: escala(JORNADA_MIN) - 4,
                        color: "var(--tinta-3)",
                      }}
                    >
                      8
                    </span>
                    <span
                      className="num pointer-events-none absolute right-1 bottom-0 text-[8px] font-normal leading-none"
                      style={{ color: "var(--tinta-3)" }}
                    >
                      0
                    </span>
                    <span
                      className="pointer-events-none absolute right-0 w-[3px]"
                      style={{
                        bottom: escala(JORNADA_MIN),
                        borderTop: "1px dashed var(--tinta-3)",
                      }}
                    />
                  </span>
                ))}
              </div>
              <div className="flex flex-1 gap-[3px]">
                {dias.map((d) => {
                  const esHoy = d === dia;
                  const nuevaSemana = d % 5 === 1 && d > 1;
                  return (
                    <div
                      key={d}
                      className="flex flex-1 flex-col gap-0.5"
                      style={{
                        marginLeft: nuevaSemana ? 8 : 0,
                      }}
                    >
                      {cuadrillasPlan.map((c) => {
                        const g = porClave.get(`${c}|${d}`);
                        const apagada = cuadrilla !== null && cuadrilla !== c;
                        return (
                          <button
                            key={c}
                            onClick={() => onDia(d)}
                            title={
                              g
                                ? `${c} · día ${d} · ${g.sede} (${g.municipio}) · ${hm(g.minManana + g.minTarde)} de carretera`
                                : `${c} · día ${d} · sin visita`
                            }
                            className="relative flex w-full items-end justify-center rounded-sm"
                            style={{
                              height: ALTO,
                              background: esHoy ? "var(--plano)" : "transparent",
                              outline: esHoy
                                ? "1px solid var(--acento)"
                                : "1px solid var(--linea)",
                              opacity: apagada ? 0.35 : 1,
                            }}
                          >
                            {/* La línea de las ocho horas. */}
                            <span
                              className="pointer-events-none absolute inset-x-0"
                              style={{
                                bottom: escala(JORNADA_MIN),
                                borderTop: "1px dashed var(--tinta-3)",
                                opacity: 0.5,
                              }}
                            />
                            {g && (
                              <span className="flex w-[9px] flex-col-reverse">
                                <span
                                  style={{
                                    height: escala(g.minManana + g.minTarde),
                                    background: colorCuadrilla(c, false),
                                    borderTopLeftRadius: 2,
                                    borderTopRightRadius: 2,
                                  }}
                                />
                                {/* Dos píxeles de superficie entre los dos
                                    segmentos: sin ellos la barra se lee como un
                                    solo bloque y se pierde de qué está hecha. */}
                                <span
                                  style={{
                                    height: 2,
                                    background: "var(--superficie)",
                                  }}
                                />
                                <span
                                  style={{
                                    height: escala(inspeccion),
                                    background: "var(--tinta-3)",
                                    opacity: 0.45,
                                    borderTopLeftRadius: 2,
                                    borderTopRightRadius: 2,
                                  }}
                                />
                              </span>
                            )}
                            {esHoy && largoHoy > 0 && (
                              <span
                                className="pointer-events-none absolute inset-y-0"
                                style={{
                                  left: `${Math.min(100, (t / largoHoy) * 100)}%`,
                                  width: 1,
                                  background: "var(--acento)",
                                }}
                              />
                            )}
                          </button>
                        );
                      })}
                      <span
                        className="text-center text-[9px]"
                        style={{
                          color: esHoy ? "var(--acento)" : "var(--tinta-3)",
                          fontWeight: esHoy ? 600 : 400,
                        }}
                      >
                        {d}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </Tarjeta>
      </div>
    </div>
  );
}
