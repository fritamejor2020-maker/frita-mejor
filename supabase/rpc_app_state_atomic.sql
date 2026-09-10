-- ============================================================================
-- RPC: append/update/remove ATÓMICO de un ítem dentro del array JSONB de una
-- clave de app_state (posSales, inventory, etc.).
--
-- Problema que resuelve (#7 de la auditoría POS): el cliente hacía
-- SELECT value -> merge en JS -> UPSERT del array completo. Entre dos
-- dispositivos escribiendo la misma clave a la vez, el que leyó primero podía
-- pisar la venta del otro.
--
-- Aquí el merge ocurre en el servidor bajo un FOR UPDATE, así que dos llamadas
-- concurrentes se serializan y ninguna pierde datos.
--
-- DESPLIEGUE (PRODUCCIÓN): pegar y ejecutar este archivo en el SQL Editor de
-- Supabase de producción (proyecto uevcotmnffftoelscjua). El cliente ya lo usa
-- con fallback: si la función no existe todavía, vuelve al comportamiento
-- anterior (merge en JS) sin romperse.
-- ============================================================================

create or replace function public.app_state_upsert_item(p_key text, p_item jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_val jsonb;
begin
  if p_item is null or (p_item->>'id') is null then
    raise exception 'p_item debe ser un objeto con id';
  end if;

  -- Asegurar que la fila existe y bloquearla para serializar llamadas concurrentes
  insert into public.app_state (key, value, updated_at)
  values (p_key, '[]'::jsonb, now())
  on conflict (key) do nothing;

  select value into v_val from public.app_state where key = p_key for update;
  if v_val is null or jsonb_typeof(v_val) <> 'array' then
    v_val := '[]'::jsonb;
  end if;

  -- Nuevo ítem al frente, resto sin el ítem del mismo id
  select jsonb_build_array(p_item) || coalesce(jsonb_agg(elem), '[]'::jsonb)
    into v_val
  from jsonb_array_elements(v_val) elem
  where elem->>'id' is distinct from (p_item->>'id');

  update public.app_state set value = v_val, updated_at = now() where key = p_key;
end;
$$;

create or replace function public.app_state_remove_item(p_key text, p_item_id text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_val jsonb;
begin
  select value into v_val from public.app_state where key = p_key for update;
  if v_val is null or jsonb_typeof(v_val) <> 'array' then
    return;
  end if;

  select coalesce(jsonb_agg(elem), '[]'::jsonb)
    into v_val
  from jsonb_array_elements(v_val) elem
  where elem->>'id' is distinct from p_item_id;

  update public.app_state set value = v_val, updated_at = now() where key = p_key;
end;
$$;

grant execute on function public.app_state_upsert_item(text, jsonb) to anon, authenticated;
grant execute on function public.app_state_remove_item(text, text) to anon, authenticated;
