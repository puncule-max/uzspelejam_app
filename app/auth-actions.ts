"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function requireString(value: FormDataEntryValue | null, name: string) {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`${name} is required.`);
  return result;
}

function safeNext(value: FormDataEntryValue | null) {
  const next = String(value ?? "/").trim();
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
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
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function signUp(formData: FormData) {
  const displayName = requireString(formData.get("display_name"), "Display name");
  const email = requireString(formData.get("email"), "Email");
  const password = requireString(formData.get("password"), "Password");
  const birthDate = requireString(formData.get("birth_date"), "Birth date");
  const city = String(formData.get("city") ?? "").trim();
  const language = String(formData.get("language") ?? "lv") === "en" ? "en" : "lv";
  const next = safeNext(formData.get("next"));
  const age = ageOn(birthDate);
  if (!Number.isFinite(age) || age < 16) redirect(`/signup?error=${encodeURIComponent("You must be at least 16 years old.")}&next=${encodeURIComponent(next)}`);

  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const supabase = await createClient();
  const callback = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const { data, error } = await supabase.auth.signUp({email,password,options:{emailRedirectTo:callback,data:{display_name:displayName,birth_date:birthDate,city,language,is_teen:age<18}}});
  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`);
  if (!data.session) redirect(`/login?message=${encodeURIComponent("Check your email to confirm your account.")}&next=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}


export async function requestPasswordReset(formData: FormData) {
  const email = requireString(formData.get("email"), "Email");
  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const supabase = await createClient();
  const redirectTo = origin + "/auth/callback?next=" + encodeURIComponent("/update-password");
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) redirect("/forgot-password?error=" + encodeURIComponent(error.message));
  redirect("/forgot-password?sent=1");
}

export async function updatePassword(formData: FormData) {
  const password = requireString(formData.get("password"), "Password");
  const confirmPassword = requireString(formData.get("confirm_password"), "Password confirmation");
  if (password.length < 8) redirect("/update-password?error=" + encodeURIComponent("Password must be at least 8 characters."));
  if (password !== confirmPassword) redirect("/update-password?error=" + encodeURIComponent("Passwords do not match."));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?message=" + encodeURIComponent("Open the password reset link from your email."));
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/update-password?error=" + encodeURIComponent(error.message));
  await supabase.auth.signOut();
  redirect("/login?message=" + encodeURIComponent("Password updated. Please sign in."));
}
