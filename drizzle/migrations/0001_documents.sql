-- Migration: create documents table for SOP / WI / OPL Studio
-- Safe to run multiple times (IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_session_id text NOT NULL,
  title text NOT NULL,
  doc_type text NOT NULL,
  template text NOT NULL,
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_owner_session_id_idx
  ON public.documents (owner_session_id);

CREATE INDEX IF NOT EXISTS documents_updated_at_idx
  ON public.documents (updated_at DESC);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- No public policies on purpose.
-- All access goes through server functions that filter by owner_session_id.
-- Do NOT add a policy that allows anon/authenticated to SELECT/INSERT freely.

-- Grants for the roles used by Supabase (adjust if your project uses different roles)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO anon;
