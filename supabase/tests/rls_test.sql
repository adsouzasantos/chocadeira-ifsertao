-- Testes de isolamento de dados (RLS) da Fase 1.
-- Cada bloco falha com exceção se a regra de segurança não for respeitada.
\set ON_ERROR_STOP on

-- Dois usuários independentes
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@exemplo.com',   '{"full_name": "Ana Produtora"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bruno@exemplo.com', '{}');

-- 1. O cadastro cria perfil, organização pessoal e vínculo de proprietário
do $$
begin
  assert (select count(*) from public.profiles) = 2, 'perfis não foram criados';
  assert (select full_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 'Ana Produtora',
    'nome do perfil incorreto';
  assert (select count(*) from public.organizations where is_personal) = 2, 'organizações pessoais não criadas';
  assert (select name from public.organizations o join public.organization_members m on m.organization_id = o.id
          where m.user_id = '00000000-0000-0000-0000-00000000000b') = 'Minhas chocadeiras',
    'nome padrão da organização incorreto';
  assert (select count(*) from public.organization_members where role = 'owner') = 2, 'vínculos de proprietário ausentes';
  raise notice 'OK 1: cadastro cria perfil, organização e vínculo';
end $$;

-- Guarda os ids das organizações para os testes seguintes
create temporary table t_orgs as
  select m.user_id, m.organization_id from public.organization_members m;
grant select on t_orgs to authenticated, anon;

-- 2. Ana cria uma chocadeira na própria organização
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

insert into public.incubators (organization_id, name, code, model, egg_capacity)
select organization_id, 'Chocadeira do galpão', 'CHOC-001', 'Comercial adaptada', 60
from t_orgs where user_id = '00000000-0000-0000-0000-00000000000a';

do $$
begin
  assert (select count(*) from public.incubators) = 1, 'Ana deveria ver 1 chocadeira';
  assert (select created_by from public.incubators limit 1) = '00000000-0000-0000-0000-00000000000a',
    'created_by deveria ser preenchido automaticamente';
  raise notice 'OK 2: proprietária cria e lê a própria chocadeira';
end $$;

-- 3. Ana NÃO consegue criar chocadeira na organização de Bruno
do $$
begin
  begin
    insert into public.incubators (organization_id, name, code)
    select organization_id, 'Invasora', 'X-1' from t_orgs where user_id = '00000000-0000-0000-0000-00000000000b';
    raise exception 'FALHA: inserção em organização alheia foi permitida';
  exception when insufficient_privilege then
    raise notice 'OK 3: inserção em organização alheia bloqueada';
  end;
end $$;

-- 4. Código duplicado na mesma organização é rejeitado
do $$
begin
  begin
    insert into public.incubators (organization_id, name, code)
    select organization_id, 'Duplicada', 'CHOC-001' from t_orgs where user_id = '00000000-0000-0000-0000-00000000000a';
    raise exception 'FALHA: código duplicado foi aceito';
  exception when unique_violation then
    raise notice 'OK 4: código duplicado rejeitado';
  end;
end $$;

-- 5. Bruno não vê nem altera a chocadeira de Ana
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';

do $$
declare
  v_rows integer;
begin
  assert (select count(*) from public.incubators) = 0, 'Bruno não deveria ver chocadeiras de Ana';
  assert (select count(*) from public.profiles) = 1, 'Bruno deveria ver apenas o próprio perfil';
  assert (select count(*) from public.organizations) = 1, 'Bruno deveria ver apenas a própria organização';

  update public.incubators set name = 'Alterada por Bruno';
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'Bruno não deveria alterar chocadeiras de Ana';

  delete from public.incubators;
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'Bruno não deveria excluir chocadeiras de Ana';

  update public.profiles set full_name = 'Invasor' where id = '00000000-0000-0000-0000-00000000000a';
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'Bruno não deveria alterar o perfil de Ana';
  raise notice 'OK 5: isolamento entre usuários garantido';
end $$;

-- 6. Visitante anônimo não acessa nenhuma tabela
reset role;
set role anon;
set request.jwt.claim.sub = '';

do $$
begin
  begin
    perform 1 from public.incubators;
    raise exception 'FALHA: anônimo leu a tabela de chocadeiras';
  exception when insufficient_privilege then
    raise notice 'OK 6: acesso anônimo bloqueado';
  end;
end $$;

-- 7. Operador pode editar, mas não excluir; visualizador só lê
reset role;
insert into public.organization_members (organization_id, user_id, role)
select organization_id, '00000000-0000-0000-0000-00000000000b', 'operator'
from t_orgs where user_id = '00000000-0000-0000-0000-00000000000a';

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';

do $$
declare
  v_rows integer;
begin
  assert (select count(*) from public.incubators) = 1, 'operador deveria ver a chocadeira da organização';

  update public.incubators set description = 'Revisada pelo operador';
  get diagnostics v_rows = row_count;
  assert v_rows = 1, 'operador deveria conseguir editar';

  delete from public.incubators;
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'operador não deveria conseguir excluir';
  raise notice 'OK 7: papéis de proprietário e operador respeitados';
end $$;

-- 8. Proprietária exclui; updated_at é mantido pelo gatilho
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

do $$
declare
  v_rows integer;
begin
  assert (select updated_at > created_at from public.incubators limit 1), 'updated_at deveria ser atualizado';
  delete from public.incubators;
  get diagnostics v_rows = row_count;
  assert v_rows = 1, 'proprietária deveria conseguir excluir';
  raise notice 'OK 8: exclusão pela proprietária e gatilho de updated_at';
end $$;

reset role;
\echo 'Todos os testes de RLS passaram.'
