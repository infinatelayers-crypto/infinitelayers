-- ============================================================================
-- Change the store admin email and/or password.
-- Run in Supabase → SQL Editor. Edit the three values at the top, then Run.
-- The OLD admin login stops working; the NEW email + password takes over.
-- ============================================================================

do $$
declare
  -- 1) The email that is CURRENTLY the admin (the one to replace).
  v_old_email text := 'admin@example.com';

  -- 2) The NEW email to log in with (can be the same as old to only change password).
  v_new_email text := 'newadmin@example.com';

  -- 3) The NEW password.
  v_new_password text := 'ChangeThisPassword123';

  v_user_id uuid;
begin
  select id into v_user_id from auth.users where email = v_old_email;

  if v_user_id is null then
    raise exception 'No user found with email %', v_old_email;
  end if;

  -- Update email + password (bcrypt) and keep the account confirmed.
  update auth.users
  set email = v_new_email,
      encrypted_password = crypt(v_new_password, gen_salt('bf', 10)),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
  where id = v_user_id;

  -- Keep the auth identity's email in sync.
  update auth.identities
  set identity_data = jsonb_set(
        coalesce(identity_data, '{}'::jsonb), '{email}', to_jsonb(v_new_email)
      ),
      updated_at = now()
  where user_id = v_user_id;

  -- The admin allowlist references user_id (not email), so it stays valid.
  -- Nothing else to change.
  raise notice 'Admin updated. Log in with % and the new password.', v_new_email;
end
$$;
