import { useEffect, useState } from 'react';
import {
  brandingApi,
  getCachedBranding,
  setCachedBranding,
  preloadLogo,
  getLogoBlobUrl,
} from '@/api/branding';

export default function BrandHeader() {
  const [name, setName] = useState<string>(import.meta.env.VITE_APP_NAME || 'VPN');
  const [logoLetter, setLogoLetter] = useState<string>(import.meta.env.VITE_APP_LOGO || 'V');
  const [hasCustomLogo, setHasCustomLogo] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Use cached branding first for instant render
      const cached = getCachedBranding();
      if (cached) {
        if (!cancelled) {
          setName(cached.name);
          setLogoLetter(cached.logo_letter);
          setHasCustomLogo(cached.has_custom_logo);
        }
        await preloadLogo(cached);
        if (!cancelled) setLogoUrl(getLogoBlobUrl());
      }

      try {
        const data = await brandingApi.getBranding();
        setCachedBranding(data);
        if (!cancelled) {
          setName(data.name);
          setLogoLetter(data.logo_letter);
          setHasCustomLogo(data.has_custom_logo);
        }
        await preloadLogo(data);
        if (!cancelled) setLogoUrl(getLogoBlobUrl());
      } catch {
        // keep whatever we already have
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mb-6 flex flex-col items-center gap-3">
      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 shadow-lg shadow-accent-500/30">
        {hasCustomLogo && logoUrl ? (
          <img src={logoUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-2xl font-bold text-white">{logoLetter}</span>
        )}
      </div>
      <h2 className="text-lg font-bold text-dark-50">{name}</h2>
    </div>
  );
}
