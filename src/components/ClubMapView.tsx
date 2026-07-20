import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Club } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';

const iconClub = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const iconClubInterested = new L.Icon({
  iconUrl: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iNDEiIHZpZXdCb3g9IjAgMCAyNSA0MSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIuNSwwIEMyMCwwIDI1LDYgMjUsMTMuNSBDMjUsMjEgMTIuNSw0MSAxMi41LDQxIEMxMi41LDQxIDAsIDIxIDAsIDEzLjUgQzAsIDYgNSwgMCAxMi41LDAgWiIgZmlsbD0iIzAwNkQzMiIvPjwvc3ZnPg==",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

type MapUpdaterProps = {
  selectedClub: Club | null;
  defaultCenter: [number, number];
  defaultZoom: number;
};

function MapUpdater({ selectedClub, defaultCenter, defaultZoom }: MapUpdaterProps) {
  const map = useMap();
  const prevClubIdRef = useRef<string | null>(null);
  const hadSelectionRef = useRef(false);

  useEffect(() => {
    if (selectedClub && prevClubIdRef.current !== selectedClub.club_id) {
      map.flyTo([selectedClub.lat, selectedClub.lng], 14);
      prevClubIdRef.current = selectedClub.club_id;
      hadSelectionRef.current = true;
    } else if (!selectedClub && hadSelectionRef.current) {
      map.flyTo(defaultCenter, defaultZoom);
      prevClubIdRef.current = null;
      hadSelectionRef.current = false;
    }
  }, [selectedClub, map, defaultCenter, defaultZoom]);

  return null;
}

type MapBoundsHandlerProps = {
  onBoundsChange: (bounds: { north: number; south: number; east: number; west: number }) => void;
};

function MapBoundsHandler({ onBoundsChange }: MapBoundsHandlerProps) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const map = useMap();
  const initialLoadRef = useRef(false);

  useEffect(() => {
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      const bounds = map.getBounds();
      onBoundsChange({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
      });
    }
  }, [map, onBoundsChange]);

  useMapEvents({
    moveend: (e) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        const bounds = e.target.getBounds();
        onBoundsChange({
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest()
        });
      }, 500);
    },
    zoomend: (e) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        const bounds = e.target.getBounds();
        onBoundsChange({
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest()
        });
      }, 500);
    }
  });

  return null;
}

type ClubMapViewProps = {
  clubs: Club[];
  selectedClub: Club | null;
  onSelectClub: (club: Club) => void;
  userLocation: { lat: number; lng: number } | null;
  onBoundsChange?: (bounds: { north: number; south: number; east: number; west: number }) => void;
  initialCenter?: [number, number];
  interestedClubIds?: Set<string>;
};

export function ClubMapView({ clubs, selectedClub, onSelectClub, userLocation, onBoundsChange, initialCenter, interestedClubIds }: ClubMapViewProps) {
  const { t } = useLanguage();
  const defaultCenter: [number, number] = initialCenter || [48.8566, 2.3522];

  const groupedClubs = clubs.reduce((acc, club) => {
    const key = `${club.lat.toFixed(6)},${club.lng.toFixed(6)}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(club);
    return acc;
  }, {} as Record<string, Club[]>);

  return (
    <div className="h-full w-full relative z-0">
      <MapContainer
        center={defaultCenter}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapUpdater selectedClub={selectedClub} defaultCenter={defaultCenter} defaultZoom={12} />

        {onBoundsChange && <MapBoundsHandler onBoundsChange={onBoundsChange} />}

        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={new L.DivIcon({
              className: 'bg-transparent',
              html: '<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>'
            })}
          >
            <Popup>{t('clubs.map.youAreHere')}</Popup>
          </Marker>
        )}

        {Object.entries(groupedClubs).map(([key, clubsAtLocation]) => {
          const [lat, lng] = key.split(',').map(Number);
          const isMultiple = clubsAtLocation.length > 1;
          const hasInterestedClub = clubsAtLocation.some(club =>
            interestedClubIds?.has(club.club_id)
          );
          const markerIcon = hasInterestedClub ? iconClubInterested : iconClub;

          return (
            <Marker
              key={key}
              position={[lat, lng]}
              icon={markerIcon}
              eventHandlers={{
                click: () => {
                  if (!isMultiple) {
                    onSelectClub(clubsAtLocation[0]);
                  }
                },
              }}
            >
              <Popup maxWidth={300}>
                {isMultiple ? (
                  <div className="space-y-2">
                    <div className="text-sm font-semibold mb-2">
                      {t('clubs.map.clubsAtLocation').replace('{n}', String(clubsAtLocation.length))}
                    </div>
                    {clubsAtLocation.map((club) => (
                      <div
                        key={club.id}
                        className="border-b last:border-b-0 pb-2 last:pb-0 cursor-pointer hover:bg-gray-50 p-1 rounded"
                        onClick={() => onSelectClub(club)}
                      >
                        <div className="text-sm font-semibold">{club.nom}</div>
                        <div className="text-xs text-gray-500">{club.ville}</div>
                        {club.address && (
                          <div className="text-xs text-gray-400 mt-1">{club.address}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div>
                    <div className="text-sm font-semibold">{clubsAtLocation[0].nom}</div>
                    <div className="text-xs text-gray-500">{clubsAtLocation[0].ville}</div>
                    {clubsAtLocation[0].address && (
                      <div className="text-xs text-gray-400 mt-1">{clubsAtLocation[0].address}</div>
                    )}
                  </div>
                )}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
