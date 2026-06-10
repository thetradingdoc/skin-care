import { TULIP_PATH } from '../../../assets/brand/tulip-path.js';

function TulipSvg({ className, width, height, title }) {
  return (
    <svg
      className={className}
      viewBox="0 0 600 215"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...(width != null ? { width } : {})}
      {...(height != null ? { height } : {})}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}>
      {title ? <title>{title}</title> : null}
      <path fill="#000000" d={TULIP_PATH} />
    </svg>
  );
}

/** Brand tulip — pixel-traced SVG, solid black fill. */
export function LogoMark({ className, title }) {
  return <TulipSvg className={className} title={title} />;
}

/** Brand mark — standalone tulip icon. */
export default function DoveIcon({ className, width = 44, height, title }) {
  const resolvedHeight = height ?? Math.round(width * (215 / 600));
  return <TulipSvg className={className} width={width} height={resolvedHeight} title={title} />;
}

/** Live wordmark — Be Vietnam Pro italic "skin" + tulip + bold "care". */
export function LogoWordmark({ className, height = 52 }) {
  return (
    <span
      className={`sc-logo-wordmark${className ? ` ${className}` : ''}`}
      style={{ '--logo-height': `${height}px` }}
      role="img"
      aria-label="skin care">
      <span className="sc-logo-skin" aria-hidden="true">
        skin
      </span>
      <span className="sc-logo-mark-slot" aria-hidden="true">
        <LogoMark className="sc-logo-mark" />
      </span>
      <span className="sc-logo-care" aria-hidden="true">
        care
      </span>
    </span>
  );
}

/** @deprecated Use LogoWordmark — kept for existing imports. */
export function BrandMarkImg(props) {
  return <LogoWordmark {...props} />;
}
