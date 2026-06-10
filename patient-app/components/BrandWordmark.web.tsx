import React, { useEffect } from 'react';

import { TULIP_PATH } from '@/lib/tulip-path.js';

type Props = { height?: number; className?: string; style?: React.CSSProperties };

function useLogoWordmarkStylesheet() {
  useEffect(() => {
    if (document.querySelector('link[data-sc-logo-wordmark]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/assets/css/logo-wordmark.css';
    link.setAttribute('data-sc-logo-wordmark', '1');
    document.head.appendChild(link);
  }, []);
}

export function BrandWordmark({ height = 40, className, style }: Props) {
  useLogoWordmarkStylesheet();

  const wordmarkClass = `sc-logo-wordmark${className ? ` ${className}` : ''}`;

  return (
    <span
      className={wordmarkClass}
      style={{ '--logo-height': `${height}px`, marginBottom: 12, ...style } as React.CSSProperties}
      role="img"
      aria-label="skin care">
      <span className="sc-logo-skin" aria-hidden="true">
        skin
      </span>
      <span className="sc-logo-mark-slot" aria-hidden="true">
        <svg className="sc-logo-mark" viewBox="0 0 600 215" aria-hidden="true">
          <path d={TULIP_PATH} fill="#000000" />
        </svg>
      </span>
      <span className="sc-logo-care" aria-hidden="true">
        care
      </span>
    </span>
  );
}
