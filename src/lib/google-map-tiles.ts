type LeafletTileLayer<TMap> = {
  addTo: (map: TMap) => void;
};

type LeafletTileRuntime<TMap> = {
  tileLayer: (
    url: string,
    options: {
      maxZoom: number;
      attribution: string;
      subdomains?: string;
      detectRetina?: boolean;
    }
  ) => LeafletTileLayer<TMap>;
};

type GoogleTileSessionResponse = {
  session?: string;
};

type GoogleTileFailure = {
  status: number;
  detail: string;
};

const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
const googleMapType = process.env.NEXT_PUBLIC_GOOGLE_MAPS_TILE_MAP_TYPE?.trim() || "roadmap";
const googleMapLanguage = process.env.NEXT_PUBLIC_GOOGLE_MAPS_LANGUAGE?.trim() || "en-US";
const googleMapRegion = process.env.NEXT_PUBLIC_GOOGLE_MAPS_REGION?.trim() || "PH";

let googleTileSessionPromise: Promise<string | null> | null = null;

function createGoogleTileSession(): Promise<string | null> {
  if (!googleMapsApiKey) return Promise.resolve(null);
  if (googleTileSessionPromise) return googleTileSessionPromise;

  googleTileSessionPromise = (async () => {
    const body = {
      mapType: googleMapType,
      language: googleMapLanguage,
      region: googleMapRegion,
      ...(googleMapType === "terrain" ? { layerTypes: ["layerRoadmap"] } : {}),
    };

    const response = await fetch(
      `https://tile.googleapis.com/v1/createSession?key=${encodeURIComponent(googleMapsApiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const detail = await response.text();
      return {
        status: response.status,
        detail,
      } satisfies GoogleTileFailure;
    }

    const data = (await response.json()) as GoogleTileSessionResponse;
    return data.session ?? null;
  })().then((result) => {
    if (typeof result === "string" || result === null) return result;
    console.warn(
      `Google Map Tiles unavailable; falling back to OpenStreetMap. Status ${result.status}: ${result.detail}`
    );
    googleTileSessionPromise = null;
    return null;
  }).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Google Map Tiles unavailable; falling back to OpenStreetMap. ${message}`);
    googleTileSessionPromise = null;
    return null;
  });

  return googleTileSessionPromise;
}

export async function addLeafletBaseTileLayer<TMap>(
  L: LeafletTileRuntime<TMap>,
  map: TMap
): Promise<void> {
  const session = await createGoogleTileSession();

  if (session && googleMapsApiKey) {
    L.tileLayer(
      `https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=${encodeURIComponent(
        session
      )}&key=${encodeURIComponent(googleMapsApiKey)}`,
      {
        maxZoom: 22,
        attribution: "Map data &copy; Google Maps",
        detectRetina: true,
      }
    ).addTo(map);
    return;
  }

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: "abc",
    detectRetina: true,
  }).addTo(map);
}
