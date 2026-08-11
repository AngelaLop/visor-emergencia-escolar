"use client";

/** Bandeja de triaje: la única pantalla donde una persona afirma algo.
 *
 * De los 20 reportes del 10 de agosto, uno era claramente una escuela y dos
 * eran viviendas que a 200 metros parecían serlo. Por eso no hay asignación
 * automática por cercanía: la distancia se muestra como candidata, nunca como
 * hecho. Un mapa rotulado "escuelas dañadas" alimentado por proximidad
 * desinforma, y en emergencia desinformar manda una brigada al lugar
 * equivocado.
 *
 * Un reporte a la vez, la foto ciudadana contra la foto previa del FFIE, y dos
 * teclas. Lo que se decide aquí se escribe en
 * `data/curaduria/reportes_chatmap.csv`, que va al repositorio.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import Imagen from "@/components/Imagen";
import { diceCalidad, miles } from "@/lib/datos";
import type { Reporte } from "@/lib/tipos";

export default function Triaje() {
  const [cola, setCola] = useState<Reporte[]>([]);
  const [i, setI] = useState(0);
  const [j, setJ] = useState(0);
  const [quien, setQuien] = useState("");
  const [nota, setNota] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setQuien(localStorage.getItem("visor.revisor") ?? "");
    fetch("/api/reportes")
      .then((r) => r.json())
      .then((d) => setCola(d.reportes ?? []))
      .finally(() => setCargando(false));
  }, []);

  const pendientes = cola.filter((r) => !r.es_escuela.trim());
  const r = pendientes[i];
  const candidata = r?.candidatas[j];

  const decide = useCallback(
    async (es: "si" | "no") => {
      if (!r) return;
      if (!quien.trim()) {
        setAviso("Falta poner quién está revisando. Queda en el registro.");
        return;
      }
      if (es === "si" && !candidata) {
        setAviso("No hay ninguna sede candidata para asignarle este reporte.");
        return;
      }
      localStorage.setItem("visor.revisor", quien.trim());
      const res = await fetch("/api/triaje", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: r.id,
          es_escuela: es,
          dane_asignado: es === "si" ? candidata!.dane : "",
          revisado_por: quien.trim(),
          nota,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setAviso(d.error ?? "No se pudo guardar");
        return;
      }
      setCola(d.reportes);
      setAviso(null);
      setNota("");
      setJ(0);
      setI(0);
    },
    [r, candidata, quien, nota],
  );

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "s" || e.key === "S") void decide("si");
      if (e.key === "n" || e.key === "N") void decide("no");
      if (e.key === "ArrowRight" && r) setJ((x) => Math.min(x + 1, r.candidatas.length - 1));
      if (e.key === "ArrowLeft") setJ((x) => Math.max(x - 1, 0));
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [decide, r]);

  if (cargando) {
    return <Marco><p className="p-6 text-sm">Cargando la cola…</p></Marco>;
  }

  if (!cola.length) {
    return (
      <Marco>
        <div className="max-w-lg p-6 text-sm" style={{ color: "var(--tinta-2)" }}>
          <p className="mb-2 font-semibold" style={{ color: "var(--tinta)" }}>
            No hay cola todavía.
          </p>
          <p>
            La produce <code>scripts/24_chatmap_ingesta.py</code>, que baja los
            reportes de ChatMap y les calcula las cinco sedes más cercanas. Sin
            correrlo no hay nada que revisar.
          </p>
        </div>
      </Marco>
    );
  }

  if (!r) {
    const revisados = cola.filter((x) => x.es_escuela.trim());
    const escuelas = revisados.filter((x) => x.es_escuela === "si");
    return (
      <Marco>
        <div className="max-w-lg p-6 text-sm">
          <p className="mb-2 font-semibold">Cola al día.</p>
          <p style={{ color: "var(--tinta-2)" }}>
            <span className="num">{miles(revisados.length)}</span> reportes
            revisados, de los cuales{" "}
            <span className="num">{miles(escuelas.length)}</span> resultaron ser
            escuelas y ya están en el mapa.
          </p>
          <Link href="/" className="mt-3 inline-block underline">
            Volver al mapa
          </Link>
        </div>
      </Marco>
    );
  }

  return (
    <Marco>
      <div className="mx-auto w-full max-w-5xl p-4">
        <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="num text-sm font-semibold">
            Reporte {i + 1} de {pendientes.length} pendientes
          </span>
          <span className="text-xs" style={{ color: "var(--tinta-2)" }}>
            {r.fecha}
          </span>
          <div className="ml-auto flex items-center gap-2 text-xs">
            <label style={{ color: "var(--tinta-2)" }}>Revisa</label>
            <input
              value={quien}
              onChange={(e) => setQuien(e.target.value)}
              placeholder="Tu nombre"
              className="w-36 rounded border px-2 py-1"
              style={{
                borderColor: "var(--linea)",
                background: "var(--superficie)",
              }}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Foto
            titulo="Foto del reporte ciudadano"
            url={r.url_foto}
            pie={r.texto || "Sin texto"}
          />
          <Foto
            titulo="Foto previa del FFIE"
            url={candidata?.foto1 ?? ""}
            pie={
              candidata?.foto1
                ? "La tomó el operador del FFIE antes del sismo."
                : "Esta sede no tiene foto previa. Si nunca fue encuestada, no hay con qué comparar."
            }
          />
        </div>

        <div
          className="mt-3 rounded border px-4 py-3"
          style={{ borderColor: "var(--linea)", background: "var(--superficie)" }}
        >
          {candidata ? (
            <>
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="num text-sm font-semibold">
                  Candidata a {candidata.dist_m} m
                </span>
                <span className="text-sm">{candidata.sede}</span>
                <span className="text-xs" style={{ color: "var(--tinta-2)" }}>
                  {candidata.mpio}, {candidata.depto}
                </span>
              </div>
              <div
                className="num mt-1 flex flex-wrap gap-x-4 text-xs"
                style={{ color: "var(--tinta-2)" }}
              >
                <span>Código DANE {candidata.dane}</span>
                <span>{miles(candidata.matricula)} alumnos</span>
                <span>
                  MMI {candidata.mmi != null
                    ? candidata.mmi.toFixed(1).replace(".", ",")
                    : "sin dato"}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 text-xs">
                <span
                  style={{
                    color: candidata.encuestada
                      ? "var(--tinta-2)"
                      : "var(--sede-ignota)",
                  }}
                >
                  {candidata.encuestada ? "Encuestada" : "Nunca fue encuestada"}
                </span>
                <span
                  style={{
                    color:
                      candidata.calidad_coord === "gps_validated"
                        ? "var(--tinta-2)"
                        : "var(--critico)",
                  }}
                >
                  {diceCalidad(candidata.calidad_coord ?? undefined)}
                </span>
              </div>

              <div className="mt-2 flex items-center gap-2 text-xs">
                <button
                  onClick={() => setJ((x) => Math.max(x - 1, 0))}
                  disabled={j === 0}
                  className="rounded border px-2 py-1 disabled:opacity-30"
                  style={{ borderColor: "var(--linea)" }}
                >
                  ← Anterior
                </button>
                <span className="num" style={{ color: "var(--tinta-3)" }}>
                  Candidata {j + 1} de {r.candidatas.length}
                </span>
                <button
                  onClick={() =>
                    setJ((x) => Math.min(x + 1, r.candidatas.length - 1))
                  }
                  disabled={j >= r.candidatas.length - 1}
                  className="rounded border px-2 py-1 disabled:opacity-30"
                  style={{ borderColor: "var(--linea)" }}
                >
                  Siguiente →
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm" style={{ color: "var(--critico)" }}>
              Ninguna sede a 500 metros o menos del punto reportado. Casi con
              seguridad no es una escuela.
            </p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => void decide("si")}
            className="rounded px-4 py-2 text-sm font-medium"
            style={{ background: "var(--sede-encuestada)", color: "#fff" }}
          >
            [S] Sí, es esta escuela
          </button>
          <button
            onClick={() => void decide("no")}
            className="rounded border px-4 py-2 text-sm font-medium"
            style={{ borderColor: "var(--linea)", color: "var(--tinta-2)" }}
          >
            [N] No es una escuela
          </button>
          <button
            onClick={() => setI((x) => (x + 1) % pendientes.length)}
            className="rounded px-3 py-2 text-xs underline"
            style={{ color: "var(--tinta-2)" }}
          >
            Dejarlo para después
          </button>
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Nota (opcional)"
            className="ml-auto w-60 rounded border px-2 py-1 text-xs"
            style={{ borderColor: "var(--linea)", background: "var(--superficie)" }}
          />
        </div>

        {aviso && (
          <p className="mt-2 text-sm" style={{ color: "var(--critico)" }}>
            {aviso}
          </p>
        )}

        <p className="mt-4 text-xs" style={{ color: "var(--tinta-3)" }}>
          Confirmar significa que la foto corresponde a esa escuela, no que la
          escuela esté dañada. Nadie de la entidad ha ido todavía.
        </p>
      </div>
    </Marco>
  );
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen">
      <header
        className="flex items-baseline gap-4 border-b px-4 py-2"
        style={{ background: "var(--superficie)", borderColor: "var(--linea)" }}
      >
        <h1 className="text-sm font-semibold">Triaje de reportes ciudadanos</h1>
        <Link href="/" className="ml-auto text-xs underline">
          Volver al mapa
        </Link>
      </header>
      {children}
    </main>
  );
}

function Foto({
  titulo,
  url,
  pie,
}: {
  titulo: string;
  url: string;
  pie: string;
}) {
  return (
    <figure
      className="rounded border p-2"
      style={{ borderColor: "var(--linea)", background: "var(--superficie)" }}
    >
      <figcaption
        className="mb-1 text-xs font-medium uppercase tracking-wide"
        style={{ color: "var(--tinta-3)" }}
      >
        {titulo}
      </figcaption>
      {url ? (
        <Imagen
          url={url}
          alt={titulo}
          className="max-h-80 w-full rounded object-contain"
          style={{ background: "var(--plano)" }}
        />
      ) : (
        <div
          className="flex h-48 items-center justify-center rounded text-xs"
          style={{ background: "var(--plano)", color: "var(--tinta-3)" }}
        >
          sin imagen
        </div>
      )}
      <p className="mt-1 text-xs" style={{ color: "var(--tinta-2)" }}>
        {pie}
      </p>
    </figure>
  );
}
