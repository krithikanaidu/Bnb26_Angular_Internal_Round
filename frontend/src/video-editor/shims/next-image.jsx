// Vite shim for `next/image` -> plain <img>.
import React from 'react';

export default function Image({ src, alt = '', fill, priority, ...props }) {
  const { width, height, style, ...rest } = props;
  const resolvedSrc = typeof src === 'string' ? src : src?.src ?? '';
  const fillStyle = fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%' } : undefined;
  return (
    <img
      src={resolvedSrc}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      loading={priority ? 'eager' : 'lazy'}
      style={{ ...(style || {}), ...(fillStyle || {}) }}
      {...rest}
    />
  );
}
