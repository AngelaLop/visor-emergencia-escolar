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

import ControlDerecho from "@/components/ControlDerecho";
import FichaSede from "@/components/FichaSede";
import { CAPAS_INICIALES } from "@/components/Mapa";
import type { Capas } from "@/components/Mapa";
import PanelIzquierdo from "@/components/PanelIzquierdo";
import { descarga } from "@/lib/csv";
import {
  cargaBordeGrilla,
  cargaColombia,
  cargaContornos,
  cargaEvento,
  cargaDanos,
  cargaReportes,
  cargaSedes,
  danosFuera,
  danosVisibles,
  filtra,
  resume,
} from "@/lib/datos";
import { FILTROS_INICIALES } from "@/lib/tipos";
import type {
  ColeccionSedes,
  Dano,
  Evento,
  Filtros,
  MapaBase,
  Reporte,
  Sede,
  Tema,
} from "@/lib/tipos";

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
  const [mapaBase, setMapaBase] = useState<MapaBase>("claro");
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [danos, setDanos] = useState<Dano[]>([]);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES);
  const [capas, setCapas] = useState<Capas>(CAPAS_INICIALES);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  // Los logos van pegados a la izquierda de la atribución del mapa base, y esa
  // barra cambia de ancho con cada mapa: la de OpenStreetMap no dice lo mismo
  // que la de CARTO. Se mide en vez de suponer un margen fijo.
  const [margenLogos, setMargenLogos] = useState(300);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      cargaEvento(),
      cargaSedes(),
      cargaContornos(),
      cargaBordeGrilla(),
      cargaColombia(),
      cargaReportes(),
      cargaDanos(),
    ])
      .then(([e, s, c, b, co, r, dn]) => {
        setEvento(e as Evento);
        setColeccion(s as ColeccionSedes);
        setContornos(c);
        setBordeGrilla(b);
        setColombia(co);
        setReportes(r as Reporte[]);
        setDanos(dn as Dano[]);
      })
      .catch((e: Error) => setError(e.message));

    const guardado = localStorage.getItem("visor.mapa") as MapaBase | null;
    if (guardado) setMapaBase(guardado);
  }, []);

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

  const seleccionadas = useMemo(
    () => (coleccion ? filtra(coleccion, filtros) : []),
    [coleccion, filtros],
  );
  const resumen = useMemo(() => resume(seleccionadas), [seleccionadas]);

  // Los puntos de daño se derivan de la selección, no de los filtros. Así
  // cualquier filtro nuevo los afecta sin que haya que acordarse de esta capa.
  const danosEnMapa = useMemo(
    () => danosVisibles(danos, seleccionadas),
    [danos, seleccionadas],
  );
  const nDanosFuera = useMemo(
    () => danosFuera(danos, danosEnMapa),
    [danos, danosEnMapa],
  );

  // El mismo recorte pero sin los sub-filtros de la última tarjeta. El relato
  // de "de la selección, N fueron encuestadas y el X % declaró avería" tiene
  // que seguir siendo verdad mientras se prende "no encuestadas": si se
  // calculara sobre lo filtrado, diría que cero de cero fueron encuestadas.
  const resumenAmplio = useMemo(
    () =>
      coleccion
        ? resume(
            filtra(coleccion, {
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
            }),
          )
        : resume([]),
    [coleccion, filtros],
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
        evento={evento}
        sedes={seleccionadas}
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
        danos={danosEnMapa}
        danosFuera={nDanosFuera}
        onIrASede={irASede}
        onExportar={() => descarga(seleccionadas)}
        encuestadasPais={ENCUESTADAS_PAIS}
      />

      <div className="pointer-events-none absolute inset-x-2 top-2 z-20 flex flex-col items-stretch gap-2 md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:items-end md:p-3 md:pb-16">
        <ControlDerecho
          resumen={resumen}
          mapaBase={mapaBase}
          onMapaBase={setMapaBase}
          onExportar={() => descarga(seleccionadas)}
        />
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
        El MMI es la sacudida que estima el USGS, no daño observado. Ninguna
        sede de esta pantalla ha sido inspeccionada.{" "}
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
