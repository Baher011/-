import { useState } from 'react';
import { Shield } from 'lucide-react';

interface AcademyImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export function AcademyImage({
  src,
  alt,
  className = '',
  fallbackLabel = 'أكاديمية البوب للفنون القتالية',
}: AcademyImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#141619] text-[#D4A843] p-6 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Shield className="w-8 h-8 mb-2 opacity-80" />
        <span className="text-xs font-medium text-zinc-300">{fallbackLabel}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
