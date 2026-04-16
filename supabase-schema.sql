-- ================================================
-- HAPPYCATH ACADEMY — Schéma Supabase
-- Coller dans : Supabase > SQL Editor > New query
-- ================================================

-- MEMBRES
create table if not exists membres (
  id text primary key,
  nom text not null,
  prenom text,
  telephone text,
  email text,
  abonnement text,
  date_inscription date,
  actif boolean default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- COURS
create table if not exists cours (
  id text primary key,
  nom text not null,
  jour integer not null, -- 0=dim, 1=lun, ..., 6=sam
  heure text not null,
  duree text,
  coach text,
  categorie text, -- 'Gym', 'Danse', 'Pilates', etc.
  tarif_plein numeric(8,2),
  tarif_reduit numeric(8,2),
  actif boolean default true,
  created_at timestamptz default now()
);

-- INSCRIPTIONS (membre ↔ cours)
create table if not exists inscriptions (
  id bigserial primary key,
  cours_id text references cours(id) on delete cascade,
  membre_id text references membres(id) on delete cascade,
  saison text default '2025-2026',
  created_at timestamptz default now(),
  unique(cours_id, membre_id, saison)
);

-- HISTORIQUE APPELS
create table if not exists historique (
  id text primary key,
  cours_id text references cours(id) on delete cascade,
  cours_nom text,
  date date not null,
  presents text[], -- tableau d'ids membres
  guests jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- REGLEMENTS (chèques, espèces, CB)
create table if not exists reglements (
  id bigserial primary key,
  membre_id text references membres(id) on delete set null,
  payeur text not null,
  montant numeric(10,2) not null,
  mode text not null, -- 'Chèque', 'Espèces', 'CB', 'Virement'
  banque text,
  numero_cheque text,
  mois date, -- mois du règlement
  trimestre text, -- ex: 'Trim. 1 2025-2026'
  numero_remise text, -- ex: 'Rem CHQ 2509-03'
  commentaire text,
  statut text default 'en_attente', -- 'en_attente', 'remis', 'encaisse'
  saison text default '2025-2026',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- REMISES BANQUE
create table if not exists remises (
  id bigserial primary key,
  numero text unique not null, -- ex: 'Rem CHQ 2509-03'
  type text not null, -- 'CHQ', 'ESP', 'CB'
  banque text,
  date_remise date,
  montant_total numeric(10,2),
  nb_reglements integer,
  statut text default 'prepare', -- 'prepare', 'remis', 'encaisse'
  created_at timestamptz default now()
);

-- BUDGET PREVISIONNEL
create table if not exists budget_previsionnel (
  id bigserial primary key,
  saison text not null default '2025-2026',
  type text not null, -- 'recette' ou 'charge'
  categorie text,
  libelle text not null,
  entite text default 'Asso', -- 'Asso' ou 'EI'
  aout numeric(10,2) default 0,
  septembre numeric(10,2) default 0,
  octobre numeric(10,2) default 0,
  novembre numeric(10,2) default 0,
  decembre numeric(10,2) default 0,
  janvier numeric(10,2) default 0,
  fevrier numeric(10,2) default 0,
  mars numeric(10,2) default 0,
  avril numeric(10,2) default 0,
  mai numeric(10,2) default 0,
  juin numeric(10,2) default 0,
  juillet numeric(10,2) default 0,
  created_at timestamptz default now()
);

-- BUDGET REEL
create table if not exists budget_reel (
  id bigserial primary key,
  saison text not null default '2025-2026',
  type text not null,
  categorie text,
  libelle text not null,
  entite text default 'Asso',
  aout numeric(10,2) default 0,
  septembre numeric(10,2) default 0,
  octobre numeric(10,2) default 0,
  novembre numeric(10,2) default 0,
  decembre numeric(10,2) default 0,
  janvier numeric(10,2) default 0,
  fevrier numeric(10,2) default 0,
  mars numeric(10,2) default 0,
  avril numeric(10,2) default 0,
  mai numeric(10,2) default 0,
  juin numeric(10,2) default 0,
  juillet numeric(10,2) default 0,
  created_at timestamptz default now()
);

-- FACTURES
create table if not exists factures (
  id bigserial primary key,
  numero text unique not null,
  type text not null, -- 'membre' ou 'professeur'
  destinataire_id text,
  destinataire_nom text not null,
  date_emission date not null,
  date_echeance date,
  lignes jsonb not null default '[]',
  montant_ht numeric(10,2),
  tva numeric(10,2) default 0,
  montant_ttc numeric(10,2),
  statut text default 'brouillon', -- 'brouillon', 'envoyee', 'payee'
  saison text default '2025-2026',
  created_at timestamptz default now()
);

-- ================================================
-- REALTIME : activer la sync temps réel
-- ================================================
alter publication supabase_realtime add table membres;
alter publication supabase_realtime add table cours;
alter publication supabase_realtime add table inscriptions;
alter publication supabase_realtime add table historique;
alter publication supabase_realtime add table reglements;

-- ================================================
-- RLS : Row Level Security (accès libre pour l'instant)
-- On affinera avec l'authentification plus tard
-- ================================================
alter table membres enable row level security;
alter table cours enable row level security;
alter table inscriptions enable row level security;
alter table historique enable row level security;
alter table reglements enable row level security;
alter table remises enable row level security;
alter table budget_previsionnel enable row level security;
alter table budget_reel enable row level security;
alter table factures enable row level security;

-- Politique temporaire : tout le monde peut lire/écrire
-- (on sécurisera avec auth utilisateur dans une prochaine étape)
create policy "acces_libre" on membres for all using (true) with check (true);
create policy "acces_libre" on cours for all using (true) with check (true);
create policy "acces_libre" on inscriptions for all using (true) with check (true);
create policy "acces_libre" on historique for all using (true) with check (true);
create policy "acces_libre" on reglements for all using (true) with check (true);
create policy "acces_libre" on remises for all using (true) with check (true);
create policy "acces_libre" on budget_previsionnel for all using (true) with check (true);
create policy "acces_libre" on budget_reel for all using (true) with check (true);
create policy "acces_libre" on factures for all using (true) with check (true);

-- ================================================
-- DONNEES DE DÉPART (depuis FitCall existant)
-- ================================================
insert into cours (id, nom, jour, heure, duree, coach) values
  ('c001', 'Pilates', 1, '09h00', '55min', 'Anna'),
  ('c002', 'Yoga Doux', 3, '10h00', '60min', 'Laura'),
  ('c003', 'Cardio Box', 4, '18h30', '50min', 'Marc'),
  ('c004', 'Stretching', 5, '12h00', '45min', 'Anna')
on conflict (id) do nothing;

insert into membres (id, nom, abonnement, actif) values
  ('m001', 'Sophie Martin', 'Pilates Lun · Yoga Mer', true),
  ('m002', 'Claire Dupont', 'Pilates Lun · Cardio Jeu', true),
  ('m003', 'Emma Bernard', 'Pilates Lun', true)
on conflict (id) do nothing;

insert into inscriptions (cours_id, membre_id) values
  ('c001', 'm001'), ('c001', 'm002'), ('c001', 'm003'),
  ('c002', 'm001'), ('c002', 'm002'),
  ('c003', 'm002'), ('c003', 'm003')
on conflict do nothing;
