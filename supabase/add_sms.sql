-- SMS შეტყობინებები: როდის გაიგზავნა დაჯავშნის და წინა დღის შეხსენების SMS.
alter table public.appointments add column if not exists sms_confirm_sent_at timestamptz;
alter table public.appointments add column if not exists sms_reminder_sent_at timestamptz;

notify pgrst, 'reload schema';
