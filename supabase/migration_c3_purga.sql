-- ============================================================================
-- C3 — Purga de logs de app_state + barrido nocturno (pg_cron)
--
-- Idempotente: se puede re-ejecutar sin efectos secundarios.
--
-- NO incluye: trigger updated_at (ya existe en schema_realtime.sql), tablas de
-- paridad (ya existen: olaclick_orders / error_logs / push_subscriptions), ni
-- nada de login/RLS de usuarios (eso es C4).
--
-- Qué hace: los arrays de historia (attendance_logs, movements, chatMessages,
-- loadHistory, rejectedRequests, completedRequests, posShifts_master_history)
-- crecen sin límite dentro de una sola fila jsonb de app_state y terminan
-- ralentizando cada pull. Esto los recorta por antigüedad, en el servidor,
-- una vez por noche.
--
-- DESPLIEGUE: pegar y ejecutar en el SQL Editor de producción (uevcotmnffftoelscjua).
-- Si pg_cron no está disponible en el proyecto, el bloque DO lo detecta y solo
-- deja las funciones (se pueden llamar manualmente o desde un scheduler externo).
-- ============================================================================

-- ── Recorta un array de log a los últimos N días (por fecha del ítem) ────────
create or replace function public.app_state_trim_log(p_key text, p_keep_days int default 90)
returns int language plpgsql security invoker set search_path = '' as $$
declare v_val jsonb; v_new jsonb; v_cut timestamptz := now() - make_interval(days => p_keep_days); v_removed int;
begin
  select value into v_val from public.app_state where key = p_key for update;
  if v_val is null or jsonb_typeof(v_val) <> 'array' then return 0; end if;
  select coalesce(jsonb_agg(e), '[]'::jsonb) into v_new
  from jsonb_array_elements(v_val) e
  where coalesce(
          (e->>'timestamp'), (e->>'created_at'), (e->>'completed_at'),
          (e->>'time'), (e->>'date'), (e->>'fecha')
        )::timestamptz >= v_cut
     or coalesce(
          (e->>'timestamp'), (e->>'created_at'), (e->>'completed_at'),
          (e->>'time'), (e->>'date'), (e->>'fecha')
        ) is null;
  v_removed := jsonb_array_length(v_val) - jsonb_array_length(v_new);
  if v_removed > 0 then
    update public.app_state set value = v_new, updated_at = now() where key = p_key;
  end if;
  return v_removed;
end;
$$;
grant execute on function public.app_state_trim_log(text, int) to anon, authenticated;

-- ── Barrido nocturno de todos los logs de historia ──────────────────────────
-- Defensivo: un try/catch por clave para que un array corrupto no aborte el resto.
create or replace function public.app_state_nightly_purge()
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in
    select key from public.app_state
    where jsonb_typeof(value) = 'array'
      and (key like 'attendance_logs%' or key like 'movements%' or key like 'chatMessages%'
           or key like 'loadHistory%' or key like 'rejectedRequests%' or key like 'completedRequests%')
  loop
    begin
      perform public.app_state_trim_log(r.key,
        case when r.key like 'chatMessages%' then 3
             when r.key like 'attendance_logs%' then 120
             else 60 end);
    exception when others then null;
    end;
  end loop;
  -- posShifts_master_history: conservar 180 días
  begin perform public.app_state_trim_log('posShifts_master_history', 180); exception when others then null; end;
end;
$$;
revoke execute on function public.app_state_nightly_purge() from anon, authenticated, public;

-- ── Programar el barrido a las 06:17 UTC (~01:17 hora Colombia) ──────────────
do $$
begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'fm_nightly_purge') then
    perform cron.unschedule('fm_nightly_purge');
  end if;
  perform cron.schedule('fm_nightly_purge', '17 6 * * *', 'select public.app_state_nightly_purge()');
exception when others then
  raise notice 'pg_cron no disponible o sin permisos: %', sqlerrm;
end;
$$;
