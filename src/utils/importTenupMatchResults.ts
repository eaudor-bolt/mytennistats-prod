import { supabase } from '../lib/supabase';

export async function importTenupMatchResults(playerId: string, playerName: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error('No user logged in');
    return;
  }

  const tenupData = await fetch('/code/tenup.json').then(res => res.json());

  if (!Array.isArray(tenupData)) {
    console.error('Invalid TenUp data format');
    return { successCount: 0, errorCount: 1, duplicateCount: 0 };
  }

  console.log(`Importing ${tenupData.length} match results from TenUp...`);

  const { data: existingMatches } = await supabase
    .from('match_results')
    .select('date, tournament_name, score')
    .eq('user_id', user.id);

  const existingMatchSet = new Set(
    (existingMatches || []).map(m => `${m.date}|${m.tournament_name}|${m.score}`)
  );

  let successCount = 0;
  let errorCount = 0;
  let duplicateCount = 0;

  for (const match of tenupData) {
    let scoreString = '';
    if (match.wo) {
      if (match.victoireUtilisateur) {
        scoreString = 'WO';
      } else {
        scoreString = 'WO (D)';
      }
    } else {
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

    const matchDate = match.date.split('T')[0];
    const tournamentName = match.nomHomologation || 'N/A';

    const duplicateKey = `${matchDate}|${tournamentName}|${scoreString}`;
    if (existingMatchSet.has(duplicateKey)) {
      console.log(`⊗ Skipping duplicate match: ${tournamentName} on ${matchDate}`);
      duplicateCount++;
      continue;
    }

    const opponent = match.adversaires?.[0];
    const opponentName = opponent
      ? `${opponent.prenom} ${opponent.nom}`.trim()
      : 'Unknown Opponent';

    const classement = opponent?.classementLibelle || 'NC';

    let eventDetails = tournamentName;
    if (match.wo) {
      eventDetails += ' (WO)';
    } else if (match.abandon) {
      eventDetails += ' (Abandon)';
    }

    if (match.victoireUtilisateur) {
      if (match.victoireSuperieure) eventDetails += ' - Victory vs Superior';
      else if (match.victoireEgale) eventDetails += ' - Victory vs Equal';
      else if (match.victoireInferieure) eventDetails += ' - Victory vs Inferior';
    } else {
      if (match.defaiteSuperieure) eventDetails += ' - Defeat vs Superior';
      else if (match.defaiteEgale) eventDetails += ' - Defeat vs Equal';
      else if (match.defaiteInferieure) eventDetails += ' - Defeat vs Inferior';
    }

    let comments = `Match ${match.victoireUtilisateur ? 'won' : 'lost'} - ${match.categorieAge}`;
    if (opponent) {
      comments += `\nAdversaire: ${opponent.prenom} ${opponent.nom}`;
      if (opponent.anneeNaissance) {
        comments += ` (${opponent.anneeNaissance})`;
      }
    }

    const matchResult = {
      user_id: user.id,
      date: matchDate,
      player_name: playerName,
      tournament_name: tournamentName,
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
      console.error(`Error inserting match vs ${opponentName} on ${matchDate}:`, error);
      errorCount++;
    } else {
      console.log(`✓ Imported match: vs ${opponentName} - ${tournamentName} on ${matchDate}`);
      successCount++;
      existingMatchSet.add(duplicateKey);
    }
  }

  console.log(`\nImport complete! Success: ${successCount}, Duplicates skipped: ${duplicateCount}, Errors: ${errorCount}`);
  return { successCount, errorCount, duplicateCount };
}
