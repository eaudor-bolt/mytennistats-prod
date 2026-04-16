import { supabase } from '../lib/supabase';

export async function importMatchResults(jsonData?: any, playerId?: string, playerName?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error('No user logged in');
    return;
  }

  const matchs = jsonData?.matchs || [];
  console.log(`Importing ${matchs.length} match results from TenUp...`);

  let successCount = 0;
  let errorCount = 0;

  for (const match of matchs) {
    // Handle WO scenarios
    let scoreString = '';
    if (match.wo) {
      if (match.victoireUtilisateur) {
        scoreString = 'WO';
      } else {
        scoreString = 'WO (D)';
      }
    } else {
      // Build score string from sets
      scoreString = match.sets
        .filter((set: any) => set.scoreUtilisateur !== null && set.scoreAdversaire !== null)
        .map((set: any) => {
          let setScore = `${set.scoreUtilisateur}/${set.scoreAdversaire}`;
          if (set.scoreTieBreak !== null) {
            setScore += ` (${set.scoreTieBreak})`;
          }
          return setScore;
        })
        .join(' - ');
    }

    // Get opponent name
    const opponent = match.adversaires?.[0];
    const opponentName = opponent
      ? `${opponent.prenom} ${opponent.nom}`.trim()
      : 'Unknown Opponent';

    // Extract classement from opponent
    const classement = opponent?.classementLibelle || 'NC';

    // Determine match result for event_details
    let eventDetails = match.nomHomologation || '';
    if (match.wo) {
      eventDetails += ' (WO)';
    } else if (match.abandon) {
      eventDetails += ' (Abandon)';
    }

    // Add match type information
    if (match.victoireUtilisateur) {
      if (match.victoireSuperieure) eventDetails += ' - Victory vs Superior';
      else if (match.victoireEgale) eventDetails += ' - Victory vs Equal';
      else if (match.victoireInferieure) eventDetails += ' - Victory vs Inferior';
    } else {
      if (match.defaiteSuperieure) eventDetails += ' - Defeat vs Superior';
      else if (match.defaiteEgale) eventDetails += ' - Defeat vs Equal';
      else if (match.defaiteInferieure) eventDetails += ' - Defeat vs Inferior';
    }

    // Build comments with opponent details
    let comments = `Match ${match.victoireUtilisateur ? 'won' : 'lost'} - ${match.categorieAge}`;
    if (opponent) {
      comments += `\nAdversaire: ${opponent.prenom} ${opponent.nom}`;
      if (opponent.anneeNaissance) {
        comments += ` (${opponent.anneeNaissance})`;
      }
    }

    const matchResult = {
      user_id: user.id,
      date: match.date.split('T')[0],
      player_name: playerName || opponentName,
      tournament_name: match.nomHomologation || 'N/A',
      score: scoreString || 'N/A',
      classement: classement,
      impressions: {
        forehand: 'good' as 'bad' | 'good' | 'great',
        backhand: 'good' as 'bad' | 'good' | 'great',
        serve: 'good' as 'bad' | 'good' | 'great',
        return: 'good' as 'bad' | 'good' | 'great',
      },
      scoring_history: [],
      event_details: eventDetails.trim(),
      comments: comments.trim(),
    };

    const { error } = await supabase
      .from('match_results')
      .insert(matchResult);

    if (error) {
      console.error(`Error inserting match vs ${opponentName} on ${match.date}:`, error);
      errorCount++;
    } else {
      console.log(`✓ Imported match: vs ${opponentName} - ${match.nomHomologation} on ${match.date}`);
      successCount++;
    }
  }

  console.log(`\nImport complete! Success: ${successCount}, Errors: ${errorCount}`);
  return { successCount, errorCount };
}
