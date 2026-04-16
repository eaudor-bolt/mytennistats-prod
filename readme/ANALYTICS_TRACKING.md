# Google Analytics Tracking Setup

Google Analytics (GA4) has been successfully integrated with tracking ID: `G-SPYY348TYP`

## What's Being Tracked

### Page Views
All page navigation is automatically tracked, including:
- Landing page
- Login page
- Tournaments page
- Matches page
- Clubs page
- Rules page
- Settings page
- Live match pages
- Match history pages
- Shared results pages

### User Actions
Authentication events:
- User login
- User logout
- Profile updates

### Navigation
- Navigation between pages (with source and destination)

### Tournament Actions
- Viewing tournament details
- Registering for tournaments
- Unregistering from tournaments
- Filtering tournaments
- Searching tournaments
- Changing view mode (map/calendar)

### Match Actions
- Creating match results
- Updating match results
- Deleting match results
- Starting live score sharing
- Finishing matches
- Sharing match results (individual, bulk, live)

### Club Actions
- Viewing club details
- Favoriting clubs
- Commenting on clubs
- Searching clubs

### Button Clicks
Generic button clicks are tracked with:
- Button name
- Location (which page/section)

### Subscription Actions
- Viewing subscription plans
- Selecting plans
- Checkout started
- Checkout completed
- Subscription cancelled

### Error Tracking
Errors are tracked with:
- Error message
- Error location
- Additional context data

## Implementation Details

All tracking is handled through utility functions in `/src/utils/analytics.ts`:
- `trackPageView(path, title)` - Automatically tracks page views
- `trackEvent(eventName, eventParams)` - Generic event tracking
- `trackButtonClick(buttonName, location)` - Button click tracking
- `trackNavigation(destination, source)` - Navigation tracking
- `trackTournamentAction(action, tournamentId, additionalData)` - Tournament-specific events
- `trackMatchAction(action, matchId, additionalData)` - Match-specific events
- `trackClubAction(action, clubId, additionalData)` - Club-specific events
- `trackUserAction(action, additionalData)` - User authentication events
- `trackSubscription(action, plan, additionalData)` - Subscription events
- `trackError(errorMessage, errorLocation, additionalData)` - Error logging

## Privacy & Compliance

The implementation:
- Does not track personally identifiable information (PII)
- Tracks user interactions to understand feature usage
- Uses standard GA4 events for analytics
- All data is sent to Google Analytics servers

## Viewing Analytics Data

To view your analytics:
1. Go to [Google Analytics](https://analytics.google.com/)
2. Select your property with ID `G-SPYY348TYP`
3. Navigate to Reports to see:
   - Real-time user activity
   - User engagement metrics
   - Event tracking data
   - Page views and navigation flows
   - Custom events (tournaments, matches, clubs, etc.)
