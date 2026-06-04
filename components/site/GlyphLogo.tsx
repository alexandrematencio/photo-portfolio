/**
 * Glyph ALXMTNC — marque officielle d'A. Matencio.
 * SVG inline pour permettre de piloter la couleur via `color` (currentColor)
 * ou via la prop `color`. Par défaut : cobalt #0013FF (couleur brand).
 */
type Props = {
  size?: number | string;
  className?: string;
  color?: string;
  title?: string;
};

export function GlyphLogo({
  size = 32,
  className,
  color = '#0013FF',
  title = 'A. Matencio',
}: Props) {
  return (
    <svg
      width={size}
      viewBox="0 0 559 521"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={className}
    >
      <g clipPath="url(#glyph-clip)">
        <path
          opacity="0.3"
          d="M85.6254 273.246V372.848L174.835 321.12"
          fill={color}
        />
        <path
          d="M343.313 422.277L257.688 372.848L472.766 248.43V149.166L257.688 273.246L172.062 223.885L386.735 99.4667L386.938 0L172.062 124.283L85.6254 74.9212V173.644L0 124.688V322.675L85.6254 372.848V273.246L172.062 322.675V422.277L343.313 521L558.797 397.394L559 297.994L343.313 422.277Z"
          fill={color}
        />
      </g>
      <defs>
        <clipPath id="glyph-clip">
          <rect width="559" height="521" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}
