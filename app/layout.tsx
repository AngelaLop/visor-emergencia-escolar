import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Visor de emergencia escolar",
  description:
    "A donde mandar a alguien a mirar primero despues del sismo del 10 de " +
    "agosto de 2026. Sedes educativas oficiales, intensidad estimada y lo que " +
    "se sabe y no se sabe de cada una.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // El tema arranca claro de forma explicita, no siguiendo al sistema
    // operativo: sobre fondo claro se distinguen mejor las bandas de
    // intensidad, y el interruptor del encabezado lo cambia.
    <html lang="es" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
