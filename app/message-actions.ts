"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function sendMessage(formData: FormData) {
  const conversationId = String(formData.get("conversation_id") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!conversationId || !body) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/messages/${conversationId}`);

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    body,
  });

  if (error) redirect(`/messages/${conversationId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/messages");
}
