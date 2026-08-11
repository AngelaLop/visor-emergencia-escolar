"use client";

/** Una foto alojada fuera de este proyecto, con su fallo dicho en pantalla.
 *
 * Ninguna imagen del visor se copia a este repositorio. Las del FFIE viven en
 * geodata.ffie.com.co y las ciudadanas en el servidor de ChatMap. Enlazarlas en
 * vez de republicarlas es una decision deliberada: las segundas vienen de grupos
 * de WhatsApp cuyos autores consintieron a compartirlas ahi, no en una
 * plataforma.
 *
 * La contrapartida es que un servidor ajeno se puede caer, y en emergencia se
 * cae. Un hueco gris donde deberia haber una foto se lee como "esta sede no
 * tiene foto", que es una afirmacion distinta y falsa. Por eso el fallo se
 * nombra.
 */

import { useState } from "react";

type Props = {
  url: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
};

export default function Imagen({ url, alt, className, style }: Props) {
  const [fallo, setFallo] = useState(false);

  if (fallo) {
    return (
      <div
        className="flex min-h-24 items-center justify-center rounded p-3 text-center text-xs"
        style={{ background: "var(--plano)", color: "var(--tinta-2)" }}
      >
        La foto existe pero no cargó. El servidor que la aloja no respondió.
        <br />
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="underline"
          style={{ color: "var(--tinta-2)" }}
        >
          Abrirla en su origen
        </a>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      onError={() => setFallo(true)}
    />
  );
}
