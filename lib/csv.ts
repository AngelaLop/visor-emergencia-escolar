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
  ["matricula_simat_2022", (r) => r.properties.matricula],
  // Vacio y no cero cuando la sede no reporto al C-600 de 2024. Quien abra el
  // CSV tiene que poder distinguir "no reporto" de "se quedo sin alumnos".
  ["matricula_c600_2024", (r) => r.properties.matricula_2024 ?? ""],
  ["vigencia_2024", (r) => r.properties.vigencia_2024 ?? ""],
  ["ptie", (r) => (r.properties.ptie ? "si" : "no")],
  ["ptie_estado", (r) => r.properties.ptie_estado ?? ""],
  ["ptie_anio_intervencion", (r) => r.properties.ptie_anio ?? ""],
  // Vacio, no cero, en las sedes que el FFIE nunca visito: no haber sido
  // visitada es no saber. Ver FICHA_IVID en lib/datos.ts.
  ["ivid", (r) => r.properties.ivid ?? ""],
  ["ivid_techos", (r) => r.properties.ivid_techos ?? ""],
  ["ivid_muros", (r) => r.properties.ivid_muros ?? ""],
  ["ivid_pisos", (r) => r.properties.ivid_pisos ?? ""],
  // Vacio cuando la sede queda fuera de la grilla del ShakeMap. Son cinco con
  // dano reportado y su MMI llega aqui como NaN, que escrito literalmente en la
  // columna se lee como un dato roto y no como un dato que no existe.
  ["mmi", (r) => (Number.isFinite(r.properties.mmi) ? r.properties.mmi : "")],
  ["nivel_mmi", (r) => r.properties.nivel],
  ["encuestada", (r) => (r.properties.encuestada ? "si" : "no")],
  ["techos_declarados", (r) => r.properties.techos ?? ""],
  ["muros_declarados", (r) => r.properties.muros ?? ""],
  ["pisos_declarados", (r) => r.properties.pisos ?? ""],
  ["fecha_encuesta", (r) => r.properties.fecha_encuesta ?? ""],
  ["calidad_coordenada", (r) => diceCalidad(r.properties.calidad_coord)],
  // Se llama `zona_simat` y no `zona` porque hasta hace poco iba al lado de otra
  // columna, `area`, que era `area_class`, la clasificacion de tres categorias
  // calculada sobre la grilla de poblacion de WorldPop. Las dos decian "donde
  // esta la escuela" y ninguna decia cual era cual. `area_class` esta vacia en
  // 4.066 de las 26.591 sedes publicadas, una de cada seis, asi que se saco del
  // archivo: una columna con ese hueco, en una lista que se usa para repartir
  // visitas, se lee como "no hay nada ahi" y no como "no lo sabemos". Vuelve
  // cuando se cierre docs/10_issue_cobertura_area_class.md. Mientras tanto sigue
  // visible en la ficha de cada sede, que si distingue el vacio.
  ["zona_simat", (r) => r.properties.zona ?? ""],
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
