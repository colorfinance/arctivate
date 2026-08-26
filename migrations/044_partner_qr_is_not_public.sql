-- A partner QR code is worth 150 points, and every member could read it.
--
-- `partners` carries a "Anyone can view partners" SELECT policy with USING
-- (true), and SELECT was granted on the whole table -- including `qr_uuid`.
-- The check-in flow treats that uuid as proof you stood in the venue: scan it,
-- get the points. So any member (and, because the policy is for role `public`,
-- any logged-out visitor with the anon key) could read all the codes out of the
-- table and check in at every partner from their sofa, once a day, forever.
--
-- Two things had to change together:
--
--   1. `qr_uuid` is no longer readable by anon or authenticated. Members still
--      see the venue directory -- name, discount, description, location, points
--      -- just not the code. Owners and admins read their own codes through
--      my_partner_qr().
--
--   2. The check-in itself moves into the database. It used to be three client
--      calls: look the partner up, insert a check_in with a points figure the
--      client chose, then call add_points with that same client-chosen number.
--      check_in_with_qr() does the lot server-side and awards the venue's own
--      points_value, so the reward is set by the partner rather than asserted
--      by whoever is holding the phone.

-- --- the check-in, server-side ----------------------------------------------

CREATE OR REPLACE FUNCTION public.check_in_with_qr(p_qr text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
  v_user uuid := auth.uid();
  v_partner record;
  v_points int;
begin
  if v_user is null then
    return json_build_object('success', false, 'error', 'Please log in to check in');
  end if;
  if p_qr is null or btrim(p_qr) = '' then
    return json_build_object('success', false, 'error', 'not_a_partner');
  end if;

  -- Compared as text on purpose: a reward code is not a uuid, and casting the
  -- argument instead would throw rather than fall through to redeem_code().
  select * into v_partner from public.partners p where p.qr_uuid::text = btrim(p_qr);

  -- Not a partner QR. The caller should try this as a reward code next, so this
  -- is a sentinel rather than something to put in front of a member.
  if v_partner is null then
    return json_build_object('success', false, 'error', 'not_a_partner');
  end if;

  if exists (
    select 1 from public.check_ins c
    where c.user_id = v_user
      and c.partner_id = v_partner.id
      and date(c.checked_in_at) = current_date
  ) then
    return json_build_object('success', false, 'error', 'You already checked in here today! Come back tomorrow.');
  end if;

  -- The venue's number, not the client's.
  v_points := greatest(coalesce(v_partner.points_value, 150), 0);

  insert into public.check_ins (user_id, partner_id, awarded_points)
  values (v_user, v_partner.id, v_points);

  update public.profiles
     set total_points = coalesce(total_points, 0) + v_points
   where id = v_user;

  return json_build_object(
    'success', true,
    'type', 'checkin',
    'points_awarded', v_points,
    'partner_name', v_partner.name,
    'discount_text', v_partner.discount_text,
    'description', coalesce(v_partner.description, 'Checked in at ' || v_partner.name)
  );
end;
$$;

-- Postgres grants EXECUTE to PUBLIC on every new function, so revoking from
-- anon alone would leave it reachable through PUBLIC.
REVOKE EXECUTE ON FUNCTION public.check_in_with_qr(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_in_with_qr(text) TO authenticated, service_role;

-- --- owners and admins still need their own codes ---------------------------

CREATE OR REPLACE FUNCTION public.my_partner_qr()
RETURNS TABLE (partner_id uuid, qr_uuid text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  select p.id, p.qr_uuid::text
  from public.partners p
  where p.owner_id = auth.uid()
     or exists (
       select 1 from public.profiles pr
       where pr.id = auth.uid() and pr.is_admin = true
     );
$$;

REVOKE EXECUTE ON FUNCTION public.my_partner_qr() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_partner_qr() TO authenticated, service_role;

-- --- take qr_uuid off the table read -----------------------------------------

-- SELECT was granted table-wide, and a column-level REVOKE cannot carve a hole
-- in a table-level grant. So the grant is replaced by an explicit column list.
REVOKE SELECT ON public.partners FROM anon, authenticated;
GRANT SELECT (id, name, location_lat, location_long, discount_text, points_value, description, owner_id)
  ON public.partners TO anon, authenticated;

-- --- while we are here: redeem_code paid a flat 150 --------------------------

-- redeem_code() also accepts a partner qr_uuid, and awarded a hardcoded 150
-- regardless of what the venue set. Same body, one number fixed.
CREATE OR REPLACE FUNCTION public.redeem_code(p_code text, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare v_reward record; v_partner record; v_points int;
begin
  if p_code is null or p_user_id is null then return json_build_object('success', false, 'error', 'Invalid parameters'); end if;
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
      v_points := greatest(coalesce(v_partner.points_value, 150), 0);
      insert into public.check_ins (user_id, partner_id, awarded_points) values (p_user_id, v_partner.id, v_points);
      update public.profiles set total_points = coalesce(total_points, 0) + v_points where id = p_user_id;
      return json_build_object('success', true, 'type', 'partner', 'points_awarded', v_points, 'partner_name', v_partner.name, 'description', 'Checked in at ' || v_partner.name);
    end if;
    return json_build_object('success', false, 'error', 'Invalid code');
  end if;
  if v_reward.is_used then return json_build_object('success', false, 'error', 'Code already redeemed'); end if;
  if v_reward.expires_at is not null and v_reward.expires_at < now() then return json_build_object('success', false, 'error', 'Code has expired'); end if;
  update public.rewards_ledger set is_used = true, used_by = p_user_id, used_at = now() where id = v_reward.id;
  if v_reward.code_type = 'points' then
    update public.profiles set total_points = coalesce(total_points, 0) + v_reward.points_value where id = p_user_id;
    return json_build_object('success', true, 'type', 'points', 'points_awarded', v_reward.points_value, 'description', coalesce(v_reward.description, 'Points reward redeemed!'));
  end if;
  if v_reward.code_type = 'partner' then
    return json_build_object('success', true, 'type', 'partner_access', 'partner_id', v_reward.partner_id, 'description', coalesce(v_reward.description, 'Partner access granted!'));
  end if;
  return json_build_object('success', true, 'type', v_reward.code_type);
end; $$;

REVOKE EXECUTE ON FUNCTION public.redeem_code(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_code(text, uuid) TO authenticated, service_role;
