-- ============================================================
-- Migration 002: Create card data tables
-- Games metadata, card categories, and cards
-- ============================================================

-- Games table
CREATE TABLE public.games (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  min_players INTEGER NOT NULL DEFAULT 2,
  max_players INTEGER NOT NULL DEFAULT 4,
  category TEXT DEFAULT 'card',
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Card categories table
CREATE TABLE public.card_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (game_id, name)
);

-- Cards table
CREATE TABLE public.cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.card_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT DEFAULT '',
  effects JSONB DEFAULT '{}',
  attributes JSONB DEFAULT '{}',
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_card_categories_game_id
  ON public.card_categories(game_id);

CREATE INDEX idx_cards_game_id
  ON public.cards(game_id);

CREATE INDEX idx_cards_category_id
  ON public.cards(category_id);

CREATE INDEX idx_games_category
  ON public.games(category);

-- Full-text search index on cards
CREATE INDEX idx_cards_search
  ON public.cards
  USING gin(to_tsvector('english', name || ' ' || display_name || ' ' || description));

-- Full-text search index on games
CREATE INDEX idx_games_search
  ON public.games
  USING gin(to_tsvector('english', name || ' ' || description));

-- Enable Row Level Security
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY "games_select"
  ON public.games FOR SELECT
  USING (true);

CREATE POLICY "card_categories_select"
  ON public.card_categories FOR SELECT
  USING (true);

CREATE POLICY "cards_select"
  ON public.cards FOR SELECT
  USING (true);

-- Authenticated users can insert
CREATE POLICY "games_insert"
  ON public.games FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "card_categories_insert"
  ON public.card_categories FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "cards_insert"
  ON public.cards FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can update
CREATE POLICY "games_update"
  ON public.games FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "card_categories_update"
  ON public.card_categories FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "cards_update"
  ON public.cards FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER games_updated_at
  BEFORE UPDATE ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER card_categories_updated_at
  BEFORE UPDATE ON public.card_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER cards_updated_at
  BEFORE UPDATE ON public.cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- Seed data: Games (for testing and development)
-- ============================================================
INSERT INTO public.games (id, name, description, min_players, max_players, category, tags, metadata)
VALUES
  ('uno', 'UNO', 'Classic card game where players race to empty their hand', 2, 10, 'card', ARRAY['family', 'classic', 'quick'], '{"supportsAI": true, "gameType": "multiplayer"}'),
  ('werewolf', 'Werewolf', 'Social deduction game of werewolves vs villagers', 5, 12, 'social_deduction', ARRAY['party', 'social', 'deduction'], '{"supportsAI": false, "gameType": "multiplayer"}')
ON CONFLICT (id) DO NOTHING;

-- TODO: Card categories and cards seed data
-- Card data will be implemented per-game as needed:
-- - UNO: number cards (0-9 x 4 colors), action cards (skip, reverse, draw2), wild cards
-- - Werewolf: role cards (werewolf, seer, villager, etc.)
-- See: docs/games/[game]/RULES.md for card specifications
