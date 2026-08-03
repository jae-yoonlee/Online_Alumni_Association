-- ============================================================
--  온라인 동창회 — Supabase 스키마
--  Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 실행하세요.
--  여러 번 실행해도 안전합니다 (idempotent).
-- ============================================================

-- ── 1. 프로필 ────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  display_name text not null default '동문',
  created_at  timestamptz not null default now()
);

-- ── 2. 동문 등록 (한 사람이 초·중·고 여러 곳에 등록 가능) ────
create table if not exists public.memberships (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  school_id   text not null,
  school_name text not null,
  grad_year   int  not null check (grad_year between 1945 and 2100),
  nickname    text not null check (char_length(nickname) between 1 and 20),
  created_at  timestamptz not null default now(),
  unique (user_id, school_id)
);

-- ── 3. 방명록 / 기수 게시판 ──────────────────────────────────
--     grad_year IS NULL  → 학교 전체 방명록 (로그인한 누구나)
--     grad_year 값 있음  → 해당 기수 전용 게시판
create table if not exists public.posts (
  id         uuid primary key default gen_random_uuid(),
  school_id  text not null,
  grad_year  int,
  user_id    uuid not null references auth.users on delete cascade,
  nickname   text not null,
  body       text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists posts_feed_idx      on public.posts (school_id, grad_year, created_at desc);
create index if not exists memberships_cohort_idx on public.memberships (school_id, grad_year);

-- ── 4. 기수 소속 확인 함수 ───────────────────────────────────
--  RLS 정책이 memberships를 직접 조회하면 무한 재귀가 발생한다.
--  security definer 함수로 감싸서 RLS를 우회한다.
create or replace function public.is_cohort_member(p_school_id text, p_grad_year int)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id   = auth.uid()
      and m.school_id = p_school_id
      and m.grad_year = p_grad_year
  );
$$;

revoke all on function public.is_cohort_member(text, int) from public;
grant execute on function public.is_cohort_member(text, int) to authenticated;

-- ── 5. 가입 시 프로필 자동 생성 ──────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), '동문'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 6. RLS ───────────────────────────────────────────────────
alter table public.profiles    enable row level security;
alter table public.memberships enable row level security;
alter table public.posts       enable row level security;

-- profiles: 본인 것만
drop policy if exists "프로필 본인 조회" on public.profiles;
create policy "프로필 본인 조회" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "프로필 본인 수정" on public.profiles;
create policy "프로필 본인 수정" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- memberships: 내 등록 + 나와 같은 기수인 사람
drop policy if exists "동문 등록 조회" on public.memberships;
create policy "동문 등록 조회" on public.memberships
  for select to authenticated
  using (user_id = auth.uid() or public.is_cohort_member(school_id, grad_year));

drop policy if exists "동문 등록 생성" on public.memberships;
create policy "동문 등록 생성" on public.memberships
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "동문 등록 수정" on public.memberships;
create policy "동문 등록 수정" on public.memberships
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "동문 등록 삭제" on public.memberships;
create policy "동문 등록 삭제" on public.memberships
  for delete to authenticated using (user_id = auth.uid());

-- posts: 학교 방명록은 로그인한 누구나 / 기수 글은 해당 기수만
drop policy if exists "글 조회" on public.posts;
create policy "글 조회" on public.posts
  for select to authenticated
  using (grad_year is null or public.is_cohort_member(school_id, grad_year));

drop policy if exists "글 작성" on public.posts;
create policy "글 작성" on public.posts
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (grad_year is null or public.is_cohort_member(school_id, grad_year))
  );

drop policy if exists "글 삭제" on public.posts;
create policy "글 삭제" on public.posts
  for delete to authenticated using (user_id = auth.uid());

-- ── 7. keep-alive 용 가벼운 함수 ─────────────────────────────
--  무료 플랜은 7일간 트래픽이 없으면 프로젝트가 자동 정지된다.
--  GitHub Actions가 주기적으로 이 함수를 호출해 정지를 막는다.
create or replace function public.ping()
returns text
language sql
stable
as $$ select 'pong'; $$;

grant execute on function public.ping() to anon, authenticated;
