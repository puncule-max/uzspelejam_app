import { createClient } from "@/lib/supabase/server";
import { resolveGameAccessContext, type DomainContext } from "@/lib/domain";

export async function getGameDetails(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: game, error } = await supabase
    .from("games")
    .select("*, activity:activities(id,code,name_lv,name_en,participation_type,play_mode,supports_teams,supports_positions), venue:venues(id,name,city,address), organizer:profiles!games_creator_id_fkey(id,display_name,avatar_url,rating_average,rating_count)")
    .eq("id", id)
    .single();
  if (error || !game) return null;

  const blockQuery = user
    ? supabase.from("blocks").select("blocker_user_id,blocked_user_id")
        .or(`and(blocker_user_id.eq.${user.id},blocked_user_id.eq.${game.creator_id}),and(blocker_user_id.eq.${game.creator_id},blocked_user_id.eq.${user.id})`)
    : Promise.resolve({ data: [] as Array<{blocker_user_id:string;blocked_user_id:string}> });

  const positionsQuery = game.activity?.supports_positions
    ? supabase.from("positions").select("id,name_lv,name_en,sort_order").eq("activity_id",game.activity.id).eq("active",true).order("sort_order")
    : Promise.resolve({ data: [] });

  const requirementsQuery = game.activity?.supports_positions
    ? supabase.from("game_position_requirements").select("position_id,required_count").eq("game_id",id)
    : Promise.resolve({ data: [] });

  const acceptedPositionsQuery = game.activity?.supports_positions
    ? supabase.from("game_participants").select("position_id").eq("game_id",id).eq("status","accepted")
    : Promise.resolve({ data: [] });

  const [
    { count: acceptedCount }, participantRes, applicationRes, waitingRes, followerRes,
    waitingPositionRes, blocksRes, positionsRes, requirementsRes, acceptedPositionsRes,
  ] = await Promise.all([
    supabase.from("game_participants").select("id", { count: "exact", head: true }).eq("game_id", id).eq("status", "accepted"),
    user ? supabase.from("game_participants").select("*").eq("game_id", id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.from("game_applications").select("*").eq("game_id", id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.from("game_waiting_list").select("*").eq("game_id", id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.from("game_followers").select("*").eq("game_id", id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.rpc("my_waiting_list_position", { p_game_id: id }) : Promise.resolve({ data: null }),
    blockQuery, positionsQuery, requirementsQuery, acceptedPositionsQuery,
  ] as any);

  const participant = participantRes.data ?? null;
  const application = applicationRes.data ?? null;
  const waiting = waitingRes.data ?? null;
  const follower = followerRes.data ?? null;
  const blocks = blocksRes.data ?? [];

  const isBlockedByOrganizer = Boolean(user && blocks.some((b:any) => b.blocker_user_id === game.creator_id && b.blocked_user_id === user.id));
  const hasBlockedOrganizer = Boolean(user && blocks.some((b:any) => b.blocker_user_id === user.id && b.blocked_user_id === game.creator_id));

  const requirementMap = new Map((requirementsRes.data ?? []).map((r:any)=>[r.position_id,Number(r.required_count)]));
  const acceptedByPosition = new Map<string,number>();
  for (const p of acceptedPositionsRes.data ?? []) {
    if (!p.position_id) continue;
    acceptedByPosition.set(p.position_id,(acceptedByPosition.get(p.position_id)??0)+1);
  }
  const positionOptions = (positionsRes.data ?? []).map((p:any)=>{
    const required=Number(requirementMap.get(p.id)??0);
    const accepted=Number(acceptedByPosition.get(p.id)??0);
    return {...p,required_count:required,accepted_count:accepted,remaining_count:Math.max(0,required-accepted)};
  });

  const ctx: DomainContext = {
    now: new Date(),
    game: {
      creatorId: game.creator_id,
      endsAt: new Date(game.ends_at),
      cancelledAt: game.cancelled_at ? new Date(game.cancelled_at) : null,
      additionalPlayersRequired: game.additional_players_required,
      acceptedPlayersCount: acceptedCount ?? 0,
      visibility: game.visibility,
      supportsTeams: Boolean(game.activity?.supports_teams),
      supportsPositions: Boolean(game.activity?.supports_positions),
      isPremiumOrganizer: false,
    },
    userId: user?.id ?? null,
    participantStatus: participant?.status ?? null,
    applicationStatus: application?.status ?? null,
    waitingStatus: waiting?.status ?? null,
    waitingListPosition: typeof waitingPositionRes.data === "number" ? waitingPositionRes.data : null,
    isFollowing: Boolean(follower),
    canAccessPrivateGame: true,
    isBlockedByOrganizer,
    hasBlockedOrganizer,
    ratingAlreadySubmitted: false,
    assignedTeamId: participant?.team_id ?? null,
    assignedPositionId: participant?.position_id ?? null,
  };

  const access = resolveGameAccessContext(ctx);
  const { data: organizerRows } = await supabase.rpc("get_profile_detail",{ p_user_id: game.creator_id });
  const organizerProfile = Array.isArray(organizerRows) ? organizerRows[0] : organizerRows;
  let conversationId: string | null = null;

  if (user && (access.userGameState === "accepted" || access.userGameState === "organizer")) {
    const { data: conversation } = await supabase.from("conversations").select("id").eq("game_id",id).eq("type","group").maybeSingle();
    conversationId = conversation?.id ?? null;
  } else if (user && access.userGameState === "pending") {
    const { data: conversation } = await supabase.from("conversations").select("id").eq("game_id",id).eq("type","application").eq("applicant_user_id",user.id).maybeSingle();
    conversationId = conversation?.id ?? null;
  }

  return { game, user, participant, application, waiting, follower, access, acceptedCount: acceptedCount ?? 0, conversationId, positionOptions, organizerProfile };
}
