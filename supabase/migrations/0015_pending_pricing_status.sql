-- A dancer who self-registered through the open form (no spreadsheet match,
-- no rate set for their class, or otherwise needs Debbie to price it) lands
-- here: their record, class enrollment, and signed waivers are saved
-- immediately, but billing waits until an admin sets the price and approves.
alter table family_members drop constraint family_members_status_check;
alter table family_members
  add constraint family_members_status_check
  check (status in ('active', 'removed', 'pending_pricing'));
