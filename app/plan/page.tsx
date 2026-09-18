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
 * LOS ESCENARIOS SON EL CONTROL PRINCIPAL. Ya no son un reparto de las mismas
 * sedes: son alcances distintos (43, 70 o 91) y, en las 91, dos formas de
 * romper el TdR. La pantalla no escoge: deja correrlos y que se vea la
 * diferencia en el contador.
 *
 * LA INSPECCIÓN ES UN SUPUESTO, NO UN DATO. Cuánto dura no lo sabemos y el TdR
 * lo esquiva. El plan se armó con 3 horas por sede. Esa cifra viaja en el JSON
 * y la pantalla la nombra como supuesto cada vez que entra en un total.
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
import TarjetaLista from "@/components/TarjetaLista";
import { cargaLista } from "@/lib/lista";
import type { ColorLista, ListaMen, Resalte } from "@/lib/lista";
import type { Movil } from "@/components/MapaPlan";
import {
  INSPECCION_MIN_DEFECTO,
  JORNADA_MIN,
  armaGuion,
  cargaPlan,
  cargaTramos,
  colorCuadrilla,
  coma,
  cuadrillas,
  diasDeCampo,
  escenarioPorDefecto,
  estadoEn,
  hm,
  jornada,
  largoDelDia,
  SE_VALLE,
  secretarias,
} from "@/lib/plan";
import type {
  ColeccionTramos,
  Escenario,
  GuionDia,
  JornadaCuadrilla,
  Plan,
  ResumenEscenario,
} from "@/lib/plan";

const MapaPlan = dynamic(() => import("@/components/MapaPlan"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm">
      cargando el mapa…
    </div>
  ),
});


/** A qué ritmo corre el reloj: minutos de jornada por segundo de pantalla.
 *
 * Con 240, un día de cuatro horas de trabajo pasa en un segundo y las tres
 * semanas completas duran algo menos de un minuto. Es el ritmo al que se alcanza
 * a ver cada movimiento sin que la demostración se haga larga.
 */
const RITMOS = [120, 240, 480];

const DIAS_SEMANA = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];
/** Se trabaja de lunes a sábado. El plan no cambia por esto: `dia_corrido` es
 *  el mismo y solo se reparte distinto en semanas. Vive acá y en
 *  `DIAS_HABILES_SEMANA` del script 86, que es de donde viene el JSON. */
const DIAS_HABILES_SEMANA = 6;
/** Lo que ocupa el panel de simulación con 3 filas de cuadrilla, medido en
 *  pantalla: 227 px más el margen. Cada fila extra suma 39 px (casilla más
 *  hueco). La ficha termina antes y el mapa lo descuenta al encuadrar. */
const ALTO_SIMULACION_3 = 235;
const ALTO_FILA_CUADRILLA = 39;

function altoSimulacion(n: number) {
  return ALTO_SIMULACION_3 + Math.max(0, n - 3) * ALTO_FILA_CUADRILLA;
}

/** Cómo leer la simulación: el mapa en movimiento y la cuadrícula de abajo.
 *  Vive en el ícono del título del panel, que es donde se mira mientras corre. */
const COMO_LEER_SIMULACION = [
  "En la cuadrícula, cada columna es un día de campo y cada fila una cuadrilla. La barra de color son las horas de carretera y la gris, encima, la inspección; la línea punteada marca una jornada de 8 horas. Toca una casilla para saltar a ese día.",
  "Al darle reproducir, el círculo grande con letra es la cuadrilla en movimiento. El número dentro del pin de una escuela es el día de campo en que se visita, contados de corrido de lunes a sábado: la semana 1 son los días 1 a 6, la 2 del 7 al 12, y así. Es el orden del recorrido, no una prioridad.",
  "Rombo lleno, la base. Cuadrado hueco, el poblado donde se duerme: hueco porque el plan nombra el pueblo, no el hotel.",
  "Línea llena, la ida a la escuela. Punteada, el regreso de la tarde. Las líneas son el trazado real por carretera, no rectas entre puntos. Cerca en el mapa no es cerca por carretera: hay sedes a tres kilómetros en línea recta y a media hora de camino.",
].join("\n\n");
/** Los controles del mapa abajo a la derecha: zoom, casa, escala y la
 *  atribución, medidos en pantalla. */
const ALTO_CONTROLES = 150;

/** Qué son las noches que se cuentan, y por qué están arriba y no abajo.
 *
 * Se cuentan todas las de la campaña, también las que se pasan en Cali o en
 * Pereira: la base es de donde sale la cuadrilla, no donde vive, y el TdR no
 * dice de dónde es la gente que se contrata. Contar solo las de fuera dejaba el
 * alojamiento un 20 % corto.
 *
 * Y van junto a los días y no junto a los kilómetros porque no son un resultado
 * del plan: salen de cuántas cuadrillas por cuántas semanas. Dos rutas
 * distintas con la misma forma dan las mismas noches.
 */
function NOTA_NOCHES(
  resumen: ResumenEscenario | undefined,
  fueraDeBase: number,
  diasCampoTotal: number,
): string {
  if (!resumen) return "";
  return (
    `${diasCampoTotal} días de campo y ${resumen.noches_hotel} noches son el total de la ` +
    `campaña, sumadas las ${resumen.cuadrillas} cuadrillas. El calendario son ` +
    `${resumen.dias_campo} días; no es el mismo número.\n\n` +
    `Se cuenta cada noche entre los días de campo de cada cuadrilla, y dos por cada domingo ` +
    `de descanso, porque se trabaja de lunes a sábado y el plan no la devuelve el sábado. ` +
    `La noche del último día no se cuenta: ese día se regresa.\n\n` +
    `Se cuentan todas, también las de Cali y Pereira. La base es de donde sale la cuadrilla, ` +
    `no donde vive: el TdR no dice de dónde es la gente que se contrata, así que dar por ` +
    `gratis esas noches sería descontar alojamiento que se paga.\n\n` +
    `${fueraDeBase} de las ${resumen.noches_hotel} caen fuera de una ciudad base, y eso mueve ` +
    `la tarifa. El plan nombra el pueblo, no el hotel, y el Registro Nacional de Turismo no ` +
    `dice si hay cupo: hay que llamar antes.`
  );
}

/** Qué es este alcance, escrito con las cifras del escenario que se mira. */
function notaAlcance(resumen: ResumenEscenario | undefined): string {
  const base =
    "Esto no es una orden de trabajo ni dice quién tiene que ir a dónde. Es una demostración de cómo se pueden acomodar las rutas y de cuánto demora cada día, para poder evaluar lo que cuesta.\n\nEl TdR fija 3 cuadrillas y 3 semanas de campo: 45 días-cuadrilla.";
  if (!resumen) return base;
  const diasTotal = resumen.cuadrillas_jornada?.reduce((a, c) => a + c.dias, 0);
  const forma =
    `Este alcance son ${resumen.sedes} sedes, ${resumen.cuadrillas} cuadrillas y ` +
    `${resumen.dias_campo} días. `;
  const cabe = resumen.en_tdr
    ? "Cabe en el TdR."
    : "No cabe en el TdR.";
  const asterisco = resumen.rotulo.includes("*")
    ? " El asterisco es sin Buenaventura."
    : "";
  const totales =
    diasTotal != null
      ? ` En campo son ${diasTotal} días y ${resumen.noches_hotel} noches, sumadas las cuadrillas.`
      : "";
  return (
    `${base}\n\n${forma}${cabe}${asterisco}${totales} Lo que mueve el total de carretera ` +
    `es qué sedes van juntas, en qué orden y dónde duerme la cuadrilla.`
  );
}

function fraseRepartoJornada(filas: JornadaCuadrilla[]): string {
  const orden = [...filas].sort(
    (a, b) => a.min_carretera_media - b.min_carretera_media,
  );
  const quieta = orden[0];
  const andariega = orden[orden.length - 1];
  if (!quieta || !andariega || quieta.cuadrilla === andariega.cuadrilla) {
    return "";
  }
  return (
    `${quieta.cuadrilla} promedia ${hm(quieta.min_carretera_media)} de carretera y ` +
    `${hm(quieta.min_inspeccion_media)} de inspección. ${andariega.cuadrilla} promedia ` +
    `${hm(andariega.min_carretera_media)} y ${hm(andariega.min_inspeccion_media)}.`
  );
}

function basesEnTexto(bases: Record<string, string>): string {
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

/** Cuánto lleva acumulado el plan hasta un instante dado. */
function acumulado(guion: GuionDia[], dia: number, t: number, inspeccion: number) {
  let min = 0;
  let km = 0;
  let visitas = 0;
  let noches = 0;
  for (const g of guion) {
    if (g.diaCorrido < dia) {
      min += g.minCarretera;
      km += g.kmCarretera;
      visitas += g.visitas.length;
      if (g.fueraDeBase) noches += 1;
      continue;
    }
    if (g.diaCorrido > dia) continue;
    const e = estadoEn(g, t, inspeccion);
    min += e.minHechos;
    km += e.kmHechos;
    // La visita se cuenta al llegar, no al terminar el día: es lo que la
    // cuadrilla ya tiene hecho en ese momento.
    visitas += e.llegadas;
    if (e.fase === "fin" && g.fueraDeBase) noches += 1;
  }
  return { min, km, visitas, noches };
}

export default function PaginaPlan() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [tramos, setTramos] = useState<ColeccionTramos | null>(null);
  const [error, setError] = useState<string | null>(null);

  // El alcance del plan: cuál de los escenarios se está mirando. Arranca vacío
  // y lo fija el archivo al cargar, porque las claves las decide el script 84.
  const [escenario, setEscenario] = useState<Escenario>("");
  // La inspección quedó fija en 3 horas desde la reunión del 16 de septiembre
  // de 2026. Sigue como constante para no reescribir lo que depende de ella.
  const inspeccion = INSPECCION_MIN_DEFECTO;
  const [cuadrilla, setCuadrilla] = useState<string | null>(null);
  /** Las secretarías apagadas en el filtro. Vacío es «todas». */
  const [ocultas, setOcultas] = useState<string[]>([]);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [tema, setTema] = useState<"claro" | "oscuro">("claro");
  // Dos vistas en la misma pantalla. «plan» es la de entrada y lo que la
  // pantalla viene a mostrar: el plan de campo con sus cuadrillas y sus horas.
  // «lista» es el universo del que sale, las 701 sedes que pidió el MEN, sin
  // horas ni rutas: se va a ella para preguntar de dónde salieron estas.
  const [modo, setModo] = useState<"lista" | "plan">("plan");
  const [lista, setLista] = useState<ListaMen | null>(null);
  const [colorLista, setColorLista] = useState<ColorLista>("zona");
  const [resaltes, setResaltes] = useState<Resalte[]>([]);
  const [ocultasLista, setOcultasLista] = useState<string[]>([]);

  const [corriendo, setCorriendo] = useState(false);
  // Al entrar no corre nada: se ve el plan completo, con las escuelas del color
  // de su cuadrilla. Se sale del reposo al reproducir o al escoger un día.
  const [enPausaInicial, setEnPausaInicial] = useState(true);
  // La simulación día por día va apagada al entrar. Apagada, la pantalla es el
  // plan completo y nada más.
  const [simular, setSimular] = useState(false);
  const [formaCalculo, setFormaCalculo] = useState(false);
  // La hoja de tarjetas en el teléfono. En escritorio no se usa.
  const [hojaAbierta, setHojaAbierta] = useState(false);
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
    cargaPlan()
      .then((p) => {
        setPlan(p);
        setEscenario(escenarioPorDefecto(p));
      })
      .catch((e) => setError(String(e)));
    cargaTramos().then(setTramos).catch((e) => setError(String(e)));
    cargaLista().then(setLista).catch((e) => setError(String(e)));
  }, []);

  const guion = useMemo(
    () => (plan && tramos ? armaGuion(plan, tramos, escenario) : []),
    [plan, tramos, escenario],
  );
  const resumen = plan?.escenarios.find((e) => e.escenario === escenario);
  // Las secretarías certificadas, aparte de la del Valle, que ponen sedes en
  // este escenario. El mapa las usa para no dibujar el límite de una
  // secretaría que en este alcance no aporta nada.
  const otrasSecretarias = useMemo(
    () =>
      plan
        ? secretarias(plan, escenario)
            .map(([s]) => s)
            .filter((s) => s !== SE_VALLE)
        : [],
    [plan, escenario],
  );
  // Cuántos días tiene este escenario. El de solo BID son 14 y el recomendado
  // 15, así que ni el reloj ni la cuadrícula pueden dar por hecho un número.
  const diasCampo = diasDeCampo(guion);
  const nCuadrillas = plan ? cuadrillas(plan, escenario).length : 3;
  const altoPanel = altoSimulacion(nCuadrillas);

  const insRef = useRef(inspeccion);
  insRef.current = inspeccion;
  const ritmoRef = useRef(ritmo);
  ritmoRef.current = ritmo;
  const guionRef = useRef(guion);
  guionRef.current = guion;
  const diasRef = useRef(diasCampo);
  diasRef.current = diasCampo;

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
      while (r.t >= largo && r.dia < diasRef.current) {
        r.t -= largo;
        r.dia += 1;
        largo = largoDelDia(guionRef.current, r.dia, insRef.current);
      }
      if (r.dia >= diasRef.current && r.t >= largo) {
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

  const objetivos = useMemo(
    () => new Set(hoy.flatMap((g) => g.visitas.map((v) => v.dane))),
    [hoy],
  );

  const moviles: Movil[] = hoy.map((g) => {
    const e = estadoEn(g, t, inspeccion);
    return { cuadrilla: g.cuadrilla, punto: e.punto, fase: e.fase };
  });

  const visitadas = useMemo(() => {
    const s = new Set<string>();
    for (const g of guion) {
      if (g.diaCorrido < dia) {
        for (const v of g.visitas) s.add(v.dane);
      } else if (g.diaCorrido === dia) {
        const llegadas = estadoEn(g, t, inspeccion).llegadas;
        for (const v of g.visitas.slice(0, llegadas)) s.add(v.dane);
      }
    }
    return s;
    // El reloj entra redondeado a cinco minutos de jornada a propósito. Esto
    // alimenta un redibujo del mapa, y rehacerlo sesenta veces por segundo para
    // que una escuela se prenda unos milisegundos antes no compra nada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guion, dia, Math.floor(t / 5)]);

  const cuenta = acumulado(guion, dia, t, inspeccion);
  const totalPlan = useMemo(() => {
    const min = guion.reduce((a, g) => a + g.minCarretera, 0);
    const km = guion.reduce((a, g) => a + g.kmCarretera, 0);
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
          objetivos={objetivos}
          reposo={reposo}
          simulando={simular}
          altoSimulacion={altoPanel}
          cuadrilla={cuadrilla}
          ocultas={ocultas}
          secretariasPlan={otrasSecretarias}
          seleccion={seleccion}
          onSelecciona={setSeleccion}
          tema={tema}
          modo={modo}
          lista={lista}
          colorLista={colorLista}
          resaltes={resaltes}
          ocultasLista={ocultasLista}
        />
      </div>

      <div
        // En escritorio es la columna izquierda y usa todo el alto: el panel de
        // simulación arranca a su derecha, así que no la tapa.
        //
        // En el teléfono es una hoja que sube desde abajo, como en el visor
        // nacional, y arranca recogida para que lo primero que se vea sea el
        // mapa. Con la simulación prendida se esconde: el panel de abajo ocupa
        // ese lugar y se cierra con su propia x.
        className={
          "pointer-events-auto fixed inset-x-0 bottom-0 z-10 flex flex-col gap-2 " +
          "overflow-y-auto overscroll-contain px-2 pb-6 " +
          (hojaAbierta ? "max-h-[88svh] " : "max-h-[38svh] ") +
          (simular ? "hidden md:flex " : "") +
          "md:pointer-events-none md:absolute md:inset-x-auto md:bottom-auto " +
          "md:left-0 md:top-0 md:max-h-dvh md:w-[380px] md:p-3"
        }
      >
        <button
          onClick={() => setHojaAbierta(!hojaAbierta)}
          aria-label={hojaAbierta ? "Recoger el panel" : "Desplegar el panel"}
          className="sticky top-0 z-20 -mx-2 flex h-7 shrink-0 items-center justify-center px-2 md:hidden"
        >
          <span
            className="flex h-full w-full items-center justify-center rounded-t-lg"
            style={{
              background: "var(--superficie)",
              boxShadow: "0 -1px 4px rgba(0,0,0,.15)",
            }}
          >
            <span
              className="block h-1 w-10 rounded-full"
              style={{ background: "var(--tinta-3)" }}
            />
          </span>
        </button>
        <div className="pointer-events-auto flex flex-col gap-2">
          <Encabezado
            plan={plan}
            resumen={resumen}
            escenario={escenario}
            ocultas={ocultas}
            onOcultas={(x) => {
              setOcultas(x);
              setSeleccion(null);
            }}
            tema={tema}
            onTema={setTema}
            modo={modo}
            onModo={(x) => {
              if (x === "lista") {
                setSimular(false);
                reinicia();
                setSeleccion(null);
              }
              setModo(x);
            }}
            lista={lista}
            ocultasLista={ocultasLista}
            onOcultasLista={setOcultasLista}
          />
          {modo === "lista" && lista && (
            <TarjetaLista
              lista={lista}
              color={colorLista}
              onColor={setColorLista}
              resaltes={resaltes}
              onResaltes={setResaltes}
              ocultas={ocultasLista}
              onSolo={(sec) => setOcultasLista(sec === null ? []
                : lista.resumen.map((r) => r.secretaria).filter((x) => x !== sec))}
              tema={tema}
            />
          )}
          {error && (
            <Tarjeta>
              <p className="px-3 py-2 text-[12px]" style={{ color: "var(--critico)" }}>
                {error}. Hay que correr el script 84 antes de abrir esta
                pantalla.
              </p>
            </Tarjeta>
          )}
          {modo === "plan" && plan && (
            <TarjetaResumen
              guion={guion}
              escenario={escenario}
              resumen={plan.escenarios.find((e) => e.escenario === escenario)}
              cuadrillasPlan={cuadrillas(plan, escenario)}
              cuadrilla={cuadrilla}
              onCuadrilla={setCuadrilla}
            />
          )}
          {modo === "plan" && plan && (
            <TarjetaSimular
              activo={simular}
              onActivo={(v) => {
                if (!v) reinicia();
                setSimular(v);
              }}
            />
          )}
          {modo === "plan" && plan && (
            <TarjetaSupuestos
              guion={guion}
              inspeccion={inspeccion}
              resumen={resumen}
            />
          )}
          {plan && !reposo && (
            <TarjetaContador
              cuenta={cuenta}
              total={totalPlan}
              dia={dia}
              sedes={resumen?.sedes ?? 0}
              diasCampo={diasCampo}
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
          {modo === "plan" && plan && (
            <TarjetaLeyenda
              plan={plan}
              resumen={resumen}
              otrasSecretarias={otrasSecretarias}
              diasCampo={diasCampo}
              onFormaCalculo={() => setFormaCalculo(true)}
            />
          )}
        </div>
      </div>

      {/* El alcance del plan, encima del mapa. Solo en la vista del plan: en la
          de la lista no hay escenarios que escoger. */}
      {plan && modo === "plan" && (
        <ChipsEscenario
          escenarios={plan.escenarios}
          escenario={escenario}
          onEscenario={(e) => {
            setEscenario(e);
            setSeleccion(null);
            setCuadrilla(null);
            // Las secretarías visibles no son las mismas en cada escenario, y
            // un filtro heredado dejaría el mapa vacío sin decir por qué.
            setOcultas([]);
            reinicia();
          }}
        />
      )}

      {/* La ficha va en un recuadro propio a la derecha: aparece al escoger una
          escuela y se va al cerrarla, sin mover las tarjetas de la izquierda. */}
      {/* La vuelta al visor nacional, siempre arriba a la derecha. */}
      <Link
        href="/"
        className="absolute right-2 top-3 z-40 rounded-lg border px-2 py-1.5 text-[11px] font-semibold shadow-md md:right-3 md:px-3 md:text-[12px]"
        style={{
          background: "var(--superficie)",
          borderColor: "var(--borde)",
          color: "var(--acento)",
        }}
      >
        <span className="md:hidden">← Visor</span>
        <span className="hidden md:inline">← Visor nacional</span>
      </Link>

      {plan && sede && (
        <div
          // Arranca debajo del botón del visor nacional. En el teléfono ocupa el
          // ancho y va por encima de la hoja de tarjetas; se cierra con su botón.
          //
          // En escritorio termina antes de los controles del mapa (zoom, casa y
          // escala), que van abajo a la derecha: tapados, no había cómo volver
          // a la vista inicial con la ficha abierta.
          className="pointer-events-none fixed inset-x-0 top-12 z-30 max-h-[calc(100dvh-56px)] overflow-y-auto p-2 md:absolute md:left-auto md:right-0 md:z-20 md:max-h-[var(--alto-ficha)] md:w-[400px] md:p-3"
          style={{
            ["--alto-ficha" as string]: simular
              ? `calc(100dvh - ${altoPanel + 48}px)`
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
          escenario={escenario}
          abierto={formaCalculo}
          onCierra={() => setFormaCalculo(false)}
        />
      )}

      {plan && simular && guion.length > 0 && (
        <BarraTiempo
          guion={guion}
          diasCampo={diasCampo}
          cuadrillasPlan={cuadrillas(plan, escenario)}
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
          onCierra={() => {
            reinicia();
            setSimular(false);
          }}
        />
      )}
    </main>
  );
}

function Encabezado({
  plan,
  resumen,
  escenario,
  ocultas,
  onOcultas,
  tema,
  onTema,
  modo,
  onModo,
  lista,
  ocultasLista,
  onOcultasLista,
}: {
  plan: Plan | null;
  resumen: ResumenEscenario | undefined;
  escenario: Escenario;
  ocultas: string[];
  onOcultas: (s: string[]) => void;
  modo: "lista" | "plan";
  onModo: (m: "lista" | "plan") => void;
  lista: ListaMen | null;
  ocultasLista: string[];
  onOcultasLista: (s: string[]) => void;
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
          <div className="mt-1.5 inline-flex rounded border text-[11px]"
               style={{ borderColor: "var(--linea)" }}>
            {([["plan", "Plan de visitas"], ["lista", "Requerimiento total MEN"]] as const).map(
              ([k, rotulo]) => (
                <button
                  key={k}
                  onClick={() => onModo(k)}
                  className="px-2.5 py-1"
                  style={{
                    background: modo === k ? "var(--acento)" : "transparent",
                    color: modo === k ? "var(--superficie)" : "var(--tinta)",
                    fontWeight: modo === k ? 600 : 400,
                  }}
                >
                  {rotulo}
                </button>
              ))}
          </div>
          {modo === "plan" && (
          <p className="mt-1 text-[11px]" style={{ color: "var(--tinta-2)" }}>
            {plan
              ? `${resumen?.sedes ?? 0} sedes · ${resumen?.cuadrillas ?? 0} cuadrillas · ${resumen?.dias_campo ?? 0} días`
              : "cargando…"}
            <Info
              texto={notaAlcance(resumen)}
              ancho
            />
          </p>
          )}
          {modo === "lista" && lista && (
            <FiltroSecretarias
              opciones={lista.resumen.map((r) => [r.secretaria, r.sedes] as [string, number])}
              ocultas={ocultasLista}
              onOcultas={onOcultasLista}
            />
          )}
          {/* Filtra las sedes del mapa por la secretaría que responde por
              ellas. Los totales de carretera siguen siendo del plan entero:
              un día puede juntar sedes de dos secretarías. */}
          {modo === "plan" && plan && (
            <FiltroSecretarias
              opciones={secretarias(plan, escenario)}
              ocultas={ocultas}
              onOcultas={onOcultas}
            />
          )}
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

/** El filtro de secretarías: un desplegable con una casilla por secretaría,
 *  para ver una sola o sumar varias. No deja apagar la última, porque un mapa
 *  sin sedes no dice nada. Se cierra al hacer clic afuera. */
/** Los escenarios, como una fila de píldoras encima del mapa.
 *
 * POR QUÉ ARRIBA Y NO EN LA COLUMNA. Es el control que más cosas cambia: al
 * tocarlo se mueven las sedes del mapa, las cuadrillas, los días y todos los
 * números de abajo. Metido en una tarjeta, al final de una columna que ya se
 * desplaza, se lee como un detalle de los supuestos. Encima del mapa, donde
 * ocurre el cambio, se lee como lo que es.
 *
 * POR QUÉ UN CONTROL SEGMENTADO Y NO PÍLDORAS SUELTAS. La referencia son los
 * chips de Google Maps, pero esos son aditivos: restaurantes y hoteles se
 * prenden los dos. Estos son excluyentes, porque son alcances del mismo
 * trabajo y no capas. Una sola píldora partida, con la activa rellena, dice
 * «escoge uno» sin tener que explicarlo. Con cuatro no cabe a 1600 px ni en
 * el teléfono: el grupo no se parte, se desplaza de lado.
 *
 * QUÉ LLEVA CADA UNO. El rótulo y dos cifras: cuántas sedes y cuántas horas de
 * carretera. La comparación es el punto de tenerlos juntos, así que el número
 * va en el botón y no en el globo. El que no cabe en el TdR no lleva letrero:
 * el borde intermitente dice que esa cifra está fuera de lo contratado.
 */
function ChipsEscenario({
  escenarios,
  escenario,
  onEscenario,
}: {
  escenarios: ResumenEscenario[];
  escenario: Escenario;
  onEscenario: (e: Escenario) => void;
}) {
  if (escenarios.length < 2) return null;
  // La línea base para el delta: el escenario más pequeño.
  const base = escenarios.reduce((a, b) => (b.sedes < a.sedes ? b : a));
  return (
    <div
      // Entre la columna de tarjetas (368 px) y el botón del visor nacional.
      // En el teléfono ocupa el ancho y se desplaza de lado si no cabe.
      className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-start overflow-x-auto py-0.5 pl-2 pr-[5.75rem] md:left-[380px] md:right-[150px] md:justify-center md:px-0 md:pr-0"
    >
      <div className="flex flex-col items-start gap-1 md:items-center">
      <div
        className="pointer-events-auto flex shrink-0 gap-0 rounded-full border p-0.5 shadow-md"
        style={{ background: "var(--superficie)", borderColor: "var(--borde)" }}
        role="group"
        aria-label="Alcance del plan"
      >
        {escenarios.map((e) => {
          const activo = e.escenario === escenario;
          const mas = e.horas_carretera - base.horas_carretera;
          return (
            <button
              key={e.escenario}
              onClick={() => onEscenario(e.escenario)}
              aria-pressed={activo}
              title={e.glosa}
              className={`flex shrink-0 flex-col items-start gap-0 rounded-full px-2.5 py-1 leading-tight${e.en_tdr ? "" : " chip-fuera-tdr"}`}
              style={{
                background: activo ? "var(--acento)" : "transparent",
                color: activo ? "var(--superficie)" : "var(--tinta)",
              }}
            >
              <span className={`text-[12px] ${activo ? "font-semibold" : ""}`}>
                {e.rotulo}
              </span>
              <span
                className="num whitespace-nowrap text-[10px] md:text-[11px]"
                style={{ opacity: activo ? 0.85 : 0.6 }}
              >
                <span className="md:hidden">
                  {e.sedes} · {coma(e.horas_carretera)} h · {e.noches_hotel} n
                </span>
                <span className="hidden md:inline">
                  {e.sedes} sedes · {coma(e.horas_carretera)} h · {e.noches_hotel} noches
                  {mas > 0.05 && ` (+${coma(mas)})`}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {escenarios.some((e) => e.rotulo.includes("*")) && (
        <p
          className="pointer-events-none max-w-[calc(100vw-8rem)] text-[10px] leading-snug md:max-w-none"
          style={{ color: "var(--tinta-3)" }}
        >
          * sin Buenaventura
        </p>
      )}
      </div>
    </div>
  );
}

function FiltroSecretarias({
  opciones,
  ocultas,
  onOcultas,
}: {
  opciones: [string, number][];
  ocultas: string[];
  onOcultas: (s: string[]) => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const cierra = (e: MouseEvent) => {
      const d = ref.current;
      if (d?.open && !d.contains(e.target as Node)) d.open = false;
    };
    document.addEventListener("mousedown", cierra);
    return () => document.removeEventListener("mousedown", cierra);
  }, []);
  const visibles = opciones.filter(([k]) => !ocultas.includes(k));
  const total = visibles.reduce((a, [, n]) => a + n, 0);
  const rotulo = ocultas.length === 0
    ? "Todas"
    : visibles.map(([k]) => k).join(", ");
  return (
    <div className="mt-2 flex items-center gap-2 text-[11px]">
      <span style={{ color: "var(--tinta-2)" }}>Secretaría</span>
      <details ref={ref} className="relative">
        <summary
          className="flex cursor-pointer list-none items-center gap-1 rounded border px-1.5 py-0.5"
          style={{ borderColor: "var(--linea)", background: "var(--superficie)" }}
        >
          <span className="max-w-[190px] truncate">{rotulo}</span>
          <span className="num" style={{ color: "var(--tinta-2)" }}>({total})</span>
          <span aria-hidden style={{ color: "var(--tinta-2)" }}>▾</span>
        </summary>
        <div
          className="absolute left-0 z-20 mt-1 flex min-w-[190px] flex-col rounded border py-1 shadow-lg"
          style={{ borderColor: "var(--linea)", background: "var(--superficie)" }}
        >
          {opciones.map(([k, n]) => {
            const activa = !ocultas.includes(k);
            const ultima = activa && visibles.length === 1;
            return (
              <label
                key={k}
                className="flex cursor-pointer items-center gap-2 px-2 py-1"
                style={{ opacity: ultima ? 0.6 : 1 }}
              >
                <input
                  type="checkbox"
                  checked={activa}
                  disabled={ultima}
                  onChange={() =>
                    onOcultas(activa ? [...ocultas, k] : ocultas.filter((x) => x !== k))
                  }
                />
                <span className="flex-1">{k}</span>
                <span className="num" style={{ color: "var(--tinta-2)" }}>{n}</span>
              </label>
            );
          })}
          {ocultas.length > 0 && (
            <button
              onClick={() => onOcultas([])}
              className="mt-1 border-t px-2 pt-1 text-left underline"
              style={{ borderColor: "var(--linea)", color: "var(--acento)" }}
            >
              Ver todas
            </button>
          )}
        </div>
      </details>
    </div>
  );
}

/** El contador que sube. Es el instrumento principal de la pantalla. */
function TarjetaContador({
  cuenta,
  total,
  dia,
  sedes,
  diasCampo,
}: {
  cuenta: { min: number; km: number; visitas: number; noches: number };
  total: { min: number; km: number };
  dia: number;
  sedes: number;
  diasCampo: number;
}) {
  const semana = Math.floor((dia - 1) / DIAS_HABILES_SEMANA) + 1;
  const enSemana = ((dia - 1) % DIAS_HABILES_SEMANA) + 1;
  return (
    <Tarjeta>
      <div className="px-3 py-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px]" style={{ color: "var(--tinta-3)" }}>
            semana {semana} · {DIAS_SEMANA[enSemana - 1]} · día {dia} de{" "}
            {diasCampo}
          </span>
          <span className="num text-[11px]" style={{ color: "var(--tinta-3)" }}>
            {cuenta.visitas} de {sedes} visitas
          </span>
        </div>
        <div className="mt-1 flex items-end gap-4">
          <div>
            <span className="num block text-[28px] font-semibold leading-none">
              {coma(cuenta.min / 60)}
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
          Al terminar: {coma(total.min / 60, 0)} h y{" "}
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
  resumen,
  cuadrillasPlan,
  cuadrilla,
  onCuadrilla,
}: {
  guion: GuionDia[];
  escenario: Escenario;
  /** El resumen del escenario, que trae la cota del solucionador. */
  resumen: ResumenEscenario | undefined;
  cuadrillasPlan: string[];
  cuadrilla: string | null;
  onCuadrilla: (c: string | null) => void;
}) {
  const suma = (gs: GuionDia[]) => ({
    sedes: gs.reduce((a, g) => a + g.visitas.length, 0),
    min: gs.reduce((a, g) => a + g.minCarretera, 0),
    km: gs.reduce((a, g) => a + g.kmCarretera, 0),
    noches: gs.filter((g) => g.fueraDeBase).length,
    // Una noche por día de campo: cada día termina en alguna ciudad.
    posibles: gs.length,
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
  // Días y noches van en la misma unidad: el total de la campaña, sumadas
  // las cuadrillas. El calendario (11, 15 o 20) ya está en el encabezado.
  const diasCampoTotal =
    resumen?.cuadrillas_jornada?.reduce((a, c) => a + c.dias, 0) ?? total.posibles;
  return (
    <Tarjeta>
      <div className="px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <span className="shrink-0 text-[11px]" style={{ color: "var(--tinta-3)" }}>
            plan completo
          </span>
          <span className="num min-w-0 text-right text-[11px] leading-snug" style={{ color: "var(--tinta-3)" }}>
            {diasCampoTotal} días de campo · {resumen?.noches_hotel ?? 0} noches
            <Info
              texto={NOTA_NOCHES(resumen, total.noches, diasCampoTotal)}
              ancho
            />
          </span>
        </div>
        {/* UNA SOLA CIFRA GRANDE, NO CUATRO.
            Cuatro números de 28 px en fila se escalonaban, porque cada rótulo
            mide distinto y el bloque más ancho empujaba a los otros a una
            segunda línea. Lo que distingue un escenario de otro son las sedes;
            lo demás es lo que cuestan, y va debajo en una línea corrida. */}
        <div className="mt-1 flex items-baseline gap-2">
          <span className="num text-[34px] font-semibold leading-none">
            {total.sedes}
          </span>
          <span className="text-[12px]" style={{ color: "var(--tinta-2)" }}>
            sedes
          </span>
        </div>
        <p className="num mt-1.5 text-[12px]" style={{ color: "var(--tinta)" }}>
          <span className="font-semibold">
            {coma(resumen ? resumen.horas_carretera : total.min / 60)} h
          </span>{" "}
          <span style={{ color: "var(--tinta-2)" }}>de carretera</span>
          {resumen && (
            <Info
              texto={
                (resumen.optimo_probado
                  ? `Óptimo demostrado: con estas reglas no existe un plan que gaste menos de ${coma(resumen.horas_carretera)} h. No es el mejor que se encontró, es el mejor que hay.`
                  : `El solucionador no alcanzó a probar que este sea el mejor plan posible. Lo que sí demostró es que ninguno baja de ${coma(resumen.cota_horas)} h, así que lo que queda por ganar está entre 0 y ${coma(resumen.horas_carretera - resumen.cota_horas)} h.`) +
                (resumen.horas_regreso > 0.05
                  ? `\n\nIncluye ${hm(resumen.horas_regreso * 60)} de regreso a la base después del último día, que se maneja pero no ocupa un día hábil. La simulación recorre los días y llega a ${coma(resumen.horas_dias)} h.`
                  : "")
              }
              ancho
            />
          )}
          <span style={{ color: "var(--tinta-3)" }}> · </span>
          <span className="font-semibold">
            {Math.round(total.km).toLocaleString("es-CO")} km
          </span>
        </p>
        {resumen?.horas_campo != null && (
          <p className="num mt-0.5 text-[11px]" style={{ color: "var(--tinta-2)" }}>
            <span className="font-semibold" style={{ color: "var(--tinta)" }}>
              {coma(resumen.horas_campo)} h
            </span>{" "}
            en campo, carretera más inspección
            <Info
              texto={
                `${coma(resumen.horas_campo)} h en campo: ${coma(resumen.horas_carretera)} h de carretera y ${coma(resumen.horas_inspeccion)} h de inspección.\n\n` +
                `La inspección son ${(resumen.inspeccion_min / 60).toLocaleString("es-CO")} horas por sede, un supuesto nuestro. El TdR lo trae adentro de las 5 visitas por semana y no lo separa del desplazamiento. Un promedio construido sobre ese supuesto hereda la misma incertidumbre.\n\n` +
                `Jornada diaria, carretera más inspección: media ${hm(resumen.min_jornada_media)}, mediana ${hm(resumen.min_jornada_mediana)}, el día más largo ${hm(resumen.min_jornada_peor)}.`
              }
              ancho
            />
          </p>
        )}
        <div className="-mx-1 overflow-x-auto">
        <table className="num mt-2 w-full min-w-[300px] text-[11px]">
          <thead>
            <tr style={{ color: "var(--tinta-3)" }}>
              <th className="text-left font-normal">cuadrilla</th>
              <th className="text-right font-normal">sedes</th>
              <th className="text-right font-normal">días</th>
              <th className="text-right font-normal">carretera</th>
              <th className="text-right font-normal">km</th>
              <th className="text-right font-normal">
                <span className="md:hidden">jor./día</span>
                <span className="hidden md:inline">jornada media</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {porCuadrilla.map((f) => {
              const j = resumen?.cuadrillas_jornada?.find((x) => x.cuadrilla === f.c);
              return (
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
                    <span className="hidden md:inline" style={{ color: "var(--tinta-3)" }}>
                      desde {bases.get(f.c)}
                    </span>
                  </span>
                </td>
                <td className="text-right">{f.sedes}</td>
                <td className="text-right">{j?.dias ?? f.posibles}</td>
                <td className="text-right">{coma(f.min / 60)}</td>
                <td className="text-right">
                  {Math.round(f.km).toLocaleString("es-CO")}
                </td>
                <td className="text-right">
                  {j ? hm(j.min_jornada_media) : "—"}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        <p className="mt-1 text-[10px]" style={{ color: "var(--tinta-3)" }}>
          Carretera es solo manejar. La jornada media suma la inspección,{" "}
          {(resumen?.inspeccion_min ?? 180) / 60} h por sede, que es un
          supuesto.
          {resumen?.cuadrillas_jornada && resumen.cuadrillas_jornada.length > 1
            ? ` ${fraseRepartoJornada(resumen.cuadrillas_jornada)}`
            : ""}{" "}
          Tocar una cuadrilla deja solo sus escuelas en el mapa.
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

/** Los supuestos del plan, en una sola tarjeta.
 *
 * Desde la reunion del 16 de septiembre de 2026 la dormida y la duración de la
 * inspección dejaron de ser controles: son las reglas con las que se armó el
 * plan y se dicen como tales. Lo que sí se calcula aquí sale del escenario que
 * se está mirando: cuántas cuadrillas, cuántos días, de dónde salen y cuántos
 * días se pasan de la jornada. Escoger escenario es cosa de los botones de
 * arriba del mapa, no de esta tarjeta.
 */
function TarjetaSupuestos({
  guion,
  inspeccion,
  resumen,
}: {
  guion: GuionDia[];
  inspeccion: number;
  resumen: ResumenEscenario | undefined;
}) {
  const pasan = (ins: number) =>
    guion.filter((g) => jornada(g, ins) > JORNADA_MIN + 0.5).length;
  const largos = pasan(inspeccion);
  // Cuánto aguanta el plan si la inspección dura más de lo supuesto. Es la
  // cifra que decide si el plan es holgado o está pegado al techo, y sin ella
  // un «0 de 45 días» se lee como margen cuando no lo hay.
  const peor = guion.reduce((a, g) => Math.max(a, jornada(g, inspeccion)), 0);
  const dobles = guion.filter((g) => g.visitas.length > 1).length;
  return (
    <Tarjeta>
      <div className="px-3 py-2">
        {/* La holgura de la jornada se queda fuera del desplegable. Es la cifra
            que decide si el plan aguanta que la inspección dure más de lo
            supuesto, y esconderla detrás de un clic es esconder justamente lo
            que hay que ver. Las reglas con las que se armó el plan sí se
            recogen: se consultan una vez y después estorban. */}
        <p className="text-[11px]" style={{ color: "var(--tinta-2)" }}>
          <span style={{ color: largos > 0 ? "var(--critico)" : "var(--tinta-2)" }}>
            {largos} de {guion.length} días
          </span>{" "}
          pasan de la jornada de {JORNADA_MIN / 60} horas. El
          día más largo es de {hm(peor)} y {dobles} de los {guion.length} llevan
          dos visitas. Con quince minutos más de inspección se pasan{" "}
          <span style={{ color: "var(--critico)"}}>
            {pasan(inspeccion + 15)} días
          </span>
          ; con media hora más, {pasan(inspeccion + 30)}.
          <Info
            texto={`El plan se armó con la inspección en ${(inspeccion / 60).toLocaleString("es-CO")} horas y la jornada tope en ${JORNADA_MIN / 60}. Eso deja el día más largo en ${hm(peor)}, a ${Math.round(JORNADA_MIN - peor)} minutos del techo.\n\nNo es un detalle fino: ${dobles} de los ${guion.length} días llevan dos visitas, así que cada minuto que se alargue la inspección cuenta doble en esos días. Cuánto dura una inspección no lo sabemos y el TdR lo esquiva al fijar 5 visitas por cuadrilla por semana sin separarla del desplazamiento.`}
            ancho
          />
        </p>
        <details className="mt-2 group">
          <summary
            className="flex cursor-pointer list-none items-center gap-1 text-[12px] font-semibold"
            style={{ color: "var(--tinta)" }}
          >
            <span
              className="inline-block transition-transform group-open:rotate-90"
              aria-hidden
              style={{ color: "var(--tinta-3)" }}
            >
              ▸
            </span>
            Supuestos
            <span className="font-normal" style={{ color: "var(--tinta-3)" }}>
              · las reglas con las que se armó
            </span>
          </summary>
        <ul
          className="mt-1 flex list-disc flex-col gap-1 pl-4 text-[11px]"
          style={{ color: "var(--tinta-2)" }}
        >
          <li>
            Cada municipio lo atiende una sola cuadrilla, y el modelo escoge
            cuál.
          </li>
          <li>
            La cuadrilla duerme en una ciudad (Cali, Pereira, Palmira, Armenia,
            Tuluá, Cartago o Buga) o en una cabecera con hoteles estables y
            sin daño grave por el sismo: Yotoco, Andalucía, Caicedonia,
            Candelaria o Versalles.
            <Info
              texto={"Las cabeceras salen del Registro Nacional de Turismo (MinCIT): al menos dos hoteles, hostales o apartahoteles de 10 habitaciones o más que renovaron el registro cada año de 2023 a 2026.\n\nSe sacaron Roldanillo, Zarzal, La Unión, Restrepo y Ansermanuevo, porque al menos la mitad de sus sedes educativas urbanas quedaron en nivel crítico según el MEN, y Dagua y Riofrío, porque la mayoría de sus alojamientos son glamping o campamento y el registro no dice si sus hoteles están en el casco urbano.\n\nEl registro no dice si hay cupo: hay que llamar antes."}
              ancho
            />
          </li>
          <li>
            Cada inspección dura {(inspeccion / 60).toLocaleString("es-CO")}{" "}
            horas, y la jornada, contando carretera e inspecciones, no pasa de{" "}
            {JORNADA_MIN / 60} horas.
          </li>
          <li>
            Una o dos visitas por día. La cuadrilla no vuelve a su base el
            domingo de descanso: el lunes sigue desde la ciudad donde terminó el
            sábado.
          </li>
          <li>
            {resumen
              ? `${resumen.cuadrillas} cuadrillas durante ${resumen.dias_campo} días, de lunes a sábado. ${basesEnTexto(resumen.bases)}. ${resumen.en_tdr ? "Cabe en el TdR." : "No cabe en el TdR."}`
              : ""}
          </li>
          <li>
            Tiempos de Mapbox, saliendo a las 7:00, de una escuela a otra a las
            11:00 y regresando a las 16:00 de un martes.
          </li>
        </ul>
        </details>
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
    entre: "entre escuelas",
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
            const activa = g.visitas.some((v) => v.dane === seleccion);
            const total = g.minCarretera;
            const nombres = g.visitas.map((v) => v.sede).join(" + ");
            const municipios = [...new Set(g.visitas.map((v) => v.municipio))].join(", ");
            return (
              <li key={g.cuadrilla}>
                <button
                  onClick={() => onSelecciona(activa ? null : g.visitas[0].dane)}
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
                    <span className="truncate text-[11px] font-medium">{nombres}</span>
                  </div>
                  <p className="text-[10px]" style={{ color: "var(--tinta-3)" }}>
                    {municipios} · {DICE[e.fase]} · {hm(total)} de carretera
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
  resumen,
  otrasSecretarias,
  diasCampo,
  onFormaCalculo,
}: {
  plan: Plan;
  resumen: ResumenEscenario | undefined;
  otrasSecretarias: string[];
  diasCampo: number;
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
          {/* Lo primero que se pregunta quien abre la pantalla es qué son los
              números de los pines, y la respuesta estaba solo en el Info de la
              simulación, que arranca apagada. */}
          <li>
            El número del pin es el día de campo en que se visita la escuela,
            del 1 al {diasCampo}, y su color es la cuadrilla. Dos pines con
            el mismo número y el mismo color son las dos visitas de un día.
          </li>
          {/* Sin nombrar el color: el rombo se dibuja con la tinta del tema y
              en oscuro sale claro, así que «negros» era falso la mitad del
              tiempo. Lo que lo identifica es la forma. */}
          <li>
            Los rombos llenos son las bases de salida:{" "}
            {resumen
              ? [...new Set(Object.values(resumen.bases))].join(" y ")
              : "—"}
            .
          </li>
          <li>
            El área sombreada con contorno continuo es el territorio de la
            Secretaría de Educación del Valle: 34 municipios.
          </li>
          {/* Solo cuando el escenario trae otras secretarías. En el alcance de
              solo la SE del Valle no hay contorno punteado que explicar. */}
          {otrasSecretarias.length > 0 && (
            <li>
              Las de contorno punteado y sombra más tenue son{" "}
              {otrasSecretarias.length === 1
                ? otrasSecretarias[0]
                : `${otrasSecretarias.slice(0, -1).join(", ")} y ${otrasSecretarias.at(-1)}`}
              , secretarías propias que suman sedes a este alcance. Los demás
              municipios con secretaría propia van sin sombra. Al pasar el
              cursor, el mapa dice de quién es cada municipio.
            </li>
          )}
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
  diasCampo,
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
  onCierra,
}: {
  guion: GuionDia[];
  diasCampo: number;
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
  onCierra: () => void;
}) {
  const dias = Array.from({ length: diasCampo }, (_, i) => i + 1);
  const porClave = new Map(guion.map((g) => [`${g.cuadrilla}|${g.diaCorrido}`, g]));
  // La escala deja la jornada de ocho horas al 70 % del alto, para que un día
  // que se pase tenga a dónde crecer y se vea que se pasó.
  const ALTO = 38;
  const escala = (min: number) => (min / JORNADA_MIN) * (ALTO * 0.7);
  const largoHoy = largoDelDia(guion, dia, inspeccion);

  return (
    // A la derecha de la columna de tarjetas y a la izquierda de los controles
    // del mapa: centrado sobre la pantalla entera tapaba el final de la columna.
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 px-2 pb-[max(0.25rem,env(safe-area-inset-bottom))] md:left-[368px] md:right-[112px] md:px-3 md:pb-1">
      <div className="pointer-events-auto">
        <Tarjeta>
          <div className="px-3 py-2">
            <div className="mb-1.5 flex items-start justify-between gap-2">
              <h2 className="text-[12px] font-semibold">
                Simulación
                <Info texto={COMO_LEER_SIMULACION} ancho />
              </h2>
              <button
                onClick={onCierra}
                aria-label="Cerrar la simulación"
                title="Cerrar la simulación"
                className="px-1 text-[16px] leading-none"
                style={{ color: "var(--tinta-3)" }}
              >
                ×
              </button>
            </div>
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
                  todas
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

            <div className="mt-4 flex gap-1 overflow-x-auto">
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
              <div className="flex min-w-0 flex-1 gap-[3px]">
                {dias.map((d) => {
                  const esHoy = d === dia;
                  const nuevaSemana = d % DIAS_HABILES_SEMANA === 1 && d > 1;
                  return (
                    <div
                      key={d}
                      className="flex min-w-[22px] flex-1 flex-col gap-0.5"
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
                                ? `${c} · día ${d} · ${g.visitas.map((v) => `${v.sede} (${v.municipio})`).join(" + ")} · ${hm(g.minCarretera)} de carretera`
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
                                    height: escala(g.minCarretera),
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
                                    height: escala(inspeccion * g.visitas.length),
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
