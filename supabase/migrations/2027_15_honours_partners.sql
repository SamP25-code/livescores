-- Past winners typed onto an honours board: a doubles year names both
-- partners, so it shows on both their player pages
alter table honours_history add column if not exists winner_partner_id uuid references people(id);
alter table honours_history add column if not exists runner_up_partner_id uuid references people(id);
