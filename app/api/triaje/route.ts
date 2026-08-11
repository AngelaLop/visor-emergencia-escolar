/** Guarda una decision de triaje en el CSV de curaduria.
 *
 * Solo funciona con la aplicacion corriendo en local. Publicada, el sistema de
 * archivos es de solo lectura y efimero: una decision escrita ahi se perderia
 * en el siguiente despliegue sin avisarle a nadie, que es peor que no poder
 * escribirla. Por eso la ruta se niega en produccion en vez de fallar callada.
 */

import { NextResponse } from "next/server";

import { guardaDecision } from "@/lib/cola";
import type { Decision } from "@/lib/cola";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      {
        error:
          "El triaje solo se hace con el visor corriendo en local, porque la " +
          "decision se escribe en data/curaduria/reportes_chatmap.csv y ese " +
          "archivo va al repositorio.",
      },
      { status: 403 },
    );
  }

  let d: Decision;
  try {
    d = (await req.json()) as Decision;
  } catch {
    return NextResponse.json({ error: "cuerpo ilegible" }, { status: 400 });
  }

  if (!d?.id || (d.es_escuela !== "si" && d.es_escuela !== "no")) {
    return NextResponse.json(
      { error: "hacen falta id y es_escuela (si o no)" },
      { status: 400 },
    );
  }
  if (d.es_escuela === "si" && !d.dane_asignado) {
    return NextResponse.json(
      { error: "un reporte confirmado necesita la sede asignada" },
      { status: 400 },
    );
  }

  try {
    const reportes = await guardaDecision(d);
    return NextResponse.json({ reportes });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error al escribir la cola" },
      { status: 500 },
    );
  }
}
