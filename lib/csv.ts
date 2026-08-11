/** Exportacion de la seleccion a CSV.
 *
 * Quien coordina en campo necesita la lista en el telefono, no un mapa bonito.
 * Se exporta exactamente lo que esta filtrado en pantalla, ordenado de mayor a
 * menor matricula, con las columnas de la ficha para que la lista se pueda leer
 * sin volver al visor.
 *
 * La calidad de la coordenada y la columna de encuestada van explicitas: son la
 * diferencia entre mandar a alguien a una direccion confiable y mandarlo a un
 * punto que nadie verifico.
 */

import { diceCalidad } from "./datos";
import type { RasgoSede } from "./tipos";

const COLUMNAS: [string, (r: RasgoSede) => string | number][] = [
  ["dane", (r) => r.properties.dane],
  ["sede", (r) => r.properties.sede],
  ["establecimiento", (r) => r.properties.establecimiento ?? ""],
  ["departamento", (r) => r.properties.depto],
  ["municipio", (r) => r.properties.mpio],
  ["secretaria", (r) => r.properties.secretaria ?? ""],
  ["matricula", (r) => r.properties.matricula],
  ["mmi", (r) => r.properties.mmi],
  ["nivel_mmi", (r) => r.properties.nivel],
  ["encuestada", (r) => (r.properties.encuestada ? "si" : "no")],
  ["techos_declarados", (r) => r.properties.techos ?? ""],
  ["muros_declarados", (r) => r.properties.muros ?? ""],
  ["pisos_declarados", (r) => r.properties.pisos ?? ""],
  ["fecha_encuesta", (r) => r.properties.fecha_encuesta ?? ""],
  ["calidad_coordenada", (r) => diceCalidad(r.properties.calidad_coord)],
  ["zona", (r) => r.properties.zona ?? ""],
  ["area", (r) => r.properties.area_class ?? ""],
  ["rwi", (r) => r.properties.rwi ?? ""],
  ["lon", (r) => r.geometry.coordinates[0]],
  ["lat", (r) => r.geometry.coordinates[1]],
  ["foto_ffie", (r) => r.properties.foto1 ?? ""],
];

function campo(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function aCsv(rasgos: RasgoSede[]): string {
  const orden = [...rasgos].sort(
    (a, b) => b.properties.matricula - a.properties.matricula,
  );
  const lineas = [COLUMNAS.map(([n]) => n).join(",")];
  for (const r of orden) {
    lineas.push(COLUMNAS.map(([, f]) => campo(f(r))).join(","));
  }
  return lineas.join("\n");
}

export function descarga(rasgos: RasgoSede[]): void {
  // El BOM es para que Excel en Windows no rompa las tildes de los municipios.
  const blob = new Blob(["﻿" + aCsv(rasgos)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const hoy = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `sedes_sismo_choco_${hoy}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
