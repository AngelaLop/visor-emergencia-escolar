/** Los símbolos que se repiten fuera del mapa.
 *
 * El pin de sede se dibuja aquí como SVG y en `Mapa.tsx` sobre un canvas. Son
 * dos técnicas para el mismo símbolo porque MapLibre necesita una imagen y el
 * panel necesita algo que escale con el texto, pero la silueta es la misma: si
 * se cambia una, hay que cambiar la otra.
 */

export function PinSede({
  alto = 16,
  color = "var(--sede-base)",
}: {
  alto?: number;
  color?: string;
}) {
  return (
    <svg
      width={(alto * 26) / 34}
      height={alto}
      viewBox="0 0 26 34"
      aria-hidden="true"
    >
      <path
        d="M13 1.2 C7.6 1.2 3.4 5.4 3.4 10.6 C3.4 17.2 13 26 13 26 C13 26 22.6 17.2 22.6 10.6 C22.6 5.4 18.4 1.2 13 1.2 Z"
        fill={color}
      />
      <path d="M13 6.6 20 11 13 15.4 6 11 Z" fill="var(--superficie)" />
      <path
        d="M9.4 12.7v3.6h7.2v-3.6"
        fill="none"
        stroke="var(--superficie)"
        strokeWidth="1.4"
      />
    </svg>
  );
}

/** La marca de GitHub, tal como la publica GitHub. */
export function MarcaGitHub({ alto = 14 }: { alto?: number }) {
  return (
    <svg width={alto} height={alto} viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
      />
    </svg>
  );
}
