"use client";

/** Qué clase de escuelas son las que están reportadas con daño.
 *
 * Tarjeta propia, hermana de la de daños y no dentro de ella. Comparten universo
 * pero no pregunta: aquella dice quién reporta qué, ésta dice qué clase de
 * escuelas son las reportadas. Metida dentro, la de daños pasaba de mil píxeles
 * de alto y había que desplazarse por sus tres bloques de fuente para llegar.
 *
 * El universo lo fija quien la dibuja, con `danosMarcados`: un reporte por sede,
 * el que gana por precedencia, y solo si su estado y su subtipo están marcados.
 * Es exactamente la lista con la que la tarjeta de daños calcula el número de su
 * encabezado, así que las dos cifras son la misma por construcción. Con la
 * Secretaría del Valle elegida, la selección de la pantalla son 1.200 sedes y
 * éstas son 557: son números distintos y mezclarlos ya fue un error de este
 * visor antes.
 *
 * Tres preguntas, de tres fuentes y de tres fechas:
 *
 *   qué son          zona y quintil de riqueza, del directorio
 *   qué tenían       energía e internet del C-600 de 2024, y el acueducto y el
 *                    alcantarillado del vecindario, del Censo 2018
 *   cómo están hoy   lo que declara la secretaría que responde por la sede, que
 *                    hasta hoy es solo la del Valle
 *
 * Tocar un tramo hace tres cosas. Resalta esas sedes en el mapa sin quitar
 * ninguna, recorta el bloque de "cómo están hoy" a ese subconjunto, y aparece
 * arriba a la derecha como una línea propia con su botón de descarga.
 *
 * Lo segundo es lo que vuelve la tarjeta una herramienta y no una ficha: la
 * pregunta útil no es cuántas no están dando clase, es cuántas de las rurales, o
 * cuántas de las que estaban sin internet. Y lo tercero es para lo que sirve
 * haberlo preguntado, que es bajarse ese CSV.
 *
 * El número grande de arriba no cambia, y esa parte sí sigue en pie: cuenta lo
 * que hay en el mapa, y en el mapa las demás sedes siguen dibujadas. Las dos
 * cifras conviven escritas, una debajo de la otra, en vez de que una tape a la
 * otra.
 *
 * Un tramo del propio bloque de hoy no se recorta a sí mismo, y por eso el
 * recorte solo lo aplican los identificadores que no empiezan por `op/`. Sería
 * circular: al tocar "no están dando clase" el denominador pasaría a ser esas
 * mismas sedes y la fila diría siempre el 100 %.
 *
 * Lo que NO tiene, y por qué. No hay enlace de "solo estas" que aplique el filtro
 * equivalente de la pantalla. Se intentó y habría mentido: los filtros de zona,
 * quintil, energía e internet recortan la capa de sedes, y estas sedes se dibujan
 * como puntos de daño, que solo respetan la secretaría, la banda y las casillas
 * de estado (ver `danosVisibles` en `lib/datos.ts`). El enlace habría cambiado
 * los grises del fondo dejando los puntos de color intactos.
 */

import { useEffect, useState } from "react";

import { Info, Tarjeta } from "@/components/Piezas";
import { miles } from "@/lib/datos";
import type { Dano, Resalte, Sede } from "@/lib/tipos";

/** La rampa de carencia, del extremo con más holgura al de más carencia.
 *
 * Un solo tono en pasos de luminosidad, y no una serie de colores distintos. La
 * elección es de forma, no de gusto: en todas estas filas el orden de las
 * categorías significa algo (rural antes que urbana, sin servicio antes que con
 * servicio, poco acueducto antes que mucho), y una rampa deja ver ese orden en el
 * color. Ocho colores distintos gastarían el canal de identidad en re-codificar
 * lo que el largo de la barra ya dice.
 *
 * Los cinco pasos y su inversión en modo oscuro están en `app/globals.css`, con
 * el resultado del validador.
 */
/** El paso 0 es el sin dato, que queda fuera de la rampa a propósito: no es un
 *  grado de carencia, no ocupa un lugar en la escala y no puede llevar un tono
 *  que sugiera que sí.
 *
 * Se guarda el número del paso y no el color, porque cada paso tiene dos: el
 * relleno y el color del rótulo que va escrito encima. Los dos se invierten con
 * el tema y decidirlo aquí obligaría al componente a saber cuál está activo. */
const fondo = (paso: number) =>
  paso === 0 ? "var(--ent-nulo)" : `var(--ent-${paso})`;
const rotulo = (paso: number) =>
  paso === 0 ? "var(--ent-txt-nulo)" : `var(--ent-txt-${paso})`;

type Segmento = {
  clave: string;
  /** Va escrito dentro de la barra, así que es corto a la fuerza. El nombre
   *  entero vive en `largo` y sale en el globo al pasar por encima. */
  nombre: string;
  largo: string;
  /** 1 es el extremo con más holgura, 5 el de más carencia, 0 el sin dato. */
  paso: number;
  danes: string[];
};

type Grupo = {
  id: string;
  titulo: string;
  nota: string;
  segmentos: Segmento[];
};

/** Reparte una lista en tramos, en el orden dado, y manda al final lo que no se
 *  pudo clasificar.
 *
 * El sin dato siempre se cuenta y siempre se dibuja. Es la mitad del contenido de
 * algunas de estas filas y esconderlo convertiría un "no sabemos" en un "no
 * tiene": la cobertura de acueducto solo existe para seis departamentos.
 */
function agrupa<T>(
  items: T[],
  dane: (x: T) => string,
  clase: (x: T) => string | null,
  orden: { clave: string; nombre: string; largo: string; paso: number }[],
  largoNulo = "sin dato",
): Segmento[] {
  const cajas = new Map<string, string[]>();
  for (const x of items) {
    const k = clase(x) ?? "";
    if (!cajas.has(k)) cajas.set(k, []);
    cajas.get(k)!.push(dane(x));
  }
  const segs = orden
    .map((o) => ({ ...o, danes: cajas.get(o.clave) ?? [] }))
    .filter((s) => s.danes.length > 0);
  const nulos = cajas.get("") ?? [];
  if (nulos.length) {
    segs.push({
      clave: "_nulo", nombre: "s/d", largo: largoNulo, paso: 0, danes: nulos,
    });
  }
  return segs;
}

/** El acueducto y el alcantarillado del vecindario, partidos por la mitad.
 *
 * Estuvieron en cuatro tramos de cobertura, "menos del 50 %", "50 a 80 %" y así,
 * y no se entendían. El motivo es de forma y no de rótulo: la cifra que hay
 * debajo ya es de segundo orden, un porcentaje de las viviendas del vecindario,
 * y repartirla además en cuatro cajas obliga a sostener dos escalas a la vez
 * para leer una barra de dos centímetros. Nadie hace eso mirando un mapa.
 *
 * Partida en dos, la fila pasa a tener la misma forma que las de electricidad e
 * internet, que están justo encima y ya se leen sin explicación: falta, hay, no
 * se sabe. Y la pregunta que contesta es la que sirve para repartir trabajo, que
 * es si el vecindario de esa escuela está mayoritariamente conectado o no.
 *
 * El corte en la mitad lo pusimos nosotros y no sale de ninguna norma. Va escrito
 * en el nombre del tramo, no escondido detrás de una palabra como "baja".
 */
const MAYORIA = [
  { clave: "no", nombre: "la mayoría sin", largo: "vecindario mayoritariamente sin conexión", paso: 5 },
  { clave: "si", nombre: "la mayoría con", largo: "vecindario mayoritariamente conectado", paso: 1 },
];

function mayoria(v: number | undefined): string | null {
  if (v == null) return null;
  return v < 0.5 ? "no" : "si";
}

/** Una casilla del formulario de la secretaría, con su denominador propio.
 *
 * No son una partición del universo como las barras de arriba: cada una se
 * calcula sobre las sedes que contestaron esa casilla, y el denominador cambia de
 * una a otra. Por eso cada fila lleva escrito su "de N" y no una nota al pie
 * común.
 */
const CASILLAS: {
  clave: string; texto: string; campo: keyof Dano; valor: boolean;
}[] = [
  { clave: "sin_clase", texto: "no dan clase presencial",
    campo: "presta_servicio", valor: false },
  { clave: "suspendidas", texto: "con clases suspendidas",
    campo: "clases_suspendidas", valor: true },
  { clave: "prioridad", texto: "piden atención prioritaria",
    campo: "requiere_prioridad", valor: true },
  { clave: "evacuacion", texto: "requieren evacuación",
    campo: "requiere_evacuacion", valor: true },
  { clave: "reubicacion", texto: "requieren reubicación",
    campo: "requiere_reubicacion", valor: true },
  { clave: "visita", texto: "esperan visita técnica",
    campo: "requiere_visita", valor: true },
  { clave: "concepto", texto: "con concepto técnico",
    campo: "concepto_tecnico", valor: true },
  { clave: "albergue", texto: "sirven de albergue",
    campo: "albergue", valor: true },
];

/** El umbral de afectación grave. Lo pusimos nosotros, así que va escrito en
 *  pantalla en vez de esconderse detrás de la palabra "grave". */
const UMBRAL = 60;

const NOTA_ENTORNO =
  "No es el agua del colegio, es la de su vecindario. Se toma el área censal "
  + "donde cae la sede, que es su manzana o su vereda y tiene 66 viviendas de "
  + "mediana, y se mira cuántas de esas viviendas estaban conectadas en el Censo "
  + "de 2018. \"La mayoría sin\" quiere decir que menos de la mitad lo estaban. "
  + "Ese corte en la mitad lo pusimos nosotros y no sale de ninguna norma. Dice "
  + "en qué clase de territorio está la sede. El C-600 no pregunta por agua en ninguno de sus "
  + "años, así que ésta es la única medida que alcanza también a las sedes que "
  + "nadie visitó. Solo existe donde tenemos el microdato del censo: Valle, "
  + "Caldas, Risaralda, Quindío, Norte de Santander y Atlántico. Ojo al leerla: "
  + "también correlaciona con no tener energía ni internet, porque las tres cosas "
  + "escasean juntas, así que en parte mide carencia general del territorio.";

const NOTA_HOY =
  "Lo declara la secretaría que responde por la sede, y hasta hoy solo lo reporta "
  + "la del Valle del Cauca. El corte es del 22 de agosto, con unas pocas sedes que "
  + "vienen del corte del 16 porque el nuevo dejó de mencionarlas: que una fuente "
  + "deje de listar una sede no es que la sede esté bien. Cada línea lleva su "
  + "propio denominador porque son casillas distintas del formulario y no todas "
  + "las sedes contestaron las mismas. Una casilla en blanco no cuenta como "
  + "\"no\": sería convertir una pregunta sin responder en una respuesta. "
  + "Los totales quedan por debajo de los del tablero de la Secretaría, y la "
  + "razón es una sola: aquí solo entran las sedes que se pudieron identificar "
  + "con su código DANE. El diagnóstico no lo trae, así que 34 filas se quedan "
  + "fuera de estas cuentas y se le devuelven a la Secretaría para que las "
  + "complete.";

export default function CaracteristicasAfectadas({
  danos,
  porDane,
  resalte,
  onResalte,
  abierta,
  onAbierta,
  secretarias,
}: {
  /** Un reporte por sede, el que pinta, y solo los que el mapa está dibujando.
   *  Lo arma `danosMarcados`, la misma función que usa la tarjeta de daños. */
  danos: Dano[];
  /** El directorio entero, para poder mirar la ficha de cada sede reportada. */
  porDane: Map<string, Sede>;
  resalte: Resalte | null;
  onResalte: (r: Resalte | null) => void;
  /** Desplegada o no. No es estado propio: al desplegarse crece la columna
   *  derecha entera, y eso lo decide `page.tsx`. */
  abierta: boolean;
  onAbierta: (v: boolean) => void;
  /** Las secretarías elegidas en la pantalla. Decide si aparece el bloque de
   *  "cómo están hoy": ver `hayEntidad`. */
  secretarias: string[];
}) {
  const [hoyAbierto, setHoyAbierto] = useState(true);
  // Las que además están en el archivo de sedes del visor. Hay reporte de sedes
  // que ese archivo no tiene: caen fuera de la grilla del ShakeMap o no están en
  // el SIMAT de 2022. De esas no se puede decir ni la zona ni el quintil.
  const conSede = danos
    .map((d) => porDane.get(d.dane))
    .filter((s): s is Sede => s != null);
  const n = conSede.length;

  const grupos: Grupo[] = n === 0 ? [] : [
    {
      id: "zona",
      titulo: "Zona",
      nota: "La binaria del SIMAT de 2022, urbana o rural. No distingue centro "
        + "poblado de vereda dispersa, que para llegar a una escuela es toda la "
        + "diferencia.",
      segmentos: agrupa(conSede, (s) => s.dane, (s) => s.zona ?? null, [
        { clave: "RURAL", nombre: "rural", largo: "rural", paso: 4 },
        { clave: "URBANA", nombre: "urbana", largo: "urbana", paso: 1 },
      ]),
    },
    {
      id: "energia",
      titulo: "Electricidad antes del sismo",
      nota: "Del C-600 de 2024. Las sedes que no reportaron ese año no se "
        + "cuentan en ninguno de los dos grupos: no reportar no es lo mismo que "
        + "no tener el servicio.",
      segmentos: agrupa(
        conSede, (s) => s.dane,
        (s) => (s.energia_2024 == null ? null : s.energia_2024 ? "con" : "sin"),
        [
          { clave: "sin", nombre: "sin", largo: "sin electricidad", paso: 5 },
          { clave: "con", nombre: "con", largo: "con electricidad", paso: 1 },
        ],
        "no reportaron al C-600",
      ),
    },
    {
      id: "internet",
      titulo: "Internet antes del sismo",
      nota: "Del C-600 de 2024, con la misma regla: no haber reportado no es "
        + "carecer del servicio.",
      segmentos: agrupa(
        conSede, (s) => s.dane,
        (s) => (s.internet_2024 == null ? null : s.internet_2024 ? "con" : "sin"),
        [
          { clave: "sin", nombre: "sin", largo: "sin internet", paso: 5 },
          { clave: "con", nombre: "con", largo: "con internet", paso: 1 },
        ],
        "no reportaron al C-600",
      ),
    },
    {
      id: "acueducto",
      titulo: "Acueducto en el vecindario de la sede",
      nota: NOTA_ENTORNO,
      segmentos: agrupa(
        conSede, (s) => s.dane, (s) => mayoria(s.acueducto_entorno), MAYORIA,
        "sin microdato del censo",
      ),
    },
    {
      id: "alcantarillado",
      titulo: "Alcantarillado en el vecindario de la sede",
      nota: NOTA_ENTORNO,
      segmentos: agrupa(
        conSede, (s) => s.dane, (s) => mayoria(s.alcantarillado_entorno), MAYORIA,
        "sin microdato del censo",
      ),
    },
    // El quintil va de ultimo. Es el unico de los seis que no describe algo que
    // la escuela tiene o le falta, sino la posicion relativa de su entorno frente
    // al resto del pais, asi que se lee despues de saber que es la sede y con que
    // cuenta, no antes.
    {
      id: "quintil",
      titulo: "Quintil de riqueza relativa del entorno",
      nota: "Quintiles nacionales del índice de riqueza relativa de Meta, "
        + "calculados sobre las 52.823 sedes del país: Q1 reúne el 20 % de las "
        + "sedes en los entornos más pobres. Se calcula desde una grilla de "
        + "2,4 km y no todas las sedes tienen celda cerca.",
      segmentos: agrupa(
        conSede, (s) => s.dane,
        (s) => (s.rwi_q == null ? null : `q${s.rwi_q}`),
        [1, 2, 3, 4, 5].map((q) => ({
          clave: `q${q}`,
          nombre: `Q${q}`,
          largo: q === 1 ? "Q1, el más pobre"
            : q === 5 ? "Q5, el más rico" : `Q${q}`,
          paso: 6 - q,
        })),
        "sin el índice calculado",
      ),
    },
  ];

  /** El recorte que aplica el bloque de hoy.
   *
   * Solo cuando el tramo encendido es de las barras de arriba. Uno del propio
   * bloque se recortaría a sí mismo y todas sus filas dirían el 100 %.
   */
  const recorta = resalte != null && !resalte.id.startsWith("op/");
  const hoy = recorta
    ? danos.filter((d) => resalte!.danes.has(d.dane))
    : danos;

  /** Si el bloque de "cómo están hoy" tiene sujeto.
   *
   * Solo aparece con una secretaría elegida. Sin ella la pantalla está mirando el
   * sismo entero y el bloque describiría, sin decirlo, a las sedes de la única
   * entidad que hoy contesta ese formulario: se leería como una cifra nacional
   * cuando es del Valle. La pregunta "¿está dando clase?" no la contesta un
   * territorio, la contesta la entidad que responde por esas escuelas, así que
   * hasta que no hay entidad elegida no hay a quién preguntarle.
   *
   * No se comprueba que la entidad sea el Valle. Que hoy sea la única que lo
   * declara es un hecho del dato, no una regla: el día que otra secretaría mande
   * su consolidado, su bloque tiene que aparecer sin tocar este archivo. Si la
   * entidad elegida no declara nada, `operativas` queda vacío y el bloque no se
   * dibuja, que es la misma puerta por otro lado.
   */
  const hayEntidad = secretarias.length > 0;

  // `!= null` y nunca por descarte: hay sedes que dejaron la casilla en blanco.
  const operativas = CASILLAS.map((c) => {
    const contestan = hoy.filter((d) => d[c.campo] != null);
    return {
      ...c,
      total: contestan.length,
      danes: contestan.filter((d) => d[c.campo] === c.valor).map((d) => d.dane),
    };
  }).filter((c) => c.total > 0);

  // Las muy afectadas y, dentro de ellas, las que además piden que las muevan.
  // Son dos casillas independientes del formulario, así que cruzarlas dice algo
  // que ninguna de las dos dice sola.
  const muyAfectadas = hoy.filter(
    (d) => d.pct_afectacion != null && d.pct_afectacion >= UMBRAL);
  const decidenReubicacion = muyAfectadas.filter(
    (d) => d.requiere_reubicacion != null);
  const pidenReubicacion = muyAfectadas.filter(
    (d) => d.requiere_reubicacion === true);

  /** Al quedarse sin entidad elegida, se apaga el resalte que salió del bloque
   *  de hoy.
   *
   * Sin esto, quitar la secretaría dejaba el mapa con los puntos en ámbar y sin
   * la sección que dice qué significan: un resalte encendido cuyo control ya no
   * está en pantalla. Solo se apagan los del bloque de hoy, que son los que se
   * quedan sin sitio; los de las barras siguen valiendo, porque esas barras
   * siguen ahí.
   */
  useEffect(() => {
    if (!hayEntidad && resalte?.id.startsWith("op/")) onResalte(null);
  }, [hayEntidad, resalte, onResalte]);

  const enciende = (id: string, etiqueta: string, danes: string[]) => {
    if (resalte?.id === id) return onResalte(null);
    onResalte({ id, etiqueta, danes: new Set(danes) });
  };

  if (danos.length === 0) return null;

  return (
    <Tarjeta>
      <button
        onClick={() => onAbierta(!abierta)}
        className="flex w-full items-baseline gap-1.5 px-4 py-2.5 text-left text-sm font-medium"
      >
        <span>Características de las SE afectadas</span>
        <span className="num text-xs" style={{ color: "var(--tinta-3)" }}>
          ({miles(danos.length)})
        </span>
        <span className="ml-auto text-xs" style={{ color: "var(--tinta-3)" }}>
          {abierta ? "▾" : "▸"}
        </span>
      </button>

      {abierta && (
        <div className="px-4 pb-3">
          {/* La aclaración del universo va detrás de la "i". Es la nota al pie
              más importante de la tarjeta y a la vez la que solo hace falta leer
              una vez: quien ya sabe que estas no son las sedes de la selección no
              necesita el párrafo cada vez que abre. */}
          <div
            className="mb-2 flex items-baseline gap-1 text-[10px]"
            style={{ color: "var(--tinta-3)" }}
          >
            <span>
              las <span className="num">{miles(danos.length)}</span> sedes con
              daño dibujadas
            </span>
            <Info
              texto={
                "Describe las sedes que la capa de daños está dibujando, no la "
                + "selección de la pantalla: con una secretaría elegida son dos "
                + "números distintos. Tocar un tramo lo resalta en el mapa y "
                + "recorta el bloque de \"cómo están hoy\" a esas sedes, y "
                + "aparece arriba a la derecha con su propio botón de descarga. "
                + "No quita ninguna sede del mapa: el número grande de arriba "
                + "sigue contando todas."
                + (n < danos.length
                  ? `\n\nLas barras se calculan sobre ${miles(n)}: de las `
                    + `${miles(danos.length - n)} restantes hay reporte pero no `
                    + "ficha en el directorio, así que de ellas no se puede decir "
                    + "ni la zona ni el quintil."
                  : "")
              }
              ancho
            />
          </div>

          {resalte && (
            <button
              onClick={() => onResalte(null)}
              className="mb-2 flex w-full items-center gap-1.5 rounded border px-2 py-1 text-left text-[10px]"
              style={{ borderColor: "var(--resalte)", color: "var(--tinta-2)" }}
            >
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: "var(--resalte)" }}
              />
              <span className="flex-1 truncate">
                <span className="num">{miles(resalte.danes.size)}</span>{" "}
                {resalte.etiqueta}
              </span>
              <span style={{ color: "var(--tinta-3)" }}>quitar</span>
            </button>
          )}

          {grupos.map((g) => (
            <Barra
              key={g.id}
              grupo={g}
              resalte={resalte}
              onEncender={enciende}
            />
          ))}

          {hayEntidad && operativas.length > 0 && (
            <>
              {/* La misma forma que las filas de capa del panel izquierdo:
                  caret a la izquierda, rotulo en `text-xs` y el ancho entero de
                  la tarjeta. Es una seccion y no un rotulo de grupo, asi que
                  tiene que leerse al mismo nivel que las demas secciones del
                  visor y poder plegarse como ellas. */}
              <div
                className="-mx-4 mt-2 flex items-center gap-2 border-t px-4 py-1.5 text-xs"
                style={{ borderColor: "var(--linea)" }}
              >
                <button
                  onClick={() => setHoyAbierto(!hoyAbierto)}
                  className="w-3 shrink-0"
                  style={{ color: "var(--tinta-3)" }}
                  aria-label={hoyAbierto ? "plegar" : "desplegar"}
                >
                  {hoyAbierto ? "▾" : "▸"}
                </button>
                <span className="min-w-0 flex-1 truncate">Cómo están hoy</span>
                {recorta && (
                  <span
                    className="shrink-0 truncate text-[10px]"
                    style={{ color: "var(--resalte)" }}
                  >
                    solo {resalte!.etiqueta}
                  </span>
                )}
                <Info texto={NOTA_HOY} ancho />
              </div>
              {hoyAbierto && operativas.map((c) => (
                <Casilla
                  key={c.clave}
                  activo={resalte?.id === `op/${c.clave}`}
                  n={c.danes.length}
                  total={c.total}
                  texto={c.texto}
                  onClick={() => enciende(`op/${c.clave}`, c.texto, c.danes)}
                />
              ))}

              {hoyAbierto && decidenReubicacion.length > 0 && (
                <Casilla
                  activo={resalte?.id === "op/reub60"}
                  n={pidenReubicacion.length}
                  total={decidenReubicacion.length}
                  texto={`de las de ${UMBRAL} % o más de afectación, piden reubicación`}
                  nota={
                    `${miles(muyAfectadas.length)} sedes declaran una afectación `
                    + `de ${UMBRAL} % o más. El umbral lo pusimos nosotros y no `
                    + "sale de ninguna norma. El porcentaje lo estimó quien llenó "
                    + "el formulario y no un ingeniero, así que no es una medida: "
                    + "es la severidad que declara la sede. Cruzarlo con la "
                    + "casilla de reubicación es lo que lo vuelve útil, porque son "
                    + "dos respuestas independientes que apuntan a lo mismo."
                  }
                  onClick={() => enciende(
                    "op/reub60",
                    `con ${UMBRAL} % o más de afectación que piden reubicación`,
                    pidenReubicacion.map((d) => d.dane),
                  )}
                />
              )}
            </>
          )}
        </div>
      )}
    </Tarjeta>
  );
}

/** Un grupo: su título con la nota detrás de la "i", y la barra apilada debajo.
 *
 * Los rótulos van dentro de la barra y no en una lista aparte. Con seis grupos,
 * la lista de tramos ocupaba cuatro veces más alto que las barras y obligaba a
 * desplazarse para comparar dos filas que están a dos centímetros. Por eso los
 * nombres de los tramos son cortos a la fuerza: tienen que caber dentro de su
 * propio segmento.
 *
 * El rótulo aparece cuando el segmento da para él y desaparece cuando no. La
 * alternativa era encogerlo hasta ser ilegible o dejarlo desbordado sobre el
 * segmento vecino, que es peor: diría un número donde va otro. El nombre entero y
 * la cifra siguen estando en el globo del `title` y en el `aria-label`.
 */
function Barra({
  grupo,
  resalte,
  onEncender,
}: {
  grupo: Grupo;
  resalte: Resalte | null;
  onEncender: (id: string, etiqueta: string, danes: string[]) => void;
}) {
  const total = grupo.segmentos.reduce((a, s) => a + s.danes.length, 0);
  if (total === 0) return null;
  return (
    <div className="mb-2">
      <div
        className="flex items-baseline gap-1 text-[10px]"
        style={{ color: "var(--tinta-2)" }}
      >
        <span>{grupo.titulo}</span>
        <Info texto={grupo.nota} />
      </div>
      {/* El hueco de 2 px entre tramos es del color de la tarjeta: sin él, dos
          pasos contiguos de la misma rampa se leen como uno solo y la barra
          pierde la partición que está mostrando. */}
      <div className="mt-0.5 flex h-[18px] w-full gap-[2px]">
        {grupo.segmentos.map((s, i) => {
          const id = `${grupo.id}/${s.clave}`;
          const on = resalte?.id === id;
          // Dentro del segmento va el rótulo y nada más. La cifra estuvo ahí
          // y sobraba: el largo del tramo ya dice cuánto, y el número al lado
          // pedía el doble de ancho, con lo que los tramos chicos se quedaban
          // mudos justo para repetir en dígitos lo que la barra ya mostraba. La
          // cifra exacta sale en el globo, que es donde se pregunta.
          //
          // A 9 px cada carácter pide unos 5,4 px. Por debajo de eso el segmento
          // va en blanco: encogerlo lo dejaría ilegible y dejarlo desbordar
          // escribiría un rótulo encima del tramo vecino, que es peor.
          const ancho = (s.danes.length / total) * 320;
          const cabe = ancho >= (s.nombre.length + 1) * 5.4;
          return (
            <button
              key={s.clave}
              onClick={() => onEncender(id, `${grupo.titulo.toLowerCase()}: ${s.largo}`, s.danes)}
              title={`${s.largo}: ${miles(s.danes.length)} de ${miles(total)}`}
              aria-label={`resaltar ${s.largo}, ${miles(s.danes.length)} sedes`}
              className="flex h-full min-w-[3px] items-center justify-center overflow-hidden px-0.5 text-[9px] leading-none"
              style={{
                flexGrow: s.danes.length,
                flexBasis: 0,
                background: on ? "var(--resalte)" : fondo(s.paso),
                color: on ? "var(--resalte-txt)" : rotulo(s.paso),
                borderTopLeftRadius: i === 0 ? 4 : 0,
                borderBottomLeftRadius: i === 0 ? 4 : 0,
                borderTopRightRadius: i === grupo.segmentos.length - 1 ? 4 : 0,
                borderBottomRightRadius:
                  i === grupo.segmentos.length - 1 ? 4 : 0,
              }}
            >
              {cabe && <span className="truncate">{s.nombre}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Una casilla del formulario, en una línea.
 *
 * El medidor va de fondo de la propia fila y no debajo, que es lo que la deja en
 * una línea en vez de tres. La fracción va escrita entera: sin el denominador,
 * "457 no dan clase" se lee como una cifra del mapa entero cuando es de las sedes
 * con daño que además contestaron esa casilla.
 */
function Casilla({
  n,
  total,
  texto,
  nota,
  activo,
  onClick,
}: {
  n: number;
  total: number;
  texto: string;
  nota?: string;
  activo: boolean;
  onClick: () => void;
}) {
  const pct = total ? Math.round((n / total) * 100) : 0;
  // Grafito y no un paso de la rampa turquesa. Estas filas no son un tramo de
  // nada: son proporciones sueltas, cada una con su denominador, y pintarlas del
  // color de las barras de arriba las hacía parecer parte de la misma escala.
  // Además compite: en una tarjeta donde el turquesa significa "grado de
  // carencia", un turquesa que no significa eso es ruido.
  //
  // Se mezcla con `--tinta`, que se invierte con el tema, así que la misma línea
  // da un gris claro sobre la tarjeta blanca y uno tenue sobre la negra.
  const tono = activo ? "var(--resalte)" : "var(--tinta)";
  const fuerza = activo ? "26%" : "13%";
  return (
    <div className="mb-[3px] flex items-center gap-1">
      <button
        onClick={onClick}
        className="flex flex-1 items-baseline gap-1.5 overflow-hidden rounded-sm px-1 py-[3px] text-left text-[10px]"
        style={{
          color: activo ? "var(--tinta)" : "var(--tinta-2)",
          // El medidor es el fondo de la fila. El corte duro entre los dos
          // colores es el dato: un degradado suave no se podría leer como una
          // proporción.
          background:
            `linear-gradient(to right, color-mix(in srgb, ${tono} ${fuerza}, transparent) `
            + `${pct}%, transparent ${pct}%)`,
        }}
        title={`${miles(n)} de ${miles(total)} que contestan esta casilla`}
      >
        <span className="num shrink-0 font-semibold">
          {miles(n)}
          <span className="font-normal" style={{ color: "var(--tinta-3)" }}>
            /{miles(total)}
          </span>
        </span>
        <span className="truncate">{texto}</span>
        <span className="num ml-auto shrink-0">{pct} %</span>
      </button>
      {nota && <Info texto={nota} />}
    </div>
  );
}
