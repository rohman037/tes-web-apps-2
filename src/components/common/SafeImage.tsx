'use client';

import React, { useState } from 'react';
import Image, { ImageProps } from 'next/image';

interface SafeImageProps extends Omit<ImageProps, 'src' | 'alt'> {
  src: string;
  alt: string;
  fallbackSrc?: string;
  className?: string;
}

/**
 * SafeImage: Universal Next.js Image component wrapper.
 * Safely handles Next.js optimization, remote images, data-URIs, blob URLs, and broken images fallback.
 */
export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  fallbackSrc = 'https://picsum.photos/seed/placeholder/400/400',
  className = '',
  width,
  height,
  fill,
  unoptimized,
  ...props
}) => {
  const [errorSrc, setErrorSrc] = useState<string | null>(null);

  const isDataOrBlob = typeof src === 'string' && (src.startsWith('data:') || src.startsWith('blob:') || src.includes('tiktokcdn') || src.includes('byteoversea'));
  const finalSrc = errorSrc === src ? fallbackSrc : (src || fallbackSrc);

  return (
    <Image
      src={finalSrc}
      alt={alt}
      className={className}
      width={!fill ? width || 300 : undefined}
      height={!fill ? height || 300 : undefined}
      fill={fill}
      unoptimized={unoptimized || isDataOrBlob}
      referrerPolicy="no-referrer"
      onError={() => {
        setErrorSrc(src);
      }}
      {...props}
    />
  );
};

export default SafeImage;


