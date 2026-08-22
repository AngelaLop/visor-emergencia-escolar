"use client";

/** El visor. Mapa a pantalla completa y tarjetas flotando a la izquierda, como
 * en un mapa de navegacion.
 *
 * Responde una sola pregunta: a donde mandar a alguien a mirar primero. No es
 * una plataforma publica de reportes ciudadanos ni un tablero de indicadores.
 * Esa restriccion es la que mantiene la pantalla legible.
 */

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import ControlDerecho, { TarjetaMapaBase } from "@/components/ControlDerecho";
import FichaSede from "@/components/FichaSede";
import { CAPAS_INICIALES } from "@/components/Mapa";
import type { Capas } from "@/components/Mapa";
import PanelIzquierdo, { TarjetaDanos } from "@/components/PanelIzquierdo";
import { descarga } from "@/lib/csv";
import {
  cargaBordeGrilla,
  cargaColombia,
  cargaContornos,
  cargaEvento,
  cargaDanos,
  cargaReportes,
  cargaSecretarias,
  cargaSedes,
  consultaEdicionMen,
  cuentaDanosMarcados,
  danesConDano,
  danoMarcado,
  danosFuera,
  danosVisibles,
  filtra,
  indiceMarco,
  miles,
  resume,
  resumeSin,
  sedesConDano,
  sinOcultas,
} from "@/lib/datos";
import { FILTROS_INICIALES, SUBTIPOS, reportePorSede } from "@/lib/tipos";
import type {
  ColeccionSecretarias,
  ColeccionSedes,
  Dano,
  Evento,
  Filtros,
  MapaBase,
  MetaMen,
  RasgoSede,
  Reporte,
  Sede,
  Tema,
} from "@/lib/tipos";

const VACIAS: RasgoSede[] = [];
const VACIO = resume([]);

// MapLibre toca `window` al importarse, asi que no puede renderizarse en el
// servidor.
const Mapa = dynamic(() => import("@/components/Mapa"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm">
      cargando el mapa…
    </div>
  ),
});

export default function Pagina() {
  const [evento, setEvento] = useState<Evento | null>(null);
  const [coleccion, setColeccion] = useState<ColeccionSedes | null>(null);
  const [contornos, setContornos] = useState<unknown | null>(null);
  const [bordeGrilla, setBordeGrilla] = useState<unknown | null>(null);
  const [colombia, setColombia] = useState<unknown | null>(null);
  // El territorio de cada secretaria, para dibujarlo al elegir una. Puede faltar
  // sin que el mapa deje de funcionar: lo unico que se pierde es la linea.
  const [territorios, setTerritorios] =
    useState<ColeccionSecretarias | null>(null);
  const [mapaBase, setMapaBase] = useState<MapaBase>("claro");
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [danos, setDanos] = useState<Dano[]>([]);
  // De cuando es la capa del MEN que se esta dibujando, y si el MEN la edito
  // despues. Lo segundo es una consulta al servicio del MEN que puede no
  // responder: cuando falla se queda en null y la pantalla no dice nada, que es
  // lo correcto. El aviso es informacion de mas, no una condicion para pintar.
  const [metaMen, setMetaMen] = useState<MetaMen | null>(null);
  const [edicionMen, setEdicionMen] = useState<number | null>(null);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES);
  const [capas, setCapas] = useState<Capas>(CAPAS_INICIALES);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  // Los logos van pegados a la izquierda de la atribución del mapa base, y esa
  // barra cambia de ancho con cada mapa: la de OpenStreetMap no dice lo mismo
  // que la de CARTO. Se mide en vez de suponer un margen fijo.
  const [margenLogos, setMargenLogos] = useState(300);
  const [error, setError] = useState<string | null>(null);

  /** La carga, en dos grupos y no en uno.
   *
   * `Promise.all` termina cuando termina el último, así que meter un archivo en
   * esa lista es decidir que la pantalla no se dibuja hasta que ese archivo
   * llegue. El grupo bloqueante es lo que la primera pantalla necesita para
   * decir algo: el evento, las sedes, la mancha de intensidad y los daños.
   *
   * Lo demás entra solo. Los territorios de las secretarías pesan 1 MB y no se
   * usan hasta que alguien elige una entidad; el contorno del país y los
   * reportes de ChatMap tampoco cambian lo que se lee al abrir. Estuvieron en el
   * grupo bloqueante y en un teléfono eso se notaba: `sedes_evento.geojson` son
   * 17,3 MB de JSON que el navegador tiene que convertir en 26.591 rasgos, y
   * encima de eso el mapa se quedaba esperando un megabyte de polígonos que
   * nadie había pedido.
   *
   * Cada uno se pinta cuando llega, porque las capas del mapa son
   * independientes: `Mapa.tsx` tiene un efecto por fuente y ninguno depende de
   * que los otros hayan terminado.
   */
  useEffect(() => {
    Promise.all([cargaEvento(), cargaSedes(), cargaContornos(), cargaDanos()])
      .then(([e, s, c, dn]) => {
        setEvento(e as Evento);
        setColeccion(s as ColeccionSedes);
        setContornos(c);
        const d = dn as { danos: Dano[]; men: MetaMen | null };
        setDanos(d.danos);
        setMetaMen(d.men);
      })
      .catch((e: Error) => setError(e.message));

    // Los que se agregan encima de un mapa que ya responde su pregunta. Si uno
    // falla, se pierde su capa y no la pantalla, que es lo que ya prometían
    // `cargaColombia` y `cargaSecretarias` en `lib/datos.ts`.
    cargaBordeGrilla().then(setBordeGrilla).catch(() => {});
    cargaColombia().then(setColombia).catch(() => {});
    cargaReportes().then((r) => setReportes(r as Reporte[])).catch(() => {});
    cargaSecretarias().then(setTerritorios).catch(() => {});

    const guardado = localStorage.getItem("visor.mapa") as MapaBase | null;
    if (guardado) setMapaBase(guardado);
  }, []);

  // Le pregunta al MEN si edito su capa despues de la descarga que dibuja el
  // mapa. Es lo unico que este visor consulta en vivo contra un servicio ajeno,
  // y por eso se mantiene tan chico: pide la ficha del servicio, un par de
  // kilobytes, y no baja ningun dato. El mapa ya esta dibujado cuando esto
  // corre, asi que si el MEN no contesta no se pierde nada.
  useEffect(() => {
    if (!metaMen) return;
    let vivo = true;
    consultaEdicionMen(metaMen).then((x) => {
      if (vivo) setEdicionMen(x);
    });
    return () => {
      vivo = false;
    };
  }, [metaMen]);

  // El tema de la interfaz sigue al mapa base: con el mapa oscuro, un panel
  // blanco encandila, y con el mapa claro un panel negro no se lee.
  const tema: Tema = mapaBase === "oscuro" ? "oscuro" : "claro";

  useEffect(() => {
    document.documentElement.dataset.theme = tema === "oscuro" ? "dark" : "light";
    localStorage.setItem("visor.mapa", mapaBase);
  }, [mapaBase, tema]);

  useEffect(() => {
    const mide = () => {
      const a = document.querySelector(".maplibregl-ctrl-attrib");
      if (a) setMargenLogos(a.getBoundingClientRect().width + 20);
    };
    const t = setTimeout(mide, 1200);
    window.addEventListener("resize", mide);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", mide);
    };
  }, [mapaBase, coleccion]);

  // Los puntos de daño no dependen de la selección de sedes ni de que la capa de
  // intensidad esté encendida. Lo que sí respetan, salvo que se pida lo
  // contrario, es el recorte de bandas: ver `danosTodasLasBandas` en `Capas`.
  //
  // Y respetan siempre la secretaría, porque eso no es un filtro sobre las
  // escuelas sino el recorte de jurisdicción de toda la pantalla. Ver
  // `danosVisibles`.
  const danosEnMapa = useMemo(
    () => danosVisibles(danos, filtros.secretarias),
    [danos, filtros.secretarias],
  );
  const nDanosFuera = useMemo(
    () => danosFuera(danos, filtros.secretarias),
    [danos, filtros.secretarias],
  );
  // Las sedes que el mapa está dibujando con daño. Entra en la selección para
  // que una escuela reportada no quede fuera del conteo por su banda de
  // intensidad. El recorte de casillas se resta después, sobre el índice.
  const conDano = useMemo(
    () => danesConDano(danosEnMapa, capas.estadosDano, capas.subtipos),
    [danosEnMapa, capas.estadosDano, capas.subtipos],
  );
  // Todas las que el reporte ganador afirma dañadas, sin mirar las casillas.
  // El mapa las pinta de color y no de gris; la lista no cambia al tocar un
  // subtipo, para no reescribir 26 mil rasgos en cada clic.
  const danesAfirmado = useMemo(
    () => danesConDano(danosEnMapa, ["colapso", "dano"], SUBTIPOS),
    [danosEnMapa],
  );
  const danesConPin = useMemo(() => [...danesAfirmado], [danesAfirmado]);
  // Las que tienen daño afirmado y ese daño está apagado. Salen de la
  // selección para no reaparecer como sede gris y no inflar el 26.591.
  const danesOcultas = useMemo(() => {
    const ocultas = new Set<string>();
    for (const dane of danesAfirmado) {
      if (!conDano.has(dane)) ocultas.add(dane);
    }
    return ocultas;
  }, [danesAfirmado, conDano]);

  // Un solo recorrido de las 26 mil: bandas, secretaría, zona. Las casillas
  // de daño no entran. Si entraran, cada clic reharía el GeoJSON y el resumen.
  // El gris debajo del pin lo apaga `danesConPin` con un setFilter. El
  // contador resta `danesOcultas` sobre el índice, sin volver a filtrar.
  const sedesMarco = useMemo(
    () => (coleccion ? filtra(coleccion, filtros, danesAfirmado) : []),
    [coleccion, filtros, danesAfirmado],
  );
  const indice = useMemo(() => indiceMarco(sedesMarco), [sedesMarco]);
  const resumen = useMemo(
    () => resumeSin(indice, danesOcultas),
    [indice, danesOcultas],
  );

  // Los que de verdad se están dibujando, que es lo que tiene que contar el
  // contador de arriba a la derecha cuando la pantalla muestra solo daños.
  const danosPintados = useMemo(
    () => (capas.danosTodasLasBandas
      ? danosEnMapa
      : danosEnMapa.filter(
        (d) => d.banda != null && filtros.bandas.includes(d.banda))),
    [danosEnMapa, capas.danosTodasLasBandas, filtros.bandas],
  );

  /** Cuándo la pantalla está mostrando solo las escuelas con daño.
   *
   * No hay un filtro propio para eso ni hace falta: es apagar la capa de sedes
   * y dejar prendida la de reportes. Son los dos interruptores que ya existen,
   * uno en la tarjeta de capas y otro en la de daños, y esa combinación no
   * significa ninguna otra cosa.
   *
   * Con la capa de sedes apagada, el contador de arriba a la derecha estaba
   * contestando una pregunta que nadie hizo: cuántas sedes dejan pasar los
   * filtros, mientras en el mapa lo único visible eran los puntos de daño.
   */
  const soloDanos = capas.reportes && !capas.sedes;
  // Solo cuando la pantalla muestra únicamente daños. Armar los rasgos recorre
  // las 52 mil sedes del marco para resolver ficha y matrícula, y no hace
  // falta en cada clic de subtipo.
  const rasgosConDano = useMemo(
    () => soloDanos
      ? sedesConDano(coleccion, danosPintados, capas.estadosDano,
                     capas.subtipos)
      : VACIAS,
    [soloDanos, coleccion, danosPintados, capas.estadosDano, capas.subtipos],
  );
  const resumenDanos = useMemo(
    () => (soloDanos ? resume(rasgosConDano) : VACIO),
    [soloDanos, rasgosConDano],
  );

  /** De la selección, cuántas sedes está el mapa dibujando con daño.
   *
   * Se cuenta contra `rasgosConDano`, que es exactamente lo que se dibuja, y no
   * contra `conDano`. Los dos conjuntos casi siempre coinciden, pero `conDano`
   * existe para otra cosa: es el permiso que deja pasar una sede con reporte
   * aunque su banda esté apagada, así que no puede aplicarse el recorte de banda
   * a sí mismo. Contando contra él, apagar "ver todas las sedes reportadas"
   * dejaba el contador diciendo un número que el mapa ya no dibujaba.
   *
   * Así este número es un subconjunto de lo que cuenta la tarjeta de daños por
   * construcción, y la diferencia entre los dos tiene una sola causa: las sedes
   * con reporte que no están en el marco que exporta el script 23. Hoy son 47:
   * 26 caen fuera de la grilla del ShakeMap, 8 tienen MMI por debajo de 4,0 y 13
   * no están en el SIMAT de 2022. El mapa las dibuja igual, porque una fuente
   * afirmando que una escuela se cayó no depende de que esté en nuestro marco.
   * Medido con `scripts/45_cuadra_conteos.py`.
   */
  const nConDano = useMemo(
    () => cuentaDanosMarcados(
      danosPintados, capas.estadosDano, capas.subtipos, indice.porDane),
    [danosPintados, capas.estadosDano, capas.subtipos, indice],
  );
  const nRasgosConDano = useMemo(
    () => cuentaDanosMarcados(
      danosPintados, capas.estadosDano, capas.subtipos),
    [danosPintados, capas.estadosDano, capas.subtipos],
  );
  const resumenContado = soloDanos ? resumenDanos : resumen;

  // El mismo recorte pero sin los sub-filtros de la última tarjeta. El relato
  // de "de la selección, N fueron encuestadas y el X % declaró avería" tiene
  // que seguir siendo verdad mientras se prende "no encuestadas": si se
  // calculara sobre lo filtrado, diría que cero de cero fueron encuestadas.
  const marcoAmplio = useMemo(
    () =>
      coleccion
        ? filtra(coleccion, {
            ...filtros,
            fisica: "todas",
            energia: "todas",
            internet: "todas",
            // El filtro por nivel de vulnerabilidad también es de esa
            // tarjeta. Sin neutralizarlo, el promedio del índice se
            // calcularía sobre los niveles que se acaban de marcar y
            // devolvería el nivel elegido, y los conteos de cada fila dirían
            // cero en las filas apagadas.
            ividCategorias: [],
          }, danesAfirmado)
        : VACIAS,
    [coleccion, filtros, danesAfirmado],
  );
  const indiceAmplio = useMemo(
    () => indiceMarco(marcoAmplio),
    [marcoAmplio],
  );
  const resumenAmplio = useMemo(
    () => resumeSin(indiceAmplio, danesOcultas),
    [indiceAmplio, danesOcultas],
  );

  // Cuantas de las sedes dibujadas con daño declaran tener un concepto tecnico
  // disponible. Lo dice el pie de pantalla, y ahi esta escrito por que la frase
  // se quedo en "declaran" y no dice "fueron inspeccionadas".
  //
  // Con la misma regla que el denominador que lo acompaña: el reporte que gana
  // por precedencia y solo si su estado está marcado. Antes miraba cualquier
  // reporte de cualquier sede, así que el numerador y el denominador de la misma
  // frase se calculaban de dos formas distintas.
  const nConConceptoTecnico = useMemo(
    () => [...reportePorSede(danosPintados).values()].filter(
      (d) => danoMarcado(d, capas.estadosDano, capas.subtipos)
        && d.concepto_tecnico === true).length,
    [danosPintados, capas.estadosDano, capas.subtipos],
  );

  const danesConReporte = useMemo(
    () =>
      reportes
        .filter((r) => r.es_escuela === "si" && r.dane_asignado)
        .map((r) => r.dane_asignado),
    [reportes],
  );

  // Las secretarías van de la más cercana al epicentro a la más lejana, no en
  // orden alfabético. Quien coordina busca primero por dónde empezar, y una
  // lista alfabética pone Antioquia antes que Chocó.
  const secretarias = useMemo(() => {
    if (!coleccion || !evento) return [];
    const [lonE, latE] = evento.epicentro;
    const suma = new Map<string, { d: number; n: number }>();
    for (const f of coleccion.features) {
      const s = f.properties.secretaria;
      if (!s) continue;
      const [lon, lat] = f.geometry.coordinates;
      const dx = (lon - lonE) * Math.cos((latE * Math.PI) / 180);
      const dy = lat - latE;
      const d = Math.hypot(dx, dy);
      const a = suma.get(s) ?? { d: 0, n: 0 };
      a.d += d;
      a.n += 1;
      suma.set(s, a);
    }
    return Array.from(suma.entries())
      .sort((a, b) => a[1].d / a[1].n - b[1].d / b[1].n)
      .map(([s]) => s);
  }, [coleccion, evento]);

  // El filtro es `zona`, la binaria del SIMAT, y no `area_class`. La
  // clasificacion de tres categorias se calcula sobre una grilla de poblacion
  // de 1 km y falta en 4.066 de estas sedes, asi que el filtro mostraba una
  // opcion "sin dato" con una de cada seis escuelas dentro. `zona` no tiene un
  // solo nulo. Lo que se pierde es distinguir centro poblado de vereda
  // dispersa; ver el issue de cobertura de area_class en docs/.
  const zonas = useMemo(() => {
    const v = new Set(coleccion?.features.map((f) => f.properties.zona ?? "") ?? []);
    v.delete("");
    return Array.from(v).sort();
  }, [coleccion]);

  /** La sede de la ficha.
   *
   * Sale de la colección, y si no está ahí se arma con lo que trae el propio
   * daño. Ese caso no es teórico: las 30 sedes de la Normal Superior La
   * Inmaculada están en Barbacoas, al sur del borde de la grilla del USGS, y no
   * tienen MMI, así que `sedes_evento.geojson` no las incluye. Sin este respaldo,
   * tocar su tarjeta en la lista no abriría nada.
   *
   * El MMI queda como NaN a propósito y no como cero: no es que no se haya
   * sacudido, es que el modelo no llega hasta ahí. La ficha esconde ese bloque
   * cuando el número no es finito.
   */
  const sedeAbierta = useMemo(() => {
    const enColeccion = coleccion?.features.find(
      (f) => f.properties.dane === seleccion,
    )?.properties;
    if (enColeccion) return enColeccion;
    const d = danos.find((x) => x.dane === seleccion);
    if (!d) return null;
    return {
      dane: d.dane,
      sede: d.sede,
      establecimiento: d.establecimiento,
      mpio: d.mpio,
      depto: d.depto,
      matricula: d.matricula,
      encuestada: d.encuestada ?? false,
      mmi: NaN,
      nivel: "sin dato",
      banda: NaN,
    } satisfies Sede;
  }, [coleccion, danos, seleccion]);

  /** Abrir una sede lleva el mapa hasta ella, venga de la lista o del mapa.
   *
   * El contador es necesario: si se toca dos veces la misma sede, el estado no
   * cambiaría y el mapa no volvería a moverse.
   *
   * Cerrar la ficha pasa `null` y no mueve nada: quien cierra quiere seguir
   * mirando donde está, no volver a ninguna parte.
   */
  const [foco, setFoco] = useState<{ dane: string; n: number } | null>(null);
  const irASede = (dane: string | null) => {
    setSeleccion(dane);
    if (dane) setFoco((f) => ({ dane, n: (f?.n ?? 0) + 1 }));
  };

  if (error) {
    return (
      <main className="flex h-screen items-center justify-center p-8">
        <div className="max-w-md text-sm">
          <p className="mb-2 font-semibold">No se pudieron cargar los datos.</p>
          <p style={{ color: "var(--tinta-2)" }}>{error}</p>
          <p className="mt-3" style={{ color: "var(--tinta-2)" }}>
            Los archivos los produce <code>scripts/23_visor_datos.py</code>.
            Hay que correrlo desde la raíz del repositorio.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-screen">
      <Mapa
        contornos={contornos}
        bordeGrilla={bordeGrilla}
        colombia={colombia}
        secretarias={territorios}
        evento={evento}
        sedes={sedesMarco}
        danesConPin={danesConPin}
        danos={danosEnMapa}
        foco={foco}
        danesConReporte={danesConReporte}
        filtros={filtros}
        capas={capas}
        mapaBase={mapaBase}
        tema={tema}
        seleccion={seleccion}
        onSeleccion={irASede}
      />

      <PanelIzquierdo
        evento={evento}
        filtros={filtros}
        onFiltros={setFiltros}
        capas={capas}
        onCapas={setCapas}
        resumen={resumen}
        resumenAmplio={resumenAmplio}
        tema={tema}
        secretarias={secretarias}
        zonas={zonas}
        reportes={reportes}
        sedes={sedesMarco}
        ocultas={danesOcultas}
        danos={danosEnMapa}
        danosFuera={nDanosFuera}
        metaMen={metaMen}
        edicionMen={edicionMen}
        onIrASede={irASede}
        onExportar={() => descarga(sinOcultas(sedesMarco, danesOcultas))}
        encuestadasPais={ENCUESTADAS_PAIS}
        mapaBase={mapaBase}
        onMapaBase={setMapaBase}
      />

      <div className="pointer-events-none absolute inset-x-2 top-2 z-20 flex flex-col items-stretch gap-2 md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:items-end md:p-3 md:pb-16">
        <ControlDerecho
          resumen={resumenContado}
          conDano={soloDanos ? resumenDanos.sedes : nConDano}
          // Con la pantalla en modo solo daños el número grande ya es el total
          // de sedes dibujadas con daño, así que no queda ninguna fuera y no hay
          // nada que explicar.
          conDanoFuera={soloDanos ? 0 : nRasgosConDano - nConDano}
          soloDanos={soloDanos}
          onExportar={() => descarga(
            soloDanos
              ? sedesConDano(coleccion, danosPintados, capas.estadosDano,
                             capas.subtipos)
              : sinOcultas(sedesMarco, danesOcultas),
          )}
        />

        {/* Los daños quedan debajo del conteo, pegados a la cifra de la que
            cuelgan, y con el mismo ancho: la franja derecha ajusta al contenido,
            asi que sin decirle nada cada tarjeta medía lo suyo y la pila
            quedaba con el borde izquierdo desigual. Los 240 px salen de
            `md:w-60`, que es lo que mide la del conteo. Desplegada pasa de la
            pantalla, asi que se desplaza por dentro; sin `min-h-0` un hijo
            flexible no se deja encoger y el desbordamiento se iria por debajo
            del borde.

            Nada de esto en el telefono, donde la tarjeta sigue viviendo en la
            hoja de abajo: ver el comentario del orden en `PanelIzquierdo`.

            Y solo cuando no hay ficha abierta: las dos a la vez en la misma
            columna dejan a cada una en un tercio de la altura. */}
        {!sedeAbierta && (
          <div className="pointer-events-auto hidden min-h-0 overflow-y-auto overscroll-contain md:block md:w-60">
            <TarjetaDanos
              capas={capas}
              onCapas={setCapas}
              filtros={filtros}
              reportes={reportes}
              danos={danosEnMapa}
              danosFuera={nDanosFuera}
              metaMen={metaMen}
              edicionMen={edicionMen}
              onIrASede={irASede}
            />
          </div>
        )}

        {/* La ficha se desplaza sola. Si este contenedor tambien se desplazara,
            el encabezado pegajoso con el boton de cerrar se iria por arriba y
            quedaria fuera de la pantalla. */}
        {sedeAbierta && (
          <div className="pointer-events-auto min-h-0">
            <FichaSede
              sede={sedeAbierta}
              reportes={reportes}
              danos={danos}
              onCerrar={() => setSeleccion(null)}
            />
          </div>
        )}

        {/* Debajo de los daños, no entre el conteo y ellos. El mapa base es una
            preferencia y no tiene que partir las dos lecturas de la columna. En
            el teléfono vive en la hoja de abajo, pegado a la misma tarjeta. */}
        <div className="pointer-events-auto hidden md:block md:w-60">
          <TarjetaMapaBase mapaBase={mapaBase} onMapaBase={setMapaBase} />
        </div>
      </div>

      {/* Los logos van en la misma franja de la atribución del mapa base, a su
          izquierda: es donde el ojo ya busca las procedencias, y sueltos en el
          medio quedaban apretujados contra el borde. Los dos a la misma altura
          y alineados por la base. */}
      <div
        className="pointer-events-none absolute bottom-1 z-10 hidden items-center gap-4 md:flex"
        style={{ right: margenLogos }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="logos/bid.png"
          alt="Banco Interamericano de Desarrollo"
          className="h-5 w-auto"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={tema === "oscuro" ? "logos/cima_blanco.svg" : "logos/cima.png"}
          alt="CIMA, Centro de Información para la Mejora de los Aprendizajes"
          className="h-5 w-auto"
        />
      </div>

      {/* Arranca donde termina la columna de tarjetas (360 px mas su margen).
          Anclada al borde de la pantalla, quedaba atravesada sobre las tarjetas
          en cuanto una se desplegaba. Nada del mapa va debajo del panel. */}
      <div
        className="absolute bottom-2 left-[372px] z-10 mr-3 hidden max-w-[calc(100%-390px)] rounded px-2 py-1 text-[10px] shadow md:block"
        style={{ background: "var(--superficie)", color: "var(--tinta-3)" }}
      >
        {/* Lo del MMI se fue al bloque del MMI, que es donde se pregunta.

            Esta frase decía que 16 sedes "tienen inspección técnica", y eso era
            afirmar más de lo que dice el archivo. La casilla del formulario
            pregunta si el concepto técnico está disponible, no si alguien fue a
            mirar la sede después del sismo: puede ser de antes, y 12 de esas 16
            declaran en la casilla siguiente que todavía requieren visita
            técnica. Ahora dice lo que dice la casilla y nada más.

            El número va escrito porque es pequeño. El día que sean muchas, esta
            frase habrá que rehacerla. */}
        <span className="num">{nConConceptoTecnico}</span> de las{" "}
        {/* El mismo número que el encabezado de la tarjeta de daños, y sale del
            mismo sitio. Decía `conDano.size`, que contaba con otra regla, y por
            eso el pie hablaba de 1.794 sedes mientras la tarjeta contaba
            1.791. */}
        <span className="num">{miles(rasgosConDano.length)}</span> sedes con daño
        reportado declaran tener un concepto técnico disponible. El resto son
        reportes de fuente, revisados uno por uno.{" "}
        <Link href="/triaje" className="underline">
          Triaje de reportes
        </Link>
      </div>
    </main>
  );
}

/** Sedes encuestadas por el FFIE en todo el país. Sale del perfilado de la base
 * maestra (`results/perfilado/base_maestra.txt`) y no de estos datos, porque el
 * GeoJSON del visor solo trae la zona del sismo. */
const ENCUESTADAS_PAIS = 15150;
