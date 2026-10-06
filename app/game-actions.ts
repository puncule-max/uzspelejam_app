"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function asString(value: FormDataEntryValue | null) { return String(value ?? "").trim(); }
function required(value: FormDataEntryValue | null, name: string) {
  const text = asString(value);
  if (!text) throw new Error(`${name} is required.`);
  return text;
}

function rigaWallClockToIso(date: string, time: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const desired = Date.UTC(y, m - 1, d, hh, mm, 0);
  let guess = desired;
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Riga", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  });
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(fmt.formatToParts(new Date(guess)).filter(p => p.type !== "literal").map(p => [p.type, p.value]));
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    guess += desired - represented;
  }
  return new Date(guess).toISOString();
}

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function createGame(formData: FormData) {
  const { supabase } = await requireUser();
  const activityId = required(formData.get("activity_id"), "Activity");
  const mode = asString(formData.get("mode")) === "online" ? "online" : "physical";
  const date = required(formData.get("date"), "Date");
  const start = required(formData.get("start_time"), "Start time");
  const end = required(formData.get("end_time"), "End time");
  const startsAt = rigaWallClockToIso(date, start);
  const endsAt = rigaWallClockToIso(date, end);
  if (new Date(endsAt) <= new Date(startsAt)) throw new Error("End time must be after start time.");

  const skill = asString(formData.get("skill"));
  const skillLevels = ["beginner", "intermediate", "advanced"].includes(skill) ? [skill] : [];
  const paid = asString(formData.get("payment_method")) !== "free";
  const totalCost = paid ? Number(asString(formData.get("total_cost")) || 0) : 0;

  const { data, error } = await supabase.rpc("create_game", {
    p_activity_id: activityId,
    p_mode: mode,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
    p_additional_players_required: Number(required(formData.get("players_needed"), "Players needed")),
    p_visibility: asString(formData.get("visibility")) === "private" ? "private" : "public",
    p_required_skill_levels: skillLevels,
    p_gender_preference: asString(formData.get("gender_preference")) || "anyone",
    p_custom_location: mode === "physical" ? required(formData.get("location"), "Location") : null,
    p_city: asString(formData.get("city")) || null,
    p_online_platform: mode === "online" ? required(formData.get("online_platform"), "Online platform") : null,
    p_total_cost: totalCost,
    p_payment_method: asString(formData.get("payment_method")) || "free",
    p_venue_booked: mode === "physical" ? asString(formData.get("venue_booked")) === "true" : null,
    p_cancellation_policy_minutes: Number(asString(formData.get("cancellation_policy_minutes")) || 0),
    p_description: asString(formData.get("description")) || null,
  });
  if (error) redirect(`/create?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/");
  redirect(`/games/${data}`);
}

export async function joinGame(formData: FormData) {
  const { supabase } = await requireUser();
  const gameId = required(formData.get("game_id"), "Game");
  const positionId = asString(formData.get("position_id")) || null;
  const { error } = await supabase.rpc("join_game", { p_game_id: gameId, p_requested_position_id: positionId });
  if (error) redirect(`/games/${gameId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/games/${gameId}`); revalidatePath("/my-games");
}

export async function joinWaitingList(formData: FormData) {
  const { supabase } = await requireUser();
  const gameId = required(formData.get("game_id"), "Game");
  const { error } = await supabase.rpc("join_waiting_list", { p_game_id: gameId });
  if (error) redirect(`/games/${gameId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/games/${gameId}`); revalidatePath("/my-games");
}

export async function withdrawApplication(formData: FormData) {
  const { supabase } = await requireUser();
  const gameId = required(formData.get("game_id"), "Game");
  const { error } = await supabase.rpc("withdraw_application", { p_game_id: gameId });
  if (error) redirect(`/games/${gameId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/games/${gameId}`); revalidatePath("/my-games");
}

export async function leaveWaitingList(formData: FormData) {
  const { supabase } = await requireUser();
  const gameId = required(formData.get("game_id"), "Game");
  const { error } = await supabase.rpc("leave_waiting_list", { p_game_id: gameId });
  if (error) redirect(`/games/${gameId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/games/${gameId}`); revalidatePath("/my-games");
}

export async function leaveGame(formData: FormData) {
  const { supabase } = await requireUser();
  const gameId = required(formData.get("game_id"), "Game");
  const { error } = await supabase.rpc("leave_game", { p_game_id: gameId });
  if (error) redirect(`/games/${gameId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/games/${gameId}`); revalidatePath("/my-games");
}

export async function followGame(formData: FormData) {
  const { supabase } = await requireUser();
  const gameId = required(formData.get("game_id"), "Game");
  const { error } = await supabase.rpc("follow_game", { p_game_id: gameId });
  if (error) redirect(`/games/${gameId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/games/${gameId}`); revalidatePath("/my-games");
}

export async function unfollowGame(formData: FormData) {
  const { supabase } = await requireUser();
  const gameId = required(formData.get("game_id"), "Game");
  const { error } = await supabase.rpc("unfollow_game", { p_game_id: gameId });
  if (error) redirect(`/games/${gameId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/games/${gameId}`); revalidatePath("/my-games");
}

export async function acceptApplication(formData: FormData) {
  const { supabase } = await requireUser();
  const gameId = required(formData.get("game_id"), "Game");
  const applicationId = required(formData.get("application_id"), "Application");
  const { error } = await supabase.rpc("accept_application", { p_application_id: applicationId, p_team_id: null, p_position_id: null });
  if (error) redirect(`/games/${gameId}/manage?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/games/${gameId}`); revalidatePath(`/games/${gameId}/manage`); revalidatePath("/my-games");
}

export async function declineApplication(formData: FormData) {
  const { supabase } = await requireUser();
  const gameId = required(formData.get("game_id"), "Game");
  const applicationId = required(formData.get("application_id"), "Application");
  const { error } = await supabase.rpc("decline_application", { p_application_id: applicationId });
  if (error) redirect(`/games/${gameId}/manage?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/games/${gameId}/manage`); revalidatePath("/my-games");
}

export async function promoteWaitingUser(formData: FormData) {
  const { supabase } = await requireUser();
  const gameId = required(formData.get("game_id"), "Game");
  const waitingId = required(formData.get("waiting_id"), "Waiting entry");
  const { error } = await supabase.rpc("promote_waiting_user", { p_waiting_id: waitingId, p_team_id: null, p_position_id: null });
  if (error) redirect(`/games/${gameId}/manage?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/games/${gameId}`); revalidatePath(`/games/${gameId}/manage`); revalidatePath("/my-games");
}
