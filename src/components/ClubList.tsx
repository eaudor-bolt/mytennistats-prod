import { useState, useEffect, useMemo } from 'react';
import { MessageSquare, MapPin, Activity, Navigation, Send, Users, Phone, Mail, MapPinned, Tv, Wifi, Shirt, Droplets, Car, Dumbbell, Home, WashingMachine, Coffee, UtensilsCrossed, Baby, DoorOpen, Waves, Sun, Zap } from 'lucide-react';
import { Club, ClubComment, supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';

type Bilingual = { fr: string; en: string };

function translateLookup(map: Record<string, Bilingual>, value: string, language: 'fr' | 'en'): string {
  const entry = map[value];
  return entry ? entry[language] : value;
}

const SURFACE_TRANSLATIONS: Record<string, Bilingual> = {
  'Terre battue traditionnelle': { fr: 'Terre battue traditionnelle', en: 'Traditional Clay' },
  'Gazon synthétique': { fr: 'Gazon synthétique', en: 'Synthetic Grass' },
  'Béton poreux': { fr: 'Béton poreux', en: 'Porous Concrete' },
  'Enrobé poreux': { fr: 'Enrobé poreux', en: 'Porous Asphalt' },
};

const FONCTION_TRANSLATIONS: Record<string, Bilingual> = {
  'Président': { fr: 'Président', en: 'President' },
  'Président d Honneur': { fr: 'Président d Honneur', en: 'Honorary President' },
  'Vice-Président': { fr: 'Vice-Président', en: 'Vice President' },
  'Secrétaire': { fr: 'Secrétaire', en: 'Secretary' },
  'Secrétaire Général': { fr: 'Secrétaire Général', en: 'Secretary General' },
  'Secrétaire Général Adjoint': { fr: 'Secrétaire Général Adjoint', en: 'Deputy Secretary General' },
  'Trésorier Général': { fr: 'Trésorier Général', en: 'Treasurer General' },
  'Correspondant': { fr: 'Correspondant', en: 'Correspondent' },
  'Membre': { fr: 'Membre', en: 'Member' },
  'Directeur': { fr: 'Directeur', en: 'Director' },
  'Directeur Sportif': { fr: 'Directeur Sportif', en: 'Sports Director' },
  'Entraîneur': { fr: 'Entraîneur', en: 'Coach' },
  'Enseignant tous publics': { fr: 'Enseignant tous publics', en: 'General Instructor' },
  'Enseignant auprès des adultes': { fr: 'Enseignant auprès des adultes', en: 'Adult Instructor' },
  'Enseignant auprès des jeunes': { fr: 'Enseignant auprès des jeunes', en: 'Youth Instructor' },
  'Assistant Moniteur': { fr: 'Assistant Moniteur', en: 'Assistant Instructor' },
  'CQP Stagiaire': { fr: 'CQP Stagiaire', en: 'CQP Trainee' },
  'DE stagiaire': { fr: 'DE stagiaire', en: 'DE Trainee' },
  'Stagiaire': { fr: 'Stagiaire', en: 'Trainee' },
  'Responsable Administratif': { fr: 'Responsable Administratif', en: 'Administrative Manager' },
  'Responsable Compétition': { fr: 'Responsable Compétition', en: 'Competition Manager' },
  'Responsable Ecole de Tennis': { fr: 'Responsable Ecole de Tennis', en: 'Tennis School Manager' },
  'Responsable Tennis Féminin': { fr: 'Responsable Tennis Féminin', en: "Women's Tennis Manager" },
  'Référent PADEL': { fr: 'Référent PADEL', en: 'Padel Coordinator' },
  'Bénévole administration': { fr: 'Bénévole administration', en: 'Administrative Volunteer' },
  'Bénévole animation': { fr: 'Bénévole animation', en: 'Activities Volunteer' },
  'Webmaster': { fr: 'Webmaster', en: 'Webmaster' },
};

const EQUIPMENT_TRANSLATIONS: Record<string, Bilingual> = {
  'Télévision': { fr: 'Télévision', en: 'Television' },
  'Wifi': { fr: 'Wifi', en: 'Wifi' },
  'Vestiaires': { fr: 'Vestiaires', en: 'Changing Rooms' },
  'Douches': { fr: 'Douches', en: 'Showers' },
  'Parking': { fr: 'Parking', en: 'Parking' },
  'Salle de sport': { fr: 'Salle de sport', en: 'Sports Hall' },
  'Club House': { fr: 'Club House', en: 'Clubhouse' },
  'Sanitaires': { fr: 'Sanitaires', en: 'Restrooms' },
  'Terrains': { fr: 'Terrains', en: 'Courts' },
};

type FilterState = {
  minCourts: number;
  surface: string | 'All';
  distance: number;
  clubName: string;
  indoorOnly: boolean;
  pickleballOnly: boolean;
  padelOnly: boolean;
  interestedOnly: boolean;
};

type ClubListProps = {
  clubs: Club[];
  selectedClub: Club | null;
  onSelectClub: (club: Club | null) => void;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  userLocation: { lat: number; lng: number } | null;
  interestedClubIds: Set<string>;
  onInterestedChange: (clubId: string, isInterested: boolean) => void;
};

function getEquipmentIcon(equipmentName: string) {
  const name = equipmentName.toLowerCase();
  if (name.includes('télé') || name.includes('tv')) return Tv;
  if (name.includes('wifi') || name.includes('wi-fi')) return Wifi;
  if (name.includes('vestiaire')) return Shirt;
  if (name.includes('douche')) return Droplets;
  if (name.includes('parking')) return Car;
  if (name.includes('salle de sport') || name.includes('fitness') || name.includes('musculation')) return Dumbbell;
  if (name.includes('club house') || name.includes('clubhouse')) return Home;
  if (name.includes('sanitaire') || name.includes('toilette') || name.includes('wc')) return DoorOpen;
  if (name.includes('restaurant') || name.includes('bar') || name.includes('cafétéria')) return UtensilsCrossed;
  if (name.includes('piscine')) return Waves;
  if (name.includes('terrasse') || name.includes('solarium')) return Sun;
  if (name.includes('café') || name.includes('coffee')) return Coffee;
  if (name.includes('laverie') || name.includes('linge')) return WashingMachine;
  if (name.includes('garderie') || name.includes('enfant')) return Baby;
  return Activity;
}

export function ClubList({
  clubs,
  selectedClub,
  onSelectClub,
  filters,
  setFilters,
  userLocation,
  interestedClubIds,
  onInterestedChange
}: ClubListProps) {
  const { language, t } = useLanguage();
  const [newComment, setNewComment] = useState("");
  const [comments, setComments] = useState<ClubComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentCounts, setCommentCounts] = useState<{ [key: string]: number }>({});
  const [loadedClubIds, setLoadedClubIds] = useState<string>("");

  const availableSurfaces = useMemo(() => {
    const surfaces = new Set<string>();
    clubs.forEach(club => {
      if (club.surface) {
        surfaces.add(club.surface);
      }
    });
    return Array.from(surfaces).sort();
  }, [clubs]);

  useEffect(() => {
    const clubIds = clubs.map(c => c.club_id).sort().join(',');
    if (clubIds && clubIds !== loadedClubIds) {
      loadCommentCounts();
      setLoadedClubIds(clubIds);
    }
  }, [clubs, loadedClubIds]);

  useEffect(() => {
    if (selectedClub) {
      loadComments(selectedClub.club_id);
    }
  }, [selectedClub]);

  const loadCommentCounts = async () => {
    if (clubs.length === 0) return;

    const clubIds = clubs.map(c => c.club_id);
    const { data } = await supabase
      .from('club_comments')
      .select('club_id')
      .in('club_id', clubIds);

    if (data) {
      const counts: { [key: string]: number } = {};
      data.forEach((comment) => {
        counts[comment.club_id] = (counts[comment.club_id] || 0) + 1;
      });
      setCommentCounts(counts);
    }
  };

  const loadComments = async (clubId: string) => {
    setLoadingComments(true);
    const { data } = await supabase
      .from('club_comments')
      .select('*')
      .eq('club_id', clubId)
      .order('created_at', { ascending: false });

    setComments(data || []);
    setLoadingComments(false);
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClub || !newComment.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert(t('clubs.list.comments.mustBeLoggedIn'));
      return;
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .maybeSingle();

    const authorName = profile
      ? `${profile.first_name} ${profile.last_name}`
      : t('clubs.list.comments.fallbackAuthor');

    const { error } = await supabase
      .from('club_comments')
      .insert({
        club_id: selectedClub.club_id,
        user_id: user.id,
        author_name: authorName,
        text: newComment.trim()
      });

    if (error) {
      console.error('Error adding comment:', error);
      alert(t('clubs.list.comments.submitError'));
      return;
    }

    setNewComment("");
    await loadComments(selectedClub.club_id);
    await loadCommentCounts();
  };

  if (selectedClub) {
    return (
      <div className="h-full flex flex-col bg-gradient-to-b from-[#0a1526] to-[#050d1a] overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#0a1526]/80 backdrop-blur-md z-10 shadow-lg shadow-black/20 flex-shrink-0">
          <button
            onClick={() => onSelectClub(null)}
            className="text-[#C8F135] font-semibold hover:text-white hover:bg-white/5 flex items-center gap-2 text-base px-3 py-2 rounded-lg transition-all"
          >
            {t('clubs.list.detail.backButton')}
          </button>
          <h2 className="text-base font-bold text-white truncate max-w-[150px] md:max-w-[200px]">{selectedClub.nom}</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="bg-gradient-to-br from-[#1A6FC4]/10 to-[#C8F135]/5 p-4 border-b border-white/5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">{selectedClub.nom}</h1>
                <p className="text-gray-300 flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-[#C8F135]" /> {selectedClub.ville}
                </p>
                {selectedClub.address && (
                  <p className="text-gray-400 text-xs mt-1">
                    {selectedClub.address}
                  </p>
                )}
              </div>
              {selectedClub.surface && (
                <span className="bg-[#C8F135] text-[#050d1a] px-3 py-1 rounded-full text-xs font-bold shadow-lg shadow-[#C8F135]/20 border border-[#C8F135]/30">
                  {translateLookup(SURFACE_TRANSLATIONS, selectedClub.surface, language)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              {(selectedClub.tennis_courts > 0 || selectedClub.total_courts > 0) && (
                <div className="bg-white/5 backdrop-blur-sm p-3 rounded-lg border border-white/10 shadow-lg">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">{t('clubs.list.detail.statTennis')}</p>
                  <p className="font-semibold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#C8F135]" />
                    {selectedClub.tennis_courts || selectedClub.total_courts}
                    {(selectedClub.indoor_tennis_courts || 0) > 0 && (
                      <span className="text-xs font-normal text-[#1A6FC4]">{t('clubs.list.detail.indoorAbbr').replace('{n}', String(selectedClub.indoor_tennis_courts))}</span>
                    )}
                  </p>
                </div>
              )}
              {selectedClub.padel_courts > 0 && (
                <div className="bg-white/5 backdrop-blur-sm p-3 rounded-lg border border-white/10 shadow-lg">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">{t('clubs.list.detail.statPadel')}</p>
                  <p className="font-semibold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-red-400" />
                    {selectedClub.padel_courts}
                    {(selectedClub.indoor_padel_courts || 0) > 0 && (
                      <span className="text-xs font-normal text-[#1A6FC4]">{t('clubs.list.detail.indoorAbbr').replace('{n}', String(selectedClub.indoor_padel_courts))}</span>
                    )}
                  </p>
                </div>
              )}
              {selectedClub.pickle_courts > 0 && (
                <div className="bg-white/5 backdrop-blur-sm p-3 rounded-lg border border-white/10 shadow-lg">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">{t('clubs.list.detail.statPickleball')}</p>
                  <p className="font-semibold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-orange-400" />
                    {selectedClub.pickle_courts}
                    {(selectedClub.indoor_pickle_courts || 0) > 0 && (
                      <span className="text-xs font-normal text-[#1A6FC4]">{t('clubs.list.detail.indoorAbbr').replace('{n}', String(selectedClub.indoor_pickle_courts))}</span>
                    )}
                  </p>
                </div>
              )}
              <div className="bg-white/5 backdrop-blur-sm p-3 rounded-lg border border-white/10 shadow-lg">
                <p className="text-xs text-gray-400 uppercase tracking-wide">{t('clubs.list.detail.statDistance')}</p>
                <p className="font-semibold text-white flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-[#C8F135]" />
                  {selectedClub.calculatedDistance
                    ? `${selectedClub.calculatedDistance.toFixed(1)} km`
                    : 'N/A'}
                </p>
              </div>
            </div>

            {selectedClub.installations && selectedClub.installations.length > 0 && (
              <div className="mt-4 bg-white/5 backdrop-blur-sm p-3 rounded-lg border border-white/10 shadow-lg">
                <p className="font-medium mb-2 text-sm text-gray-200">{t('clubs.list.detail.installationsHeader')}</p>
                <div className="text-xs text-gray-300 space-y-3">
                  {selectedClub.installations.map((installation: any, idx: number) => (
                    <div key={idx} className="space-y-2">
                      {installation.nom && (
                        <p className="font-semibold text-white">{installation.nom}</p>
                      )}

                      {installation.surfaces && installation.surfaces.length > 0 && (
                        <div className="space-y-1">
                          <span className="font-medium text-gray-300">{t('clubs.list.detail.surfacesLabel')}</span>
                          {installation.surfaces.map((surface: any, sIdx: number) => {
                            const sportLabel = surface.pratique ? `${surface.pratique} - ` : '';
                            return (
                              <p key={sIdx} className="ml-4 text-gray-400 flex items-center gap-1.5">
                                <Activity className="w-3 h-3 text-[#C8F135] flex-shrink-0" />
                                {sportLabel}{surface.nbTerrains} {translateLookup(SURFACE_TRANSLATIONS, surface.libelle, language)}
                                {surface.nbTerrainsCouverts > 0 && ` (${surface.nbTerrainsCouverts} ${language === 'fr' ? 'couverts' : 'indoor'})`}
                              </p>
                            );
                          })}
                        </div>
                      )}

                      {installation.equipements && installation.equipements.length > 0 && (
                        <div className="space-y-1">
                          <span className="font-medium text-gray-300">{t('clubs.list.detail.equipmentsLabel')}</span>
                          <div className="ml-4 space-y-1">
                            {installation.equipements.map((equip: string, eIdx: number) => {
                              const IconComponent = getEquipmentIcon(equip);
                              return (
                                <div key={eIdx} className="flex items-center gap-1.5 text-gray-400">
                                  <IconComponent className="w-3 h-3 text-[#C8F135] flex-shrink-0" />
                                  <span>{translateLookup(EQUIPMENT_TRANSLATIONS, equip, language)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {installation.accessibilite && installation.accessibilite.length > 0 && (
                        <div className="space-y-1">
                          <span className="font-medium text-gray-300">{t('clubs.list.detail.accessibilityLabel')}</span>
                          <div className="ml-4 space-y-1">
                            {installation.accessibilite.map((acc: string, aIdx: number) => {
                              const IconComponent = getEquipmentIcon(acc);
                              return (
                                <div key={aIdx} className="flex items-center gap-1.5 text-gray-400">
                                  <IconComponent className="w-3 h-3 text-[#C8F135] flex-shrink-0" />
                                  <span>{translateLookup(EQUIPMENT_TRANSLATIONS, acc, language)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(selectedClub.address || selectedClub.telephone || selectedClub.email) && (
              <div className="mt-4 bg-white/5 backdrop-blur-sm p-3 rounded-lg border border-[#1A6FC4]/30 border-l-4 shadow-lg">
                <p className="font-medium mb-2 text-sm text-gray-200 flex items-center gap-2">
                  <MapPinned className="w-4 h-4 text-[#1A6FC4]" />
                  {t('clubs.list.detail.locationContactHeader')}
                </p>
                <div className="space-y-2 text-xs">
                  {selectedClub.address && (
                    <div className="flex items-start gap-2 text-gray-300">
                      <MapPin className="w-3 h-3 mt-0.5 text-[#C8F135] flex-shrink-0" />
                      <span>{selectedClub.address}</span>
                    </div>
                  )}
                  {selectedClub.telephone && (
                    <div className="flex items-center gap-2 text-gray-300">
                      <Phone className="w-3 h-3 text-[#C8F135] flex-shrink-0" />
                      <a href={`tel:${selectedClub.telephone}`} className="hover:text-[#1A6FC4] transition-colors">
                        {selectedClub.telephone}
                      </a>
                    </div>
                  )}
                  {selectedClub.email && (
                    <div className="flex items-center gap-2 text-gray-300">
                      <Mail className="w-3 h-3 text-[#C8F135] flex-shrink-0" />
                      <a href={`mailto:${selectedClub.email}`} className="hover:text-[#1A6FC4] transition-colors">
                        {selectedClub.email}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedClub.equipes && (() => {
              const dirigeanteTeam = selectedClub.equipes.find((eq: any) => eq.code === 'dirigeante');
              const pedagogiqueTeam = selectedClub.equipes.find((eq: any) => eq.code === 'pedagogique');

              const direction = dirigeanteTeam?.membres || [];
              const teachers = pedagogiqueTeam?.membres || [];

              if (direction.length === 0 && teachers.length === 0) return null;

              return (
                <div className="mt-4 bg-white/5 backdrop-blur-sm p-3 rounded-lg border border-[#C8F135]/30 border-l-4 shadow-lg">
                  <p className="font-medium mb-2 text-sm text-gray-200 flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#C8F135]" />
                    {t('clubs.list.detail.teamHeader')}
                  </p>

                  {direction.length > 0 && (
                    <div className="mb-3 pb-2 border-b border-white/10">
                      <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">{t('clubs.list.detail.directionHeader')}</p>
                      <div className="space-y-1">
                        {direction.map((member: any, idx: number) => (
                          <div key={idx} className="ml-4">
                            <div className="flex items-center gap-1 text-xs text-gray-300">
                              <span className="font-medium">{member.prenom} {member.nom}</span>
                              {member.fonctions && (
                                <span className="text-gray-400">
                                  ({(Array.isArray(member.fonctions) ? member.fonctions : [member.fonctions]).map((f: string) => translateLookup(FONCTION_TRANSLATIONS, f, language)).join(', ')})
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {teachers.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">{t('clubs.list.detail.teachersHeader')}</p>
                      <div className="space-y-1">
                        {teachers.map((teacher: any, idx: number) => (
                          <div key={idx} className="ml-4">
                            <div className="flex items-center gap-1 text-xs text-gray-300">
                              <span className="font-medium">{teacher.prenom} {teacher.nom}</span>
                              {teacher.fonctions && (
                                <span className="text-gray-400">
                                  ({(Array.isArray(teacher.fonctions) ? teacher.fonctions : [teacher.fonctions]).map((f: string) => translateLookup(FONCTION_TRANSLATIONS, f, language)).join(', ')})
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="mt-4 bg-white/5 backdrop-blur-sm p-3 rounded-lg border border-white/10 shadow-lg">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={interestedClubIds.has(selectedClub.club_id)}
                  onChange={(e) => onInterestedChange(selectedClub.club_id, e.target.checked)}
                  className="w-4 h-4 text-[#C8F135] bg-white/10 border-white/20 rounded focus:ring-[#C8F135] focus:ring-2"
                />
                <span className="text-sm font-medium text-gray-200">{t('clubs.list.interested')}</span>
              </label>
            </div>
          </div>

          <div className="p-4 bg-gradient-to-b from-[#0a1526]/50 to-[#050d1a]">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#C8F135]" />
              {t('clubs.list.comments.header')}
            </h3>

            <div className="space-y-4 mb-6">
              {loadingComments ? (
                <p className="text-gray-400 text-sm italic">{t('common.loading')}</p>
              ) : comments.length === 0 ? (
                <p className="text-gray-400 text-sm italic">{t('clubs.list.comments.empty')}</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="bg-white/5 backdrop-blur-sm p-3 rounded-lg border border-white/10">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-xs text-[#C8F135]">{c.author_name}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(c.created_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300">{c.text}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleCommentSubmit} className="relative sticky bottom-0 bg-[#050d1a]/90 backdrop-blur-md py-2">
              <input
                type="text"
                placeholder={t('clubs.list.comments.placeholder')}
                className="w-full pl-4 pr-12 py-3 bg-white/5 text-white placeholder-gray-400 rounded-full border border-white/10 focus:ring-2 focus:ring-[#C8F135] text-sm transition-all"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-[#C8F135] text-[#050d1a] rounded-full hover:bg-white transition-colors disabled:opacity-50 shadow-lg"
                disabled={!newComment.trim()}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-[#0a1526] to-[#050d1a] overflow-hidden">
      <div className="border-b border-white/10 bg-[#0a1526]/80 backdrop-blur-md shadow-lg shadow-black/20 z-10 flex-shrink-0 max-h-[40vh] md:max-h-none overflow-y-auto">
        <div className="p-4 sticky top-0 bg-[#0a1526]/95 backdrop-blur-md z-20">
          <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
            <Zap className="w-6 h-6 text-[#C8F135]" />
            {t('clubs.list.filters.heading')}
            <span className="text-sm font-normal text-gray-400 ml-auto">{t('clubs.list.filters.resultsCount').replace('{n}', String(clubs.length))}</span>
          </h2>
        </div>

        <div className="space-y-3 px-4 pb-4">
          <div>
            <input
              type="text"
              placeholder={t('clubs.list.filters.searchPlaceholder')}
              className="w-full bg-white/5 border border-white/10 text-white placeholder-gray-400 text-sm rounded-lg focus:ring-[#C8F135] focus:border-[#C8F135] block p-2.5"
              value={filters.clubName}
              onChange={(e) => setFilters(prev => ({ ...prev, clubName: e.target.value }))}
            />
          </div>

          <div className="flex gap-2">
            <select
              className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] outline-none transition-all bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
              value={filters.surface}
              onChange={(e) => setFilters(prev => ({ ...prev, surface: e.target.value }))}
            >
              <option value="All" class="bg-[#0a1628] text-gray-300">{t('clubs.list.filters.allSurfaces')}</option>
              {availableSurfaces.map(surface => (
                <option key={surface} value={surface} class="bg-[#0a1628] text-gray-300">{translateLookup(SURFACE_TRANSLATIONS, surface, language)}</option>
              ))}
            </select>

            <div className="flex-1 relative">
              <input
                type="number"
                min="0"
                placeholder={t('clubs.list.filters.minCourtsPlaceholder')}
                className="w-full bg-white/5 border border-white/10 text-white placeholder-gray-400 text-sm rounded-lg focus:ring-[#C8F135] focus:border-[#C8F135] block p-2.5"
                value={filters.minCourts || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, minCourts: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="indoorOnly"
                checked={filters.indoorOnly}
                onChange={(e) => setFilters(prev => ({ ...prev, indoorOnly: e.target.checked }))}
                className="w-4 h-4 text-[#C8F135] bg-white/10 border-white/20 rounded focus:ring-[#C8F135] focus:ring-2"
              />
              <label htmlFor="indoorOnly" className="ml-2 text-sm text-gray-300 cursor-pointer">
                {t('clubs.list.filters.indoorOnly')}
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="padelOnly"
                checked={filters.padelOnly}
                onChange={(e) => setFilters(prev => ({ ...prev, padelOnly: e.target.checked }))}
                className="w-4 h-4 text-[#C8F135] bg-white/10 border-white/20 rounded focus:ring-[#C8F135] focus:ring-2"
              />
              <label htmlFor="padelOnly" className="ml-2 text-sm text-gray-300 cursor-pointer">
                {t('clubs.list.filters.padelOnly')}
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="pickleballOnly"
                checked={filters.pickleballOnly}
                onChange={(e) => setFilters(prev => ({ ...prev, pickleballOnly: e.target.checked }))}
                className="w-4 h-4 text-[#C8F135] bg-white/10 border-white/20 rounded focus:ring-[#C8F135] focus:ring-2"
              />
              <label htmlFor="pickleballOnly" className="ml-2 text-sm text-gray-300 cursor-pointer">
                {t('clubs.list.filters.pickleballOnly')}
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="interestedOnly"
                checked={filters.interestedOnly}
                onChange={(e) => setFilters(prev => ({ ...prev, interestedOnly: e.target.checked }))}
                className="w-4 h-4 text-[#C8F135] bg-white/10 border-white/20 rounded focus:ring-[#C8F135] focus:ring-2"
              />
              <label htmlFor="interestedOnly" className="ml-2 text-sm text-gray-300 cursor-pointer">
                {t('clubs.list.interested')}
              </label>
            </div>
          </div>

          {clubs.length > 0 && (
            <div className="text-sm text-gray-300 bg-[#C8F135]/10 p-3 rounded-lg border border-[#C8F135]/30">
              <p className="font-medium">{(clubs.length === 1 ? t('clubs.list.filters.resultsSummarySingular') : t('clubs.list.filters.resultsSummaryPlural')).replace('{n}', String(clubs.length))}</p>
              <p className="text-xs mt-1 text-gray-400">{t('clubs.list.filters.allLocationsSortedByDistance')}</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-[#050d1a] to-[#0a1526]">
        {clubs.length > 0 ? clubs.map(club => {
          const hasComments = commentCounts[club.club_id] > 0;
          const isInterested = interestedClubIds.has(club.club_id);
          return (
            <div
              key={club.id}
              onClick={() => onSelectClub(club)}
              className={`bg-white/5 backdrop-blur-sm p-5 rounded-2xl shadow-lg border transition-all cursor-pointer group relative overflow-hidden ${
                isInterested
                  ? 'border-[#C8F135]/50 shadow-[#C8F135]/20 shadow-xl'
                  : 'border-white/10 hover:shadow-2xl hover:border-[#C8F135]/30 hover:bg-white/10'
              }`}
            >
              {isInterested && (
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#C8F135]/20 to-transparent rounded-bl-full" />
              )}

              <div className="flex justify-between items-start mb-3 relative">
                <div className="flex-1 min-w-0 pr-2">
                  <h3 className="font-bold text-lg text-white group-hover:text-[#C8F135] transition-colors line-clamp-2 mb-1">
                    {club.nom}
                  </h3>
                  <div className="flex items-center text-sm text-gray-300 gap-1.5">
                    <MapPin className="w-4 h-4 flex-shrink-0 text-[#C8F135]" />
                    <span className="line-clamp-1">{club.ville}</span>
                    {club.calculatedDistance && (
                      <span className="text-[#C8F135] font-semibold whitespace-nowrap">
                        • {club.calculatedDistance.toFixed(1)} km
                      </span>
                    )}
                  </div>
                </div>

                {hasComments && (
                  <div className="flex items-center gap-1.5 bg-[#C8F135]/20 px-2.5 py-1.5 rounded-lg border border-[#C8F135]/30">
                    <MessageSquare className="w-4 h-4 text-[#C8F135]" />
                    <span className="text-sm text-[#C8F135] font-semibold">{commentCounts[club.club_id]}</span>
                  </div>
                )}
              </div>

              {club.address && (
                <div className="flex items-start text-sm text-gray-400 mb-3 gap-2 bg-white/5 p-2.5 rounded-lg border border-white/5">
                  <MapPinned className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#1A6FC4]" />
                  <span className="line-clamp-1">{club.address}</span>
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                {club.surface && (
                  <span className="inline-flex items-center gap-1 bg-white/5 text-gray-300 text-xs px-3 py-1.5 rounded-full font-semibold border border-white/10">
                    <Activity className="w-3 h-3" />
                    {translateLookup(SURFACE_TRANSLATIONS, club.surface, language)}
                  </span>
                )}
                {(club.tennis_courts > 0 || club.total_courts > 0) && (
                  <span className="inline-flex items-center gap-1 bg-[#C8F135]/20 text-[#C8F135] text-xs px-3 py-1.5 rounded-full font-semibold border border-[#C8F135]/30">
                    <Zap className="w-3 h-3" />
                    {club.tennis_courts || club.total_courts} {t('clubs.list.card.tennisSuffix')}
                    {(club.indoor_tennis_courts || 0) > 0 && (
                      <>
                        <span className="hidden sm:inline">{t('clubs.list.card.indoorSuffixFull').replace('{n}', String(club.indoor_tennis_courts))}</span>
                        <span className="sm:hidden">{t('clubs.list.card.indoorSuffixShort').replace('{n}', String(club.indoor_tennis_courts))}</span>
                      </>
                    )}
                  </span>
                )}
                {club.padel_courts > 0 && (
                  <span className="inline-flex items-center gap-1 bg-red-500/20 text-red-400 text-xs px-3 py-1.5 rounded-full font-semibold border border-red-500/30">
                    <Activity className="w-3 h-3" />
                    {club.padel_courts} {t('clubs.list.card.padelSuffix')}
                    {(club.indoor_padel_courts || 0) > 0 && (
                      <>
                        <span className="hidden sm:inline">{t('clubs.list.card.indoorSuffixFull').replace('{n}', String(club.indoor_padel_courts))}</span>
                        <span className="sm:hidden">{t('clubs.list.card.indoorSuffixShort').replace('{n}', String(club.indoor_padel_courts))}</span>
                      </>
                    )}
                  </span>
                )}
                {club.pickle_courts > 0 && (
                  <span className="inline-flex items-center gap-1 bg-orange-500/20 text-orange-400 text-xs px-3 py-1.5 rounded-full font-semibold border border-orange-500/30">
                    <Activity className="w-3 h-3" />
                    {club.pickle_courts} {t('clubs.list.card.pickleSuffix')}
                    {(club.indoor_pickle_courts || 0) > 0 && (
                      <>
                        <span className="hidden sm:inline">{t('clubs.list.card.indoorSuffixFull').replace('{n}', String(club.indoor_pickle_courts))}</span>
                        <span className="sm:hidden">{t('clubs.list.card.indoorSuffixShort').replace('{n}', String(club.indoor_pickle_courts))}</span>
                      </>
                    )}
                  </span>
                )}
              </div>
            </div>
          );
        }) : (
          <div className="text-center py-16">
            <Zap className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">{t('clubs.list.emptyState.title')}</p>
            <p className="text-sm text-gray-500 mt-1">{t('clubs.list.emptyState.subtitle')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
