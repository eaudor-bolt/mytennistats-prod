import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

type Language = 'fr' | 'en';

type TranslationObject = {
  nav: any;
  hero: any;
  stats: any;
  features: any;
  howItWorks: any;
  forPlayers: any;
  forCoaches: any;
  footer: any;
  auth: any;
};

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: ((key: string) => string) & TranslationObject;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations: Record<Language, Record<string, string>> = {
  fr: {
    'app.title': 'Tennis Manager',
    'nav.tournaments': 'Tournois',
    'nav.matches': 'Matchs',
    'nav.live': 'Live',
    'nav.rules': 'Règles',
    'nav.settings': 'Paramètres',
    'nav.logout': 'Déconnexion',

    'landing.welcome': 'Bienvenue sur Tennis Manager',
    'landing.subtitle': 'Gérez vos tournois, matchs et performances',
    'landing.selectLanguage': 'Choisissez votre langue',
    'landing.continue': 'Continuer',
    'landing.title': 'Tennis Tournaments',
    'landing.getStarted': 'Tester',
    'landing.hero.title1': 'Organisez vos Tournois de Tennis',
    'landing.hero.title2': 'Comme un Pro',
    'landing.hero.subtitle': 'La plateforme complète pour gérer les inscriptions aux tournois, suivre les résultats de matchs et consulter les scores en direct. Parfait pour les clubs, organisateurs et joueurs.',
    'landing.hero.cta': 'Commencer l\'essai gratuit',
    'landing.features.title': 'Tout ce dont vous avez besoin',
    'landing.features.calendar.title': 'Calendrier de Tournois',
    'landing.features.calendar.desc': 'Parcourez et inscrivez-vous aux tournois à venir dans votre région',
    'landing.features.scoring.title': 'Score en Direct',
    'landing.features.scoring.desc': 'Suivez et partagez les scores de matchs en direct avec des mises à jour instantanées',
    'landing.features.analytics.title': 'Analyses de Matchs',
    'landing.features.analytics.desc': 'Statistiques détaillées et suivi des performances pour chaque match',
    'landing.features.players.title': 'Gestion des Joueurs',
    'landing.features.players.desc': 'Gérez plusieurs joueurs et suivez leur progression',
    'landing.pages.title': 'Découvrez Toutes les Fonctionnalités',
    'landing.pages.subtitle': 'Explorez nos différentes pages pour une expérience complète de gestion de tennis',
    'landing.pages.tournaments.title': 'Page Tournois',
    'landing.pages.tournaments.desc': 'Consultez le calendrier complet des tournois, filtrez par catégorie, niveau et localisation. Inscrivez-vous facilement et suivez vos convocations en temps réel. Visualisez les tournois sur une carte interactive.',
    'landing.pages.matchResults.title': 'Page Résultats de Matchs',
    'landing.pages.matchResults.desc': 'Enregistrez vos résultats de matchs avec un système de scoring détaillé. Consultez des statistiques avancées pour chaque point, analysez vos performances et partagez vos résultats avec vos amis.',
    'landing.pages.videos.title': 'Page Vidéos',
    'landing.pages.videos.desc': 'Enregistrez vos matchs en vidéo, associez les moments clés aux points marqués, et créez des montages personnalisés. Analysez votre technique avec des outils d\'édition intégrés.',
    'landing.pages.rules.title': 'Page Règles',
    'landing.pages.rules.desc': 'Accédez à une base de connaissances complète des règles du tennis. Posez vos questions et obtenez des réponses précises grâce à notre assistant intelligent alimenté par l\'IA.',
    'landing.pricing.title': 'Tarifs Simples et Transparents',
    'landing.pricing.free.title': 'Gratuit',
    'landing.pricing.free.month': '/mois',
    'landing.pricing.free.feature1': 'Accès à 1 profil de joueur',
    'landing.pricing.free.feature2': 'Inscription à 1 tournoi',
    'landing.pricing.free.feature3': 'Suivi de matchs basique',
    'landing.pricing.free.feature4': 'Vue calendrier des tournois',
    'landing.pricing.free.cta': 'Commencer Gratuitement',
    'landing.pricing.premium.title': 'Premium',
    'landing.pricing.premium.popular': 'Populaire',
    'landing.pricing.premium.feature1': 'Profils de joueurs illimités',
    'landing.pricing.premium.feature2': 'Inscriptions aux tournois illimitées',
    'landing.pricing.premium.feature3': 'Score en direct avec partage',
    'landing.pricing.premium.feature4': 'Analyses de matchs avancées',
    'landing.pricing.premium.feature5': 'Suivi du pourcentage de victoires',
    'landing.pricing.premium.feature6': 'Support prioritaire',
    'landing.pricing.premium.cta': 'Obtenir Premium',
    'landing.cta.title': 'Prêt à Commencer ?',
    'landing.cta.subtitle': 'Rejoignez des centaines d\'organisateurs et de joueurs utilisant Tennis Tournaments',
    'landing.cta.button': 'Créer un Compte Gratuit',
    'landing.footer': '2025 Tennis Tournaments. Tous droits réservés.',
    'landing.nav.features': 'Fonctionnalités',
    'landing.nav.pricing': 'Tarifs',
    'landing.nav.login': 'Connexion',
    'landing.nav.signup': 'S\'inscrire',
    'landing.hero.badge': 'Application Tennis',
    'landing.hero.tagline': 'Pas de bruit. Juste votre tennis.',
    'landing.footer.product': 'Produit',
    'landing.footer.legal': 'Juridique',
    'landing.footer.contact': 'Contact',
    'landing.footer.legalNotice': 'Mentions légales',
    'landing.footer.termsOfUse': 'CGU',
    'landing.footer.termsOfSale': 'CGV',
    'landing.footer.privacyPolicy': 'Confidentialité',
    'landing.footer.cookiePolicy': 'Cookies',
    'landing.footer.tagline': 'Votre compagnon pour suivre vos matchs, tournois et progression au tennis.',
    'landing.footer.gdpr': 'Ce service est conforme au Règlement Général sur la Protection des Données (RGPD). Vos données personnelles sont traitées avec le plus grand soin et ne sont jamais partagées avec des tiers sans votre consentement explicite.',
    'landing.footer.copyright': '\u00A9 2026 MyTenniStats. Tous droits réservés.',

    'login.title': 'Connexion',
    'login.email': 'Email',
    'login.password': 'Mot de passe',
    'login.signIn': 'Se connecter',
    'login.signUp': 'S\'inscrire',
    'login.noAccount': 'Pas de compte ?',
    'login.haveAccount': 'Déjà un compte ?',

    'settings.title': 'Paramètres',
    'settings.language': 'Langue',
    'settings.profile': 'Profil',
    'settings.french': 'Français',
    'settings.english': 'Anglais',
    'settings.players': 'Joueurs',
    'settings.addPlayer': 'Ajouter un joueur',
    'settings.playerName': 'Nom du joueur',
    'settings.yearOfBirth': 'Année de naissance',
    'settings.save': 'Enregistrer',
    'settings.cancel': 'Annuler',
    'settings.delete': 'Supprimer',
    'settings.firstName': 'Prénom',
    'settings.lastName': 'Nom',
    'settings.updateProfile': 'Mettre à jour le profil',

    'tournaments.title': 'Tournois',
    'tournaments.headtitle': 'Liste des tournois',
    'tournaments.subtitle': 'Découvrez et suivez les tournois sur la region Parisienne (plus de regions a venir)',
    'tournaments.map': 'Carte',
    'tournaments.calendar': 'Calendrier',
    'tournaments.upcoming': 'À venir',
    'tournaments.ongoing': 'En cours',
    'tournaments.completed': 'Terminés',
    'tournaments.all': 'Tous',
    'tournaments.searchPlaceholder': 'Rechercher un tournoi...',
    'tournaments.filters': 'Filtres',
    'tournaments.mapView': 'Vue carte',
    'tournaments.calendarView': 'Vue calendrier',
    'tournaments.registeredFor': 'inscrit',
    'tournaments.openingDate': 'Ouverture',
    'tournaments.judge': 'Juge',
    'tournaments.categories': 'Catégories disponibles',
    'tournaments.registration': 'Inscription',
    'tournaments.convocations': 'Convocations',
    'tournaments.addToCalendar': 'Ajouter au calendrier',
    'tournaments.noResults': 'Aucun tournoi trouvé correspondant à vos filtres.',
    'tournaments.allTournaments': 'Tous les tournois',

    'matches.title': 'Mes Matchs',
    'matches.addMatch': 'Ajouter un match',
    'matches.date': 'Date',
    'matches.player': 'Joueur',
    'matches.tournament': 'Tournoi',
    'matches.opponent': 'Adversaire',
    'matches.score': 'Score',
    'matches.ranking': 'Classement',
    'matches.result': 'Résultat',
    'matches.win': 'Victoire',
    'matches.loss': 'Défaite',
    'matches.edit': 'Modifier',
    'matches.delete': 'Supprimer',
    'matches.stats': 'Statistiques',
    'matches.noMatches': 'Aucun match enregistré',
    'matches.event': 'Événement',
    'matches.comments': 'Commentaires',

    'addMatch.title': 'Ajouter un match',
    'addMatch.editTitle': 'Modifier le match',
    'addMatch.selectDate': 'Sélectionnez la date du match',
    'addMatch.selectPlayer': 'Sélectionnez le joueur',
    'addMatch.tournamentName': 'Nom du tournoi',
    'addMatch.tournamentPlaceholder': 'Exemple: Tournoi de Valbonne',
    'addMatch.opponentName': 'Nom de l\'adversaire',
    'addMatch.opponentPlaceholder': 'Prénom Nom',
    'addMatch.enterScore': 'Entrez le score',
    'addMatch.scorePlaceholder': '6-4 6-3',
    'addMatch.opponentRanking': 'Classement adversaire',
    'addMatch.rankingPlaceholder': '15/2',
    'addMatch.selectResult': 'Résultat du match',
    'addMatch.impressions': 'Impressions',
    'addMatch.service': 'Service',
    'addMatch.forehand': 'Coup droit',
    'addMatch.backhand': 'Revers',
    'addMatch.volley': 'Volée',
    'addMatch.placement': 'Placement',
    'addMatch.bad': 'Mauvais',
    'addMatch.good': 'Bon',
    'addMatch.great': 'Excellent',
    'addMatch.eventDetails': 'Détails de l\'événement',
    'addMatch.eventPlaceholder': 'Finale, Demi-finale, etc.',
    'addMatch.addComments': 'Commentaires',
    'addMatch.commentsPlaceholder': 'Ajoutez des notes sur votre match...',
    'addMatch.saveMatch': 'Enregistrer le match',

    'convocation.title': 'Ajouter une convocation',
    'convocation.selectPlayer': 'Sélectionnez le joueur',
    'convocation.date': 'Date de convocation',
    'convocation.time': 'Heure',
    'convocation.location': 'Lieu',
    'convocation.locationPlaceholder': 'Adresse du court',
    'convocation.phone': 'Téléphone',
    'convocation.phonePlaceholder': '+33 6 12 34 56 78',
    'convocation.judge': 'Juge Arbitre',
    'convocation.judgePlaceholder': 'Nom du juge',
    'convocation.save': 'Enregistrer',
    'convocation.cancel': 'Annuler',

    'live.title': 'Match en direct',
    'live.newMatch': 'Nouveau match',
    'live.selectPlayers': 'Sélectionner les joueurs',
    'live.player1': 'Joueur 1',
    'live.player2': 'Joueur 2',
    'live.startMatch': 'Démarrer le match',
    'live.server': 'Service',
    'live.set': 'Set',
    'live.game': 'Jeu',
    'live.points': 'Points',
    'live.undo': 'Annuler',
    'live.endMatch': 'Terminer le match',
    'live.winner': 'Gagnant',

    'common.loading': 'Chargement...',
    'common.save': 'Enregistrer',
    'common.cancel': 'Annuler',
    'common.delete': 'Supprimer',
    'common.edit': 'Modifier',
    'common.close': 'Fermer',
    'common.confirm': 'Confirmer',
    'common.search': 'Rechercher',
    'common.filter': 'Filtrer',
    'common.clear': 'Effacer',
    'common.yes': 'Oui',
    'common.no': 'Non',
  },
  en: {
    'app.title': 'Tennis Manager',
    'nav.tournaments': 'Tournaments',
    'nav.matches': 'Matches',
    'nav.live': 'Live',
    'nav.rules': 'Rules',
    'nav.settings': 'Settings',
    'nav.logout': 'Logout',

    'landing.welcome': 'Welcome to Tennis Manager',
    'landing.subtitle': 'Manage your tournaments, matches and performance',
    'landing.selectLanguage': 'Choose your language',
    'landing.continue': 'Continue',
    'landing.title': 'Tennis Tournaments',
    'landing.getStarted': 'Get Started',
    'landing.hero.title1': 'Organize Your Tennis Tournaments',
    'landing.hero.title2': 'Like a Pro',
    'landing.hero.subtitle': 'The complete platform for managing tournament registrations, tracking match results, and following live scores. Perfect for clubs, organizers, and players.',
    'landing.hero.cta': 'Start Free Trial',
    'landing.features.title': 'Everything You Need',
    'landing.features.calendar.title': 'Tournament Calendar',
    'landing.features.calendar.desc': 'Browse and register for upcoming tournaments in your area',
    'landing.features.scoring.title': 'Live Scoring',
    'landing.features.scoring.desc': 'Track and share live match scores with instant updates',
    'landing.features.analytics.title': 'Match Analytics',
    'landing.features.analytics.desc': 'Detailed statistics and performance tracking for every match',
    'landing.features.players.title': 'Player Management',
    'landing.features.players.desc': 'Manage multiple players and track their progress',
    'landing.pages.title': 'Discover All Features',
    'landing.pages.subtitle': 'Explore our different pages for a complete tennis management experience',
    'landing.pages.tournaments.title': 'Tournaments Page',
    'landing.pages.tournaments.desc': 'Browse the complete tournament calendar, filter by category, level and location. Register easily and track your convocations in real-time. View tournaments on an interactive map.',
    'landing.pages.matchResults.title': 'Match Results Page',
    'landing.pages.matchResults.desc': 'Record your match results with a detailed scoring system. View advanced statistics for each point, analyze your performance and share your results with friends.',
    'landing.pages.videos.title': 'Videos Page',
    'landing.pages.videos.desc': 'Record your matches on video, link key moments to scored points, and create personalized montages. Analyze your technique with integrated editing tools.',
    'landing.pages.rules.title': 'Rules Page',
    'landing.pages.rules.desc': 'Access a comprehensive knowledge base of tennis rules. Ask your questions and get accurate answers through our AI-powered intelligent assistant.',
    'landing.pricing.title': 'Simple, Transparent Pricing',
    'landing.pricing.free.title': 'Free',
    'landing.pricing.free.month': '/month',
    'landing.pricing.free.feature1': 'Access to 1 player profile',
    'landing.pricing.free.feature2': 'Register for 1 tournament',
    'landing.pricing.free.feature3': 'Basic match tracking',
    'landing.pricing.free.feature4': 'Tournament calendar view',
    'landing.pricing.free.cta': 'Start Free',
    'landing.pricing.premium.title': 'Premium',
    'landing.pricing.premium.popular': 'Popular',
    'landing.pricing.premium.feature1': 'Unlimited player profiles',
    'landing.pricing.premium.feature2': 'Unlimited tournament registrations',
    'landing.pricing.premium.feature3': 'Live scoring with sharing',
    'landing.pricing.premium.feature4': 'Advanced match analytics',
    'landing.pricing.premium.feature5': 'Win percentage tracking',
    'landing.pricing.premium.feature6': 'Priority support',
    'landing.pricing.premium.cta': 'Get Premium',
    'landing.cta.title': 'Ready to Get Started?',
    'landing.cta.subtitle': 'Join hundreds of organizers and players using Tennis Tournaments',
    'landing.cta.button': 'Create Free Account',
    'landing.footer': '2025 Tennis Tournaments. All rights reserved.',
    'landing.nav.features': 'Features',
    'landing.nav.pricing': 'Pricing',
    'landing.nav.login': 'Log in',
    'landing.nav.signup': 'Sign up',
    'landing.hero.badge': 'Tennis App',
    'landing.hero.tagline': 'No noise. Just your tennis.',
    'landing.footer.product': 'Product',
    'landing.footer.legal': 'Legal',
    'landing.footer.contact': 'Contact',
    'landing.footer.legalNotice': 'Legal Notice',
    'landing.footer.termsOfUse': 'Terms of Use',
    'landing.footer.termsOfSale': 'Terms of Sale',
    'landing.footer.privacyPolicy': 'Privacy Policy',
    'landing.footer.cookiePolicy': 'Cookie Policy',
    'landing.footer.tagline': 'Your companion for tracking matches, tournaments, and tennis progress.',
    'landing.footer.gdpr': 'This service complies with the General Data Protection Regulation (GDPR). Your personal data is handled with the utmost care and is never shared with third parties without your explicit consent.',
    'landing.footer.copyright': '\u00A9 2026 MyTenniStats. All rights reserved.',

    'login.title': 'Login',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.signIn': 'Sign In',
    'login.signUp': 'Sign Up',
    'login.noAccount': 'No account?',
    'login.haveAccount': 'Already have an account?',

    'settings.title': 'Settings',
    'settings.language': 'Language',
    'settings.profile': 'Profile',
    'settings.french': 'French',
    'settings.english': 'English',
    'settings.players': 'Players',
    'settings.addPlayer': 'Add Player',
    'settings.playerName': 'Player Name',
    'settings.yearOfBirth': 'Year of Birth',
    'settings.save': 'Save',
    'settings.cancel': 'Cancel',
    'settings.delete': 'Delete',
    'settings.firstName': 'First Name',
    'settings.lastName': 'Last Name',
    'settings.updateProfile': 'Update Profile',

    'tournaments.title': 'Tournaments',
    'tournaments.headtitle': 'Tennis Tournaments',
    'tournaments.subtitle': 'Discover and follow tournaments around the world',
    'tournaments.map': 'Map',
    'tournaments.calendar': 'Calendar',
    
    'tournaments.upcoming': 'Upcoming',
    'tournaments.ongoing': 'Ongoing',
    'tournaments.completed': 'Completed',
    'tournaments.all': 'All',
    'tournaments.searchPlaceholder': 'Search tournament...',
    'tournaments.filters': 'Filters',
    'tournaments.mapView': 'Map View',
    'tournaments.calendarView': 'Calendar View',
    'tournaments.registeredFor': 'registered',
    'tournaments.openingDate': 'Opening',
    'tournaments.judge': 'Judge',
    'tournaments.categories': 'Available Categories',
    'tournaments.registration': 'Registration',
    'tournaments.convocations': 'Convocations',
    'tournaments.addToCalendar': 'Add to Calendar',
    'tournaments.noResults': 'No tournaments found matching your filters.',
    'tournaments.allTournaments': 'All Tournaments',

    'matches.title': 'My Matches',
    'matches.addMatch': 'Add Match',
    'matches.date': 'Date',
    'matches.player': 'Player',
    'matches.tournament': 'Tournament',
    'matches.opponent': 'Opponent',
    'matches.score': 'Score',
    'matches.ranking': 'Ranking',
    'matches.result': 'Result',
    'matches.win': 'Win',
    'matches.loss': 'Loss',
    'matches.edit': 'Edit',
    'matches.delete': 'Delete',
    'matches.stats': 'Statistics',
    'matches.noMatches': 'No matches recorded',
    'matches.event': 'Event',
    'matches.comments': 'Comments',

    'addMatch.title': 'Add Match',
    'addMatch.editTitle': 'Edit Match',
    'addMatch.selectDate': 'Select match date',
    'addMatch.selectPlayer': 'Select player',
    'addMatch.tournamentName': 'Tournament Name',
    'addMatch.tournamentPlaceholder': 'Example: Valbonne Tournament',
    'addMatch.opponentName': 'Opponent Name',
    'addMatch.opponentPlaceholder': 'First Last',
    'addMatch.enterScore': 'Enter score',
    'addMatch.scorePlaceholder': '6-4 6-3',
    'addMatch.opponentRanking': 'Opponent Ranking',
    'addMatch.rankingPlaceholder': '15/2',
    'addMatch.selectResult': 'Match Result',
    'addMatch.impressions': 'Impressions',
    'addMatch.service': 'Service',
    'addMatch.forehand': 'Forehand',
    'addMatch.backhand': 'Backhand',
    'addMatch.volley': 'Volley',
    'addMatch.placement': 'Placement',
    'addMatch.bad': 'Bad',
    'addMatch.good': 'Good',
    'addMatch.great': 'Great',
    'addMatch.eventDetails': 'Event Details',
    'addMatch.eventPlaceholder': 'Final, Semi-final, etc.',
    'addMatch.addComments': 'Comments',
    'addMatch.commentsPlaceholder': 'Add notes about your match...',
    'addMatch.saveMatch': 'Save Match',

    'convocation.title': 'Add Convocation',
    'convocation.selectPlayer': 'Select player',
    'convocation.date': 'Convocation Date',
    'convocation.time': 'Time',
    'convocation.location': 'Location',
    'convocation.locationPlaceholder': 'Court address',
    'convocation.phone': 'Phone',
    'convocation.phonePlaceholder': '+1 555 123 4567',
    'convocation.judge': 'Judge Referee',
    'convocation.judgePlaceholder': 'Judge name',
    'convocation.save': 'Save',
    'convocation.cancel': 'Cancel',

    'live.title': 'Live Match',
    'live.newMatch': 'New Match',
    'live.selectPlayers': 'Select Players',
    'live.player1': 'Player 1',
    'live.player2': 'Player 2',
    'live.startMatch': 'Start Match',
    'live.server': 'Server',
    'live.set': 'Set',
    'live.game': 'Game',
    'live.points': 'Points',
    'live.undo': 'Undo',
    'live.endMatch': 'End Match',
    'live.winner': 'Winner',

    'common.loading': 'Loading...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.close': 'Close',
    'common.confirm': 'Confirm',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.clear': 'Clear',
    'common.yes': 'Yes',
    'common.no': 'No',
  }
};

const detectLanguage = (): Language => {
  const stored = localStorage.getItem('tennis-manager-language');
  if (stored === 'fr' || stored === 'en') {
    return stored;
  }

  // Language is only ever changed via the in-app FR/EN toggle, never by the
  // device/browser/OS locale — that mismatch (declared vs. detected content
  // language) is what triggers browsers' built-in auto-translate and mangles
  // text like "myTenniStats".
  return 'en';
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(detectLanguage());

  useEffect(() => {
    loadUserLanguage();
  }, []);

  const loadUserLanguage = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const userLang = user.user_metadata?.language;
        if (userLang === 'fr' || userLang === 'en') {
          setLanguageState(userLang);
          localStorage.setItem('tennis-manager-language', userLang);
        }
      }
    } catch (error) {
      console.error('Error loading user language:', error);
    }
  };

  useEffect(() => {
    localStorage.setItem('tennis-manager-language', language);
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('tennis-manager-language', lang);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.auth.updateUser({
          data: { language: lang }
        });
      }
    } catch (error) {
      console.error('Error updating user language:', error);
    }
  };

  const structuredTranslations = {
    en: {
      nav: {
        home: 'Home',
        analysis: 'Performance Analysis',
        framework: 'Functionalities',
        howItWorks: 'How It Works',
        players: 'For Players',
        coaches: 'Parents & Coaches',
        pricing: 'Pricing',
        login: 'Log in',
        signup: 'Sign up',
      },
      hero: {
        badge: 'Organize your Tennis Performance',
        title1: 'Track your tennis matches.',
        title2: 'Analyze your game like a pro.',
        description: 'The complete platform for managing tournament registrations, tracking match results, sharing live scores and see the evolution of your game over time using video. This application is perfect for parents to help organize tennis matches, players to track their results over time, coaches to have a central platform to check the results of their players and any passionnate tennis lover. No noise, just everything you need for your tennis',
        cta: 'Get Started Free',
        ctaSecondary: 'Learn how it works',
        highlights: ['Tournament Registration', 'Live Scoring', 'Match Analytics', 'Player Tracking'],
      },
      stats: {
        badge: 'By The Numbers',
        title: 'The science behind every swing',
        items: [],
      },
      features: {
        badge: 'Functionalities',
        title: 'Everything in one app',
        subtitle: 'Everything you need for your tennis under the same app. It\'s built for parents, players, coaches, and clubs to have a centralised platform to see the history of your results and evolution of your tennis.',
        items: [
          {
            title: 'Tournament Calendar',
            desc: 'Browse and register for upcoming tournaments in your area. Stay on top of schedules, deadlines, and draw results all in one place.',
            tag: 'Tournaments',
          },
          {
            title: 'Live Scoring',
            desc: 'Track any tennis games and easily share live match scores and points to coaches or family in real time.',
            tag: 'Live',
          },
          {
            title: 'Match Analytics',
            desc: 'Detailed statistics and performance tracking for every match. Understand your strengths, weaknesses, and progress over time.',
            tag: 'Analytics',
          },
          {
            title: 'Player Management',
            desc: 'Manage multiple players and watch the evolution of their game over the years. Perfect for coaches and academies.',
            tag: 'Management',
          },
          {
            title: 'Tennis Rules',
            desc: 'Know the tennis rules and ask questions related to any tennis game situation. Your on-court rules companion.',
            tag: 'Education',
          },
        ],
      },
      howItWorks: {
        badge: 'How It Works',
        title: 'Understand exactly how you win and lose points',
        subtitle: 'Every point tells a story. myTenniStats captures how it ends — not just who won it — so the patterns become visible over time.',
        liveScore: {
          windowLabel: 'Live Score',
          title: 'Live scoring focused on how the point ends',
          description: "While you score a match live, tag each point with the shot that decided it — forehand, backhand, volley, service, return — and whether it was a winner or a fault. Over a match, a practice session, or a whole season, you'll see the trend emerge: which shots win you points, and which ones are costing you the most unforced errors. That's exactly where to focus your practice.",
          bullets: [
            'See your winner-vs-fault ratio for every shot',
            'Spot the trend across matches and seasons',
            'Know exactly what to work on next',
          ],
        },
        video: {
          windowLabel: 'Video Library',
          title: 'Record video, track your evolution',
          description: 'Attach video to any point while you play, or upload footage from practice. Every clip is organized by shot and date, so you can compare how your forehand — or any stroke — looked last month against how it looks today, across both practice sessions and matches.',
          bullets: [
            'Video linked to every point you play',
            'Compare technique over time, shot by shot',
            'Practice and match footage, all in one place',
          ],
        },
      },
      forPlayers: {
        badge: 'For Players',
        title: 'Take control of your development',
        description: "Whether you're a club player chasing your first ranking or an advanced player willing to get more insights from your game, myTenniStats gives you the data-driven edge that will help you improve your tennis and help you share your results with your family and coaches.",
        cta: 'Get your analysis',
        benefits: [
          { title: 'Track Progress Over Time', desc: 'Watch your performance metrics evolve across every session. Identify your strongest improvement curves.' },
          { title: 'Detect Your Mistakes', desc: 'With the radar chart of your match stats, easily visualize where your winners and errors are for each stroke.' },
          { title: 'Share Your Performance With Coaches', desc: 'Easily share your match results and statistics with your coach to target areas of improvement together.' },
          { title: 'Improve your Technique', desc: 'By recording your tennis in video, myTenniStats can help you detect what to improve through AI analysis.' },
        ],
      },
      forCoaches: {
        badge: 'Parents & Coaches',
        title: 'Simpler organization for the tennis competition of your kids or players',
        description: 'myTenniStats amplifies your coaching expertise with objective data — freeing you to focus on the human side of development.',
        beta: 'Free for certified coaches during beta',
        betaDesc: "We're partnering with 50 coaching programs worldwide to validate myTenniStats in real training environments. Apply for early access.",
        betaCta: 'Apply for beta',
        tools: [
          { title: 'Squad Dashboard', desc: 'Monitor your entire roster from a single view. Compare players, flag outliers, and prioritize who needs attention this week.' },
          { title: 'Auto-Generated Reports', desc: 'Share polished performance reports with players and parents. Easily share links in seconds with your coaches or family to follow a game in Live or see historical match results.' },
          { title: 'Real-Time Alerts', desc: "Get notified the moment a player's form, fatigue index, or serve velocity crosses critical thresholds during live sessions." },
          { title: 'Remote Analysis', desc: 'Analyze recordings from any court, anywhere. No proprietary hardware required — works with standard video and audio input.' },
        ],
      },
      footer: {
        tagline: 'The complete platform for tournament registrations, match tracking, and live scores. Built for players, clubs, and organizers.',
        copyright: 'myTenniStats — All rights reserved.',
        sections: {
          platform: { title: 'Platform', links: ['Tournament Calendar', 'Live Scoring', 'Match Analytics', 'Player Management'] },
          athletes: { title: 'For Athletes', links: ['Players', 'Coaches', 'Clubs', 'Academies', 'Junior Programs'] },
          company: { title: 'Company', links: ['About', 'Pricing', 'Careers', 'Press'] },
          legal: { title: 'Legal', links: ['Privacy Policy', 'Terms of Use', 'Cookie Settings'] },
        },
      },
      auth: {
        login: 'Log in',
        signup: 'Sign up',
        email: 'Email address',
        password: 'Password',
      },
    },
    fr: {
      nav: {
        home: 'Accueil',
        analysis: 'Analyse de performance',
        framework: 'Fonctionnalités',
        howItWorks: 'Comment Ça Marche',
        players: 'Pour les joueurs',
        coaches: 'Parents & Coachs',
        pricing: 'Tarifs',
        login: 'Connexion',
        signup: "S'inscrire",
      },
      hero: {
        badge: "Organisez votre performance tennis",
        title1: 'Suivez vos matchs de tennis.',
        title2: 'Analysez votre jeu comme un pro.',
        description: 'La plateforme complète pour gérer les inscriptions aux tournois, suivre les résultats de matchs, partager les scores en direct et voir l\'évolution de votre jeu au fil du temps grâce à la vidéo. Cette application est parfaite pour les parents qui aident à organiser les matchs de tennis, les joueurs pour suivre leurs résultats dans le temps, les coachs pour avoir une plateforme centralisée pour vérifier les résultats de leurs joueurs et tout passionné de tennis. Pas de bruit, juste tout ce dont vous avez besoin pour votre tennis',
        cta: 'Commencer gratuitement',
        ctaSecondary: 'Comment ça fonctionne',
        highlights: ['Inscription aux tournois', 'Score en direct', 'Analyse de matchs', 'Suivi des joueurs'],
      },
      stats: {
        badge: 'En chiffres',
        title: 'La science derrière chaque coup',
        items: [],
      },
      features: {
        badge: 'Fonctionnalités',
        title: 'Tout dans une seule app',
        subtitle: 'Tout ce dont vous avez besoin pour votre tennis dans une seule application. Elle est conçue pour les parents, joueurs, coachs et clubs afin d\'avoir une plateforme centralisée pour voir l\'historique de vos résultats et l\'évolution de votre tennis.',
        items: [
          {
            title: 'Calendrier des tournois',
            desc: "Consultez et inscrivez-vous aux tournois à venir dans votre région. Suivez les calendriers, délais et tableaux en un seul endroit.",
            tag: 'Tournois',
          },
          {
            title: 'Score en direct',
            desc: "Suivez n'importe quel match de tennis et partagez facilement les scores et points en direct avec les coachs ou la famille.",
            tag: 'Direct',
          },
          {
            title: 'Analyse de matchs',
            desc: "Statistiques détaillées et suivi de performance pour chaque match. Comprenez vos forces, faiblesses et votre progression.",
            tag: 'Analytique',
          },
          {
            title: 'Gestion des joueurs',
            desc: "Gérez plusieurs joueurs et suivez l'évolution de leur jeu au fil des années. Idéal pour les coachs et académies.",
            tag: 'Gestion',
          },
          {
            title: 'Règles du tennis',
            desc: "Connaissez les règles du tennis et posez des questions sur n'importe quelle situation de jeu. Votre guide sur le court.",
            tag: 'Éducation',
          },
        ],
      },
      howItWorks: {
        badge: 'Comment Ça Marche',
        title: 'Comprenez exactement pourquoi vous gagnez ou perdez vos points',
        subtitle: 'Chaque point raconte une histoire. myTenniStats capture comment il se termine — pas seulement qui l\'a gagné — pour que les tendances deviennent visibles avec le temps.',
        liveScore: {
          windowLabel: 'Score en direct',
          title: 'Un score en direct centré sur la fin du point',
          description: "Pendant que vous notez un match en direct, associez à chaque point le coup qui l'a décidé — coup droit, revers, volée, service, retour — et s'il s'agit d'un gagnant ou d'une faute. Sur un match, une séance d'entraînement ou une saison entière, la tendance apparaît clairement : quels coups vous font gagner des points, et lesquels vous coûtent le plus de fautes directes. C'est exactement là qu'il faut concentrer votre entraînement.",
          bullets: [
            'Visualisez votre ratio gagnants/fautes pour chaque coup',
            'Repérez la tendance sur vos matchs et vos saisons',
            'Sachez exactement sur quoi travailler ensuite',
          ],
        },
        video: {
          windowLabel: 'Bibliothèque vidéo',
          title: 'Enregistrez vos vidéos, suivez votre évolution',
          description: "Associez une vidéo à n'importe quel point pendant que vous jouez, ou importez des séquences de vos entraînements. Chaque vidéo est organisée par coup et par date, pour comparer l'allure de votre coup droit — ou de n'importe quel autre coup — le mois dernier avec ce qu'il donne aujourd'hui, à l'entraînement comme en match.",
          bullets: [
            'Une vidéo liée à chaque point que vous jouez',
            'Comparez votre technique dans le temps, coup par coup',
            "Vidéos d'entraînement et de match réunies au même endroit",
          ],
        },
      },
      forPlayers: {
        badge: 'Pour les joueurs',
        title: 'Prenez le contrôle de votre développement',
        description: "Que vous soyez un joueur de club visant votre premier classement ou un joueur avancé souhaitant obtenir plus d'informations sur votre jeu, myTenniStats vous donne l'avantage basé sur les données qui vous aidera à améliorer votre tennis et à partager vos résultats avec votre famille et vos coachs.",
        cta: 'Obtenir votre analyse',
        benefits: [
          { title: 'Suivre vos progrès', desc: "Observez l'évolution de vos métriques de performance à chaque séance. Identifiez vos courbes d'amélioration les plus fortes." },
          { title: "Détectez vos erreurs", desc: "Grâce au graphique radar de vos statistiques de match, visualisez facilement où se situent vos points gagnants et vos fautes pour chaque coup." },
          { title: 'Partagez vos performances à vos coachs', desc: "Partagez facilement vos résultats de match et statistiques avec votre coach pour cibler les axes d'amélioration ensemble." },
          { title: 'Améliorez votre technique', desc: 'En enregistrant votre tennis en vidéo, myTenniStats peut vous aider à détecter ce qu\'il faut améliorer grâce à l\'analyse IA.' },
        ],
      },
      forCoaches: {
        badge: 'Parents & Coachs',
        title: 'Organisation simplifiée pour la compétition tennis de vos enfants ou joueurs',
        description: "myTenniStats amplifie votre expertise de coaching avec des données objectives — vous libérant pour vous concentrer sur l'humain.",
        beta: 'Gratuit pour les coachs certifiés pendant la bêta',
        betaDesc: "Nous nous associons à 50 programmes de coaching mondiaux pour valider myTenniStats en conditions réelles. Postulez pour un accès anticipé.",
        betaCta: 'Postuler pour la bêta',
        tools: [
          { title: 'Tableau de bord équipe', desc: "Surveillez tout votre effectif en un coup d'œil. Comparez les joueurs, signalez les anomalies et priorisez les besoins de la semaine." },
          { title: 'Rapports automatisés', desc: "Partagez des rapports de performance soignés avec joueurs et parents. Partagez facilement des liens en quelques secondes avec vos coachs ou votre famille pour suivre un match en direct ou voir les résultats de matchs historiques." },
          { title: 'Alertes en temps réel', desc: "Soyez notifié dès qu'un joueur franchit des seuils critiques de forme, d'indice de fatigue ou de vitesse de service lors des séances live." },
          { title: 'Analyse à distance', desc: "Analysez des enregistrements depuis n'importe quel court, partout dans le monde. Aucun matériel propriétaire requis." },
        ],
      },
      footer: {
        tagline: "La plateforme complète pour les inscriptions aux tournois, le suivi des matchs et les scores en direct. Conçue pour les joueurs, clubs et organisateurs.",
        copyright: 'myTenniStats — Tous droits réservés.',
        sections: {
          platform: { title: 'Plateforme', links: ['Calendrier des tournois', 'Score en direct', 'Analyse de matchs', 'Gestion des joueurs'] },
          athletes: { title: 'Pour les athlètes', links: ['Joueurs', 'Coachs', 'Clubs', 'Académies', 'Programmes juniors'] },
          company: { title: 'Entreprise', links: ['À propos', 'Tarifs', 'Carrières', 'Presse'] },
          legal: { title: 'Légal', links: ['Politique de confidentialité', "Conditions d'utilisation", 'Cookies'] },
        },
      },
      auth: {
        login: 'Connexion',
        signup: 'Inscription',
        email: 'Adresse e-mail',
        password: 'Mot de passe',
      },
    },
  };

  const t: any = (key: string): string => {
    return translations[language][key] || key;
  };

  Object.assign(t, structuredTranslations[language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
