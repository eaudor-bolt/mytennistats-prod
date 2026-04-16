import { Calendar, MapPin, Users, Mail, Phone, ExternalLink, Plus } from 'lucide-react';
import { Tournament, UserPlayer, TournamentRegistration, Convocation } from '../lib/supabase';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { usePlayers } from '../contexts/PlayersContext';
import { useAuth } from '../contexts/AuthContext';
import { useTournamentData } from '../contexts/TournamentDataContext';
import { ConvocationsList } from './ConvocationsList';
import { trackTournamentAction } from '../utils/analytics';

type TournamentCardProps = {
  tournament: Tournament;
  isSelected: boolean;
  onClick: () => void;
  onRegistrationChange?: () => void;
};

export function TournamentCard({ tournament, isSelected, onClick, onRegistrationChange }: TournamentCardProps) {
  const { players } = usePlayers();
  const { user } = useAuth();
  const { registrations: allRegistrations, convocations: allConvocations, refreshData } = useTournamentData();

  const registrations = allRegistrations.filter(r => r.tournament_id === tournament.id);

  // For placeholder tournaments, try to match by event_code instead of ID
  const convocations = tournament.id.startsWith('placeholder-')
    ? allConvocations.filter(c =>
        tournament.id === `placeholder-${c.id}` || c.event_code === tournament.event_code
      )
    : allConvocations.filter(c => c.tournament_id === tournament.id);

  const handleDeleteConvocation = async (convocationId: string) => {
    const { error } = await supabase
      .from('convocations')
      .delete()
      .eq('id', convocationId);

    if (!error) {
      trackTournamentAction('unregister', tournament.id, { convocation_id: convocationId });
      await refreshData();
    }
  };

  const toggleRegistration = async (playerId: string) => {
    if (!user) return;

    const existing = registrations.find(r => r.player_id === playerId);

    if (existing) {
      if (!existing.paid) {
        const { error } = await supabase
          .from('tournament_registrations')
          .update({ paid: true })
          .eq('id', existing.id);

        if (!error) {
          trackTournamentAction('register', tournament.id, { player_id: playerId, paid: true });
          await refreshData();
          if (onRegistrationChange) onRegistrationChange();
        }
      } else {
        const { error } = await supabase
          .from('tournament_registrations')
          .delete()
          .eq('id', existing.id);

        if (!error) {
          trackTournamentAction('unregister', tournament.id, { player_id: playerId });
          await refreshData();
          if (onRegistrationChange) onRegistrationChange();
        }
      }
    } else {
      const { error } = await supabase
        .from('tournament_registrations')
        .insert({
          user_id: user.id,
          tournament_id: tournament.id,
          player_id: playerId,
          paid: false
        })
        .select()
        .single();

      if (!error) {
        trackTournamentAction('register', tournament.id, { player_id: playerId, paid: false });
        await refreshData();
        if (onRegistrationChange) onRegistrationChange();
      }
    }
  };

  const isPlayerRegistered = (playerId: string) => {
    return registrations.some(r => r.player_id === playerId);
  };

  const getPlayerRegistration = (playerId: string) => {
    return registrations.find(r => r.player_id === playerId);
  };

  const getRegistrationTicks = (playerId: string) => {
    const registration = getPlayerRegistration(playerId);
    if (!registration) return '';
    return registration.paid ? '✓✓' : '✓';
  };

  const getRegisteredPlayers = () => {
    return players.filter(p => isPlayerRegistered(p.id));
  };

  const hasRegistrations = registrations.length > 0;

  const getPlayerColor = (index: number) => {
    const colors = [
      { name: 'blue', border: '#3b82f6', bg: '#eff6ff', text: '#3b82f6' },
      { name: 'orange', border: '#f97316', bg: '#fff7ed', text: '#f97316' },
      { name: 'red', border: '#ef4444', bg: '#fef2f2', text: '#ef4444' },
      { name: 'purple', border: '#8b5cf6', bg: '#f5f3ff', text: '#8b5cf6' },
      { name: 'green', border: '#10b981', bg: '#ecfdf5', text: '#10b981' },
    ];
    return colors[index % colors.length];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const createGoogleCalendarLink = () => {
    const title = encodeURIComponent(tournament.organizer);

    let detailsText = `Tournoi: ${tournament.title}\nOrganisateur: ${tournament.organizer}\nCode: ${tournament.event_code}`;

    if (tournament.judge_arbitrator) {
      detailsText += `\n\nJuge Arbitre: ${tournament.judge_arbitrator}`;
    }

    if (tournament.venue_phone) {
      detailsText += `\nTéléphone: ${tournament.venue_phone}`;
    }

    if (tournament.venue_address) {
      detailsText += `\n\nLieu: ${tournament.venue_address}\n${tournament.venue_postal_code} ${tournament.venue_city}`;
    } else if (tournament.venue_city) {
      detailsText += `\n\nLieu: ${tournament.venue_city}`;
    }

    const details = encodeURIComponent(detailsText);

    const locationParts = [];
    if (tournament.venue_address) locationParts.push(tournament.venue_address);
    if (tournament.venue_postal_code) locationParts.push(tournament.venue_postal_code);
    if (tournament.venue_city) locationParts.push(tournament.venue_city);
    const location = encodeURIComponent(locationParts.join(', ') || tournament.organizer);

    const startDate = tournament.start_date.replace(/-/g, '');
    const endDate = tournament.end_date.replace(/-/g, '');

    return `https://calendar.google.com/calendar/u/0/r/eventedit?text=${title}&details=${details}&location=${location}&dates=${startDate}T090000Z/${endDate}T090000Z&ctz=Europe/Paris`;
  };

  const createOuvertureReminderLink = () => {
    const title = encodeURIComponent(`RAPPEL: ${tournament.organizer}`);

    let detailsText = `Ouverture des inscriptions\n\nTournoi: ${tournament.title}\nOrganisateur: ${tournament.organizer}\nCode: ${tournament.event_code}`;

    detailsText += `\n\nDates du tournoi: ${formatDate(tournament.start_date)} - ${formatDate(tournament.end_date)}`;

    if (tournament.judge_arbitrator) {
      detailsText += `\n\nJuge Arbitre: ${tournament.judge_arbitrator}`;
    }

    if (tournament.contact_email) {
      detailsText += `\nEmail: ${tournament.contact_email}`;
    }

    if (tournament.venue_phone) {
      detailsText += `\nTéléphone: ${tournament.venue_phone}`;
    }

    if (tournament.venue_address) {
      detailsText += `\n\nLieu: ${tournament.venue_address}\n${tournament.venue_postal_code} ${tournament.venue_city}`;
    } else if (tournament.venue_city) {
      detailsText += `\n\nLieu: ${tournament.venue_city}`;
    }

    if (tournament.surface) {
      detailsText += `\n\nSurface: ${tournament.surface}`;
    }

    detailsText += `\n\nPrix: ${tournament.cash_prize}€`;
    if (tournament.prizes_lots > 0) {
      detailsText += ` | Lots: ${tournament.prizes_lots}€`;
    }

    if (tournament.categories && tournament.categories.length > 0) {
      detailsText += `\n\nCatégories:\n${tournament.categories.map(cat => `- (${cat.category}) ${cat.event}: ${cat.fees_kid}`).join('\n')}`;
    }

    detailsText += `\n\nLien TenUp: https://tenup.fft.fr/tournoi/${tournament.event_code.slice(-6)}`;

    const details = encodeURIComponent(detailsText);

    const locationParts = [];
    if (tournament.venue_address) locationParts.push(tournament.venue_address);
    if (tournament.venue_postal_code) locationParts.push(tournament.venue_postal_code);
    if (tournament.venue_city) locationParts.push(tournament.venue_city);
    const location = encodeURIComponent(locationParts.join(', ') || tournament.organizer);

    const ouvertureDate = tournament.date_ouverture_inscription!.replace(/-/g, '');

    return `https://calendar.google.com/calendar/u/0/r/eventedit?text=${title}&details=${details}&location=${location}&dates=${ouvertureDate}T090000Z/${ouvertureDate}T100000Z&ctz=Europe/Paris`;
  };

  const createGoogleMapsLink = () => {
    const address = `${tournament.venue_address}, ${tournament.venue_postal_code} ${tournament.venue_city}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  };

  const getCategoryColor = (event: string, index: number) => {
    if (event.includes('Dames')) {
      const purpleShades = ['#8b5cf6', '#7c3aed', '#6d28d9'];
      return purpleShades[index % purpleShades.length];
    } else {
      const greenShades = ['#22c55e', '#16a34a', '#15803d', '#1da750'];
      return greenShades[index % greenShades.length];
    }
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white/5 backdrop-blur-md rounded-xl hover:shadow-2xl transition-all duration-300 overflow-hidden border relative cursor-pointer ${
        hasRegistrations ? 'border-2' : 'border'
      } ${
        isSelected ? 'border-[#C8F135] shadow-lg shadow-[#C8F135]/20' : 'border-white/10 shadow-xl shadow-black/40'
      } hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/50`}
      style={hasRegistrations ? {
        borderColor: getPlayerColor(0).border,
        boxShadow: `0 0 20px ${getPlayerColor(0).border}`
      } : {}}
    >
      {hasRegistrations && (
        <div className="space-y-1 p-2 border-b border-white/10 bg-white/5">
          {getRegisteredPlayers().map((player, idx) => {
            const color = getPlayerColor(idx);
            const registration = getPlayerRegistration(player.id);
            const isPaid = registration?.paid || false;
            return (
              <div
                key={player.id}
                className="px-3 py-2 rounded-md font-semibold text-xs sm:text-sm flex items-center justify-between"
                style={{
                  borderLeft: `4px solid ${color.border}`,
                  backgroundColor: `${color.border}20`,
                  color: color.border
                }}
              >
                <span>{player.first_name} inscrit</span>
                {isPaid && (
                  <span className="ml-2 px-2 py-0.5 bg-[#C8F135] text-[#050d1a] text-xs rounded-full font-bold">
                    Paid
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="p-4 sm:p-6">
        <div className="mb-3">
          <h3 className="text-lg sm:text-xl font-bold text-white mb-1 leading-tight">{tournament.organizer}</h3>
          <hr className="border-white/10 my-2" />
          <div className="text-base sm:text-lg text-[#C8F135] font-semibold mb-1">{tournament.title}</div>
          <div className="text-xs sm:text-sm text-gray-400">Code: {tournament.event_code}</div>
        </div>

        <div className="flex gap-2 justify-center mb-3">
          <a
            href={`https://tenup.fft.fr/tournoi/${tournament.event_code.slice(-6)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-3 py-2 sm:px-4 bg-[#1A6FC4] hover:bg-[#1557a0] text-white text-xs sm:text-sm font-semibold rounded-md transition shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            TenUp
          </a>
          <a
            href={createGoogleCalendarLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-2 sm:px-4 bg-[#C8F135] hover:bg-[#b5d930] text-[#050d1a] text-xs sm:text-sm font-semibold rounded-md transition shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Add to Calendar</span>
            <span className="sm:hidden">Calendar</span>
          </a>
        </div>

        <ConvocationsList
          convocations={convocations}
          tournament={tournament}
          onDelete={handleDeleteConvocation}
        />

        <div className="space-y-2 mb-3">
          <div className="flex items-center text-gray-300 gap-2">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 text-[#C8F135]" />
            <span className="text-xs sm:text-sm">
              {formatDate(tournament.start_date)} - {formatDate(tournament.end_date)}
            </span>
          </div>

          {tournament.date_ouverture_inscription && (() => {
            const ouvertureDate = new Date(tournament.date_ouverture_inscription);
            const currentDate = new Date();
            const isPast = ouvertureDate > currentDate;
            const bgColor = isPast ? 'bg-red-500/10' : 'bg-emerald-500/10';
            const borderColor = isPast ? 'border-red-500' : 'border-emerald-500';
            const textColor = isPast ? 'text-red-400' : 'text-emerald-400';
            const iconColor = isPast ? 'text-red-500' : 'text-emerald-500';
            const hoverBg = isPast ? 'hover:bg-red-500' : 'hover:bg-emerald-500';

            return (
              <div className={`${bgColor} p-2 rounded-md border-l-2 ${borderColor}`}>
                <div className={`flex items-center ${textColor} gap-2 justify-between`}>
                  <div className="flex items-center gap-2">
                    <Calendar className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${iconColor}`} />
                    <span className="text-xs sm:text-sm font-medium">
                      Ouverture: {formatDate(tournament.date_ouverture_inscription)}
                    </span>
                  </div>
                  {isPast && (
                    <a
                      href={createOuvertureReminderLink()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex-shrink-0 p-1 rounded-full ${hoverBg} hover:text-white transition-colors`}
                      onClick={(e) => e.stopPropagation()}
                      title="Ajouter un rappel au calendrier"
                    >
                      <Plus className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            );
          })()}

          {tournament.judge_arbitrator && (
            <div className="flex items-center text-gray-300 gap-2">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 text-[#C8F135]" />
              <span className="text-xs sm:text-sm">Juge: {tournament.judge_arbitrator}</span>
            </div>
          )}

          {tournament.contact_email && (
            <div className="flex items-center text-gray-300 gap-2">
              <Mail className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 text-[#C8F135]" />
              <a
                href={`mailto:${tournament.contact_email}`}
                className="text-xs sm:text-sm text-[#1A6FC4] hover:text-[#C8F135] hover:underline truncate transition"
                onClick={(e) => e.stopPropagation()}
              >
                {tournament.contact_email}
              </a>
            </div>
          )}

          {tournament.venue_phone && (
            <div className="flex items-center text-gray-300 gap-2">
              <Phone className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 text-[#C8F135]" />
              <a
                href={`tel:${tournament.venue_phone}`}
                className="text-xs sm:text-sm text-[#1A6FC4] hover:text-[#C8F135] hover:underline transition"
                onClick={(e) => e.stopPropagation()}
              >
                {tournament.venue_phone}
              </a>
            </div>
          )}

          {tournament.venue_address && (
            <div className="flex items-start text-gray-300 gap-2">
              <MapPin className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5 text-[#C8F135]" />
              <div className="flex-1">
                <span className="text-xs sm:text-sm whitespace-pre-line">
                  {tournament.venue_address}
                  <br />
                  {tournament.venue_postal_code} - {tournament.venue_city}
                </span>
                <a
                  href={createGoogleMapsLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#1A6FC4] hover:text-[#C8F135] hover:underline text-xs sm:text-sm ml-2 transition"
                  onClick={(e) => e.stopPropagation()}
                  title="Ouvrir dans Google Maps"
                >
                  <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4" />
                </a>
              </div>
            </div>
          )}

          {tournament.surface && (
            <div className="flex gap-2">
              <span className="inline-block px-2 py-1 sm:px-3 bg-white/10 text-gray-300 text-xs sm:text-sm rounded-md border border-white/20">
                {tournament.surface}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between text-white pt-1">
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl font-bold text-[#C8F135]">{tournament.cash_prize}€</span>
            </div>
            {tournament.prizes_lots > 0 && (
              <div className="text-xs sm:text-sm text-gray-400">Lots: {tournament.prizes_lots}€</div>
            )}
          </div>
        </div>

        {tournament.categories && tournament.categories.length > 0 && (
          <div className="mt-2 pt-2 border-t border-white/10">
            <h4 className="font-semibold text-white mb-2 text-xs sm:text-sm">Catégories disponibles:</h4>
            <div className="flex flex-wrap gap-2 mb-2">
              {tournament.categories.map((cat, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-xs font-medium shadow-lg min-h-[32px]"
                  style={{
                    backgroundColor: getCategoryColor(cat.event, idx),
                  }}
                >
                  <span className="font-bold whitespace-nowrap">({cat.category})</span>
                  <span className="whitespace-nowrap">{cat.event}</span>
                  <span className="font-bold whitespace-nowrap ml-auto">{cat.fees_kid}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {players.map((player, idx) => {
                const colors = [
                  { text: '#3b82f6', border: '#3b82f6', hover: '#3b82f620' },
                  { text: '#f97316', border: '#f97316', hover: '#f9731620' },
                  { text: '#ef4444', border: '#ef4444', hover: '#ef444420' },
                  { text: '#8b5cf6', border: '#8b5cf6', hover: '#8b5cf620' },
                  { text: '#10b981', border: '#10b981', hover: '#10b98120' },
                ];
                const color = colors[idx % colors.length];
                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleRegistration(player.id);
                    }}
                    className="inscription-button"
                    style={{
                      color: isPlayerRegistered(player.id) ? 'white' : color.text,
                      borderColor: color.border,
                      backgroundColor: isPlayerRegistered(player.id) ? color.text : 'transparent',
                      fontWeight: '600',
                    }}
                    onMouseEnter={(e) => {
                      if (!isPlayerRegistered(player.id)) {
                        e.currentTarget.style.backgroundColor = color.hover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = isPlayerRegistered(player.id) ? color.text : 'transparent';
                    }}
                  >
                    Inscription {player.first_name} {getRegistrationTicks(player.id)}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 pt-2 border-t border-white/10 text-xs text-gray-400 space-y-1">
              <div>✅ inscription faite (liste d'attente)</div>
              <div>✅✅ inscription faite et payée</div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
