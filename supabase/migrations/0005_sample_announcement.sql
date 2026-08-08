-- ===========================================================================
-- Sample announcement (demo/testing only).
-- An "all" audience, already-sent announcement so the parent announcement
-- archive has something to render before Debbie sends real ones. Safe for
-- Debbie to delete from admin later.
-- ===========================================================================

insert into announcements (subject, body, sender, audience_type, audience_ref, sent_at)
values (
  'Welcome to the new MacVoy parent portal',
  E'Hello families,\n\nWelcome to our new online home! You can now view your dancer''s schedule, see upcoming payments, and read announcements right here.\n\nWe''re excited for the 2026–2027 season.\n\n— Debbie',
  'debbie@macvoyirishdance.com',
  'all',
  '{}'::jsonb,
  now()
);
