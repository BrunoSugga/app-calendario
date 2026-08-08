-- Roles admin/member + seed del administrador + protección de role

alter table public.profiles
  add column if not exists role text not null default 'member';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'member'));

-- Admin del proyecto (Bruno)
update public.profiles
set role = 'admin'
where id = 'bfd18782-7bea-4386-bd8f-de050f398aec';

-- Si el perfil aún no existiera (usuario Auth ya creado), crearlo como admin
insert into public.profiles (id, display_name, role)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1)),
  'admin'
from auth.users u
where u.id = 'bfd18782-7bea-4386-bd8f-de050f398aec'
on conflict (id) do update
set role = 'admin';

-- Impide que un usuario autenticado se auto-promueva a admin
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.role is distinct from old.role
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'No se puede cambiar el rol del perfil';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- Policies de profiles: update solo display_name efectivo (role protegido por trigger)
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
