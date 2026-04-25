import { Calendar, Trash2 } from 'lucide-react';
import { Convocation, Tournament } from '../lib/supabase';

type ConvocationsListProps = {
  convocations: Convocation[];
  tournament: Tournament;
  onDelete?: (convocationId: string) => void;
};

export function ConvocationsList({ convocations, tournament, onDelete }: ConvocationsListProps) {
  if (!convocations || convocations.length === 0) {
    return null;
  }

  const getPlayerColor = (player: string) => {
    const playerLower = player.toLowerCase();
    switch (playerLower) {
      case 'ida':
        return { border: '#3b82f6', bg: '#eff6ff', text: '#3b82f6' };
      case 'ruben':
        return { border: '#f97316', bg: '#fff7ed', text: '#f97316' };
      case 'papa':
        return { border: '#ef4444', bg: '#fef2f2', text: '#ef4444' };
      default:
        return { border: '#6b7280', bg: '#f9fafb', text: '#6b7280' };
    }
  };

  const createGoogleCalendarUrl = (convocation: Convocation) => {
    try {
      console.log(convocation)
      const convDate = new Date(convocation.convocation_date + 'T' + convocation.convocation_time);

      const year = convDate.getFullYear();
      const month = String(convDate.getMonth() + 1).padStart(2, '0');
      const day = String(convDate.getDate()).padStart(2, '0');
      const hours = String(convDate.getHours()).padStart(2, '0');
      const minutes = String(convDate.getMinutes()).padStart(2, '0');

      const startDateStr = `${year}${month}${day}T${hours}${minutes}00`;
      const endDate = new Date(convDate.getTime() + 2 * 60 * 60 * 1000);
      const endYear = endDate.getFullYear();
      const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
      const endDay = String(endDate.getDate()).padStart(2, '0');
      const endHours = String(endDate.getHours()).padStart(2, '0');
      const endMinutes = String(endDate.getMinutes()).padStart(2, '0');
      const endDateStr = `${endYear}${endMonth}${endDay}T${endHours}${endMinutes}00`;

      const title = `Convocation ${convocation.player_name} - ${tournament.organizer}`;

      let details = `Tournoi: ${tournament.title || tournament.organizer}\nOrganisateur: ${tournament.organizer}\nDate: ${convDate.toLocaleDateString('fr-FR')}\nHeure: ${convocation.convocation_time}`;

      if (convocation.judge_arbitrator) {
        details += `\n\nJuge Arbitre: ${convocation.judge_arbitrator}`;
      }

      if (convocation.phone) {
        details += `\nTéléphone: ${convocation.phone}`;
      }

      const cityLine =
  tournament.postal_code && tournament.venue_city
    ? `${tournament.postal_code} ${tournament.venue_city}`
    : undefined;
      const location =
  convocation.location ||
  tournament.venue_address ||
  cityLine ||
  tournament.organizer;
      
      //const location = convocation.location || tournament.venue_address || tournament.venue_city || tournament.organizer;

      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startDateStr}/${endDateStr}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}&ctz=Europe/Paris`;
    } catch (error) {
      console.error('Error creating Google Calendar URL:', error);
      return '#';
    }
  };

  return (
    <div className="space-y-2 mt-4 pt-4 border-t border-gray-200">
      <h4 className="text-sm font-semibold text-gray-700 mb-2">Convocations</h4>
      {convocations.map((convocation) => {
        const color = getPlayerColor(convocation.player_name);
        const convDate = new Date(convocation.convocation_date);
        const dateStr = convDate.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: 'short',
        });

        return (
          <div
            key={convocation.id}
            className="flex items-center justify-between p-3 rounded-lg gap-2"
            style={{
              borderLeft: `4px solid ${color.border}`,
              backgroundColor: color.bg,
            }}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span
                className="font-semibold text-sm"
                style={{ color: color.text }}
              >
                {convocation.player_name}
              </span>
              <span className="text-xs text-gray-600">
                {dateStr} • {convocation.convocation_time}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <a
                href={createGoogleCalendarUrl(convocation)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-md transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Calendar size={14} />
                <span>Calendrier</span>
              </a>
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Supprimer la convocation de ${convocation.player_name} ?`)) {
                      onDelete(convocation.id);
                    }
                  }}
                  className="inline-flex items-center justify-center p-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
                  title="Supprimer la convocation"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
