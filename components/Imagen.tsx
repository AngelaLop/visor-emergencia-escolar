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

/** Las URL que trae un campo de foto, que puede traer más de una.
 *
 * Los rectores del Valle subieron la imagen a un formulario de Google y dos de
 * ellos adjuntaron dos archivos, que llegan al mismo campo separados por coma.
 * Sin partirlo, el visor pedía una URL que era en realidad dos pegadas y no
 * cargaba ninguna de las dos.
 */
export function urlsDeFoto(campo?: string): string[] {
  if (!campo) return [];
  return campo.split(/[\s,;]+/).filter((x) => x.startsWith("http"));
}

/** La URL con la que Drive entrega la imagen, no su página de visor.
 *
 * `drive.google.com/open?id=X` es una página HTML: puesta en un `img` no pinta
 * nada. La miniatura del mismo identificador sí devuelve JPEG o PNG, y lo hace
 * sin credenciales, que es lo que permite mostrar aquí las fotos del
 * diagnóstico del Valle. Se comprobó sobre una muestra de doce: once
 * respondieron imagen y una dio 404, o sea que el archivo ya no está.
 *
 * Lo que no es de Drive se devuelve tal cual. Las fotos del FFIE y las
 * ciudadanas ya son URL de imagen.
 */
export function urlVisible(url: string): string {
  const id = url.match(/[?&]id=([\w-]+)/)?.[1]
    ?? url.match(/\/file\/d\/([\w-]+)/)?.[1];
  return url.includes("drive.google.com") && id
    ? `https://drive.google.com/thumbnail?id=${id}&sz=w800`
    : url;
}

type Props = {
  url: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
};

export default function Imagen({ url, alt, className, style }: Props) {
  const [fallo, setFallo] = useState(false);
  const src = urlVisible(url);
  // Google rechaza la imagen cuando la petición llega con la cabecera Referer de
  // un sitio que no conoce: Chrome la corta con ERR_BLOCKED_BY_ORB y la foto
  // queda en blanco. Suprimir el referente la deja pasar. Comprobado en cuatro
  // combinaciones, cada una en un navegador limpio: con referente fallan las dos
  // formas de pedirla, sin referente cargan las dos.
  //
  // Solo para Google. Hay servidores que hacen lo contrario y exigen el
  // referente para no servir la foto a cualquiera, y las del FFIE están en uno
  // de esos, así que suprimirlo para todos cambiaría un problema por otro.
  const suprimeReferente = src.includes("google");

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
      src={src}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      referrerPolicy={suprimeReferente ? "no-referrer" : undefined}
      onError={() => setFallo(true)}
    />
  );
}
