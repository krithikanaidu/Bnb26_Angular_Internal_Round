-- Run in Supabase SQL editor. Sequelize `sync({alter:true})` also creates these automatically.
create extension if not exists "uuid-ossp";
create table if not exists "Projects" (id uuid primary key default uuid_generate_v4(), title text not null, description text, status text default 'idea', tags jsonb default '[]', created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists "Assets" (id uuid primary key default uuid_generate_v4(), project_id uuid references "Projects"(id) on delete cascade, kind text default 'video', file_name text, storage_path text, public_url text, size_bytes int, mime_type text, duration_sec float default 0, meta jsonb default '{}', created_at timestamptz default now(), updated_at timestamptz default now());
-- KRITIKA: reusable hook templates behind the Ideation → Hook Generator flow.
-- Declared before Scripts/Hooks because both reference it.
create table if not exists "HookPatterns" (id uuid primary key default uuid_generate_v4(), pattern text not null, category text not null, example text, source text default 'viral-hooks', created_at timestamptz default now(), updated_at timestamptz default now());
-- KRITIKA: ideation columns (version/beats/supporting/hook_pattern_id) back the
-- Ideation → Script Studio flow. Existing rows keep working via the defaults.
create table if not exists "Scripts" (id uuid primary key default uuid_generate_v4(), project_id uuid references "Projects"(id) on delete cascade, title text, body text not null, tone text default 'energetic', target_platforms jsonb default '[]', version int default 1, hook_pattern_id uuid references "HookPatterns"(id) on delete set null, beats jsonb default '[]', supporting jsonb default '{}', created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists "Hooks" (id uuid primary key default uuid_generate_v4(), script_id uuid, project_id uuid, text text not null, score float default 0, style text default 'curiosity', pattern_id uuid references "HookPatterns"(id) on delete set null, category text default 'statement', created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists "TranscriptSegments" (id uuid primary key default uuid_generate_v4(), asset_id uuid, project_id uuid, start_sec float, end_sec float, text text, embedding_hint text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists "Clips" (id uuid primary key default uuid_generate_v4(), project_id uuid, asset_id uuid, title text, start_sec float, end_sec float, virality_score float default 0, hook_text text, captions jsonb default '[]', status text default 'suggested', meta jsonb default '{}', created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists "clip_jobs" (id uuid primary key default uuid_generate_v4(), project_id uuid references "Projects"(id) on delete cascade, source_name text, source_path text, status text default 'queued', stage text default 'queued', progress float default 0, options jsonb default '{}', transcript jsonb, outputs jsonb default '[]', error text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists "EditProjects" (id uuid primary key default uuid_generate_v4(), project_id uuid, clip_id uuid, edl jsonb default '{}', platform text default 'tiktok', aspect text default '9:16', version int default 1, created_at timestamptz default now(), updated_at timestamptz default now());
-- KRITIKA: one row per adapted platform version of a clip; Adapt & Publish edits these.
-- Declared before PublishJobs because PublishJobs.variant_id references it.
create table if not exists "PlatformVariants" (id uuid primary key default uuid_generate_v4(), clip_id uuid references "Clips"(id) on delete cascade, platform text not null, aspect text default '9:16', duration float, title text, caption text, hashtags jsonb default '[]', cta text, caption_style text, reframe jsonb default '{}', edl_version int, warnings jsonb default '[]', status text default 'ready', asset_id uuid, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists "PublishJobs" (id uuid primary key default uuid_generate_v4(), project_id uuid, clip_id uuid, variant_id uuid references "PlatformVariants"(id) on delete set null, platform text not null, scheduled_at timestamptz, status text default 'draft', caption text, hashtags jsonb default '[]', result_url text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists "Metrics" (id uuid primary key default uuid_generate_v4(), project_id uuid, clip_id uuid, platform text, views int default 0, likes int default 0, comments int default 0, shares int default 0, retention_pct float default 0, created_at timestamptz default now(), updated_at timestamptz default now());
-- Backfill for databases created before the KRITIKA merge. `create table if not exists`
-- above is a no-op on existing tables, so add the new columns explicitly.
alter table "Scripts" add column if not exists "version" int default 1;
alter table "Scripts" add column if not exists "hook_pattern_id" uuid references "HookPatterns"(id) on delete set null;
alter table "Scripts" add column if not exists "beats" jsonb default '[]';
alter table "Scripts" add column if not exists "supporting" jsonb default '{}';
alter table "Hooks" add column if not exists "pattern_id" uuid references "HookPatterns"(id) on delete set null;
alter table "Hooks" add column if not exists "category" text default 'statement';
alter table "PublishJobs" add column if not exists "variant_id" uuid references "PlatformVariants"(id) on delete set null;
-- Storage bucket (or create via Dashboard > Storage):
insert into storage.buckets (id, name, public) values ('creator-assets','creator-assets', true) on conflict (id) do nothing;

-- Accounts (lowercase, matching the Sequelize models + backend/src/config/authSchema.js).
-- password_hash holds a scrypt digest ("scrypt$N$r$p$salt$key"), never the password.
create table if not exists "users" (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  name text default '',
  password_hash text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table "users" add column if not exists "name" text default '';
alter table "users" add column if not exists "password_hash" text;
create unique index if not exists "users_email_key" on "users" (lower(email));
