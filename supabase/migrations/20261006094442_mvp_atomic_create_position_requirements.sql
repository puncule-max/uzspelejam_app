
create or replace function private.create_game_with_requirements_impl(
  p_activity_id uuid,
  p_mode public.play_mode,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_additional_players_required integer,
  p_visibility public.game_visibility default 'public',
  p_required_skill_levels public.skill_level[] default '{}',
  p_gender_preference public.gender_preference default 'anyone',
  p_custom_location text default null,
  p_city text default null,
  p_online_platform text default null,
  p_total_cost numeric default 0,
  p_payment_method public.payment_method default 'free',
  p_venue_booked boolean default null,
  p_cancellation_policy_minutes integer default null,
  p_description text default null,
  p_position_requirements jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_game_id uuid;
  v_item record;
  v_position uuid;
  v_count integer;
  v_total integer:=0;
begin
  v_game_id:=private.create_game_impl(
    p_activity_id,p_mode,p_starts_at,p_ends_at,p_additional_players_required,p_visibility,
    p_required_skill_levels,p_gender_preference,p_custom_location,p_city,p_online_platform,
    p_total_cost,p_payment_method,p_venue_booked,p_cancellation_policy_minutes,p_description
  );

  if p_position_requirements is null or p_position_requirements='{}'::jsonb then
    return v_game_id;
  end if;
  if jsonb_typeof(p_position_requirements)<>'object' then
    raise exception 'INVALID_POSITION_REQUIREMENTS';
  end if;

  for v_item in select key,value from jsonb_each_text(p_position_requirements)
  loop
    begin
      v_position:=v_item.key::uuid;
      v_count:=v_item.value::integer;
    exception when others then
      raise exception 'INVALID_POSITION_REQUIREMENTS';
    end;

    if v_count<=0 then continue; end if;
    if v_count>99 then raise exception 'INVALID_REQUIRED_COUNT'; end if;
    if not exists(
      select 1 from public.positions p
      where p.id=v_position and p.activity_id=p_activity_id and p.active
    ) then raise exception 'POSITION_NOT_VALID_FOR_ACTIVITY'; end if;

    v_total:=v_total+v_count;
    if v_total>p_additional_players_required then
      raise exception 'POSITION_REQUIREMENTS_EXCEED_CAPACITY';
    end if;

    insert into public.game_position_requirements(game_id,position_id,required_count)
    values(v_game_id,v_position,v_count);
  end loop;

  return v_game_id;
end;
$$;

revoke all on function private.create_game_with_requirements_impl(
  uuid,public.play_mode,timestamptz,timestamptz,integer,public.game_visibility,
  public.skill_level[],public.gender_preference,text,text,text,numeric,
  public.payment_method,boolean,integer,text,jsonb
) from public,anon;
grant execute on function private.create_game_with_requirements_impl(
  uuid,public.play_mode,timestamptz,timestamptz,integer,public.game_visibility,
  public.skill_level[],public.gender_preference,text,text,text,numeric,
  public.payment_method,boolean,integer,text,jsonb
) to authenticated;

create or replace function public.create_game_with_requirements(
  p_activity_id uuid,
  p_mode public.play_mode,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_additional_players_required integer,
  p_visibility public.game_visibility default 'public',
  p_required_skill_levels public.skill_level[] default '{}',
  p_gender_preference public.gender_preference default 'anyone',
  p_custom_location text default null,
  p_city text default null,
  p_online_platform text default null,
  p_total_cost numeric default 0,
  p_payment_method public.payment_method default 'free',
  p_venue_booked boolean default null,
  p_cancellation_policy_minutes integer default null,
  p_description text default null,
  p_position_requirements jsonb default '{}'::jsonb
)
returns uuid
language sql
security invoker
set search_path=''
as $$
  select private.create_game_with_requirements_impl(
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
  );
$$;

revoke all on function public.create_game_with_requirements(
  uuid,public.play_mode,timestamptz,timestamptz,integer,public.game_visibility,
  public.skill_level[],public.gender_preference,text,text,text,numeric,
  public.payment_method,boolean,integer,text,jsonb
) from public,anon;
grant execute on function public.create_game_with_requirements(
  uuid,public.play_mode,timestamptz,timestamptz,integer,public.game_visibility,
  public.skill_level[],public.gender_preference,text,text,text,numeric,
  public.payment_method,boolean,integer,text,jsonb
) to authenticated;
