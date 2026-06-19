CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  muscle_group TEXT,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE exercises ADD COLUMN IF NOT EXISTS muscle_group TEXT;

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_explicit BOOLEAN;
UPDATE sessions SET is_explicit = false WHERE is_explicit IS NULL;
UPDATE sessions se
SET ended_at = GREATEST(
  COALESCE((SELECT MAX(st.created_at) FROM sets st WHERE st.session_id = se.id), se.started_at),
  se.started_at
)
WHERE se.is_explicit = false AND se.ended_at IS NULL;
ALTER TABLE sessions ALTER COLUMN is_explicit SET DEFAULT false;
ALTER TABLE sessions ALTER COLUMN is_explicit SET NOT NULL;

CREATE TABLE IF NOT EXISTS sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  weight NUMERIC(8,2) NOT NULL CHECK (weight >= 0),
  reps INTEGER NOT NULL CHECK (reps > 0),
  set_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exercises_user ON exercises(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_exercises_user_lower_name ON exercises(user_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_sessions_user_started ON sessions(user_id, started_at DESC);
DROP INDEX IF EXISTS idx_sessions_user_active;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_user_active ON sessions(user_id) WHERE ended_at IS NULL AND is_explicit = true;
CREATE INDEX IF NOT EXISTS idx_sets_session_order ON sets(session_id, set_order);
CREATE INDEX IF NOT EXISTS idx_sets_exercise_created ON sets(exercise_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);
