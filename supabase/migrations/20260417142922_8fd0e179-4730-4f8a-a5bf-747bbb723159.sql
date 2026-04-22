-- Clinical notes by doctors on patient records
CREATE TABLE public.clinical_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_record_id UUID NOT NULL REFERENCES public.patient_records(id) ON DELETE CASCADE,
  patient_user_id UUID NOT NULL,
  doctor_user_id UUID NOT NULL,
  doctor_name TEXT,
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_clinical_notes_patient_user ON public.clinical_notes(patient_user_id, created_at DESC);
CREATE INDEX idx_clinical_notes_record ON public.clinical_notes(patient_record_id);

ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;

-- Doctors (and admins) can view all notes
CREATE POLICY "Doctors can view all notes"
ON public.clinical_notes FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'admin'));

-- Patients can view notes written about them
CREATE POLICY "Patients can view their own notes"
ON public.clinical_notes FOR SELECT
TO authenticated
USING (patient_user_id = auth.uid());

-- Only doctors/admins can write notes, and only as themselves
CREATE POLICY "Doctors can insert notes"
ON public.clinical_notes FOR INSERT
TO authenticated
WITH CHECK (
  doctor_user_id = auth.uid()
  AND (public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'admin'))
);

-- Doctors can update/delete their own notes
CREATE POLICY "Doctors can update own notes"
ON public.clinical_notes FOR UPDATE
TO authenticated
USING (doctor_user_id = auth.uid());

CREATE POLICY "Doctors can delete own notes"
ON public.clinical_notes FOR DELETE
TO authenticated
USING (doctor_user_id = auth.uid());