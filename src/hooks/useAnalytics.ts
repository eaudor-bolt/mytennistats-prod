import { useEffect } from 'react';
import { trackPageView } from '../utils/analytics';

export const usePageTracking = (pageName: string, pageTitle: string) => {
  useEffect(() => {
    trackPageView(pageName, pageTitle);
  }, [pageName, pageTitle]);
};
