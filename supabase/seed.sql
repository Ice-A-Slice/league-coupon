-- Seed data for user_round_dynamic_points
-- Assuming user_id '86849fee-0d7c-47fb-8303-d26eb3276ef0' and scored betting_round_ids 1 and 2 from images
-- Using placeholder dynamic_points values (e.g., 6 and 9) as calculation logic isn't built yet.

INSERT INTO public.user_round_dynamic_points (user_id, betting_round_id, dynamic_points, season_id)
VALUES
  ('86849fee-0d7c-47fb-8303-d26eb3276ef0', 1, 6, 1), -- For Round 67 (ID 1)
  ('86849fee-0d7c-47fb-8303-d26eb3276ef0', 2, 9, 1); -- For Round 69 (ID 2)

-- Note: Ensure these user_id, betting_round_id, and season_id values exist in their respective tables.
-- The dynamic_points are placeholders. 