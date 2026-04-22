ALTER TABLE public.clinical_notes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clinical_notes;