CREATE TABLE public.sos_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lon double precision NOT NULL CHECK (lon BETWEEN -180 AND 180),
  area text NOT NULL DEFAULT '' CHECK (char_length(area) <= 200),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','responding','resolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sos_alerts TO anon, authenticated;
GRANT ALL ON public.sos_alerts TO service_role;
ALTER TABLE public.sos_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can raise sos" ON public.sos_alerts FOR INSERT TO anon, authenticated WITH CHECK (status = 'open');
CREATE POLICY "dashboard can read sos" ON public.sos_alerts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "dashboard can update status" ON public.sos_alerts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (status IN ('open','responding','resolved'));
ALTER PUBLICATION supabase_realtime ADD TABLE public.sos_alerts;