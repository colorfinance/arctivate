-- Anyone holding the public anon key could change any member's points.
--
-- add_points(p_user_id, p_points) is SECURITY DEFINER, so it bypasses row
-- level security, and it took the target user and the amount as arguments
-- with no check on who was asking. EXECUTE was granted to `anon`, and the
-- anon key ships inside the JavaScript bundle. Verified against production:
-- an unauthenticated caller moved another member's total, which was reverted
-- immediately. redeem_code(p_code, p_user_id) had the same shape and could
-- award a code or a partner check-in to any account.
--
-- Three changes:
--   1. anon loses EXECUTE on every SECURITY DEFINER function. None of them
--      are of any use before signing in — they all read auth.uid().
--   2. add_points and redeem_code refuse to act on somebody else's behalf.
--      A signed-in caller may only affect themselves. A service-role caller
--      (no JWT, so auth.uid() is null) is unaffected, which is what
--      pages/api/redeem.ts uses.
--   3. every SECURITY DEFINER function gets a fixed search_path, so none of
--      them can be redirected at attacker-created objects.

-- --- 1. anon has no business calling any of these ----------------------------

-- Revoking from `anon` alone does nothing: Postgres grants EXECUTE to PUBLIC
-- by default and anon inherits it, so the grant has to come off PUBLIC and
-- then be handed back to the roles that should have it. Confirmed the hard
-- way — the first attempt at this revoke left the hole wide open.
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.sig);
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.completed_days_for(uuid, date) FROM PUBLIC, anon, authenticated;

-- --- 2. these two must not act for someone else ------------------------------

CREATE OR REPLACE FUNCTION public.add_points(p_user_id uuid, p_points integer)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  -- A signed-in caller may only top up their own total. auth.uid() is null
  -- for the service role, which is trusted server-side code.
  IF auth.uid() IS NOT NULL AND p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'You can only change your own points';
  END IF;
  UPDATE public.profiles SET total_points = COALESCE(total_points, 0) + p_points WHERE id = p_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.redeem_code(p_code text, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_reward record; v_partner record; v_points int;
begin
  if p_code is null or p_user_id is null then return json_build_object('success', false, 'error', 'Invalid parameters'); end if;
  -- Same rule: redeem for yourself, or be the server.
  if auth.uid() is not null and p_user_id <> auth.uid() then
    return json_build_object('success', false, 'error', 'You can only redeem for yourself');
  end if;

  select * into v_reward from public.rewards_ledger where code = p_code;
  if v_reward is null then
    select * into v_partner from public.partners where qr_uuid::text = p_code;
    if v_partner is not null then
      if exists(select 1 from public.check_ins where user_id = p_user_id and partner_id = v_partner.id and date(checked_in_at) = current_date) then
        return json_build_object('success', false, 'error', 'Already checked in today');
      end if;
      v_points := 150;
      insert into public.check_ins (user_id, partner_id, awarded_points) values (p_user_id, v_partner.id, v_points);
      update public.profiles set total_points = total_points + v_points where id = p_user_id;
      return json_build_object('success', true, 'type', 'partner', 'points_awarded', v_points, 'partner_name', v_partner.name, 'description', 'Checked in at ' || v_partner.name);
    end if;
    return json_build_object('success', false, 'error', 'Invalid code');
  end if;
  if v_reward.is_used then return json_build_object('success', false, 'error', 'Code already redeemed'); end if;
  if v_reward.expires_at is not null and v_reward.expires_at < now() then return json_build_object('success', false, 'error', 'Code has expired'); end if;
  update public.rewards_ledger set is_used = true, used_by = p_user_id, used_at = now() where id = v_reward.id;
  if v_reward.code_type = 'points' then
    update public.profiles set total_points = total_points + v_reward.points_value where id = p_user_id;
    return json_build_object('success', true, 'type', 'points', 'points_awarded', v_reward.points_value, 'description', coalesce(v_reward.description, 'Points reward redeemed!'));
  end if;
  if v_reward.code_type = 'partner' then
    return json_build_object('success', true, 'type', 'partner_access', 'partner_id', v_reward.partner_id, 'description', coalesce(v_reward.description, 'Partner access granted!'));
  end if;
  return json_build_object('success', true, 'type', v_reward.code_type);
end; $function$;

-- --- 3. pin search_path on every SECURITY DEFINER function -------------------

DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.prosecdef
      AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path TO ''public''', f.sig);
  END LOOP;
END $$;

-- increment_points is SECURITY INVOKER, so row level security already stops it
-- being pointed at anyone else, but it has no business being anon-callable.
REVOKE EXECUTE ON FUNCTION public.increment_points(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_points(uuid, integer) TO authenticated, service_role;
ALTER FUNCTION public.increment_points(uuid, integer) SET search_path TO 'public';
