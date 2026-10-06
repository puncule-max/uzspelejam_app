"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function requireString(value: FormDataEntryValue | null, name: string) {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`${name} is required.`);
  return result;
}

function ageOn(dateString: string) {
  const birth = new Date(`${dateString}T00:00:00Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday = now.getUTCMonth() < birth.getUTCMonth() || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export async function signIn(formData: FormData) {
  const email = requireString(formData.get("email"), "Email");
  const password = requireString(formData.get("password"), "Password");
  const next = String(formData.get("next") ?? "/");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`);
  redirect(next.startsWith("/") ? next : "/");
}

export async function signUp(formData: FormData) {
  const displayName = requireString(formData.get("display_name"), "Display name");
  const email = requireString(formData.get("email"), "Email");
  const password = requireString(formData.get("password"), "Password");
  const birthDate = requireString(formData.get("birth_date"), "Birth date");
  const city = String(formData.get("city") ?? "").trim();
  const language = String(formData.get("language") ?? "lv") === "en" ? "en" : "lv";
  const age = ageOn(birthDate);
  if (!Number.isFinite(age) || age < 16) redirect(`/signup?error=${encodeURIComponent("You must be at least 16 years old.")}`);

  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({email,password,options:{emailRedirectTo:`${origin}/auth/callback`,data:{display_name:displayName,birth_date:birthDate,city,language,is_teen:age<18}}});
  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  if (!data.session) redirect("/login?message=Check%20your%20email%20to%20confirm%20your%20account.");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
