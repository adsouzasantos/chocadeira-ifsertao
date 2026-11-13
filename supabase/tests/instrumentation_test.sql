-- Testes da instrumentação: dispositivos, ingestão, alarmes e isolamento (RLS).
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'carla@exemplo.com', '{"full_name": "Carla"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'davi@exemplo.com',  '{"full_name": "Davi"}');

create temporary table t_ctx (key text primary key, val text);
grant all on t_ctx to authenticated, service_role;

-- Carla cadastra uma chocadeira e vincula um dispositivo
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';

insert into public.incubators (organization_id, name, code)
select organization_id, 'Chocadeira de teste', 'T-1' from public.organization_members;

insert into public.devices (organization_id, incubator_id, label)
select i.organization_id, i.id, 'ESP32 principal' from public.incubators i;

insert into t_ctx select 'device_key', device_key from public.devices;
insert into t_ctx select 'incubator', id::text from public.incubators;

do $$
begin
  assert (select count(*) from public.alarm_settings) = 1, 'limites padrão não foram criados';
  assert (select temp_max_c from public.alarm_settings) = 37.8, 'limite padrão incorreto';
  assert (select device_key ~ '^chc-[0-9a-f]{12}$' from public.devices), 'identificador do dispositivo inválido';
  raise notice 'OK 1: chocadeira com limites padrão e dispositivo com identificador gerado';
end $$;

-- 2. Usuário não escolhe o identificador nem grava telemetria diretamente
do $$
begin
  begin
    insert into public.devices (organization_id, device_key) select organization_id, 'chc-escolhido' from public.organization_members;
    raise exception 'FALHA: usuário definiu device_key';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.telemetry (organization_id, measured_at) select organization_id, now() from public.organization_members;
    raise exception 'FALHA: usuário gravou telemetria';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.ingest_reading((select val from t_ctx where key = 'device_key'), now(), 37.5, 55, 80);
    raise exception 'FALHA: usuário executou a ingestão';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK 2: campos e funções exclusivos do serviço de ingestão protegidos';
end $$;

-- 3. Davi não vincula dispositivo a chocadeira alheia
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
do $$
begin
  begin
    insert into public.devices (organization_id, incubator_id)
    values ((select o.id from public.organizations o where o.is_personal limit 1),
            (select val::uuid from t_ctx where key = 'incubator'));
    raise exception 'FALHA: dispositivo vinculado a chocadeira alheia';
  exception when insufficient_privilege then
    raise notice 'OK 3: vínculo com chocadeira de outra organização bloqueado';
  end;
end $$;

-- ===================== Ingestão (como service_role) =====================
reset role;
set role service_role;

do $$
declare
  k   text := (select val from t_ctx where key = 'device_key');
  inc uuid := (select val::uuid from t_ctx where key = 'incubator');
  t0  timestamptz := date_trunc('second', now()) - interval '1 hour';
  r   jsonb;
begin
  -- 4. Leitura normal
  r := public.ingest_reading(k, t0, 37.5, 55, 80, -60, 1, false, '1.0.0', true);
  assert (r ->> 'accepted')::boolean, 'leitura normal recusada';
  assert jsonb_array_length(r -> 'events') = 0, 'leitura normal gerou evento';
  assert (select online and last_temperature_c = 37.5 and firmware_version = '1.0.0' from public.devices where device_key = k),
    'retrato do dispositivo não atualizado';

  -- 5. Duplicada e dispositivo desconhecido
  r := public.ingest_reading(k, t0, 37.5, 55, 80);
  assert r ->> 'reason' = 'duplicate', 'duplicata aceita';
  r := public.ingest_reading('chc-inexistente', t0, 37.5, 55, 80);
  assert r ->> 'reason' = 'unknown_device', 'dispositivo desconhecido aceito';
  raise notice 'OK 4-5: leitura válida, duplicata e dispositivo desconhecido';

  -- 6. Temperatura alta: só alarma após o atraso de 120 s
  r := public.ingest_reading(k, t0 + interval '10 s', 38.5, 55, 80);
  assert jsonb_array_length(r -> 'events') = 0, 'alarmou antes do atraso';
  r := public.ingest_reading(k, t0 + interval '70 s', 38.6, 55, 80);
  assert jsonb_array_length(r -> 'events') = 0, 'alarmou antes do atraso (2)';
  r := public.ingest_reading(k, t0 + interval '140 s', 38.9, 55, 80);
  assert r -> 'events' @> '[{"type":"temperature_high","event":"opened"}]', 'alarme de temperatura não abriu';
  assert (select started_at = t0 + interval '10 s' and peak_value = 38.9 and severity = 'critical'
          from public.alarms where type = 'temperature_high'), 'dados do alarme incorretos';

  -- Faixa de histerese (37,7 > 37,6): continua ativo; pico é preservado
  r := public.ingest_reading(k, t0 + interval '150 s', 39.2, 55, 80);
  r := public.ingest_reading(k, t0 + interval '160 s', 37.7, 55, 80);
  assert (select resolved_at is null and peak_value = 39.2 from public.alarms where type = 'temperature_high'),
    'alarme deveria continuar ativo na histerese';
  r := public.ingest_reading(k, t0 + interval '170 s', 37.5, 55, 80);
  assert r -> 'events' @> '[{"type":"temperature_high","event":"resolved"}]', 'alarme não foi resolvido';
  raise notice 'OK 6: temperatura com atraso, pico e histerese';

  -- 7. Oscilação curta (porta aberta) não gera alarme
  r := public.ingest_reading(k, t0 + interval '200 s', 36.0, 55, 80);
  r := public.ingest_reading(k, t0 + interval '230 s', 37.5, 55, 80);
  r := public.ingest_reading(k, t0 + interval '400 s', 37.5, 55, 80);
  assert not exists (select 1 from public.alarms where type = 'temperature_low'), 'oscilação curta gerou alarme';
  raise notice 'OK 7: queda breve de temperatura ignorada';

  -- 8. Água: alarme imediato, histerese de 5 pontos
  r := public.ingest_reading(k, t0 + interval '410 s', 37.5, 55, 12);
  assert r -> 'events' @> '[{"type":"water_low","event":"opened"}]', 'alarme de água não abriu';
  assert (select message = 'Nível de água abaixo de 20%: reponha o reservatório' from public.alarms where type = 'water_low'),
    'mensagem do alarme de água incorreta';
  assert (select message = 'Temperatura acima do limite de 37,8 °C' from public.alarms where type = 'temperature_high'),
    'mensagem do alarme de temperatura incorreta';
  r := public.ingest_reading(k, t0 + interval '420 s', 37.5, 55, 22);
  assert exists (select 1 from public.alarms where type = 'water_low' and resolved_at is null), 'água deveria seguir em alarme';
  r := public.ingest_reading(k, t0 + interval '430 s', 37.5, 55, 90);
  assert r -> 'events' @> '[{"type":"water_low","event":"resolved"}]', 'alarme de água não resolveu';
  raise notice 'OK 8: nível de água';

  -- 9. Falha de sensor (leituras nulas) e umidade baixa (atenção)
  r := public.ingest_reading(k, t0 + interval '500 s', null, null, 90);
  r := public.ingest_reading(k, t0 + interval '700 s', null, null, 90);
  assert r -> 'events' @> '[{"type":"sensor_failure","event":"opened"}]', 'falha de sensor não detectada';
  r := public.ingest_reading(k, t0 + interval '710 s', 37.5, 40, 90);
  assert r -> 'events' @> '[{"type":"sensor_failure","event":"resolved"}]', 'falha de sensor não resolveu';
  r := public.ingest_reading(k, t0 + interval '900 s', 37.5, 40, 90);
  assert r -> 'events' @> '[{"type":"humidity_low","event":"opened"}]', 'umidade baixa não alarmou';
  assert (select severity = 'warning' from public.alarms where type = 'humidity_low'), 'severidade da umidade incorreta';
  raise notice 'OK 9: falha de sensor e umidade';

  -- 10. Reenvio de leitura antiga: entra no histórico, não alarma, não regride o retrato
  r := public.ingest_reading(k, t0 - interval '30 min', 42.0, 55, 90, null, null, true);
  assert (r ->> 'accepted')::boolean, 'reenvio recusado';
  assert not exists (select 1 from public.alarms where type = 'temperature_high' and resolved_at is null), 'reenvio gerou alarme';
  assert (select last_temperature_c = 37.5 from public.devices where device_key = k), 'retrato regrediu com leitura antiga';

  -- 11. Relógio absurdo do ESP32: usa o horário do servidor
  r := public.ingest_reading(k, timestamptz '1970-01-01', 37.5, 55, 90);
  assert (r ->> 'clock_ok')::boolean = false, 'relógio inválido não detectado';
  raise notice 'OK 10-11: reenvio e relógio incoerente';
end $$;

-- 12. Comunicação: sem mensagens além do limite abre alarme; nova leitura resolve
reset role;
update public.devices set last_seen_at = now() - interval '10 minutes';
set role service_role;
do $$
declare
  k text := (select val from t_ctx where key = 'device_key');
  r jsonb;
begin
  r := public.check_device_timeouts();
  assert (r ->> 'marked_offline')::int = 1 and (r ->> 'alarms_opened')::int = 1, 'timeout não detectado: ' || r::text;
  assert (select not online from public.devices where device_key = k), 'dispositivo deveria estar offline';
  r := public.check_device_timeouts();
  assert (r ->> 'alarms_opened')::int = 0, 'alarme de comunicação duplicado';
  r := public.ingest_reading(k, now(), 37.5, 55, 90);
  assert r -> 'events' @> '[{"type":"device_offline","event":"resolved"}]', 'retorno não resolveu o alarme';

  -- Last Will: marca offline e só alarma depois da tolerância
  r := public.set_device_status(k, false);
  r := public.check_device_timeouts();
  assert (r ->> 'alarms_opened')::int = 0, 'alarmou antes da tolerância';
  raise notice 'OK 12: tempo limite de comunicação e Last Will';
end $$;

reset role;
update public.devices set offline_since = now() - interval '5 minutes';
set role service_role;
do $$
declare
  k text := (select val from t_ctx where key = 'device_key');
  r jsonb;
begin
  r := public.check_device_timeouts();
  assert (r ->> 'alarms_opened')::int = 1, 'Last Will não gerou alarme após a tolerância';
  r := public.set_device_status(k, true);
  assert not exists (select 1 from public.alarms where type = 'device_offline' and resolved_at is null), 'status online não resolveu';
  raise notice 'OK 13: alarme após Last Will e resolução ao reconectar';
end $$;

-- ===================== Acesso pelo site =====================
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
do $$
declare
  v_alarm bigint;
begin
  assert (select count(*) from public.devices) = 0, 'Davi vê dispositivos alheios';
  assert (select count(*) from public.telemetry) = 0, 'Davi vê telemetria alheia';
  assert (select count(*) from public.alarms) = 0, 'Davi vê alarmes alheios';
  assert (select count(*) from public.alarm_settings) = 0, 'Davi vê limites alheios';
  assert (select count(*) from public.telemetry_series((select val::uuid from t_ctx where key = 'incubator'), now() - interval '2 hours', now())) = 0,
    'Davi obteve série alheia';
  begin
    perform public.acknowledge_alarm(1);
    raise exception 'FALHA: Davi reconheceu alarme alheio';
  exception when insufficient_privilege then null;
  end;
  update public.alarm_settings set temp_max_c = 40;
  assert not found, 'Davi alterou limites alheios';
  raise notice 'OK 14: isolamento de dispositivos, telemetria, alarmes e limites';
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
do $$
declare
  v_alarm bigint := (select id from public.alarms where type = 'humidity_low');
begin
  assert (select count(*) from public.telemetry) >= 15, 'Carla deveria ver o histórico';
  assert (select count(*) from public.telemetry_series((select val::uuid from t_ctx where key = 'incubator'), now() - interval '2 hours', now(), 50)) > 0,
    'série agregada vazia';
  perform public.acknowledge_alarm(v_alarm, 'Umidificador religado');
  assert (select acknowledged_by = '00000000-0000-0000-0000-0000000000c1' and resolution_note = 'Umidificador religado'
          from public.alarms where id = v_alarm), 'reconhecimento não registrado';
  begin
    update public.alarm_settings set temp_min_c = 38.5;
    raise exception 'FALHA: faixa invertida aceita';
  exception when check_violation then null;
  end;
  update public.alarm_settings set temp_min_c = 37.0, temp_max_c = 37.6, preset = 'galinha-eclosao';
  assert (select updated_by = '00000000-0000-0000-0000-0000000000c1' from public.alarm_settings), 'updated_by não registrado';
  begin
    update public.alarms set resolved_at = now();
    raise exception 'FALHA: usuário alterou alarme diretamente';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK 15: dona vê histórico, reconhece alarme e ajusta limites com validação';
end $$;

reset role;
\echo 'Todos os testes de instrumentação passaram.'
