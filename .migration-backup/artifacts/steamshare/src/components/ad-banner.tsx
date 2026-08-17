interface AdBannerProps {
  placement: "home" | "browse";
}

interface Ad {
  id: number;
  imageUrl: string;
  linkUrl: string;
}

import { useQuery } from "@tanstack/react-query";

async function fetchAds(placement: string): Promise<Ad[]> {
  const res = await fetch(`/api/site-settings/ads?placement=${placement}`, { credentials: "include" });
  if (!res.ok) return [];
  return res.json();
}

export function AdBanner({ placement }: AdBannerProps) {
  const { data: ads = [] } = useQuery({
    queryKey: ["ads", placement],
    queryFn: () => fetchAds(placement),
    staleTime: 60_000,
  });

  if (ads.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full my-4">
      {ads.map((ad) => (
        <a
          key={ad.id}
          href={ad.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-xl overflow-hidden border border-border hover:border-primary/40 transition-colors"
        >
          <img
            src={ad.imageUrl}
            alt="Advertisement"
            className="w-full h-auto max-h-40 object-contain bg-muted/20"
            style={{ display: "block" }}
          />
        </a>
      ))}
    </div>
  );
}
