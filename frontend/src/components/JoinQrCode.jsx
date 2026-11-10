import { useEffect, useState } from 'react';

export default function JoinQrCode({ url, alt, className = 'w-56 h-56', resolution = 448 }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let cancelled = false;
    // The encoder is only needed on the screens that show a code.
    import('qrcode')
      .then((mod) => mod.default.toDataURL(url, { width: resolution, margin: 1, errorCorrectionLevel: 'M' }))
      .then((dataUrl) => { if (!cancelled) setSrc(dataUrl); })
      .catch(() => { if (!cancelled) setSrc(''); });
    return () => { cancelled = true; };
  }, [url, resolution]);

  if (!src) return <div className={`${className} bg-slate-100 rounded-lg`} />;
  return <img src={src} alt={alt} className={`${className} object-contain`} />;
}
