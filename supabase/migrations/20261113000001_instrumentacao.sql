-- =============================================================================
-- Instrumentação: dispositivos (ESP32), limites de alarme, telemetria e alarmes
--
-- Fluxo: ESP32 -> broker MQTT -> serviço de ingestão -> public.ingest_reading()
-- As funções de ingestão só podem ser executadas pela chave service_role, usada
-- exclusivamente pelo serviço de ingestão (nunca pelo site).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.alarm_type as enum (
  'temperature_high',
  'temperature_low',
  'humidity_high',
  'humidity_low',
  'water_low',
  'sensor_failure',
  'device_offline'
);

create type public.alarm_severity as enum ('critical', 'warning');

-- -----------------------------------------------------------------------------
-- Dispositivos de instrumentação
-- O identificador (device_key) é gerado pela plataforma e usado como client id
-- e como segmento do tópico MQTT: chocadeira/v1/{device_key}/...
-- -----------------------------------------------------------------------------
create table public.devices (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  incubator_id          uuid unique references public.incubators (id) on delete set null,
  device_key            text not null unique
                          default ('chc-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
                          check (device_key ~ '^[a-z0-9-]{6,40}$'),
  label                 text check (label is null or char_length(label) <= 80),
  firmware_version      text check (firmware_version is null or char_length(firmware_version) <= 32),
  online                boolean not null default false,
  last_seen_at          timestamptz,
  offline_since         timestamptz,
  last_measured_at      timestamptz,
  last_temperature_c    numeric(5, 2),
  last_humidity_pct     numeric(5, 2),
  last_water_level_pct  smallint,
  last_rssi             smallint,
  last_mains_power      boolean,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index devices_organization_id_idx on public.devices (organization_id);

create trigger devices_set_updated_at
  before update on public.devices
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Limites de alarme por chocadeira
-- Valores iniciais: incubação de ovos de galinha (dias 0 a 17). Devem ser
-- ajustados conforme a espécie e a fase.
-- -----------------------------------------------------------------------------
create table public.alarm_settings (
  incubator_id       uuid primary key references public.incubators (id) on delete cascade,
  temp_min_c         numeric(4, 1) not null default 37.2 check (temp_min_c between 30 and 42),
  temp_max_c         numeric(4, 1) not null default 37.8 check (temp_max_c between 30 and 42),
  humidity_min_pct   numeric(4, 1) not null default 50 check (humidity_min_pct between 0 and 100),
  humidity_max_pct   numeric(4, 1) not null default 60 check (humidity_max_pct between 0 and 100),
  water_min_pct      smallint not null default 20 check (water_min_pct between 0 and 100),
  alarm_delay_s      integer not null default 120 check (alarm_delay_s between 0 and 1800),
  offline_timeout_s  integer not null default 120 check (offline_timeout_s between 60 and 3600),
  preset             text check (preset is null or char_length(preset) <= 60),
  updated_at         timestamptz not null default now(),
  updated_by         uuid references auth.users (id) on delete set null,
  constraint alarm_settings_temp_range check (temp_min_c < temp_max_c),
  constraint alarm_settings_humidity_range check (humidity_min_pct < humidity_max_pct)
);

create or replace function private.alarm_settings_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create trigger alarm_settings_touch
  before update on public.alarm_settings
  for each row execute function private.alarm_settings_touch();

-- Toda chocadeira nasce com limites padrão
create or replace function private.create_alarm_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.alarm_settings (incubator_id, preset)
  values (new.id, 'galinha-incubacao')
  on conflict do nothing;
  return new;
end;
$$;

create trigger incubators_create_alarm_settings
  after insert on public.incubators
  for each row execute function private.create_alarm_settings();

insert into public.alarm_settings (incubator_id, preset)
select id, 'galinha-incubacao' from public.incubators
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Telemetria (histórico de leituras)
-- O histórico pertence à chocadeira: trocar ou remover o ESP32 não apaga dados.
-- -----------------------------------------------------------------------------
create table public.telemetry (
  id               bigint generated always as identity primary key,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  incubator_id     uuid references public.incubators (id) on delete cascade,
  device_id        uuid references public.devices (id) on delete set null,
  measured_at      timestamptz not null,
  received_at      timestamptz not null default now(),
  temperature_c    numeric(5, 2) check (temperature_c is null or temperature_c between -20 and 80),
  humidity_pct     numeric(5, 2) check (humidity_pct is null or humidity_pct between 0 and 100),
  water_level_pct  smallint check (water_level_pct is null or water_level_pct between 0 and 100),
  rssi             smallint,
  seq              integer,
  replay           boolean not null default false,
  constraint telemetry_device_time_unique unique (device_id, measured_at)
);

create index telemetry_incubator_time_idx on public.telemetry (incubator_id, measured_at desc);

-- -----------------------------------------------------------------------------
-- Alarmes
-- Ativo = resolved_at nulo. No máximo um alarme ativo por tipo e chocadeira.
-- -----------------------------------------------------------------------------
create table public.alarms (
  id               bigint generated always as identity primary key,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  incubator_id     uuid not null references public.incubators (id) on delete cascade,
  device_id        uuid references public.devices (id) on delete set null,
  type             public.alarm_type not null,
  severity         public.alarm_severity not null,
  message          text not null,
  trigger_value    numeric(6, 2),
  threshold        numeric(6, 2),
  peak_value       numeric(6, 2),
  started_at       timestamptz not null default now(),
  resolved_at      timestamptz,
  acknowledged_at  timestamptz,
  acknowledged_by  uuid references auth.users (id) on delete set null,
  resolution_note  text check (resolution_note is null or char_length(resolution_note) <= 500)
);

create unique index alarms_one_active_per_type on public.alarms (incubator_id, type) where resolved_at is null;
create index alarms_org_started_idx on public.alarms (organization_id, started_at desc);

-- Número no formato brasileiro para as mensagens (37.80 -> "37,8")
create or replace function private.fmt_num(p numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p::text like '%.%' then replace(rtrim(rtrim(p::text, '0'), '.'), '.', ',')
    else p::text
  end;
$$;

-- Condições fora da faixa ainda em observação (atraso antes de disparar)
create table private.alarm_conditions (
  incubator_id  uuid not null references public.incubators (id) on delete cascade,
  type          public.alarm_type not null,
  since         timestamptz not null,
  primary key (incubator_id, type)
);

-- -----------------------------------------------------------------------------
-- Avaliação de uma condição de alarme (com atraso e histerese)
--   p_out_of_range: valor fora da faixa configurada
--   p_back_in_range: valor voltou para dentro da faixa com margem (histerese)
-- -----------------------------------------------------------------------------
create or replace function private.evaluate_condition(
  p_org uuid,
  p_incubator uuid,
  p_device uuid,
  p_type public.alarm_type,
  p_severity public.alarm_severity,
  p_out_of_range boolean,
  p_back_in_range boolean,
  p_value numeric,
  p_threshold numeric,
  p_at timestamptz,
  p_delay_s integer,
  p_message text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active  public.alarms%rowtype;
  v_since   timestamptz;
begin
  select * into v_active
  from public.alarms
  where incubator_id = p_incubator and type = p_type and resolved_at is null;

  if p_out_of_range then
    if v_active.id is not null then
      -- Alarme já ativo: registra o pior valor observado
      update public.alarms
      set peak_value = case
            when p_type in ('temperature_low', 'humidity_low', 'water_low') then least(peak_value, p_value)
            else greatest(peak_value, p_value)
          end
      where id = v_active.id;
      return null;
    end if;

    insert into private.alarm_conditions (incubator_id, type, since)
    values (p_incubator, p_type, p_at)
    on conflict (incubator_id, type) do nothing;

    select since into v_since
    from private.alarm_conditions
    where incubator_id = p_incubator and type = p_type;

    if p_at - v_since >= make_interval(secs => p_delay_s) then
      insert into public.alarms
        (organization_id, incubator_id, device_id, type, severity, message, trigger_value, threshold, peak_value, started_at)
      values
        (p_org, p_incubator, p_device, p_type, p_severity, p_message, p_value, p_threshold, p_value, v_since);
      delete from private.alarm_conditions where incubator_id = p_incubator and type = p_type;
      return 'opened';
    end if;
    return null;
  end if;

  -- Fora da condição: descarta observação pendente
  delete from private.alarm_conditions where incubator_id = p_incubator and type = p_type;

  if p_back_in_range and v_active.id is not null then
    update public.alarms set resolved_at = p_at where id = v_active.id;
    return 'resolved';
  end if;
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Ingestão de uma leitura (chamada pelo serviço de ingestão)
-- -----------------------------------------------------------------------------
create or replace function public.ingest_reading(
  p_device_key       text,
  p_measured_at      timestamptz,
  p_temperature_c    numeric default null,
  p_humidity_pct     numeric default null,
  p_water_level_pct  integer default null,
  p_rssi             integer default null,
  p_seq              integer default null,
  p_replay           boolean default false,
  p_firmware         text default null,
  p_mains_power      boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device    public.devices%rowtype;
  v_settings  public.alarm_settings%rowtype;
  v_at        timestamptz := p_measured_at;
  v_clock_ok  boolean := true;
  v_inserted  bigint;
  v_events    jsonb := '[]'::jsonb;
  v_result    text;
  v_temp      numeric := round(p_temperature_c, 2);
  v_hum       numeric := round(p_humidity_pct, 2);
begin
  select * into v_device from public.devices where device_key = p_device_key;
  if v_device.id is null then
    return jsonb_build_object('accepted', false, 'reason', 'unknown_device');
  end if;

  -- Relógio do dispositivo incoerente: usa o horário de recebimento
  if v_at is null or v_at > now() + interval '5 minutes' or v_at < now() - interval '7 days' then
    v_at := now();
    v_clock_ok := false;
  end if;

  insert into public.telemetry
    (organization_id, incubator_id, device_id, measured_at, temperature_c, humidity_pct, water_level_pct, rssi, seq, replay)
  values
    (v_device.organization_id, v_device.incubator_id, v_device.id, v_at, v_temp, v_hum,
     p_water_level_pct, p_rssi, p_seq, coalesce(p_replay, false))
  on conflict (device_id, measured_at) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    return jsonb_build_object('accepted', false, 'reason', 'duplicate');
  end if;

  -- Toda mensagem prova que o dispositivo está conectado
  update public.devices
  set online = true,
      last_seen_at = now(),
      offline_since = null,
      firmware_version = coalesce(p_firmware, firmware_version),
      last_mains_power = coalesce(p_mains_power, last_mains_power)
  where id = v_device.id;

  -- O retrato "atual" só avança com leituras mais recentes
  if v_device.last_measured_at is null or v_at > v_device.last_measured_at then
    update public.devices
    set last_measured_at = v_at,
        last_temperature_c = v_temp,
        last_humidity_pct = v_hum,
        last_water_level_pct = p_water_level_pct,
        last_rssi = p_rssi
    where id = v_device.id;
  end if;

  if v_device.incubator_id is null then
    return jsonb_build_object('accepted', true, 'clock_ok', v_clock_ok, 'events', v_events);
  end if;

  -- Volta de comunicação encerra o alarme de dispositivo desconectado
  update public.alarms set resolved_at = now()
  where incubator_id = v_device.incubator_id and type = 'device_offline' and resolved_at is null;
  if found then
    v_events := v_events || jsonb_build_object('type', 'device_offline', 'event', 'resolved');
  end if;

  -- Leituras reenviadas após queda de rede entram no histórico, mas não geram alarmes
  if coalesce(p_replay, false) or not v_clock_ok then
    return jsonb_build_object('accepted', true, 'clock_ok', v_clock_ok, 'events', v_events);
  end if;

  select * into v_settings from public.alarm_settings where incubator_id = v_device.incubator_id;

  -- Temperatura (crítico), histerese de 0,2 °C
  v_result := private.evaluate_condition(v_device.organization_id, v_device.incubator_id, v_device.id,
    'temperature_high', 'critical',
    v_temp is not null and v_temp > v_settings.temp_max_c,
    v_temp is not null and v_temp <= v_settings.temp_max_c - 0.2,
    v_temp, v_settings.temp_max_c, v_at, v_settings.alarm_delay_s,
    format('Temperatura acima do limite de %s °C', private.fmt_num(v_settings.temp_max_c)));
  if v_result is not null then v_events := v_events || jsonb_build_object('type', 'temperature_high', 'event', v_result); end if;

  v_result := private.evaluate_condition(v_device.organization_id, v_device.incubator_id, v_device.id,
    'temperature_low', 'critical',
    v_temp is not null and v_temp < v_settings.temp_min_c,
    v_temp is not null and v_temp >= v_settings.temp_min_c + 0.2,
    v_temp, v_settings.temp_min_c, v_at, v_settings.alarm_delay_s,
    format('Temperatura abaixo do limite de %s °C', private.fmt_num(v_settings.temp_min_c)));
  if v_result is not null then v_events := v_events || jsonb_build_object('type', 'temperature_low', 'event', v_result); end if;

  -- Umidade (atenção), histerese de 2 pontos percentuais
  v_result := private.evaluate_condition(v_device.organization_id, v_device.incubator_id, v_device.id,
    'humidity_high', 'warning',
    v_hum is not null and v_hum > v_settings.humidity_max_pct,
    v_hum is not null and v_hum <= v_settings.humidity_max_pct - 2,
    v_hum, v_settings.humidity_max_pct, v_at, v_settings.alarm_delay_s,
    format('Umidade acima do limite de %s%%', private.fmt_num(v_settings.humidity_max_pct)));
  if v_result is not null then v_events := v_events || jsonb_build_object('type', 'humidity_high', 'event', v_result); end if;

  v_result := private.evaluate_condition(v_device.organization_id, v_device.incubator_id, v_device.id,
    'humidity_low', 'warning',
    v_hum is not null and v_hum < v_settings.humidity_min_pct,
    v_hum is not null and v_hum >= v_settings.humidity_min_pct + 2,
    v_hum, v_settings.humidity_min_pct, v_at, v_settings.alarm_delay_s,
    format('Umidade abaixo do limite de %s%%', private.fmt_num(v_settings.humidity_min_pct)));
  if v_result is not null then v_events := v_events || jsonb_build_object('type', 'humidity_low', 'event', v_result); end if;

  -- Nível de água (crítico): dispara sem atraso, histerese de 5 pontos
  v_result := private.evaluate_condition(v_device.organization_id, v_device.incubator_id, v_device.id,
    'water_low', 'critical',
    p_water_level_pct is not null and p_water_level_pct < v_settings.water_min_pct,
    p_water_level_pct is not null and p_water_level_pct >= v_settings.water_min_pct + 5,
    p_water_level_pct, v_settings.water_min_pct, v_at, 0,
    format('Nível de água abaixo de %s%%: reponha o reservatório', private.fmt_num(v_settings.water_min_pct)));
  if v_result is not null then v_events := v_events || jsonb_build_object('type', 'water_low', 'event', v_result); end if;

  -- Falha de sensor: temperatura ou umidade ausentes na leitura
  v_result := private.evaluate_condition(v_device.organization_id, v_device.incubator_id, v_device.id,
    'sensor_failure', 'warning',
    v_temp is null or v_hum is null,
    v_temp is not null and v_hum is not null,
    null, null, v_at, v_settings.alarm_delay_s,
    'Falha na leitura do sensor de temperatura e umidade');
  if v_result is not null then v_events := v_events || jsonb_build_object('type', 'sensor_failure', 'event', v_result); end if;

  return jsonb_build_object('accepted', true, 'clock_ok', v_clock_ok, 'events', v_events);
end;
$$;

-- -----------------------------------------------------------------------------
-- Status de conexão informado pelo broker (mensagem retida / Last Will)
-- -----------------------------------------------------------------------------
create or replace function public.set_device_status(p_device_key text, p_online boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device public.devices%rowtype;
begin
  select * into v_device from public.devices where device_key = p_device_key;
  if v_device.id is null then
    return jsonb_build_object('accepted', false, 'reason', 'unknown_device');
  end if;

  if p_online then
    update public.devices set online = true, last_seen_at = now(), offline_since = null where id = v_device.id;
    update public.alarms set resolved_at = now()
    where incubator_id = v_device.incubator_id and type = 'device_offline' and resolved_at is null;
  elsif v_device.online then
    -- O alarme só é aberto por check_device_timeouts(), após a tolerância configurada
    update public.devices set online = false, offline_since = now() where id = v_device.id;
  end if;

  return jsonb_build_object('accepted', true);
end;
$$;

-- -----------------------------------------------------------------------------
-- Verificação periódica de comunicação (executada pelo serviço de ingestão a
-- cada 30 s; pode também ser agendada com pg_cron)
-- -----------------------------------------------------------------------------
create or replace function public.check_device_timeouts()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r         record;
  v_opened  integer := 0;
  v_marked  integer := 0;
begin
  -- Sem mensagens além do tempo limite: marca como desconectado
  with stale as (
    select d.id, d.last_seen_at
    from public.devices d
    left join public.alarm_settings s on s.incubator_id = d.incubator_id
    where d.online
      and d.last_seen_at < now() - make_interval(secs => coalesce(s.offline_timeout_s, 120))
  )
  update public.devices d
  set online = false, offline_since = stale.last_seen_at
  from stale
  where d.id = stale.id;
  get diagnostics v_marked = row_count;

  -- Desconectado além do tempo limite e sem alarme aberto: abre o alarme
  for r in
    select d.id, d.organization_id, d.incubator_id, d.offline_since
    from public.devices d
    join public.alarm_settings s on s.incubator_id = d.incubator_id
    where not d.online
      and d.offline_since is not null
      and d.offline_since < now() - make_interval(secs => s.offline_timeout_s)
      and not exists (
        select 1 from public.alarms a
        where a.incubator_id = d.incubator_id and a.type = 'device_offline' and a.resolved_at is null
      )
  loop
    insert into public.alarms (organization_id, incubator_id, device_id, type, severity, message, started_at)
    values (r.organization_id, r.incubator_id, r.id, 'device_offline', 'critical',
            'Equipamento sem comunicação com a plataforma', r.offline_since);
    v_opened := v_opened + 1;
  end loop;

  return jsonb_build_object('marked_offline', v_marked, 'alarms_opened', v_opened);
end;
$$;

-- -----------------------------------------------------------------------------
-- Reconhecimento de alarme pelo usuário
-- -----------------------------------------------------------------------------
create or replace function public.acknowledge_alarm(p_alarm_id bigint, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.alarms where id = p_alarm_id;
  if v_org is null or not private.has_org_role(v_org, array['owner', 'operator']::public.org_role[]) then
    raise exception 'Alarme não encontrado ou sem permissão' using errcode = '42501';
  end if;

  update public.alarms
  set acknowledged_at = coalesce(acknowledged_at, now()),
      acknowledged_by = coalesce(acknowledged_by, auth.uid()),
      resolution_note = coalesce(nullif(left(btrim(p_note), 500), ''), resolution_note)
  where id = p_alarm_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Série histórica agregada para os gráficos (respeita o RLS do usuário)
-- -----------------------------------------------------------------------------
create or replace function public.telemetry_series(
  p_incubator_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_points integer default 300
)
returns table (
  bucket           timestamptz,
  temperature_avg  numeric,
  temperature_min  numeric,
  temperature_max  numeric,
  humidity_avg     numeric,
  humidity_min     numeric,
  humidity_max     numeric,
  water_level_avg  numeric,
  samples          integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select make_interval(secs => greatest(
             30,
             ceil(extract(epoch from (p_to - p_from)) / greatest(least(p_points, 2000), 10))
           )) as step
  )
  select
    date_bin(params.step, t.measured_at, timestamptz '2000-01-01') as bucket,
    round(avg(t.temperature_c), 2),
    min(t.temperature_c),
    max(t.temperature_c),
    round(avg(t.humidity_pct), 1),
    min(t.humidity_pct),
    max(t.humidity_pct),
    round(avg(t.water_level_pct), 0),
    count(*)::integer
  from public.telemetry t, params
  where t.incubator_id = p_incubator_id
    and t.measured_at >= p_from
    and t.measured_at <= p_to
    and p_to > p_from
    and p_to - p_from <= interval '92 days'
  group by 1
  order by 1;
$$;

-- -----------------------------------------------------------------------------
-- Limpeza do histórico bruto (agendar com pg_cron; ver README)
-- -----------------------------------------------------------------------------
create or replace function private.purge_old_telemetry(p_keep_days integer default 90)
returns integer
language sql
security definer
set search_path = ''
as $$
  with deleted as (
    delete from public.telemetry where measured_at < now() - make_interval(days => p_keep_days) returning 1
  )
  select count(*)::integer from deleted;
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.devices enable row level security;
alter table public.alarm_settings enable row level security;
alter table public.telemetry enable row level security;
alter table public.alarms enable row level security;
alter table private.alarm_conditions enable row level security;

create policy "devices: leitura por membros"
  on public.devices for select to authenticated
  using ((select private.is_org_member(organization_id)));

create policy "devices: cadastro por proprietários e operadores"
  on public.devices for insert to authenticated
  with check (
    (select private.has_org_role(organization_id, array['owner', 'operator']::public.org_role[]))
    and (
      incubator_id is null
      or exists (select 1 from public.incubators i where i.id = incubator_id and i.organization_id = devices.organization_id)
    )
  );

create policy "devices: edição por proprietários e operadores"
  on public.devices for update to authenticated
  using ((select private.has_org_role(organization_id, array['owner', 'operator']::public.org_role[])))
  with check ((select private.has_org_role(organization_id, array['owner', 'operator']::public.org_role[])));

create policy "devices: remoção por proprietários e operadores"
  on public.devices for delete to authenticated
  using ((select private.has_org_role(organization_id, array['owner', 'operator']::public.org_role[])));

create policy "alarm_settings: leitura por membros"
  on public.alarm_settings for select to authenticated
  using (exists (
    select 1 from public.incubators i
    where i.id = incubator_id and (select private.is_org_member(i.organization_id))
  ));

create policy "alarm_settings: edição por proprietários e operadores"
  on public.alarm_settings for update to authenticated
  using (exists (
    select 1 from public.incubators i
    where i.id = incubator_id
      and (select private.has_org_role(i.organization_id, array['owner', 'operator']::public.org_role[]))
  ))
  with check (exists (
    select 1 from public.incubators i
    where i.id = incubator_id
      and (select private.has_org_role(i.organization_id, array['owner', 'operator']::public.org_role[]))
  ));

create policy "telemetry: leitura por membros"
  on public.telemetry for select to authenticated
  using ((select private.is_org_member(organization_id)));

create policy "alarms: leitura por membros"
  on public.alarms for select to authenticated
  using ((select private.is_org_member(organization_id)));

-- -----------------------------------------------------------------------------
-- Permissões
-- Usuários só escrevem os campos que lhes cabem; o restante é exclusivo do
-- serviço de ingestão (service_role).
-- -----------------------------------------------------------------------------
revoke all on public.devices, public.alarm_settings, public.telemetry, public.alarms from anon;
revoke insert, update on public.devices from authenticated;
grant insert (organization_id, incubator_id, label) on public.devices to authenticated;
grant update (label) on public.devices to authenticated;
revoke insert, update, delete on public.telemetry, public.alarms from authenticated;
revoke insert, delete on public.alarm_settings from authenticated;
revoke update on public.alarm_settings from authenticated;
grant update (temp_min_c, temp_max_c, humidity_min_pct, humidity_max_pct, water_min_pct,
              alarm_delay_s, offline_timeout_s, preset)
  on public.alarm_settings to authenticated;

revoke execute on function public.ingest_reading(text, timestamptz, numeric, numeric, integer, integer, integer, boolean, text, boolean)
  from public, anon, authenticated;
revoke execute on function public.set_device_status(text, boolean) from public, anon, authenticated;
revoke execute on function public.check_device_timeouts() from public, anon, authenticated;
grant execute on function public.ingest_reading(text, timestamptz, numeric, numeric, integer, integer, integer, boolean, text, boolean)
  to service_role;
grant execute on function public.set_device_status(text, boolean) to service_role;
grant execute on function public.check_device_timeouts() to service_role;

revoke execute on function public.acknowledge_alarm(bigint, text) from public, anon;
grant execute on function public.acknowledge_alarm(bigint, text) to authenticated;
revoke execute on function public.telemetry_series(uuid, timestamptz, timestamptz, integer) from public, anon;
grant execute on function public.telemetry_series(uuid, timestamptz, timestamptz, integer) to authenticated;

revoke all on function private.evaluate_condition(uuid, uuid, uuid, public.alarm_type, public.alarm_severity,
  boolean, boolean, numeric, numeric, timestamptz, integer, text) from public, anon, authenticated;
revoke all on function private.purge_old_telemetry(integer) from public, anon, authenticated;
revoke all on function private.create_alarm_settings() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Tempo real: o site recebe alterações de dispositivos e alarmes
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.devices, public.alarms;
  end if;
end;
$$;
