-- BIOSISWA TASK: schema awal + role + aturan keamanan Supabase
-- Buat dua akun terlebih dahulu di Authentication > Users:
-- admin123@biosiswa-task.example / tester1234
-- siswa123@biosiswa-task.example / tester1234
-- Lalu jalankan SQL ini di SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  role text not null check (role in ('teacher','student')),
  points integer not null default 0 check (points >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  description text not null check (char_length(description) between 1 and 1000),
  points integer not null check (points between 1 and 1000),
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id),
  student_id uuid not null references public.profiles(id),
  student_name text not null,
  student_class text not null,
  notes text not null check (char_length(notes) between 1 and 500),
  photo_path text not null,
  points_awarded integer not null default 0 check (points_awarded >= 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  teacher_reason text not null default '',
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  points_cost integer not null check (points_cost > 0),
  active boolean not null default true
);

create table if not exists public.redemptions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id),
  product_id uuid not null references public.products(id),
  points_spent integer not null check (points_spent > 0),
  created_at timestamptz not null default now()
);

create schema if not exists private;
create or replace function private.current_role()
returns text language sql stable security definer set search_path = ''
as $$ select p.role from public.profiles p where p.id = (select auth.uid()) $$;
revoke all on function private.current_role() from public;
grant usage on schema private to authenticated;
grant execute on function private.current_role() to authenticated;

alter table public.profiles enable row level security;
alter table public.missions enable row level security;
alter table public.submissions enable row level security;
alter table public.products enable row level security;
alter table public.redemptions enable row level security;

-- Hapus policy dengan nama sama agar SQL dapat dijalankan ulang.
drop policy if exists "profile read self or teacher" on public.profiles;
drop policy if exists "missions read active or teacher" on public.missions;
drop policy if exists "teacher create missions" on public.missions;
drop policy if exists "teacher update missions" on public.missions;
drop policy if exists "student create own submission" on public.submissions;
drop policy if exists "student read own or teacher read all submissions" on public.submissions;
drop policy if exists "products read authenticated" on public.products;
drop policy if exists "student read own redemptions or teacher read all" on public.redemptions;

create policy "profile read self or teacher" on public.profiles
for select to authenticated
using (id = (select auth.uid()) or (select private.current_role()) = 'teacher');

create policy "missions read active or teacher" on public.missions
for select to authenticated
using (active = true or (select private.current_role()) = 'teacher');
create policy "teacher create missions" on public.missions
for insert to authenticated
with check ((select private.current_role()) = 'teacher' and created_by = (select auth.uid()));
create policy "teacher update missions" on public.missions
for update to authenticated
using ((select private.current_role()) = 'teacher')
with check ((select private.current_role()) = 'teacher');

create policy "student create own submission" on public.submissions
for insert to authenticated
with check ((select private.current_role()) = 'student' and student_id = (select auth.uid()));
create policy "student read own or teacher read all submissions" on public.submissions
for select to authenticated
using (student_id = (select auth.uid()) or (select private.current_role()) = 'teacher');

create policy "products read authenticated" on public.products
for select to authenticated using (true);
create policy "student read own redemptions or teacher read all" on public.redemptions
for select to authenticated
using (student_id = (select auth.uid()) or (select private.current_role()) = 'teacher');

-- Peninjauan dilakukan melalui fungsi ini agar poin tidak bisa ditambah oleh siswa dari browser.
create or replace function public.review_submission(p_submission_id uuid, p_status text, p_reason text default '')
returns void language plpgsql security definer set search_path = ''
as $$
declare s public.submissions%rowtype;
begin
  if (select private.current_role()) <> 'teacher' then
    raise exception 'Only teacher can review submissions';
  end if;
  if p_status not in ('approved','rejected') then
    raise exception 'Invalid review status';
  end if;
  select * into s from public.submissions where id = p_submission_id for update;
  if not found or s.status <> 'pending' then
    raise exception 'Submission not found or already reviewed';
  end if;
  update public.submissions
  set status = p_status,
      teacher_reason = coalesce(p_reason,''),
      reviewed_by = (select auth.uid()),
      reviewed_at = now(),
      points_awarded = case when p_status = 'approved' then (select m.points from public.missions m where m.id = s.mission_id) else 0 end
  where id = p_submission_id;
  if p_status = 'approved' then
    update public.profiles
    set points = points + (select m.points from public.missions m where m.id = s.mission_id)
    where id = s.student_id;
  end if;
end;
$$;
revoke all on function public.review_submission(uuid,text,text) from public, anon;
grant execute on function public.review_submission(uuid,text,text) to authenticated;

-- Buat dua profil berdasarkan akun Auth yang sudah dibuat di Dashboard.
insert into public.profiles (id, username, role)
select u.id,
       case u.email when 'admin123@biosiswa-task.example' then 'admin123' else 'siswa123' end,
       case u.email when 'admin123@biosiswa-task.example' then 'teacher' else 'student' end
from auth.users u
where u.email in ('admin123@biosiswa-task.example','siswa123@biosiswa-task.example')
on conflict (id) do update set username = excluded.username, role = excluded.role;

insert into public.products (name, description, points_cost)
select v.name, v.description, v.points_cost
from (values
 ('Pulpen','Alat tulis untuk kegiatan belajar.',100),
 ('Buku catatan','Buku catatan untuk tugas sekolah.',250),
 ('Pensil','Pensil untuk kegiatan kelas.',80)
) as v(name,description,points_cost)
where not exists (select 1 from public.products);

-- Storage: buat bucket bernama "proof-photos" sebagai PRIVATE di Dashboard.
-- Kebijakan Storage yang tepat perlu ditambahkan setelah format folder ditetapkan.
