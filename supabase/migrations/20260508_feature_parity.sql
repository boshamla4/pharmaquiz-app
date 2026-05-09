CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_hash TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  ip_address TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.questions (
  id TEXT PRIMARY KEY,
  section_name TEXT NOT NULL,
  question_number INT NOT NULL,
  source_order INT NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('single', 'multiple')),
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_page INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'submitted')),
  mode TEXT NOT NULL CHECK (mode IN ('ordered', 'random')),
  timer_seconds INT,
  current_index INT NOT NULL DEFAULT 0,
  answered_questions INT NOT NULL DEFAULT 0,
  total_questions INT NOT NULL DEFAULT 0,
  score NUMERIC(10,2),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.attempt_questions (
  id UUID PRIMARY KEY,
  attempt_id UUID NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  question_id TEXT REFERENCES public.questions(id) ON DELETE SET NULL,
  position INT NOT NULL,
  question_snapshot JSONB NOT NULL,
  selected_answer_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_correct BOOLEAN,
  score_weight NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(attempt_id, position)
);

CREATE TABLE IF NOT EXISTS public.feedback_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  whatsapp TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.api_performance_metrics (
  id BIGSERIAL PRIMARY KEY,
  route TEXT NOT NULL,
  status_code INT NOT NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  total_ms INT NOT NULL,
  item_count INT,
  stages JSONB NOT NULL DEFAULT '{}'::jsonb,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_tokens_profile_id ON public.access_tokens(profile_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_profile_id ON public.user_sessions(profile_id);
CREATE INDEX IF NOT EXISTS idx_questions_section_name ON public.questions(section_name, source_order);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_profile_id ON public.quiz_attempts(profile_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempt_questions_attempt_id ON public.attempt_questions(attempt_id, position);
CREATE INDEX IF NOT EXISTS idx_feedback_comments_profile_id ON public.feedback_comments(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_metrics_route ON public.api_performance_metrics(route, created_at DESC);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_performance_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "sessions_select_own" ON public.user_sessions;
CREATE POLICY "sessions_select_own" ON public.user_sessions
  FOR SELECT USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "sessions_update_own" ON public.user_sessions;
CREATE POLICY "sessions_update_own" ON public.user_sessions
  FOR UPDATE USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "attempts_select_own" ON public.quiz_attempts;
CREATE POLICY "attempts_select_own" ON public.quiz_attempts
  FOR SELECT USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "attempts_insert_own" ON public.quiz_attempts;
CREATE POLICY "attempts_insert_own" ON public.quiz_attempts
  FOR INSERT WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "attempts_update_own" ON public.quiz_attempts;
CREATE POLICY "attempts_update_own" ON public.quiz_attempts
  FOR UPDATE USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "attempt_questions_select_own" ON public.attempt_questions;
CREATE POLICY "attempt_questions_select_own" ON public.attempt_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      WHERE qa.id = attempt_questions.attempt_id AND qa.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "attempt_questions_insert_own" ON public.attempt_questions;
CREATE POLICY "attempt_questions_insert_own" ON public.attempt_questions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      WHERE qa.id = attempt_questions.attempt_id AND qa.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "attempt_questions_update_own" ON public.attempt_questions;
CREATE POLICY "attempt_questions_update_own" ON public.attempt_questions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      WHERE qa.id = attempt_questions.attempt_id AND qa.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "questions_read_authenticated" ON public.questions;
CREATE POLICY "questions_read_authenticated" ON public.questions
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "feedback_comments_select_own" ON public.feedback_comments;
CREATE POLICY "feedback_comments_select_own" ON public.feedback_comments
  FOR SELECT USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "feedback_comments_insert_own" ON public.feedback_comments;
CREATE POLICY "feedback_comments_insert_own" ON public.feedback_comments
  FOR INSERT WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "api_metrics_no_direct_access" ON public.api_performance_metrics;
CREATE POLICY "api_metrics_no_direct_access" ON public.api_performance_metrics
  FOR ALL USING (FALSE) WITH CHECK (FALSE);

DROP POLICY IF EXISTS "access_tokens_no_direct_access" ON public.access_tokens;
CREATE POLICY "access_tokens_no_direct_access" ON public.access_tokens
  FOR ALL USING (FALSE) WITH CHECK (FALSE);
