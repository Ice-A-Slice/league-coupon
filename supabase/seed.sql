-- Seed Competitions
INSERT INTO public.competitions (id, name, api_league_id, country_name, type) 
VALUES (1, 'Tippeligaen', 203, 'Norway', 'League') ON CONFLICT (id) DO NOTHING;

-- Seed Seasons
INSERT INTO public.seasons (id, competition_id, name, api_season_year, start_date, end_date, is_current) 
VALUES (1, 1, 'Tippeligaen 2024', 2024, '2024-03-10', '2024-11-28', true) ON CONFLICT (id) DO NOTHING;

-- Seed Betting Rounds
INSERT INTO public.betting_rounds (id, competition_id, name, status, updated_at) 
VALUES 
(1, 1, 'Round 1', 'open', NOW()),
(2, 1, 'Round 2', 'open', NOW())
ON CONFLICT (id) DO NOTHING; 