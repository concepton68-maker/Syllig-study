-- Un compte peut avoir plusieurs rôles (ex. parent ET administrateur du contenu) : bascule d'espace sans changer de compte.
create table if not exists user_roles (
  user_id uuid not null references users(id) on delete cascade,
  role    text not null check (role in ('parent','student','admin')),
  primary key (user_id, role)
);
insert into user_roles (user_id, role) select id, role from users on conflict do nothing;

-- tout nouveau compte reçoit automatiquement son rôle principal
create or replace function users_default_role() returns trigger language plpgsql as $$
begin
  insert into user_roles (user_id, role) values (new.id, new.role) on conflict do nothing;
  return new;
end $$;
drop trigger if exists users_default_role_trg on users;
create trigger users_default_role_trg after insert on users for each row execute function users_default_role();
