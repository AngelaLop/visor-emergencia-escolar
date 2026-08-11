"use client";

/** Las tarjetas de la izquierda, apiladas como en un mapa de navegación.
 *
 * El orden es el orden en que se contesta la pregunta operativa. Primero qué
 * pasó y dónde, enseguida lo que la ciudadanía ya reportó, que es hoy la razón
 * de ser de la herramienta, después qué se está viendo en el mapa, después qué
 * subconjunto de sedes interesa y por último qué se sabe de esas sedes. Cada
 * tarjeta se pliega, porque en una emergencia nadie mira las cinco a la vez.
 *
 * La tarjeta de intensidad hace dos cosas con un solo control: dibuja la banda y
 * deja pasar sus escuelas. Que sea la misma casilla es deliberado. Si el mapa
 * pintara una zona de MMI 5,0 mientras la lista cuenta otra cosa, los dos
 * números de la pantalla dejarían de hablar del mismo territorio.
 */

import { useRef, useState } from "react";

import { MarcaGitHub } from "@/components/Iconos";
import { COLOR_BANDA, REPORTE, svgEpicentro } from "@/components/Mapa";
import type { Capas } from "@/components/Mapa";
import { NOMBRE_AREA, NOMBRE_QUINTIL, horaLocal, miles } from "@/lib/datos";
import type { Resumen } from "@/lib/datos";
import { BANDAS, EXPLICACION_MMI, FUENTE_MMI } from "@/lib/tipos";
import type { Evento, Filtros, Reporte, Tema } from "@/lib/tipos";

type Props = {
  evento: Evento | null;
  filtros: Filtros;
  onFiltros: (f: Filtros) => void;
  capas: Capas;
  onCapas: (c: Capas) => void;
  resumen: Resumen;
  /** La misma selección sin los sub-filtros de la última tarjeta. */
  resumenAmplio: Resumen;
  tema: Tema;
  secretarias: string[];
  areas: string[];
  reportes: Reporte[];
  onIrASede: (dane: string) => void;
  onExportar: () => void;
  /** Cuántas sedes del país entero encuestó el FFIE. */
  encuestadasPais: number;
};

export default function PanelIzquierdo(p: Props) {
  // En el teléfono la pila de tarjetas es una hoja que sube desde abajo y
  // arranca recogida, para que lo primero que se vea sea el mapa.
  const [hojaAbierta, setHojaAbierta] = useState(false);

  return (
    <div
      className={
        // `pointer-events-none` solo desde `md`. En el telefono esta hoja es lo
        // que hay que poder arrastrar, y un contenedor que desplaza pero no
        // recibe punteros no se deja recorrer con el dedo en WebKit: el gesto
        // no encuentra a quien moverse. En escritorio si hace falta, porque la
        // columna de 360 px ocupa toda la altura y por debajo de las tarjetas
        // tiene que poder hacerse clic en el mapa.
        "pointer-events-auto overscroll-contain md:pointer-events-none " +
        "z-10 flex flex-col gap-2 overflow-y-auto " +
        // El relleno inferior deja pasar la escala y la atribucion del mapa,
        // que van fijas abajo y se comian la ultima tarjeta.
        "fixed inset-x-0 bottom-0 px-2 pb-8 " +
        (hojaAbierta ? "max-h-[88svh] " : "max-h-[38svh] ") +
        // `inset-y-0` fija arriba y abajo, y eso es lo que acota la columna a
        // la altura de la pantalla para que se desplace por dentro. Sin el
        // borde inferior crecia hacia abajo y el que terminaba desplazandose
        // era el documento entero.
        "md:absolute md:inset-y-0 md:left-0 md:right-auto " +
        "md:max-h-none md:w-[360px] md:p-3 md:pb-10"
      }
    >
      {/* El asa ocupa todo el ancho y es opaca. Como pastilla estrecha se
          quedaba flotando sobre el texto de la tarjeta que pasaba por debajo,
          y tapaba palabras sueltas en mitad de un parrafo. Ahora es el borde
          superior de la hoja: lo que se desplaza desaparece detras de ella,
          que es como se comporta cualquier hoja que sube desde abajo. */}
      <button
        onClick={() => setHojaAbierta(!hojaAbierta)}
        aria-label={hojaAbierta ? "Recoger el panel" : "Desplegar el panel"}
        className="pointer-events-auto sticky top-0 z-20 -mx-2 flex h-7 shrink-0 items-center justify-center px-2 md:hidden"
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
        <TarjetaEvento {...p} />
        <TarjetaDanos {...p} />
        <TarjetaCapas {...p} />
        <TarjetaCaracteristicas {...p} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------- 1. evento --

function TarjetaEvento({ evento }: Props) {
  return (
    <Tarjeta>
      <div className="flex items-start gap-2 px-4 pt-3">
        <div className="flex-1">
          <h1 className="text-sm font-semibold tracking-wide">
            VISOR ESCOLAR DE EMERGENCIA
            <Info
              texto="Ubica las sedes educativas oficiales de Colombia sobre la intensidad que el sismo del 10 de agosto de 2026 alcanzó en cada punto. Encima marca los reportes de daño que la ciudadanía manda por ChatMap de HOT y que ya pasaron por revisión humana. Y de cada sede muestra cómo estaba su infraestructura antes del sismo, según la encuesta del FFIE y el registro C-600 del DANE. Ninguna sede de esta pantalla ha sido inspeccionada."
              tono="var(--cima)"
            />
          </h1>
          <p className="text-xs" style={{ color: "var(--tinta-3)" }}>
            Sedes educativas oficiales de{" "}
            <strong style={{ color: "var(--tinta-2)" }}>Colombia</strong>
          </p>
          <span
            className="mt-0.5 inline-flex items-center gap-1.5 text-[10px]"
            style={{ color: "var(--tinta-3)" }}
          >
            <a
              // El repositorio del analisis es privado y a un visitante le
              // devuelve un 404. Este es el codigo de lo que esta mirando.
              href="https://github.com/AngelaLop/visor-emergencia-escolar"
              target="_blank"
              rel="noreferrer"
              title="Código del visor en GitHub"
              className="inline-flex"
              style={{ color: "inherit" }}
            >
              <MarcaGitHub alto={12} />
            </a>
            <a
              href="https://angelalop.github.io/AngelaLopezS/"
              target="_blank"
              rel="noreferrer"
              title="Portafolio de Angela López"
              style={{ color: "inherit" }}
            >
              AngelaLop
            </a>
          </span>
        </div>
      </div>

      <div className="flex items-start gap-3 px-4 pb-3 pt-2">
        <span
          className="shrink-0"
          dangerouslySetInnerHTML={{ __html: svgEpicentro(38) }}
        />
        <div className="min-w-0">
          {evento ? (
            <>
              <p className="text-sm font-medium">
                Sismo de magnitud {String(evento.magnitud).replace(".", ",")} a{" "}
                {evento.descripcion}
                <Info
                  texto={`Un sismo tan profundo reparte la sacudida sobre un área mucho más amplia que uno superficial. Por eso bajo el epicentro la intensidad es ${String(evento.mmi_epicentro ?? "").replace(".", ",")} y el máximo del mapa, ${String(evento.mmi_maximo ?? "").replace(".", ",")}, cae unos 44 km al sureste: la sacudida más fuerte no ocurre sobre la vertical del foco.`}
                />
              </p>
              <p className="num text-xs" style={{ color: "var(--tinta-2)" }}>
                {horaLocal(evento.origen_utc)}, hora de Colombia
              </p>
              <p className="num text-xs" style={{ color: "var(--tinta-2)" }}>
                Profundidad {String(evento.profundidad_km).replace(".", ",")} km
              </p>
            </>
          ) : (
            <p className="text-xs" style={{ color: "var(--tinta-3)" }}>
              cargando el evento…
            </p>
          )}
        </div>
      </div>
    </Tarjeta>
  );
}

// ------------------------------------------------------------- 2. daños --

function TarjetaDanos({ capas, onCapas, reportes, onIrASede }: Props) {
  // Recogida al abrir: la primera pantalla tiene que dejar ver el mapa, y quien
  // llega buscando los reportes los despliega de un clic.
  const [abierta, setAbierta] = useState(false);
  // "si" sin tilde es el valor que guarda el CSV de curaduria: es un codigo,
  // no prosa, y cambiarlo romperia las filas ya revisadas.
  const confirmados = reportes.filter(
    (r) => r.es_escuela === "si" && r.dane_asignado,
  );
  const pendientes = reportes.filter((r) => !r.es_escuela.trim());
  const matricula = confirmados.reduce((a, r) => {
    const c = r.candidatas.find((x) => x.dane === r.dane_asignado);
    return a + (c?.matricula ?? 0);
  }, 0);

  return (
    <Tarjeta>
      <div className="flex items-center gap-2 px-4 py-2.5">
        <button
          onClick={() => setAbierta(!abierta)}
          className="flex flex-1 items-center gap-2 text-left text-sm font-medium"
        >
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: REPORTE }}
          />
          <span>Daños Reportados en Instituciones Educativas (IE)</span>
          <span className="num text-xs" style={{ color: "var(--tinta-3)" }}>
            ({miles(confirmados.length)})
          </span>
        </button>
        <button
          onClick={() => onCapas({ ...capas, reportes: !capas.reportes })}
          aria-label={capas.reportes ? "ocultar en el mapa" : "mostrar en el mapa"}
          title={capas.reportes ? "ocultar en el mapa" : "mostrar en el mapa"}
          style={{ color: "var(--tinta-3)" }}
        >
          {capas.reportes ? "◉" : "○"}
        </button>
        <button
          onClick={() => setAbierta(!abierta)}
          style={{ color: "var(--tinta-3)" }}
          aria-label={abierta ? "plegar" : "desplegar"}
        >
          {abierta ? "▾" : "▸"}
        </button>
      </div>

      {abierta && (
        <div className="px-4 pb-3">
          <p className="mb-3 text-xs leading-relaxed" style={{ color: "var(--tinta-2)" }}>
            Con la colaboración del Humanitarian OpenStreetMap Team (HOT) se
            recogen de forma comunitaria fotografías enviadas por WhatsApp, que
            luego se curan una por una y se emparejan con el directorio oficial
            de sedes educativas. Aparecer aquí significa que una persona verificó
            que la fotografía corresponde a esa sede, no que la sede esté dañada.
          </p>

          {/* El canal de reporte es el de HOT, no uno propio. Duplicarlo daria
              una segunda cola que nadie revisa. El enlace va aqui y no en el
              encabezado porque quien acaba de leer de donde salen estos puntos
              es quien puede aportar el siguiente. */}
          <a
            href="https://chatmap.hotosm.org/"
            target="_blank"
            rel="noreferrer"
            className="mb-3 flex items-center justify-center gap-2 rounded border px-3 py-2 text-xs font-medium"
            style={{ borderColor: "var(--cima)", color: "var(--cima)" }}
          >
            Reportar daños en IE
            <span aria-hidden="true">↗</span>
          </a>

          {confirmados.length > 0 ? (
            <>
              <div
                className="mb-3 grid grid-cols-2 gap-3 rounded px-3 py-2"
                style={{ background: "var(--plano)" }}
              >
                <div>
                  <div className="num text-2xl font-semibold leading-none">
                    {miles(confirmados.length)}
                  </div>
                  <div className="text-xs" style={{ color: "var(--tinta-2)" }}>
                    {confirmados.length === 1 ? "sede reportada" : "sedes reportadas"}
                  </div>
                </div>
                <div>
                  <div
                    className="num text-2xl font-semibold leading-none"
                    style={{ color: "var(--critico)" }}
                  >
                    {miles(matricula)}
                  </div>
                  <div className="text-xs" style={{ color: "var(--tinta-2)" }}>
                    {confirmados.length === 1
                      ? "estudiantes en la sede"
                      : "estudiantes en esas sedes"}
                  </div>
                </div>
              </div>

              {confirmados.map((r) => {
                const c = r.candidatas.find((x) => x.dane === r.dane_asignado);
                return (
                  <button
                    key={r.id}
                    onClick={() => onIrASede(r.dane_asignado)}
                    className="mb-2 block w-full overflow-hidden rounded border text-left"
                    style={{ borderColor: "var(--linea)" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.url_foto}
                      alt="Fotografía enviada por un ciudadano"
                      className="h-36 w-full object-cover"
                      style={{ background: "var(--plano)" }}
                      loading="lazy"
                    />
                    <span className="block px-2.5 py-2">
                      <span className="block text-xs font-medium">
                        {c?.sede ?? r.dane_asignado}
                      </span>
                      <span
                        className="num block text-[10px]"
                        style={{ color: "var(--tinta-3)" }}
                      >
                        Código DANE {r.dane_asignado}
                      </span>
                      <span
                        className="num block text-xs"
                        style={{ color: "var(--tinta-2)" }}
                      >
                        {miles(c?.matricula ?? 0)} estudiantes
                      </span>
                      <span
                        className="block text-xs"
                        style={{ color: "var(--tinta-2)" }}
                      >
                        {c?.mpio}
                        {c ? `, reportado a ${c.dist_m} m de la sede` : ""}
                      </span>
                      {c && !c.encuestada && (
                        <span
                          className="block text-[10px]"
                          style={{ color: "var(--sede-ignota)" }}
                        >
                          Nunca fue encuestada
                        </span>
                      )}
                      <span
                        className="block text-[10px]"
                        style={{ color: "var(--tinta-3)" }}
                      >
                        {r.fecha}, confirmado por{" "}
                        {r.revisado_por || "sin registrar"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </>
          ) : (
            <p
              className="rounded border px-3 py-2 text-xs"
              style={{ borderColor: "var(--linea)", color: "var(--tinta-2)" }}
            >
              Todavía no hay ningún reporte confirmado.
              {pendientes.length > 0 ? (
                <>
                  {" "}
                  Hay <span className="num">{miles(pendientes.length)}</span>{" "}
                  esperando revisión en{" "}
                  <a href="/triaje" className="underline">
                    la bandeja de triaje
                  </a>
                  .
                </>
              ) : null}
            </p>
          )}
        </div>
      )}
    </Tarjeta>
  );
}

// -------------------------------------------------------------- 3. capas --

function TarjetaCapas({
  filtros,
  onFiltros,
  capas,
  onCapas,
  resumen,
  secretarias,
  areas,
}: Props) {
  const [abierta, setAbierta] = useState(true);
  const [intensidadAbierta, setIntensidadAbierta] = useState(true);
  const [masFiltros, setMasFiltros] = useState(false);
  const set = (p: Partial<Filtros>) => onFiltros({ ...filtros, ...p });
  const alternaLista = (lista: string[], v: string) =>
    lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v];

  const alterna = (b: number) =>
    onFiltros({
      ...filtros,
      bandas: filtros.bandas.includes(b)
        ? filtros.bandas.filter((x) => x !== b)
        : [...filtros.bandas, b],
    });

  return (
    <Tarjeta>
      <Encabezado
        titulo="Capas"
        abierta={abierta}
        onAlternar={() => setAbierta(!abierta)}
      />
      {abierta && (
        <div className="pb-2">
          <FilaCapa
            nombre="Intensidad del sismo"
            ayuda={EXPLICACION_MMI}
            fuente={FUENTE_MMI}
            activa={capas.intensidad}
            onAlternar={() => onCapas({ ...capas, intensidad: !capas.intensidad })}
            plegada={!intensidadAbierta}
            onPlegar={() => setIntensidadAbierta(!intensidadAbierta)}
          />
          {intensidadAbierta && (
            <div className="pb-1">
              <div className="flex gap-3 px-4 pb-1 pl-8 text-[10px]">
                <button
                  onClick={() =>
                    onFiltros({ ...filtros, bandas: BANDAS.map((b) => b.banda) })
                  }
                  className="underline"
                  style={{ color: "var(--tinta-3)" }}
                >
                  Seleccionar todas
                </button>
                <button
                  onClick={() => onFiltros({ ...filtros, bandas: [] })}
                  className="underline"
                  style={{ color: "var(--tinta-3)" }}
                >
                  Quitar todas
                </button>
              </div>
              {[...BANDAS].reverse().map((b) => {
                const on = filtros.bandas.includes(b.banda);
                return (
                  <button
                    key={b.banda}
                    onClick={() => alterna(b.banda)}
                    className="flex w-full items-center gap-2 px-4 py-1 pl-8 text-xs"
                  >
                    <span
                      className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border text-[9px] leading-none"
                      style={{
                        borderColor: on ? "var(--tinta)" : "var(--linea)",
                        background: on ? "var(--tinta)" : "transparent",
                        color: "var(--superficie)",
                      }}
                    >
                      {on ? "✓" : ""}
                    </span>
                    <span
                      className="inline-block h-3 w-5 shrink-0 rounded-sm"
                      style={{
                        background: COLOR_BANDA[b.banda],
                        opacity: on ? 1 : 0.35,
                      }}
                    />
                    <span className="num" style={{ color: "var(--tinta-2)" }}>
                      MMI {b.etiqueta}
                    </span>
                    <span
                      className="ml-auto truncate text-[10px]"
                      style={{ color: "var(--tinta-3)" }}
                    >
                      {b.nota}
                    </span>
                  </button>
                );
              })}
              <p
                className="px-4 pt-1 pl-8 text-[10px] leading-relaxed"
                style={{ color: "var(--tinta-3)" }}
              >
                El mapa pinta qué tan fuerte se sintió el sismo en cada zona y
                muestra las instituciones educativas que quedaron dentro.
                Encender una banda decide las dos cosas a la vez: la mancha del
                mapa y las sedes que se cuentan. La línea punteada marca hasta
                dónde llega la grilla del USGS, no hasta dónde llegó el temblor.
              </p>
            </div>
          )}

          <FilaCapa
            nombre="Sedes educativas"
            activa={capas.sedes}
            onAlternar={() => onCapas({ ...capas, sedes: !capas.sedes })}
            muestra={<Gota color="var(--sede-base)" />}
          />

          {/* Los filtros de la sede cuelgan de su propia capa. Antes vivian en
              una tarjeta aparte y quedaba sin decir que recortan exactamente
              esos puntos y ningun otro. */}
          <div className="px-4 pt-1 pb-2 pl-8">
            <Etiqueta>Secretaría</Etiqueta>
            <div className="mb-2">
              <Desplegable
                opciones={secretarias}
                elegidas={filtros.secretarias}
                onAlternar={(v) =>
                  set({ secretarias: alternaLista(filtros.secretarias, v) })
                }
                onLimpiar={() => set({ secretarias: [] })}
              />
            </div>

            <button
              onClick={() => setMasFiltros(!masFiltros)}
              className="text-xs underline"
              style={{ color: "var(--tinta-2)" }}
            >
              {masFiltros ? "Menos filtros" : "Más filtros"}
            </button>

            {masFiltros && (
              <div className="mt-2">
                <Etiqueta>Área</Etiqueta>
                <div className="mb-3">
                  <Chips>
                    {areas.map((a) => (
                      <Opcion
                        key={a}
                        activo={filtros.areas.includes(a)}
                        onClick={() => set({ areas: alternaLista(filtros.areas, a) })}
                      >
                        {NOMBRE_AREA[a] ?? a}
                      </Opcion>
                    ))}
                  </Chips>
                </div>

                <div className="mb-1 text-xs" style={{ color: "var(--tinta-3)" }}>
                  Matrícula mínima:{" "}
                  <span className="num">{miles(filtros.matriculaMin)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1000}
                  step={25}
                  value={filtros.matriculaMin}
                  onChange={(e) => set({ matriculaMin: Number(e.target.value) })}
                  className="w-full"
                />

                <div
                  className="mt-2 mb-1 text-xs"
                  style={{ color: "var(--tinta-3)" }}
                >
                  Quintil de riqueza del entorno
                  <Info texto="Quintiles nacionales del índice de riqueza relativa de Meta, calculados sobre las 52.823 sedes del país. El primer quintil reúne el 20 % de las sedes en los entornos más pobres. Las sedes sin el dato quedan por fuera si se elige un quintil." />
                </div>
                <Chips>
                  {[1, 2, 3, 4, 5].map((q) => (
                    <Opcion
                      key={q}
                      activo={filtros.quintiles.includes(q)}
                      onClick={() =>
                        set({
                          quintiles: filtros.quintiles.includes(q)
                            ? filtros.quintiles.filter((x) => x !== q)
                            : [...filtros.quintiles, q],
                        })
                      }
                    >
                      {NOMBRE_QUINTIL[q]}
                    </Opcion>
                  ))}
                </Chips>

                <label className="mt-2 flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={filtros.resaltarCoordDudosa}
                    onChange={(e) => set({ resaltarCoordDudosa: e.target.checked })}
                  />
                  <span style={{ color: "var(--tinta-2)" }}>
                    Resaltar las coordenadas sin verificar (
                    <span className="num">{miles(resumen.sinCoordVerificada)}</span>{" "}
                    en la selección)
                  </span>
                </label>
              </div>
            )}
          </div>

          <FilaCapa
            nombre="Huellas de edificio"
            nota="desde el zoom 15"
            activa={capas.huellas}
            onAlternar={() => onCapas({ ...capas, huellas: !capas.huellas })}
          />
        </div>
      )}
    </Tarjeta>
  );
}

// ------------------------------- 5. caracteristicas antes del sismo --

/** Lo que se sabia de estas sedes antes del 10 de agosto.
 *
 * Dos fuentes y dos fechas distintas, y conviene no mezclarlas: la encuesta del
 * FFIE es una declaracion del rector de hace cuatro anos, y el C-600 es un
 * registro administrativo del ano pasado. Ninguna de las dos dice nada sobre el
 * estado de la sede despues del sismo.
 *
 * El relato ("de la seleccion, N fueron visitadas y el X % declaro averia") se
 * calcula sobre la seleccion sin los botones de esta tarjeta. Si se calculara
 * sobre lo filtrado, al elegir "nunca visitadas" diria que cero de cero fueron
 * visitadas y que el 0 % declaro averia, que es una frase sin sentido.
 */
function TarjetaCaracteristicas({
  filtros,
  onFiltros,
  resumen,
  resumenAmplio,
  encuestadasPais,
}: Props) {
  const [abierta, setAbierta] = useState(false);
  const set = (p: Partial<Filtros>) => onFiltros({ ...filtros, ...p });
  const pct = (n: number, de: number) => (de ? Math.round((n / de) * 100) : 0);
  const base = resumenAmplio;
  const recortado =
    filtros.tab === "fisica"
      ? filtros.fisica !== "todas"
      : filtros.energia !== "todas" || filtros.internet !== "todas";

  return (
    // El acento de esta tarjeta es el turquesa de CIMA y no el azul del resto.
    // Se redefine la variable aqui en vez de tocar `Opcion` y las pestañas,
    // porque esos mismos componentes los usa la tarjeta de capas, que sigue en
    // azul. Una variable heredada cambia todo lo de dentro y nada de fuera.
    <Tarjeta estilo={{ "--acento": "var(--cima)" } as React.CSSProperties}>
      <Encabezado
        titulo="Características de las IE antes del sismo"
        abierta={abierta}
        onAlternar={() => setAbierta(!abierta)}
      />
      {abierta && (
        <>
          <div className="flex border-b" style={{ borderColor: "var(--linea)" }}>
            {(
              [
                ["fisica", "Infraestructura"],
                ["servicios", "Servicios"],
              ] as const
            ).map(([id, nombre]) => (
              <button
                key={id}
                onClick={() => set({ tab: id })}
                className="flex-1 px-2 pb-2 pt-1 text-xs font-medium"
                style={{
                  color: filtros.tab === id ? "var(--acento)" : "var(--tinta-3)",
                  borderBottom:
                    filtros.tab === id
                      ? "2px solid var(--acento)"
                      : "2px solid transparent",
                }}
              >
                {nombre}
              </button>
            ))}
          </div>

          <div className="px-4 py-3">
            {filtros.tab === "fisica" ? (
              <>
                <p
                  className="mb-2 text-xs leading-relaxed"
                  style={{ color: "var(--tinta-2)" }}
                >
                  Entre noviembre de 2021 y febrero de 2022, el Fondo de
                  Financiamiento de la Infraestructura Educativa (FFIE) visitó{" "}
                  <span className="num">{miles(encuestadasPais)}</span> sedes del
                  país y le preguntó al rector por el estado de los techos, los
                  muros y los pisos.
                  <Info texto="La encuesta también recogió el material de la construcción, su edad y la fecha del último mantenimiento. Es una declaración del rector, no una inspección técnica, y es anterior al sismo: describe el punto de partida, no el daño de hoy." />
                </p>

                {base.encuestadas > 0 ? (
                  <p
                    className="mb-3 text-xs leading-relaxed"
                    style={{ color: "var(--tinta-2)" }}
                  >
                    De las{" "}
                    <span className="num font-semibold">{miles(base.sedes)}</span>{" "}
                    sedes seleccionadas,{" "}
                    <span className="num font-semibold">
                      {miles(base.encuestadas)}
                    </span>{" "}
                    fueron visitadas. De esas declararon avería el{" "}
                    <span className="num">
                      {pct(base.techosDanados, base.encuestadas)} %
                    </span>{" "}
                    en techos, el{" "}
                    <span className="num">
                      {pct(base.murosDanados, base.encuestadas)} %
                    </span>{" "}
                    en muros y el{" "}
                    <span className="num">
                      {pct(base.pisosDanados, base.encuestadas)} %
                    </span>{" "}
                    en pisos.
                  </p>
                ) : (
                  <p className="mb-3 text-xs" style={{ color: "var(--tinta-2)" }}>
                    Ninguna de las sedes seleccionadas fue visitada por el FFIE,
                    así que no hay nada declarado sobre su estado.
                  </p>
                )}

                <Etiqueta>Ver en el mapa</Etiqueta>
                <Segmentado ancho>
                  <Opcion
                    activo={filtros.fisica === "todas"}
                    onClick={() => set({ fisica: "todas" })}
                  >
                    Todas
                  </Opcion>
                  <Opcion
                    activo={filtros.fisica === "encuestadas"}
                    onClick={() => set({ fisica: "encuestadas" })}
                  >
                    Visitadas
                  </Opcion>
                  <Opcion
                    activo={filtros.fisica === "no_encuestadas"}
                    onClick={() => set({ fisica: "no_encuestadas" })}
                  >
                    Nunca visitadas
                  </Opcion>
                </Segmentado>

                <Hallazgo
                  n={base.nuncaEncuestadas}
                  de={base.sedes}
                  matricula={base.matriculaIgnota}
                  texto="de las sedes seleccionadas nunca fueron visitadas. De estas no hay ninguna declaración previa sobre su estado."
                />
              </>
            ) : (
              <>
                <p
                  className="mb-2 text-xs leading-relaxed"
                  style={{ color: "var(--tinta-2)" }}
                >
                  El formulario C-600 del DANE recoge cada año información
                  administrativa de las sedes educativas del país. El registro de
                  2024 dice cuáles contaban con energía eléctrica y con conexión a
                  internet antes del sismo.
                  <Info texto="Las sedes que no reportaron al C-600 de 2024 no se cuentan en ninguno de los dos grupos. No reportar no es lo mismo que no tener el servicio, y contar la ausencia de reporte como carencia inflaría la cifra." />
                </p>

                <p
                  className="mb-3 text-xs leading-relaxed"
                  style={{ color: "var(--tinta-2)" }}
                >
                  De las{" "}
                  <span className="num font-semibold">{miles(base.sedes)}</span>{" "}
                  sedes seleccionadas,{" "}
                  <span className="num font-semibold">
                    {miles(base.sinEnergia)}
                  </span>{" "}
                  ya estaban sin electricidad, con{" "}
                  <span className="num">{miles(base.matriculaSinEnergia)}</span>{" "}
                  estudiantes, y{" "}
                  <span className="num font-semibold">
                    {miles(base.sinInternet)}
                  </span>{" "}
                  sin internet, con{" "}
                  <span className="num">{miles(base.matriculaSinInternet)}</span>{" "}
                  estudiantes.
                </p>

                <Etiqueta>Ver en el mapa</Etiqueta>
                <Fila etiqueta="Electricidad">
                  <Segmentado ancho>
                    <Opcion
                      activo={filtros.energia === "todas"}
                      onClick={() => set({ energia: "todas" })}
                    >
                      Todas
                    </Opcion>
                    <Opcion
                      activo={filtros.energia === "con"}
                      onClick={() => set({ energia: "con" })}
                    >
                      Con
                    </Opcion>
                    <Opcion
                      activo={filtros.energia === "sin"}
                      onClick={() => set({ energia: "sin" })}
                    >
                      Sin
                    </Opcion>
                  </Segmentado>
                </Fila>

                <Fila etiqueta="Internet">
                  <Segmentado ancho>
                    <Opcion
                      activo={filtros.internet === "todas"}
                      onClick={() => set({ internet: "todas" })}
                    >
                      Todas
                    </Opcion>
                    <Opcion
                      activo={filtros.internet === "con"}
                      onClick={() => set({ internet: "con" })}
                    >
                      Con
                    </Opcion>
                    <Opcion
                      activo={filtros.internet === "sin"}
                      onClick={() => set({ internet: "sin" })}
                    >
                      Sin
                    </Opcion>
                  </Segmentado>
                </Fila>
              </>
            )}

            {recortado && (
              <p
                className="mt-3 rounded px-2.5 py-1.5 text-xs"
                style={{ background: "var(--plano)", color: "var(--tinta-2)" }}
              >
                Con este recorte el mapa muestra{" "}
                <span className="num font-semibold">{miles(resumen.sedes)}</span>{" "}
                sedes y{" "}
                <span className="num font-semibold">{miles(resumen.matricula)}</span>{" "}
                estudiantes.
              </p>
            )}
          </div>
        </>
      )}
    </Tarjeta>
  );
}

// ------------------------------------------------------------- piezas --

function Tarjeta({
  children,
  estilo,
}: {
  children: React.ReactNode;
  /** Permite redefinir variables de color para una tarjeta sola. Se usa para
   *  cambiar el acento sin tocar el de las demas, que comparten componentes. */
  estilo?: React.CSSProperties;
}) {
  return (
    <section
      className="rounded-lg border shadow-md"
      style={{
        background: "var(--superficie)",
        borderColor: "var(--borde)",
        ...estilo,
      }}
    >
      {children}
    </section>
  );
}

function Encabezado({
  titulo,
  abierta,
  onAlternar,
}: {
  titulo: string;
  abierta: boolean;
  onAlternar: () => void;
}) {
  return (
    <button
      onClick={onAlternar}
      className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium"
    >
      <span>{titulo}</span>
      <span style={{ color: "var(--tinta-3)" }}>{abierta ? "▾" : "▸"}</span>
    </button>
  );
}

function FilaCapa({
  nombre,
  nota,
  ayuda,
  fuente,
  activa,
  onAlternar,
  muestra,
  plegada,
  onPlegar,
}: {
  nombre: string;
  nota?: string;
  ayuda?: string;
  fuente?: { texto: string; url: string };
  activa: boolean;
  onAlternar: () => void;
  muestra?: React.ReactNode;
  plegada?: boolean;
  onPlegar?: () => void;
}) {
  return (
    <>
      <div
        className="flex items-center gap-2 px-4 py-1.5 text-xs"
        style={{ opacity: activa ? 1 : 0.45 }}
      >
        {onPlegar ? (
          <button
            onClick={onPlegar}
            className="w-3 shrink-0"
            style={{ color: "var(--tinta-3)" }}
            aria-label={plegada ? "desplegar" : "plegar"}
          >
            {plegada ? "▸" : "▾"}
          </button>
        ) : (
          <span className="w-3 shrink-0">{muestra}</span>
        )}
        <span className="min-w-0 flex-1 truncate">
          {nombre}
          {nota && (
            <span style={{ color: "var(--tinta-3)" }}> ({nota})</span>
          )}
        </span>
        {ayuda && <Info texto={ayuda} fuente={fuente} />}
        <button
          onClick={onAlternar}
          aria-label={activa ? "ocultar en el mapa" : "mostrar en el mapa"}
          title={activa ? "ocultar en el mapa" : "mostrar en el mapa"}
          style={{ color: "var(--tinta-3)" }}
        >
          {activa ? "◉" : "○"}
        </button>
      </div>
    </>
  );
}

function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-1 text-[10px] font-medium uppercase tracking-wide"
      style={{ color: "var(--tinta-3)" }}
    >
      {children}
    </div>
  );
}

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 grid grid-cols-[76px_1fr] items-center gap-2">
      <div
        className="text-[10px] font-medium uppercase tracking-wide"
        style={{ color: "var(--tinta-3)" }}
      >
        {etiqueta}
      </div>
      <div>{children}</div>
    </div>
  );
}

/** Botones sueltos que bajan de línea. El grupo pegado no sirve para Área: sus
 * cuatro opciones no caben en el ancho de la tarjeta y se salían de la caja. */
function Chips({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1">{children}</div>;
}

function Segmentado({
  children,
  ancho,
}: {
  children: React.ReactNode;
  ancho?: boolean;
}) {
  return (
    <div
      className={`inline-flex overflow-hidden rounded border ${ancho ? "w-full" : ""}`}
      style={{ borderColor: "var(--linea)" }}
    >
      {children}
    </div>
  );
}

function Opcion({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 whitespace-nowrap rounded border px-2 py-1 text-[11px]"
      style={{
        borderColor: activo ? "var(--acento)" : "var(--linea)",
        background: activo ? "var(--plano)" : "transparent",
        color: activo ? "var(--acento)" : "var(--tinta-2)",
        fontWeight: activo ? 600 : 400,
      }}
    >
      {children}
    </button>
  );
}

function Desplegable({
  opciones,
  elegidas,
  onAlternar,
  onLimpiar,
}: {
  opciones: string[];
  elegidas: string[];
  onAlternar: (v: string) => void;
  onLimpiar: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busca, setBusca] = useState("");
  const visibles = opciones.filter((o) =>
    o.toLowerCase().includes(busca.toLowerCase()),
  );

  return (
    <div className="relative">
      <button
        onClick={() => setAbierto(!abierto)}
        className="flex w-full items-center justify-between rounded border px-2 py-1 text-[11px]"
        style={{ borderColor: "var(--linea)", background: "var(--superficie)" }}
      >
        <span style={{ color: elegidas.length ? "var(--acento)" : "var(--tinta-2)" }}>
          {elegidas.length === 0
            ? "Todas"
            : elegidas.length === 1
              ? elegidas[0]
              : `${elegidas.length} secretarías`}
        </span>
        <span style={{ color: "var(--tinta-3)" }}>{abierto ? "▲" : "▼"}</span>
      </button>

      {abierto && (
        <div
          className="absolute z-20 mt-1 w-full rounded border shadow-lg"
          style={{ background: "var(--superficie)", borderColor: "var(--borde)" }}
        >
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar"
            className="w-full border-b px-2 py-1.5 text-xs"
            style={{ borderColor: "var(--linea)", background: "transparent" }}
          />
          <div className="max-h-48 overflow-y-auto p-1">
            {visibles.map((o) => (
              <label
                key={o}
                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs"
              >
                <input
                  type="checkbox"
                  checked={elegidas.includes(o)}
                  onChange={() => onAlternar(o)}
                />
                <span>{o}</span>
              </label>
            ))}
            {!visibles.length && (
              <p className="px-1.5 py-2 text-xs" style={{ color: "var(--tinta-3)" }}>
                Nada coincide
              </p>
            )}
          </div>
          <div
            className="flex justify-between border-t px-2 py-1.5 text-xs"
            style={{ borderColor: "var(--linea)" }}
          >
            <button
              onClick={onLimpiar}
              className="underline"
              style={{ color: "var(--tinta-2)" }}
            >
              Limpiar
            </button>
            <button
              onClick={() => setAbierto(false)}
              className="underline"
              style={{ color: "var(--tinta-2)" }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Hallazgo({
  n,
  de,
  matricula,
  texto,
}: {
  n: number;
  de: number;
  matricula: number;
  texto: string;
}) {
  const pct = de ? Math.round((n / de) * 100) : 0;
  return (
    <div
      className="mt-3 rounded border px-3 py-2"
      style={{ borderColor: "var(--sede-ignota)" }}
    >
      <div className="flex items-baseline gap-2">
        <span className="num text-xl font-semibold" style={{ color: "var(--sede-ignota)" }}>
          {miles(n)}
        </span>
        <span className="num text-xs" style={{ color: "var(--tinta-2)" }}>
          {pct} % de la selección
        </span>
      </div>
      <div className="text-xs" style={{ color: "var(--tinta-2)" }}>
        {texto} Son <span className="num">{miles(matricula)}</span> estudiantes.
      </div>
    </div>
  );
}

function Mini({ n, matricula, texto }: { n: number; matricula: number; texto: string }) {
  return (
    <div>
      <div
        className="num text-lg font-semibold leading-none"
        style={{ color: n ? "var(--sede-ignota)" : "var(--tinta-3)" }}
      >
        {miles(n)}
      </div>
      <div className="text-xs" style={{ color: "var(--tinta-2)" }}>
        {texto}
      </div>
      <div className="num text-[10px]" style={{ color: "var(--tinta-3)" }}>
        {miles(matricula)} estudiantes
      </div>
    </div>
  );
}

/** Un botón de información, que despliega su texto al pasar por encima.
 *
 * La explicación vive detrás del botón y no en la tarjeta porque es una nota al
 * pie: quien ya sabe por qué el epicentro no es el punto más sacudido no
 * necesita leerla cada vez que abre el visor.
 *
 * La nota se posiciona con coordenadas medidas del botón y no con `absolute`
 * dentro de la tarjeta. La columna de tarjetas tiene desplazamiento vertical, y
 * eso recorta cualquier cosa que se salga de sus 360 px: la nota aparecía
 * cortada por la mitad.
 */
function Info({
  texto,
  fuente,
  tono,
}: {
  texto: string;
  fuente?: { texto: string; url: string };
  /** Color del boton. Por defecto es el gris de nota al pie. Solo lo cambia el
   *  boton del titulo, que no explica un dato sino la plataforma entera. */
  tono?: string;
}) {
  // Dos estados y no uno: el clic deja la nota fija y el puntero solo la asoma.
  // Con una sola bandera, mover el mouse encima para hacer clic la abría y el
  // clic la volvía a cerrar en el mismo gesto.
  const [encima, setEncima] = useState(false);
  const [fijado, setFijado] = useState(false);
  const [caja, setCaja] = useState<{ top: number; left: number } | null>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const abierto = encima || fijado;

  function ubica() {
    const r = boton.current?.getBoundingClientRect();
    if (r) setCaja({ top: r.bottom + 6, left: Math.max(8, r.left - 120) });
  }

  return (
    <span className="ml-1 inline-block align-middle">
      <button
        ref={boton}
        onMouseEnter={() => {
          ubica();
          setEncima(true);
        }}
        onMouseLeave={() => setEncima(false)}
        onClick={() => {
          ubica();
          setFijado(!fijado);
        }}
        aria-label="Qué significa esto"
        className="rounded-full border px-1.5 text-[9px] leading-4"
        style={{
          borderColor: tono ?? "var(--linea)",
          color: tono ?? "var(--tinta-3)",
        }}
      >
        i
      </button>
      {abierto && caja && (
        <span
          className="fixed z-50 block w-72 rounded border px-3 py-2 text-[11px] leading-relaxed shadow-lg"
          style={{
            top: caja.top,
            left: caja.left,
            background: "var(--superficie)",
            borderColor: "var(--borde)",
            color: "var(--tinta-2)",
            fontWeight: 400,
          }}
        >
          {texto}
          {fuente && (
            <>
              {" "}
              <a
                href={fuente.url}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {fuente.texto}
              </a>
              .
            </>
          )}
        </span>
      )}
    </span>
  );
}

/** La silueta del pin de sede, en chiquito, para la fila de la capa. */
function Gota({ color }: { color: string }) {
  return (
    <svg width="9" height="12" viewBox="0 0 26 34" aria-hidden="true">
      <path
        d="M13 1.2 C7.6 1.2 3.4 5.4 3.4 10.6 C3.4 17.2 13 26 13 26 C13 26 22.6 17.2 22.6 10.6 C22.6 5.4 18.4 1.2 13 1.2 Z"
        fill={color}
      />
    </svg>
  );
}
