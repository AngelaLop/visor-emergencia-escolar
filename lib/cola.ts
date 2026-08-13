/** Lectura y escritura de la cola de curaduria. Solo servidor.
 *
 * La cola vive en `data/curaduria/reportes_chatmap.csv`, un archivo de texto
 * versionado en git y no una base de datos. Es deliberado: la decision de si
 * una foto es una escuela y de cual es la toma una persona, y ese registro
 * tiene que poder leerse, corregirse a mano y auditarse en el historial. Una
 * fila de ese CSV es la unica cosa en todo el visor que un humano afirma.
 *
 * El script 24 escribe el mismo archivo. Las dos rutas respetan la regla: lo ya
 * revisado no se pisa nunca.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import type { Candidata, Reporte } from "./tipos";

const RUTA = path.join(process.cwd(), "..", "data", "curaduria",
  "reportes_chatmap.csv");

const PUBLICO = path.join(process.cwd(), "public", "datos", "reportes.json");

const COLUMNAS = ["id", "fecha", "lat", "lon", "url_foto", "texto", "candidatas",
  "es_escuela", "dane_asignado", "revisado_por", "revisado_en", "nota"];

/** Divide una linea de CSV respetando las comillas.
 *
 * Hace falta un parseo de verdad y no un `split(",")`: la columna `candidatas`
 * lleva JSON dentro, con comas y comillas escapadas.
 */
export function partir(linea: string): string[] {
  const campos: string[] = [];
  let actual = "";
  let entre = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (entre) {
      if (c === '"' && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else if (c === '"') {
        entre = false;
      } else {
        actual += c;
      }
    } else if (c === '"') {
      entre = true;
    } else if (c === ",") {
      campos.push(actual);
      actual = "";
    } else {
      actual += c;
    }
  }
  campos.push(actual);
  return campos;
}

export function filasDeTexto(texto: string): string[][] {
  const filas: string[][] = [];
  let linea = "";
  let entre = false;
  for (const c of texto) {
    if (c === '"') entre = !entre;
    if (c === "\n" && !entre) {
      if (linea.trim() !== "") filas.push(partir(linea.replace(/\r$/, "")));
      linea = "";
    } else {
      linea += c;
    }
  }
  if (linea.trim() !== "") filas.push(partir(linea.replace(/\r$/, "")));
  return filas;
}

export function campo(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function leeCola(): Promise<Reporte[]> {
  let texto: string;
  try {
    texto = await fs.readFile(RUTA, "utf-8");
  } catch {
    // Sin ingesta todavia no hay cola, y eso es un estado normal del sistema.
    return [];
  }
  const filas = filasDeTexto(texto.replace(/^﻿/, ""));
  if (filas.length < 2) return [];
  const cab = filas[0];
  const idx = (n: string) => cab.indexOf(n);

  return filas.slice(1).map((f) => {
    const g = (n: string) => (idx(n) >= 0 ? (f[idx(n)] ?? "") : "");
    let candidatas: Candidata[] = [];
    try {
      candidatas = JSON.parse(g("candidatas") || "[]");
    } catch {
      candidatas = [];
    }
    return {
      id: g("id"),
      fecha: g("fecha"),
      lat: Number(g("lat")),
      lon: Number(g("lon")),
      url_foto: g("url_foto"),
      texto: g("texto"),
      candidatas,
      es_escuela: g("es_escuela"),
      dane_asignado: g("dane_asignado"),
      revisado_por: g("revisado_por"),
      revisado_en: g("revisado_en"),
      nota: g("nota"),
    };
  });
}

export type Decision = {
  id: string;
  es_escuela: "si" | "no";
  dane_asignado: string;
  revisado_por: string;
  nota?: string;
};

export async function guardaDecision(d: Decision): Promise<Reporte[]> {
  const cola = await leeCola();
  const i = cola.findIndex((r) => r.id === d.id);
  if (i < 0) throw new Error(`el reporte ${d.id} no esta en la cola`);

  cola[i] = {
    ...cola[i],
    es_escuela: d.es_escuela,
    // Un "no es escuela" no puede quedar con una sede pegada: seria una
    // asignacion a medias esperando a que alguien la lea mal.
    dane_asignado: d.es_escuela === "si" ? d.dane_asignado : "",
    revisado_por: d.revisado_por,
    revisado_en: new Date().toISOString().slice(0, 19).replace("T", " "),
    nota: d.nota ?? "",
  };

  const lineas = [COLUMNAS.join(",")];
  for (const r of cola) {
    lineas.push([
      r.id, r.fecha, String(r.lat), String(r.lon), r.url_foto, r.texto,
      JSON.stringify(r.candidatas), r.es_escuela, r.dane_asignado,
      r.revisado_por, r.revisado_en, r.nota,
    ].map(campo).join(","));
  }
  await fs.writeFile(RUTA, lineas.join("\n") + "\n", "utf-8");

  // El visor publicado no puede leer el CSV, asi que cada decision refresca la
  // copia estatica. Solo lo confirmado: lo pendiente son fotos que nadie ha
  // revisado y no tienen por que salir a la calle.
  const confirmados = cola.filter((x) => x.es_escuela === "si" && x.dane_asignado);
  await fs.mkdir(path.dirname(PUBLICO), { recursive: true });
  await fs.writeFile(
    PUBLICO,
    JSON.stringify({ reportes: confirmados }),
    "utf-8",
  );

  return cola;
}
