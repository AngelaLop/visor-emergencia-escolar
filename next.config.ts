import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Las fotos vienen de dos servidores externos y no se copian a este
  // repositorio: las del FFIE son de sus operadores y las de ChatMap son de
  // grupos de WhatsApp cuyos autores consintieron a compartirlas ahi. Se
  // enlazan, no se republican.
  images: { unoptimized: true },
};

export default nextConfig;
