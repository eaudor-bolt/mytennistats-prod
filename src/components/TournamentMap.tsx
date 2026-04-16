import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Tournament, TournamentRegistration } from '../lib/supabase';
import { useState, useEffect, useRef } from 'react';

type TournamentMapProps = {
  tournaments: Tournament[];
  selectedTournament: string | null;
  onSelectTournament: (id: string) => void;
  onOpenTournamentModal?: (tournament: Tournament) => void;
  registrations?: TournamentRegistration[];
  userLocation?: { lat: number; lng: number } | null;
};

type TournamentsByLocation = {
  latitude: number;
  longitude: number;
  tournaments: Tournament[];
};

const iconDefault = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const iconRegistered = new L.Icon({
  iconUrl: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iNDEiIHZpZXdCb3g9IjAgMCAyNSA0MSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIuNSwwIEMyMCwwIDI1LDYgMjUsMTMuNSBDMjUsMjEgMTIuNSw0MSAxMi41LDQxIEMxMi41LDQxIDAsIDIxIDAsIDEzLjUgQzAsIDYgNSwgMCAxMi41LDAgWiIgZmlsbD0iIzAwNkQzMiIvPjwvc3ZnPg==",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const groupTournamentsByLocation = (tournaments: Tournament[]): TournamentsByLocation[] => {
  const locationMap = new Map<string, Tournament[]>();

  tournaments.forEach((tournament) => {
    if (tournament.latitude && tournament.longitude) {
      const key = `${Number(tournament.latitude).toFixed(6)},${Number(tournament.longitude).toFixed(6)}`;
      if (!locationMap.has(key)) {
        locationMap.set(key, []);
      }
      locationMap.get(key)!.push(tournament);
    }
  });

  return Array.from(locationMap.entries()).map(([key, tournaments]) => {
    const [lat, lng] = key.split(',').map(Number);
    return {
      latitude: lat,
      longitude: lng,
      tournaments: tournaments.sort((a, b) => a.start_date.localeCompare(b.start_date)),
    };
  });
};

const getIconForLocation = (tournaments: Tournament[], registrations: TournamentRegistration[] = []): L.Icon => {
  const tournamentIds = tournaments.filter(t => t && t.id).map(t => t.id);
  const locationRegistrations = registrations.filter(reg => reg && reg.tournament_id && tournamentIds.includes(reg.tournament_id));

  if (locationRegistrations.length > 0) {
    return iconRegistered;
  }

  return iconDefault;
};

function MapController({
  selectedTournament,
  tournaments,
  userLocation,
  defaultCenter,
  defaultZoom,
}: {
  selectedTournament: string | null;
  tournaments: Tournament[];
  userLocation?: { lat: number; lng: number } | null;
  defaultCenter: [number, number];
  defaultZoom: number;
}) {
  const map = useMap();
  const prevTournamentIdRef = useRef<string | null>(null);
  const hadSelectionRef = useRef(false);

  useEffect(() => {
    if (selectedTournament && prevTournamentIdRef.current !== selectedTournament) {
      const tournament = tournaments.find(t => t.id === selectedTournament);
      if (!tournament || !tournament.latitude || !tournament.longitude) return;

      const lat = Number(tournament.latitude);
      const lng = Number(tournament.longitude);
      if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return;

      try {
        map.flyTo([lat, lng], 12);
      } catch (error) {
        console.error('Error moving to tournament location:', error);
      }
      prevTournamentIdRef.current = selectedTournament;
      hadSelectionRef.current = true;
    } else if (!selectedTournament && hadSelectionRef.current) {
      map.flyTo(defaultCenter, defaultZoom);
      prevTournamentIdRef.current = null;
      hadSelectionRef.current = false;
    }
  }, [selectedTournament, map, defaultCenter, defaultZoom, tournaments, userLocation]);

  return null;
}

function PopupContent({
  tournaments,
  hoveredTournamentId,
  setHoveredTournamentId,
  onSelectTournament,
  onOpenTournamentModal,
  formatDate,
}: {
  tournaments: Tournament[];
  hoveredTournamentId: string | null;
  setHoveredTournamentId: (id: string | null) => void;
  onSelectTournament: (id: string) => void;
  onOpenTournamentModal?: (tournament: Tournament) => void;
  formatDate: (date: string) => string;
}) {
  return (
    <div style={{ padding: '10px', maxWidth: '280px' }}>
      <h4 style={{
        margin: '0 0 8px 0',
        color: '#1f2937',
        fontSize: '14px',
        fontWeight: 'bold'
      }}>
        {tournaments.length} tournoi{tournaments.length > 1 ? 's' : ''}
      </h4>

      <div style={{
        maxHeight: '330px',
        overflowY: 'auto',
        overflowX: 'hidden',
        paddingRight: '4px'
      }}>
        {tournaments.map((tournament) => (
          <div
            key={tournament.id}
            style={{
              padding: '8px',
              margin: '4px 0',
              borderLeft: '3px solid #16a34a',
              background: hoveredTournamentId === tournament.id ? '#e5e7eb' : '#f9fafb',
              cursor: 'pointer',
              transition: 'background 0.2s',
              borderRadius: '4px',
            }}
            onMouseEnter={() => setHoveredTournamentId(tournament.id)}
            onMouseLeave={() => setHoveredTournamentId(null)}
            onClick={() => {
              const lat = Number(tournament.latitude);
              const lng = Number(tournament.longitude);

              if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                onSelectTournament(tournament.id);
              }

              if (onOpenTournamentModal) {
                onOpenTournamentModal(tournament);
              }
            }}
          >
            <div style={{
              fontWeight: 600,
              fontSize: '12px',
              color: '#1f2937',
              marginBottom: '2px'
            }}>
              {tournament.organizer}
            </div>
            <div style={{
              fontSize: '11px',
              color: '#6b7280'
            }}>
              {formatDate(tournament.start_date)} - {formatDate(tournament.end_date)}
            </div>
            {tournament.venue_city && (
              <div style={{
                fontSize: '10px',
                color: '#9ca3af',
                marginTop: '2px'
              }}>
                {tournament.venue_city}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TournamentMap({
  tournaments,
  selectedTournament,
  onSelectTournament,
  onOpenTournamentModal,
  registrations = [],
  userLocation,
}: TournamentMapProps) {
  const [hoveredTournamentId, setHoveredTournamentId] = useState<string | null>(null);

  const validTournaments = tournaments.filter(t =>
    t.latitude && t.longitude &&
    !isNaN(Number(t.latitude)) && !isNaN(Number(t.longitude))
  );

  const defaultCenter: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : [48.8566, 2.3522];

  const defaultZoom = userLocation ? 12 : 6;

  if (validTournaments.length === 0) {
    return (
      <div className="w-full h-full relative z-0 max-w-full overflow-hidden">
        <MapContainer
          center={defaultCenter}
          zoom={defaultZoom}
          style={{ width: '100%', height: '100%', borderRadius: '0.75rem', maxWidth: '100%' }}
          className="shadow-lg"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            maxZoom={19}
          />
          {userLocation && (
            <Marker
              position={[userLocation.lat, userLocation.lng]}
              icon={new L.DivIcon({
                className: 'bg-transparent',
                html: '<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>'
              })}
            >
              <Popup>Vous etes ici</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
    );
  }

  const locationGroups = groupTournamentsByLocation(validTournaments);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  return (
    <div className="w-full h-full relative z-0 max-w-full overflow-hidden">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ width: '100%', height: '100%', borderRadius: '0.75rem', maxWidth: '100%' }}
        className="shadow-lg"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />

        <MapController
          selectedTournament={selectedTournament}
          tournaments={validTournaments}
          userLocation={userLocation}
          defaultCenter={defaultCenter}
          defaultZoom={defaultZoom}
        />

        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={new L.DivIcon({
              className: 'bg-transparent',
              html: '<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>'
            })}
          >
            <Popup>Vous etes ici</Popup>
          </Marker>
        )}

        {locationGroups.map((group, groupIdx) => (
          <Marker
            key={`${group.latitude}-${group.longitude}-${groupIdx}`}
            position={[group.latitude, group.longitude]}
            icon={getIconForLocation(group.tournaments, registrations)}
            eventHandlers={{
              click: () => {
                if (group.tournaments.length > 0) {
                  onSelectTournament(group.tournaments[0].id);
                }
              }
            }}
          >
            <Popup closeButton={true} maxWidth={320}>
              <PopupContent
                tournaments={group.tournaments}
                hoveredTournamentId={hoveredTournamentId}
                setHoveredTournamentId={setHoveredTournamentId}
                onSelectTournament={onSelectTournament}
                onOpenTournamentModal={onOpenTournamentModal}
                formatDate={formatDate}
              />
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
