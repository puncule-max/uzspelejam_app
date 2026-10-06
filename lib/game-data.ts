import { createClient } from "@/lib/supabase/server";
import { resolveGameAccessContext, type DomainContext } from "@/lib/domain";

export async function getGameDetails(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: game, error } = await supabase
    .from("games")
    .select("*, activity:activities(id,code,name_lv,name_en,participation_type,play_mode,supports_teams,supports_positions), venue:venues(id,name,city,address)")
    .eq("id", id)
    .single();
  if (error || !game) return null;

  const [{ count: acceptedCount }, participantRes, applicationRes, waitingRes, followerRes] = await Promise.all([
    supabase.from("game_participants").select("id", { count: "exact", head: true }).eq("game_id", id).eq("status", "accepted"),
    user ? supabase.from("game_participants").select("*").eq("game_id", id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.from("game_applications").select("*").eq("game_id", id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.from("game_waiting_list").select("*").eq("game_id", id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.from("game_followers").select("*").eq("game_id", id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
  ] as any);

  const participant = participantRes.data ?? null;
  const application = applicationRes.data ?? null;
  const waiting = waitingRes.data ?? null;
  const follower = followerRes.data ?? null;

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
    waitingListPosition: null,
    isFollowing: Boolean(follower),
    canAccessPrivateGame: true,
    isBlockedByOrganizer: false,
    hasBlockedOrganizer: false,
    ratingAlreadySubmitted: false,
    assignedTeamId: participant?.team_id ?? null,
    assignedPositionId: participant?.position_id ?? null,
  };

  const access = resolveGameAccessContext(ctx);
  let conversationId: string | null = null;

  if (user && (access.userGameState === "accepted" || access.userGameState === "organizer")) {
    const { data: conversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("game_id",id)
      .eq("type","group")
      .maybeSingle();
    conversationId = conversation?.id ?? null;
  } else if (user && access.userGameState === "pending") {
    const { data: conversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("game_id",id)
      .eq("type","application")
      .eq("applicant_user_id",user.id)
      .maybeSingle();
    conversationId = conversation?.id ?? null;
  }

  return { game, user, participant, application, waiting, follower, access, acceptedCount: acceptedCount ?? 0, conversationId };
}
