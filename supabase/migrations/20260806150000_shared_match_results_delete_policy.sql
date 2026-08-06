/*
  # Allow owners to delete their own shared match result links

  1. Problem
    - Settings -> Shared Links -> delete on a "Match Result" share sends
      `DELETE /rest/v1/shared_match_results?id=eq.{id}` and gets a 2xx back,
      but the row is still there afterward. `shared_match_results` has RLS
      enabled with only SELECT and INSERT policies ("Users can view their
      own shares" / "Users can create their own shares") - there is no
      DELETE policy at all. PostgREST doesn't error when RLS filters a
      DELETE down to zero matched rows, it just reports success on deleting
      nothing, which is exactly the "no error, row still there" symptom.
    - `live_matches` (the other half of the same Settings table, "Live
      Score" links) already has a matching "Users can delete own live
      matches" policy, which is why that half of the delete button works.

  2. Fix
    - Add the missing DELETE policy, scoped to the row's own `user_id` -
      same shape as every other owner-scoped policy on this table.
*/

CREATE POLICY "Users can delete their own shares"
  ON public.shared_match_results
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
