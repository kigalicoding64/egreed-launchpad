ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS install_command text,
  ADD COLUMN IF NOT EXISTS start_command text,
  ADD COLUMN IF NOT EXISTS output_dir text;