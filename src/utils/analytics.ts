declare global {
  interface Window {
    gtag: (
      command: 'config' | 'event' | 'js' | 'set',
      targetId: string | Date,
      config?: Record<string, unknown>
    ) => void;
    dataLayer: unknown[];
  }
}

export const trackPageView = (path: string, title: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'page_view', {
      page_path: path,
      page_title: title,
    });
  }
};

export const trackEvent = (
  eventName: string,
  eventParams?: Record<string, unknown>
) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, eventParams);
  }
};

export const trackClick = (
  elementName: string,
  additionalData?: Record<string, unknown>
) => {
  trackEvent('click', {
    element: elementName,
    ...additionalData,
  });
};

export const trackButtonClick = (buttonName: string, location?: string) => {
  trackEvent('button_click', {
    button_name: buttonName,
    location: location,
  });
};

export const trackNavigation = (destination: string, source?: string) => {
  trackEvent('navigation', {
    destination,
    source,
  });
};

export const trackTournamentAction = (
  action: 'view' | 'register' | 'unregister' | 'filter' | 'search',
  tournamentId?: string,
  additionalData?: Record<string, unknown>
) => {
  trackEvent('tournament_action', {
    action,
    tournament_id: tournamentId,
    ...additionalData,
  });
};

export const trackMatchAction = (
  action: 'create' | 'update' | 'finish' | 'share' | 'view',
  matchId?: string,
  additionalData?: Record<string, unknown>
) => {
  trackEvent('match_action', {
    action,
    match_id: matchId,
    ...additionalData,
  });
};

export const trackClubAction = (
  action: 'view' | 'favorite' | 'comment' | 'search',
  clubId?: string,
  additionalData?: Record<string, unknown>
) => {
  trackEvent('club_action', {
    action,
    club_id: clubId,
    ...additionalData,
  });
};

export const trackUserAction = (
  action: 'login' | 'logout' | 'register' | 'profile_update',
  additionalData?: Record<string, unknown>
) => {
  trackEvent('user_action', {
    action,
    ...additionalData,
  });
};

export const trackError = (
  errorMessage: string,
  errorLocation: string,
  additionalData?: Record<string, unknown>
) => {
  trackEvent('error', {
    error_message: errorMessage,
    error_location: errorLocation,
    ...additionalData,
  });
};

export const trackSubscription = (
  action: 'view_plans' | 'select_plan' | 'checkout_started' | 'checkout_completed' | 'cancelled',
  plan?: string,
  additionalData?: Record<string, unknown>
) => {
  trackEvent('subscription_action', {
    action,
    plan,
    ...additionalData,
  });
};

export const trackVideoAction = (
  action: 'upload' | 'edit' | 'delete' | 'timeline_add' | 'timeline_edit' | 'timeline_delete' | 'tag_add' | 'tag_remove' | 'play' | 'pause',
  videoId?: string,
  additionalData?: Record<string, unknown>
) => {
  trackEvent('video_action', {
    action,
    video_id: videoId,
    ...additionalData,
  });
};

export const trackFilterAction = (
  filterType: string,
  filterValue: string | number | boolean,
  location: string,
  additionalData?: Record<string, unknown>
) => {
  trackEvent('filter_action', {
    filter_type: filterType,
    filter_value: filterValue,
    location,
    ...additionalData,
  });
};

export const trackConvocationAction = (
  action: 'add' | 'edit' | 'delete' | 'view',
  convocationId?: string,
  additionalData?: Record<string, unknown>
) => {
  trackEvent('convocation_action', {
    action,
    convocation_id: convocationId,
    ...additionalData,
  });
};
