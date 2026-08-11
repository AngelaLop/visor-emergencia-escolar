/** Devuelve la cola de curaduria al visor.
 *
 * El mapa solo dibuja los reportes con `es_escuela = si`, pero la bandeja de
 * triaje necesita tambien los pendientes, asi que la ruta entrega la cola
 * completa y cada pantalla decide que mira.
 */

import { NextResponse } from "next/server";

import { leeCola } from "@/lib/cola";

export const dynamic = "force-dynamic";

export async function GET() {
  const reportes = await leeCola();
  return NextResponse.json({ reportes });
}
