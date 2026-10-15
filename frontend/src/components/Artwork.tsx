import { useState } from 'react';
import { Gamepad2 } from 'lucide-react';
export function Artwork({
  url,
  fallbackUrl,
  name,
  className = '',
  priority = false,
  layout = 'fill',
}: {
  url?: string;
  fallbackUrl?: string;
  name: string;
  className?: string;
  priority?: boolean;
  layout?: 'fill' | 'natural';
}) {
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const source = [url, fallbackUrl].find(
    (candidate) =>
      candidate && !candidate.startsWith('placeholder://') && !failedUrls.includes(candidate),
  );
  if (!source) {
    const hue = Array.from(name).reduce((value, char) => value + char.charCodeAt(0), 0) % 360;
    return (
      <div
        className={`gradient-art relative flex w-full items-end overflow-hidden ${layout === 'natural' ? 'aspect-[2/3]' : 'h-full'} ${className}`}
        role="img"
        aria-label={name}
        style={{
          background: `linear-gradient(135deg,hsl(${hue} 20% 12%),hsl(${(hue + 35) % 360} 26% 27%),#181817)`,
        }}
      >
        <div className="artwork-orbit" aria-hidden="true" />
        <Gamepad2
          className="absolute right-[12%] top-[18%] h-[40%] w-[40%] -rotate-12 text-white/10"
          aria-hidden="true"
        />
        <div className="relative p-5 text-sm font-bold tracking-wide text-white/80">{name}</div>
      </div>
    );
  }
  return (
    <img
      src={source}
      data-fallback={source !== url ? '' : undefined}
      alt={name}
      width={layout === 'natural' ? 600 : undefined}
      height={layout === 'natural' ? 900 : undefined}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      onError={() => setFailedUrls((previous) => [...previous, source!])}
      className={`${layout === 'natural' ? 'block h-auto' : 'h-full'} w-full ${className}`}
      style={{ objectFit: source !== url ? 'contain' : 'cover' }}
    />
  );
}
