ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'github';

CREATE TABLE IF NOT EXISTS public.project_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  path text NOT NULL,
  content text NOT NULL DEFAULT '',
  origin text NOT NULL DEFAULT 'upload',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, path)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_files TO authenticated;
GRANT ALL ON public.project_files TO service_role;

ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own project files" ON public.project_files;
CREATE POLICY "Users manage own project files"
  ON public.project_files FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS project_files_project_idx ON public.project_files(project_id);