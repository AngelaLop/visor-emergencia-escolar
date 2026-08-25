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

import CaracteristicasAfectadas from "@/components/CaracteristicasAfectadas";
import ControlDerecho, { TarjetaMapaBase } from "@/components/ControlDerecho";
import FichaSede from "@/components/FichaSede";
import { CAPAS_INICIALES } from "@/components/Mapa";
import type { Capas } from "@/components/Mapa";
import PanelIzquierdo, { TarjetaDanos } from "@/components/PanelIzquierdo";
import { descarga } from "@/lib/csv";
import {
  alumnos,
  cargaBordeGrilla,
  cargaColombia,
  cargaContornos,
  cargaEvento,
  cargaDanos,
  cargaReportes,
  cargaSecretarias,
  cargaIes,
  cargaSedes,
  consultaEdicionMen,
  cuentaDanosMarcados,
  danesConDano,
  danoMarcado,
  danosMarcados,
  danosFuera,
  danosVisibles,
  filtra,
  indiceMarco,
  miles,
  pideAtributos,
  resume,
  sinCoordenada,
  sinRecorteDeBanda,
  resumeSin,
  sedesConDano,
  sinOcultas,
} from "@/lib/datos";
import { FILTROS_INICIALES, SUBTIPOS, reportePorSede } from "@/lib/tipos";
import type {
  ColeccionIes,
  ColeccionSecretarias,
  ColeccionSedes,
  Dano,
  Evento,
  Filtros,
  MapaBase,
  MetaMen,
  RasgoSede,
  Reporte,
  Resalte,
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
  const [ies, setIes] = useState<ColeccionIes | null>(null);
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
  /** El subconjunto que la tarjeta de características está resaltando.
   *
   * Vive aquí y no dentro de la tarjeta porque lo consume el mapa, que es su
   * hermano y no su hijo. Resaltar no toca `filtros` ni `capas`: ninguna de las
   * cuentas de la pantalla cambia, que es exactamente lo que separa resaltar de
   * recortar. */
  const [resalte, setResalte] = useState<Resalte | null>(null);
  /** Si el bloque de características está desplegado.
   *
   * También vive aquí porque decide el ancho de la columna derecha entera. Las
   * barras no caben en los 240 px con los que abre la columna, y ensanchar solo
   * la tarjeta de daños dejaría la pila con el borde izquierdo desigual.
   *
   * Abre desplegado desde que el visor arranca en solo daños. Cerrado, la
   * pantalla de entrada eran puntos rojos sobre un mapa y nada que dijera qué
   * tienen en común esas escuelas; el desglose por característica es la única
   * lectura de conjunto de las sedes dañadas, y estaba a un clic que nadie daba
   * porque nada anunciaba que existía. */
  const [caracteristicas, setCaracteristicas] = useState(true);
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
    cargaIes().then(setIes).catch(() => {});

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
  /** Solo los códigos, para saber cuáles trae el marco sin construir el índice
   *  entero. Se necesita antes que `porDane`, que se arma más abajo. */
  const coleccionTiene = useMemo(
    () => new Set((coleccion?.features ?? []).map((f) => f.properties.dane)),
    [coleccion],
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

  /** Las sedes con reporte que el marco no tiene, para poder contarlas.
   *
   * Son 47 y el mapa siempre las dibuja, porque una fuente afirmando que una
   * escuela se cayó no depende de que nuestro marco la tenga. Lo que faltaba era
   * que entraran en el conteo y en el CSV: hasta hoy la pantalla decía 1.744
   * arriba mientras la capa dibujaba 1.791.
   *
   * De dónde salen, medido el 23 de agosto de 2026 contra la base maestra: 27 no
   * tienen coordenada en el directorio y su punto se dibuja con la que publica el
   * MEN; 11 caen fuera de la grilla del ShakeMap; 9 quedan por debajo de MMI 4,0.
   * Ninguna es ajena al SIMAT de 2022, aunque este comentario lo dijo un tiempo.
   * Los tres casos comparten el efecto y no la causa, así que el rótulo de
   * pantalla habla del listado de sedes y no de la intensidad: más de la mitad de
   * estas sedes no está fuera por el sismo, sino porque no sabemos dónde quedan.
   *
   * Entran solo cuando el recorte de intensidad no está recortando. Con bandas
   * encendidas, "esta sede está en MMI 6,0" es justo lo que se está preguntando y
   * de 20 de ellas no se puede contestar, porque no tienen MMI o lo tienen por
   * debajo del mínimo. Meterlas ahí sería colarlas en una selección que dice
   * mirar una intensidad que ellas no tienen.
   *
   * Y solo mientras nadie pregunte por un atributo. Llegan con nombre, municipio
   * y matrícula y nada más: sin zona, sin quintil, sin C-600. En cuanto alguien
   * filtra por zona no hay forma honesta de decir si pasan, y salen por la misma
   * regla con la que `pasa` deja fuera a una sede sin quintil cuando se elige un
   * quintil.
   */
  const fueraDelMarco = useMemo(() => {
    if (!sinRecorteDeBanda(filtros) || pideAtributos(filtros)) return VACIAS;
    return sedesConDano(coleccion, danosPintados, capas.estadosDano,
                        capas.subtipos)
      .filter((f) => !coleccionTiene.has(f.properties.dane))
      // Los dos atributos que estas sedes si traen, en el propio reporte de
      // daño, y que por eso no estan en `pideAtributos`: la entidad que
      // responde por ellas y su matricula. Sin el primero, elegir una
      // secretaria le sumaba a su cuenta las sedes fuera del marco de todo el
      // pais: con el Valle en pantalla se contaban las de Choco y Manizales.
      .filter((f) => filtros.secretarias.length === 0
        || filtros.secretarias.includes(f.properties.secretaria ?? ""))
      .filter((f) => alumnos(f.properties) >= filtros.matriculaMin);
  }, [filtros, coleccion, coleccionTiene, danosPintados, capas.estadosDano,
      capas.subtipos]);

  const sedesMarco = useMemo(
    () => (coleccion
      ? [...filtra(coleccion, filtros, danesAfirmado), ...fueraDelMarco]
      : []),
    [coleccion, filtros, danesAfirmado, fueraDelMarco],
  );
  const indice = useMemo(() => indiceMarco(sedesMarco), [sedesMarco]);
  /** Los codigos que sobreviven a los filtros, para que el mapa atenue el resto.
   *
   * Sale del mismo `sedesMarco` que alimenta la cifra de la derecha, asi que las
   * dos hablan del mismo recorte por construccion. */
  const danesSeleccion = useMemo(
    () => new Set(sinOcultas(sedesMarco, danesOcultas)
      .map((f) => f.properties.dane)),
    [sedesMarco, danesOcultas],
  );
  const resumen = useMemo(
    () => resumeSin(indice, danesOcultas),
    [indice, danesOcultas],
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
  /** Las sedes con daño que además pasan los filtros de la izquierda.
   *
   * Se cruza contra `sedesMarco` y no se arma por separado. Armado aparte, que
   * es como estaba, la pantalla de solo daños ignoraba el panel izquierdo
   * entero: elegir una secretaría, una zona o una matrícula mínima recortaba el
   * mapa y dejaba el contador de la derecha diciendo el total del país. Los dos
   * decían cosas distintas del mismo recorte.
   *
   * Cruzar contra el marco hereda gratis las reglas que ya estaban pensadas
   * ahí: el recorte de banda con su excepción para las sedes reportadas, la de
   * dejar fuera a las que no están en el marco en cuanto alguien filtra por un
   * atributo que ellas no tienen, y las ocultas de la curaduría, que hasta hoy
   * esta pantalla tampoco descontaba.
   *
   * Solo cuando la pantalla muestra únicamente daños. Armar los rasgos recorre
   * las 52 mil sedes del marco para resolver ficha y matrícula, y no hace falta
   * en cada clic de subtipo.
   */
  const rasgosConDano = useMemo(() => {
    if (!soloDanos) return VACIAS;
    const conDano = new Set(
      sedesConDano(coleccion, danosPintados, capas.estadosDano, capas.subtipos)
        .map((f) => f.properties.dane),
    );
    return sinOcultas(sedesMarco, danesOcultas)
      .filter((f) => conDano.has(f.properties.dane));
  }, [soloDanos, coleccion, danosPintados, capas.estadosDano, capas.subtipos,
      sedesMarco, danesOcultas]);
  /** Las sedes con daño que no se pueden dibujar porque nadie tiene su punto.
   *
   * No es que estén filtradas: es que ninguna de nuestras fuentes sabe dónde
   * quedan, ni el SIMAT de 2022, ni el directorio del MEN de 2026, ni la propia
   * capa del Ministerio. Sin coordenada no hay punto que pintar, así que no
   * están en el mapa y tampoco en el número grande.
   *
   * Se cuentan aparte y se dicen en pantalla porque callarlas convierte el
   * contador en una afirmación falsa: quien lo lee entiende "estas son todas",
   * y no lo son. Son pocas y pesan: hoy dos de ellas declaran colapso.
   *
   * Respetan el desglose de estados y subtipos, igual que el contador, para que
   * el aviso hable siempre del mismo recorte que el número al que acompaña.
   */
  /** Las sedes con daño que no se pueden dibujar, y sus estudiantes.
   *
   * Sale de `danos` y no de `danosPintados`: esa lista ya paso por
   * `danosVisibles`, que descarta justamente las que no tienen coordenada, asi
   * que calculada ahi daba cero siempre y el aviso no se mostraba nunca.
   *
   * Es la misma regla y el mismo recorrido que alimentan el "no se pueden
   * dibujar" de la tarjeta de daños, para que las dos digan el mismo numero. */
  const sinCoord = useMemo(
    () => sinCoordenada(danos, filtros.secretarias),
    [danos, filtros.secretarias],
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

  /** Las sedes del tramo resaltado, para poder bajarlas en CSV.
   *
   * Se resuelven contra el marco ya recortado y no contra la colección entera: lo
   * que se descarga tiene que ser un subconjunto de lo que la pantalla dice estar
   * mostrando. Si una sede resaltada quedó fuera por un filtro, no entra, y el
   * número del botón lo dice porque se cuenta sobre esta misma lista.
   *
   * El marco ya trae las que no están en la colección, así que las 47 se bajan
   * con las demás cuando corresponde. */
  const sedesResaltadas = useMemo(() => {
    if (!resalte) return VACIAS;
    return sinOcultas(sedesMarco, danesOcultas)
      .filter((f) => resalte.danes.has(f.properties.dane));
  }, [resalte, sedesMarco, danesOcultas]);

  /** El ancho de la columna derecha.
   *
   * 240 px mientras solo hay cifras, 360 cuando se despliegan las barras de
   * características, que es lo que ya mide el panel izquierdo. Lo deciden aquí
   * las tres tarjetas a la vez y no cada una por su cuenta: la franja ajusta al
   * contenido, así que si solo creciera la de daños la pila quedaría con el
   * borde izquierdo desigual. */
  const anchoDerecha = caracteristicas ? "md:w-[22.5rem]" : "md:w-60";

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

  /** El universo de la tarjeta de características: un reporte por sede, el que
   *  gana, y solo si su estado y su subtipo están marcados.
   *
   * Sale de `danosMarcados`, la misma función con la que la tarjeta de daños
   * calcula el número de su encabezado. Es a propósito: las dos tarjetas son
   * hermanas y hablan de las mismas sedes, y con dos cálculos paralelos ya se
   * separaron antes en este visor. */
  const marcadas = useMemo(
    () => danosMarcados(danosPintados, capas.estadosDano, capas.subtipos),
    [danosPintados, capas.estadosDano, capas.subtipos],
  );

  /** El directorio entero indexado por código DANE.
   *
   * Lo necesita la tarjeta de características para mirar la zona, el quintil y
   * los servicios de cada sede reportada. Va sobre la colección completa y no
   * sobre el marco filtrado: una sede con daño puede estar fuera de la selección
   * por su banda de intensidad y aun así el mapa la dibuja, así que buscarla en
   * el marco la dejaría sin ficha justo cuando se está mirando.
   *
   * Se arma una sola vez, al llegar el archivo. `indiceMarco` no sirve para
   * esto: ese se rehace con cada filtro. */
  const porDane = useMemo(() => {
    const m = new Map<string, Sede>();
    for (const f of coleccion?.features ?? []) m.set(f.properties.dane, f.properties);
    return m;
  }, [coleccion]);

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
        ies={ies}
        danesConPin={danesConPin}
        danos={danosEnMapa}
        danesSeleccion={danesSeleccion}
        foco={foco}
        danesConReporte={danesConReporte}
        filtros={filtros}
        capas={capas}
        mapaBase={mapaBase}
        tema={tema}
        seleccion={seleccion}
        onSeleccion={irASede}
        resalte={resalte}
        // Al desplegar las caracteristicas la columna derecha pasa de 240 a
        // 360 px y tapa la esquina donde viven el zoom y el boton de inicio.
        controlesIzquierda={caracteristicas}
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
        danesSeleccion={danesSeleccion}
        danosFuera={nDanosFuera}
        metaMen={metaMen}
        edicionMen={edicionMen}
        onIrASede={irASede}
        onExportar={() => descarga(sinOcultas(sedesMarco, danesOcultas))}
        encuestadasPais={ENCUESTADAS_PAIS}
        mapaBase={mapaBase}
        onMapaBase={setMapaBase}
        danosMarcados={marcadas}
        porDane={porDane}
        resalte={resalte}
        onResalte={setResalte}
        caracteristicas={caracteristicas}
        onCaracteristicas={setCaracteristicas}
      />

      <div className="pointer-events-none absolute inset-x-2 top-2 z-20 flex flex-col items-stretch gap-2 md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:items-end md:p-3 md:pb-16">
        <div className={`pointer-events-auto w-full ${anchoDerecha}`}>
          <ControlDerecho
          resumen={resumenContado}
          resalte={resalte
            ? { n: sedesResaltadas.length, etiqueta: resalte.etiqueta }
            : null}
          onExportarResalte={resalte
            ? () => descarga(sedesResaltadas)
            : null}
          sinCoordenada={sinCoord}
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
        </div>

        {/* Los daños quedan debajo del conteo, pegados a la cifra de la que
            cuelgan, y con el mismo ancho: la franja derecha ajusta al contenido,
            asi que sin decirle nada cada tarjeta medía lo suyo y la pila
            quedaba con el borde izquierdo desigual. Por eso las tres comparten
            `anchoDerecha` y crecen juntas al desplegar las caracteristicas.
            Desplegada pasa de la pantalla, asi que se desplaza por dentro; sin
            `min-h-0` un hijo flexible no se deja encoger y el desbordamiento se
            iria por debajo del borde.

            Nada de esto en el telefono, donde la tarjeta sigue viviendo en la
            hoja de abajo: ver el comentario del orden en `PanelIzquierdo`.

            Y solo cuando no hay ficha abierta: las dos a la vez en la misma
            columna dejan a cada una en un tercio de la altura. */}
        {!sedeAbierta && (
          <div className={`pointer-events-auto hidden min-h-0 overflow-y-auto overscroll-contain md:block ${anchoDerecha}`}>
            <TarjetaDanos
              capas={capas}
              onCapas={setCapas}
              filtros={filtros}
              reportes={reportes}
              danos={danosEnMapa}
              danesSeleccion={danesSeleccion}
              danosFuera={nDanosFuera}
              metaMen={metaMen}
              edicionMen={edicionMen}
              onIrASede={irASede}
            />

            {/* Hermana de la de daños, pegada debajo y con el mismo universo.
                Metida dentro, la de daños pasaba de mil píxeles de alto y había
                que recorrer sus tres bloques de fuente para llegar. */}
            <div className="mt-2">
              <CaracteristicasAfectadas
                danos={marcadas}
                porDane={porDane}
                resalte={resalte}
                onResalte={setResalte}
                abierta={caracteristicas}
                onAbierta={setCaracteristicas}
                secretarias={filtros.secretarias}
              />
            </div>
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
        <div className={`pointer-events-auto hidden md:block ${anchoDerecha}`}>
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
