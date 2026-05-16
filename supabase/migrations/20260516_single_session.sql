-- Add plaintext token column to access_tokens (medquiz-style: no hashing)
ALTER TABLE public.access_tokens ADD COLUMN IF NOT EXISTS token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS access_tokens_token_idx ON public.access_tokens (token) WHERE token IS NOT NULL;

-- Track the one active session per profile for single-session enforcement
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_session_id UUID;
