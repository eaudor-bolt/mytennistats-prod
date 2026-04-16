/*
  # Add Sample Match Data

  1. Sample Data
    - Add sample players (Ida, Ruben, Papa and opponents)
    - Add sample matches with realistic scores
    - Link matches to existing tournaments
  
  2. Notes
    - Uses realistic tennis scoring
    - Includes completed matches with winners
    - Safe to run multiple times (checks if data exists)
*/

-- Insert sample players if they don't exist
INSERT INTO players (name, email, ranking)
SELECT 'Ida', 'ida@example.com', 15
WHERE NOT EXISTS (SELECT 1 FROM players WHERE name = 'Ida');

INSERT INTO players (name, email, ranking)
SELECT 'Ruben', 'ruben@example.com', 20
WHERE NOT EXISTS (SELECT 1 FROM players WHERE name = 'Ruben');

INSERT INTO players (name, email, ranking)
SELECT 'Papa', 'papa@example.com', 10
WHERE NOT EXISTS (SELECT 1 FROM players WHERE name = 'Papa');

INSERT INTO players (name, email, ranking)
SELECT 'Sophie Martin', 'sophie.martin@example.com', 18
WHERE NOT EXISTS (SELECT 1 FROM players WHERE name = 'Sophie Martin');

INSERT INTO players (name, email, ranking)
SELECT 'Lucas Dubois', 'lucas.dubois@example.com', 22
WHERE NOT EXISTS (SELECT 1 FROM players WHERE name = 'Lucas Dubois');

INSERT INTO players (name, email, ranking)
SELECT 'Marie Bernard', 'marie.bernard@example.com', 16
WHERE NOT EXISTS (SELECT 1 FROM players WHERE name = 'Marie Bernard');

INSERT INTO players (name, email, ranking)
SELECT 'Thomas Petit', 'thomas.petit@example.com', 12
WHERE NOT EXISTS (SELECT 1 FROM players WHERE name = 'Thomas Petit');

INSERT INTO players (name, email, ranking)
SELECT 'Emma Leroy', 'emma.leroy@example.com', 25
WHERE NOT EXISTS (SELECT 1 FROM players WHERE name = 'Emma Leroy');

-- Add sample matches if they don't exist yet
DO $$
DECLARE
  v_ida_id uuid;
  v_ruben_id uuid;
  v_papa_id uuid;
  v_sophie_id uuid;
  v_lucas_id uuid;
  v_marie_id uuid;
  v_thomas_id uuid;
  v_emma_id uuid;
  v_tournament_id uuid;
BEGIN
  -- Get player IDs
  SELECT id INTO v_ida_id FROM players WHERE name = 'Ida' LIMIT 1;
  SELECT id INTO v_ruben_id FROM players WHERE name = 'Ruben' LIMIT 1;
  SELECT id INTO v_papa_id FROM players WHERE name = 'Papa' LIMIT 1;
  SELECT id INTO v_sophie_id FROM players WHERE name = 'Sophie Martin' LIMIT 1;
  SELECT id INTO v_lucas_id FROM players WHERE name = 'Lucas Dubois' LIMIT 1;
  SELECT id INTO v_marie_id FROM players WHERE name = 'Marie Bernard' LIMIT 1;
  SELECT id INTO v_thomas_id FROM players WHERE name = 'Thomas Petit' LIMIT 1;
  SELECT id INTO v_emma_id FROM players WHERE name = 'Emma Leroy' LIMIT 1;
  
  -- Get a tournament ID
  SELECT id INTO v_tournament_id FROM tournaments LIMIT 1;
  
  -- Only insert if we have the necessary data and matches don't exist
  IF v_ida_id IS NOT NULL AND v_sophie_id IS NOT NULL AND v_tournament_id IS NOT NULL THEN
    -- Ida vs Sophie - Completed
    IF NOT EXISTS (SELECT 1 FROM matches WHERE player1_id = v_ida_id AND player2_id = v_sophie_id) THEN
      INSERT INTO matches (tournament_id, player1_id, player2_id, player1_score, player2_score, winner_id, status, round, match_date)
      VALUES (
        v_tournament_id,
        v_ida_id,
        v_sophie_id,
        '6-3, 6-4',
        '3-6, 4-6',
        v_ida_id,
        'completed',
        'Quarter Final',
        CURRENT_DATE - INTERVAL '2 days'
      );
    END IF;
    
    -- Ruben vs Lucas - Completed
    IF v_ruben_id IS NOT NULL AND v_lucas_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM matches WHERE player1_id = v_ruben_id AND player2_id = v_lucas_id) THEN
      INSERT INTO matches (tournament_id, player1_id, player2_id, player1_score, player2_score, winner_id, status, round, match_date)
      VALUES (
        v_tournament_id,
        v_ruben_id,
        v_lucas_id,
        '7-6, 4-6, 6-4',
        '6-7, 6-4, 4-6',
        v_ruben_id,
        'completed',
        'Semi Final',
        CURRENT_DATE - INTERVAL '1 day'
      );
    END IF;
    
    -- Papa vs Thomas - Completed
    IF v_papa_id IS NOT NULL AND v_thomas_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM matches WHERE player1_id = v_papa_id AND player2_id = v_thomas_id) THEN
      INSERT INTO matches (tournament_id, player1_id, player2_id, player1_score, player2_score, winner_id, status, round, match_date)
      VALUES (
        v_tournament_id,
        v_papa_id,
        v_thomas_id,
        '6-2, 6-3',
        '2-6, 3-6',
        v_papa_id,
        'completed',
        'Final',
        CURRENT_DATE
      );
    END IF;
    
    -- Ida vs Marie - In Progress
    IF v_marie_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM matches WHERE player1_id = v_ida_id AND player2_id = v_marie_id) THEN
      INSERT INTO matches (tournament_id, player1_id, player2_id, player1_score, player2_score, winner_id, status, round, match_date)
      VALUES (
        v_tournament_id,
        v_ida_id,
        v_marie_id,
        '6-4, 3-2',
        '4-6, 2-3',
        NULL,
        'in_progress',
        'Semi Final',
        CURRENT_DATE
      );
    END IF;
    
    -- Ruben vs Emma - Scheduled
    IF v_emma_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM matches WHERE player1_id = v_ruben_id AND player2_id = v_emma_id) THEN
      INSERT INTO matches (tournament_id, player1_id, player2_id, player1_score, player2_score, winner_id, status, round, match_date)
      VALUES (
        v_tournament_id,
        v_ruben_id,
        v_emma_id,
        NULL,
        NULL,
        NULL,
        'scheduled',
        'Quarter Final',
        CURRENT_DATE + INTERVAL '1 day'
      );
    END IF;
  END IF;
END $$;
