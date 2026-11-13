-- ═══════════════════════════════════════════════════════════════════
--  THE GREAT AI DEBATE — Supabase schema
--  Paste this whole file into Supabase → SQL Editor → Run. Safe to re-run.
--
--  Security model
--  • The browser only ever holds the public *anon* key.
--  • Anyone can READ the public show state (events.state). It never
--    contains hidden poll results or secrets — the host only copies
--    results into it once they are allowed to be seen.
--  • Nobody can write tables directly (RLS on, no write policies).
--    Every write goes through the SECURITY DEFINER functions below,
--    which validate the host key (stored only as a SHA-256 hash) or,
--    for votes, the poll status / option / one-vote-per-participant rule.
--  • Votes and participants are not readable by the public at all.
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

-- ── Tables ─────────────────────────────────────────────────────────
create table if not exists public.events (
  room_code   text primary key check (room_code ~ '^[A-Z0-9]{4,8}$'),
  state       jsonb not null,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create table if not exists public.event_secrets (
  room_code      text primary key references public.events(room_code) on delete cascade,
  host_key_hash  text not null
);

create table if not exists public.participants (
  room_code       text not null references public.events(room_code) on delete cascade,
  participant_id  uuid not null,
  joined_at       timestamptz not null default now(),
  primary key (room_code, participant_id)
);

create table if not exists public.votes (
  room_code       text not null references public.events(room_code) on delete cascade,
  poll_id         text not null,
  participant_id  uuid not null,
  option          text not null,
  created_at      timestamptz not null default now(),
  primary key (room_code, poll_id, participant_id)   -- one vote per participant per poll
);
create index if not exists votes_poll_idx on public.votes (room_code, poll_id);

-- ── Row Level Security ────────────────────────────────────────────
alter table public.events        enable row level security;
alter table public.event_secrets enable row level security;
alter table public.participants  enable row level security;
alter table public.votes         enable row level security;

drop policy if exists "public can read show state" on public.events;
create policy "public can read show state" on public.events
  for select to anon, authenticated using (true);
-- (No policies on event_secrets / participants / votes ⇒ no direct access.)

revoke insert, update, delete, truncate on public.events from anon, authenticated;
revoke all on public.event_secrets, public.participants, public.votes from anon, authenticated;
grant select on public.events to anon, authenticated;

-- ── Realtime: broadcast changes to the public state ───────────────
do $$
begin
  alter publication supabase_realtime add table public.events;
exception when duplicate_object then null;
end $$;

-- ── Helpers ───────────────────────────────────────────────────────
create or replace function public.server_now()
returns double precision
language sql stable
as $$ select extract(epoch from clock_timestamp()) * 1000 $$;

create or replace function public._host_ok(p_room text, p_key text)
returns boolean
language sql stable security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.event_secrets
    where room_code = p_room
      and host_key_hash = encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex')
  );
$$;
revoke all on function public._host_ok(text, text) from public, anon, authenticated;

-- ── Host functions ────────────────────────────────────────────────
create or replace function public.create_event(p_room text, p_host_key text, p_state jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if p_room !~ '^[A-Z0-9]{4,8}$' then return jsonb_build_object('ok', false, 'reason', 'bad_room'); end if;
  if length(coalesce(p_host_key, '')) < 32 then return jsonb_build_object('ok', false, 'reason', 'weak_key'); end if;
  if octet_length(p_state::text) > 500000 then return jsonb_build_object('ok', false, 'reason', 'too_large'); end if;
  if (select count(*) from public.events where created_at > now() - interval '1 hour') > 300 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;
  if exists (select 1 from public.events where room_code = p_room) then
    return jsonb_build_object('ok', false, 'reason', 'exists');
  end if;
  insert into public.events (room_code, state) values (p_room, p_state);
  insert into public.event_secrets (room_code, host_key_hash)
    values (p_room, encode(extensions.digest(p_host_key, 'sha256'), 'hex'));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.host_update_state(p_room text, p_host_key text, p_state jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if not public._host_ok(p_room, p_host_key) then return jsonb_build_object('ok', false, 'reason', 'forbidden'); end if;
  if octet_length(p_state::text) > 500000 then return jsonb_build_object('ok', false, 'reason', 'too_large'); end if;
  update public.events set state = p_state, updated_at = now() where room_code = p_room;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.host_poll_tally(p_room text, p_host_key text, p_poll text)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_counts jsonb;
  v_total int;
begin
  if not public._host_ok(p_room, p_host_key) then return jsonb_build_object('ok', false, 'reason', 'forbidden'); end if;
  select coalesce(jsonb_object_agg(option, n), '{}'::jsonb), coalesce(sum(n), 0)
    into v_counts, v_total
    from (select option, count(*)::int as n from public.votes
          where room_code = p_room and poll_id = p_poll group by option) t;
  return jsonb_build_object('ok', true, 'counts', v_counts, 'total', v_total);
end $$;

create or replace function public.host_participant_count(p_room text, p_host_key text)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if not public._host_ok(p_room, p_host_key) then return jsonb_build_object('ok', false, 'reason', 'forbidden'); end if;
  return jsonb_build_object('ok', true, 'count', (select count(*) from public.participants where room_code = p_room));
end $$;

-- Participant-level opinion change between two polls (only people who voted in both).
create or replace function public.host_opinion_shift(p_room text, p_host_key text, p_initial text, p_final text)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
declare r record;
begin
  if not public._host_ok(p_room, p_host_key) then return jsonb_build_object('ok', false, 'reason', 'forbidden'); end if;
  select
    count(*)::int                                                          as both_voted,
    count(*) filter (where a.option <> b.option)::int                     as changed,
    count(*) filter (where a.option <> b.option and b.option = 'ban')::int     as to_ban,
    count(*) filter (where a.option <> b.option and b.option = 'embrace')::int as to_embrace,
    count(*) filter (where a.option <> b.option and b.option not in ('ban','embrace'))::int as other
  into r
  from public.votes a
  join public.votes b
    on b.room_code = a.room_code and b.participant_id = a.participant_id and b.poll_id = p_final
  where a.room_code = p_room and a.poll_id = p_initial;
  return jsonb_build_object('ok', true, 'both', r.both_voted, 'changed', r.changed,
                            'to_ban', r.to_ban, 'to_embrace', r.to_embrace, 'other', r.other);
end $$;

create or replace function public.host_reset_poll(p_room text, p_host_key text, p_poll text)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if not public._host_ok(p_room, p_host_key) then return jsonb_build_object('ok', false, 'reason', 'forbidden'); end if;
  delete from public.votes where room_code = p_room and poll_id = p_poll;
  return jsonb_build_object('ok', true);
end $$;

-- ── Audience functions ────────────────────────────────────────────
create or replace function public.join_event(p_room text, p_participant uuid)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if not exists (select 1 from public.events where room_code = p_room) then
    return jsonb_build_object('ok', false, 'reason', 'no_event');
  end if;
  if (select count(*) from public.participants where room_code = p_room) >= 2000 then
    return jsonb_build_object('ok', false, 'reason', 'full');
  end if;
  insert into public.participants (room_code, participant_id) values (p_room, p_participant)
    on conflict do nothing;
  return jsonb_build_object('ok', true);
end $$;

-- Server-side vote validation: poll must be the currently OPEN poll, option must exist,
-- participant must have joined, and only one vote per participant per poll.
create or replace function public.cast_vote(p_room text, p_participant uuid, p_poll text, p_option text)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_state jsonb;
  v_poll jsonb;
  v_existing text;
  v_rows int;
begin
  -- FOR SHARE: a concurrent "close poll" update waits for this vote (or this vote sees it closed).
  select state into v_state from public.events where room_code = p_room for share;
  if v_state is null then return jsonb_build_object('ok', false, 'reason', 'no_event'); end if;

  if not exists (select 1 from public.participants where room_code = p_room and participant_id = p_participant) then
    return jsonb_build_object('ok', false, 'reason', 'not_joined');
  end if;

  v_poll := v_state -> 'poll';
  if v_poll is null or jsonb_typeof(v_poll) <> 'object'
     or v_poll ->> 'id' is distinct from p_poll
     or v_poll ->> 'status' is distinct from 'open' then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;

  if not exists (select 1 from jsonb_array_elements(v_poll -> 'options') o where o ->> 'id' = p_option) then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  insert into public.votes (room_code, poll_id, participant_id, option)
    values (p_room, p_poll, p_participant, p_option)
    on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    select option into v_existing from public.votes
      where room_code = p_room and poll_id = p_poll and participant_id = p_participant;
    return jsonb_build_object('ok', false, 'reason', 'duplicate', 'option', v_existing);
  end if;
  return jsonb_build_object('ok', true, 'option', p_option);
end $$;

-- ── Grants ────────────────────────────────────────────────────────
grant execute on function public.server_now()                                    to anon, authenticated;
grant execute on function public.create_event(text, text, jsonb)                 to anon, authenticated;
grant execute on function public.host_update_state(text, text, jsonb)            to anon, authenticated;
grant execute on function public.host_poll_tally(text, text, text)               to anon, authenticated;
grant execute on function public.host_participant_count(text, text)              to anon, authenticated;
grant execute on function public.host_opinion_shift(text, text, text, text)      to anon, authenticated;
grant execute on function public.host_reset_poll(text, text, text)               to anon, authenticated;
grant execute on function public.join_event(text, uuid)                          to anon, authenticated;
grant execute on function public.cast_vote(text, uuid, text, text)               to anon, authenticated;

-- Optional housekeeping: delete rooms older than 7 days.
-- delete from public.events where created_at < now() - interval '7 days';
