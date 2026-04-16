/*
  # Database Cleanup - Remove Unused Tables

  This migration removes tables that are no longer used in the application.

  ## Tables Being Removed
  
  1. **players** table
     - Reason: Replaced by `user_players` table which has proper user relationship
     - The old `players` table had a simple `name` field
     - The new `user_players` table has `first_name`, `last_name`, and `user_id`

  2. **matches** table
     - Reason: Not used in application code
     - Different from `match_results` table which is actively used
     - Was created for tournament bracket management but never implemented

  3. **stripe_customers** table
     - Reason: Duplicates data in `user_subscriptions` table
     - The `user_subscriptions` table already has `stripe_customer_id`

  4. **stripe_subscriptions** table
     - Reason: Duplicates data in `user_subscriptions` table
     - The `user_subscriptions` table contains all necessary subscription info

  5. **stripe_orders** table
     - Reason: Not referenced anywhere in the application code
     - Subscription management is handled through `user_subscriptions`

  ## Data Safety
  
  All active data is stored in the following tables which remain intact:
  - user_profiles, user_players, tournaments, tournament_registrations
  - convocations, match_results, live_matches, shared_match_results
  - user_subscriptions, user_feature_flags, user_usage_stats

  ## Note
  
  This cleanup improves database performance and reduces confusion by
  removing duplicate and unused schema elements.
*/

-- Drop unused tables with CASCADE to remove dependencies
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS stripe_customers CASCADE;
DROP TABLE IF EXISTS stripe_subscriptions CASCADE;
DROP TABLE IF EXISTS stripe_orders CASCADE;

-- Drop unused custom types if they exist
DROP TYPE IF EXISTS stripe_subscription_status CASCADE;
DROP TYPE IF EXISTS stripe_order_status CASCADE;
