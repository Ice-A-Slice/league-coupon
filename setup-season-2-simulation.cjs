require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupSeason2Simulation() {
  console.log('🚀 Starting Season 2 Simulation Setup...\n');

  try {
    // 1. Create Season 2
    console.log('1️⃣ Creating Season 2...');
    const { data: season2, error: seasonError } = await supabase
      .from('seasons')
      .insert([{
        name: '2031 Season',
        api_season_year: 2031,
        competition_id: 1,
        start_date: '2025-01-01',
        end_date: '2025-05-31',
        completed_at: null,
        winner_determined_at: null,
        last_round_special_activated: false
      }])
      .select()
      .single();

    if (seasonError) {
      console.error('❌ Error creating season:', seasonError);
      return;
    }
    console.log(`✅ Season 2 created with ID: ${season2.id}`);

    // 2. Create season rounds for Season 2
    console.log('\n2️⃣ Creating season rounds...');
    const seasonRoundsData = [
      {
        season_id: season2.id,
        name: 'Round 1'
      },
      {
        season_id: season2.id,
        name: 'Round 2'
      },
      {
        season_id: season2.id,
        name: 'Final Round'
      }
    ];

    const { data: seasonRounds, error: seasonRoundsError } = await supabase
      .from('rounds')
      .insert(seasonRoundsData)
      .select();

    if (seasonRoundsError) {
      console.error('❌ Error creating season rounds:', seasonRoundsError);
      return;
    }
    console.log(`✅ Created ${seasonRounds.length} season rounds`);

    // 3. Create betting rounds for Season 2
    console.log('\n3️⃣ Creating betting rounds...');
    const bettingRoundsData = [
      {
        name: 'Round 1',
        competition_id: 1,
        status: 'open',
        earliest_fixture_kickoff: '2025-01-01T15:00:00Z',
        latest_fixture_kickoff: '2025-01-15T17:00:00Z'
      },
      {
        name: 'Round 2',
        competition_id: 1,
        status: 'open',
        earliest_fixture_kickoff: '2025-01-16T15:00:00Z',
        latest_fixture_kickoff: '2025-01-31T17:00:00Z'
      },
      {
        name: 'Final Round',
        competition_id: 1,
        status: 'open',
        earliest_fixture_kickoff: '2025-02-01T15:00:00Z',
        latest_fixture_kickoff: '2025-02-15T17:00:00Z'
      }
    ];

    const { data: bettingRounds, error: bettingRoundsError } = await supabase
      .from('betting_rounds')
      .insert(bettingRoundsData)
      .select();

    if (bettingRoundsError) {
      console.error('❌ Error creating betting rounds:', bettingRoundsError);
      return;
    }
    console.log(`✅ Created ${bettingRounds.length} betting rounds`);

    // 4. Get existing teams for proper foreign key relationships
    console.log('\n4️⃣ Getting existing teams...');
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name')
      .in('name', ['Arsenal', 'Liverpool', 'Manchester City', 'Chelsea']);

    if (teamsError || !teams || teams.length === 0) {
      console.error('❌ Error getting teams:', teamsError);
      return;
    }
    
    const teamMap = {};
    teams.forEach(team => {
      teamMap[team.name] = team.id;
    });
    console.log(`✅ Found ${teams.length} teams for fixtures`);

    // 5. Create test fixtures for Season 2  
    console.log('\n5️⃣ Creating test fixtures...');
    const fixturesData = [
      {
        api_fixture_id: 5001,
        round_id: seasonRounds[0].id,
        home_team_id: teamMap['Arsenal'],
        away_team_id: teamMap['Liverpool'],
        kickoff: '2025-01-10T15:00:00Z',
        home_goals: 2,
        away_goals: 1,
        result: '1', // Home win
        status_short: 'FT',
        status_long: 'Match Finished'
      },
      {
        api_fixture_id: 5002,
        round_id: seasonRounds[0].id,
        home_team_id: teamMap['Manchester City'],
        away_team_id: teamMap['Chelsea'],
        kickoff: '2025-01-11T15:00:00Z',
        home_goals: 1,
        away_goals: 1,
        result: 'X', // Draw
        status_short: 'FT',
        status_long: 'Match Finished'
      },
      {
        api_fixture_id: 5003,
        round_id: seasonRounds[1].id,
        home_team_id: teamMap['Chelsea'],
        away_team_id: teamMap['Arsenal'],
        kickoff: '2025-01-25T15:00:00Z',
        home_goals: 0,
        away_goals: 2,
        result: '2', // Away win
        status_short: 'FT',
        status_long: 'Match Finished'
      },
      {
        api_fixture_id: 5004,
        round_id: seasonRounds[2].id,
        home_team_id: teamMap['Liverpool'],
        away_team_id: teamMap['Manchester City'],
        kickoff: '2025-02-10T15:00:00Z',
        home_goals: 3,
        away_goals: 1,
        result: '1', // Home win
        status_short: 'FT',
        status_long: 'Match Finished'
      }
    ];

    const { data: fixtures, error: fixturesError } = await supabase
      .from('fixtures')
      .insert(fixturesData)
      .select();

    if (fixturesError) {
      console.error('❌ Error creating fixtures:', fixturesError);
      return;
    }
    console.log(`✅ Created ${fixtures.length} test fixtures`);

    // 6. Create betting round fixtures relationships
    console.log('\n6️⃣ Creating betting round fixtures relationships...');
    const bettingRoundFixtures = [];
    
    for (let i = 0; i < fixtures.length; i++) {
      bettingRoundFixtures.push({
        betting_round_id: bettingRounds[Math.floor(i / 2)].id,
        fixture_id: fixtures[i].id
      });
    }

    const { error: brfError } = await supabase
      .from('betting_round_fixtures')
      .insert(bettingRoundFixtures);

    if (brfError) {
      console.error('❌ Error creating betting round fixtures:', brfError);
      return;
    }
    console.log(`✅ Created ${bettingRoundFixtures.length} betting round fixture relationships`);

    // 7. Get existing users
    console.log('\n7️⃣ Getting existing users...');
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .limit(5);

    if (usersError || !users || users.length === 0) {
      console.error('❌ Error getting users:', usersError);
      return;
    }
    console.log(`✅ Found ${users.length} users for simulation`);

    // 8. Get players for predictions
    console.log('\n8️⃣ Getting players for predictions...');
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('id, name')
      .in('name', ['Mohamed Salah', 'Erling Haaland']);
    
    if (playersError || !players || players.length === 0) {
      console.error('❌ Error getting players:', playersError);
      // Continue without player predictions
      const playerMap = {};
    } else {
      var playerMap = {};
      players.forEach(player => {
        if (player.name.includes('Salah')) playerMap['Salah'] = player.id;
        if (player.name.includes('Haaland')) playerMap['Haaland'] = player.id;
      });
      console.log(`✅ Found ${players.length} players for predictions`);
    }

    // 9. Create season predictions that will result in interesting ties
    console.log('\n9️⃣ Creating season predictions...');
    const seasonPredictions = [];
    
    // For Season 2, we'll say Arsenal wins the league and Salah is top scorer
    // Create predictions for each user - both users will predict correctly for ties
    for (let i = 0; i < users.length; i++) {
      // League winner predictions
      seasonPredictions.push({
        user_id: users[i].id,
        season_id: season2.id,
        question_type: 'league_winner',
        answered_team_id: teamMap['Arsenal'] // Both users predict Arsenal correctly
      });
      
      // Top scorer predictions (if we have player IDs)
      if (playerMap['Salah']) {
        seasonPredictions.push({
          user_id: users[i].id,
          season_id: season2.id,
          question_type: 'top_scorer',
          answered_player_id: playerMap['Salah'] // Both users predict Salah correctly
        });
      }
      
      // Best goal difference predictions
      seasonPredictions.push({
        user_id: users[i].id,
        season_id: season2.id,
        question_type: 'best_goal_difference',
        answered_team_id: i === 0 ? teamMap['Arsenal'] : teamMap['Liverpool'] // Different predictions
      });
      
      // Last place predictions
      seasonPredictions.push({
        user_id: users[i].id,
        season_id: season2.id,
        question_type: 'last_place',
        answered_team_id: teamMap['Chelsea'] // Both users predict Chelsea correctly
      });
    }

    const { data: predictions, error: predictionsError } = await supabase
      .from('user_season_answers')
      .insert(seasonPredictions)
      .select();

    if (predictionsError) {
      console.error('❌ Error creating predictions:', predictionsError);
      return;
    }
    console.log(`✅ Created ${predictions.length} season predictions`);

    // 🔟 Create match predictions that will result in cup ties
    console.log('\n🔟 Creating match predictions...');
    const matchPredictions = [];
    
    // Create predictions for each user for each fixture
    // Design: All users will get some points to create ties
    const predictionPatterns = [];
    
    for (let i = 0; i < users.length; i++) {
      const patternOptions = [
        // Pattern 0: Gets fixtures 2001,2002 correct (2 points)
        { user_id: users[i].id, predictions: [['1', '1'], ['X', 'X'], ['1', '2'], ['X', '1']] },
        // Pattern 1: Gets fixtures 2001,2003 correct (2 points) 
        { user_id: users[i].id, predictions: [['1', '1'], ['1', 'X'], ['2', '2'], ['X', '1']] },
        // Pattern 2: Gets fixtures 2002,2004 correct (2 points)
        { user_id: users[i].id, predictions: [['2', '1'], ['X', 'X'], ['1', '2'], ['1', '1']] },
        // Pattern 3: Gets fixture 2003 correct (1 point)
        { user_id: users[i].id, predictions: [['2', '1'], ['1', 'X'], ['2', '2'], ['X', '1']] },
        // Pattern 4: Gets fixture 2004 correct (1 point)
        { user_id: users[i].id, predictions: [['X', '1'], ['2', 'X'], ['1', '2'], ['1', '1']] }
      ];
      
      predictionPatterns.push(patternOptions[i % patternOptions.length]);
    }

    for (const pattern of predictionPatterns) {
      for (let i = 0; i < fixtures.length; i++) {
        matchPredictions.push({
          user_id: pattern.user_id,
          fixture_id: fixtures[i].id,
          betting_round_id: bettingRounds[Math.floor(i / 2)].id, // Map fixtures to correct betting rounds
          prediction: pattern.predictions[i][0], // User's prediction
          points_awarded: null // Will be calculated later
        });
      }
    }

    const { data: userBets, error: betsError } = await supabase
      .from('user_bets')
      .insert(matchPredictions)
      .select();

    if (betsError) {
      console.error('❌ Error creating match predictions:', betsError);
      return;
    }
    console.log(`✅ Created ${userBets.length} match predictions`);

    // 1️⃣1️⃣ Complete the betting rounds
    console.log('\n1️⃣1️⃣ Completing betting rounds...');
    const { error: completeRoundsError } = await supabase
      .from('betting_rounds')
      .update({ status: 'scored' })
      .in('id', bettingRounds.map(r => r.id));

    if (completeRoundsError) {
      console.error('❌ Error completing rounds:', completeRoundsError);
      return;
    }
    console.log('✅ Marked all betting rounds as scored');

    // 1️⃣2️⃣ Complete the season
    console.log('\n1️⃣2️⃣ Completing Season 2...');
    const { error: completeSeasonError } = await supabase
      .from('seasons')
      .update({ 
        completed_at: new Date().toISOString(),
        last_round_special_activated: true,
        last_round_special_activated_at: new Date().toISOString()
      })
      .eq('id', season2.id);

    if (completeSeasonError) {
      console.error('❌ Error completing season:', completeSeasonError);
      return;
    }
    console.log('✅ Season 2 completed with Last Round Special activated');

    console.log('\n🎉 Season 2 Simulation Setup Complete!');
    console.log('\n📊 Expected Results:');
    console.log('League Winners: 2 users tied (Arsenal predictors) with ~6 points each');
    console.log('Cup Winners: 3 users tied with 2 points each');
    console.log('\n🧪 Next Steps:');
    console.log('1. Run points calculation');
    console.log('2. Run winner determination');
    console.log('3. Check Hall of Fame displays both seasons');

    return { season2, seasonRounds, bettingRounds, fixtures, users };

  } catch (error) {
    console.error('❌ Simulation setup failed:', error);
    throw error;
  }
}

// Run the simulation
setupSeason2Simulation().catch(console.error);