"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext, ageOn } from "@/lib/auth-navigation";

function requireString(value: FormDataEntryValue | null, name: string) {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`${name} is required.`);
  return result;
}

async function rememberLanguage(language: "lv" | "en") {
  (await cookies()).set("uz_locale", language, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}

export async function signIn(formData: FormData) {
  const email = requireString(formData.get("email"), "Email");
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`);
  if (data.user) {
    const { data: profiles } = await supabase.rpc("get_profile_detail", { p_user_id: data.user.id });
    const profile = Array.isArray(profiles) ? profiles[0] : profiles;
    if (profile?.language === "lv" || profile?.language === "en") await rememberLanguage(profile.language);
  }
  redirect(next);
}

export async function signUp(formData: FormData) {
  const displayName = requireString(formData.get("display_name"), "Display name");
  const email = requireString(formData.get("email"), "Email");
  const password = String(formData.get("password") ?? "");
  const birthDate = requireString(formData.get("birth_date"), "Birth date");
  const city = String(formData.get("city") ?? "").trim();
  const language = String(formData.get("language") ?? "lv") === "en" ? "en" : "lv";
  const next = safeNext(formData.get("next"));
  if (password.length < 8) redirect(`/signup?error=${encodeURIComponent("Password must be at least 8 characters.")}&next=${encodeURIComponent(next)}`);
  const age = ageOn(birthDate);
  if (!Number.isFinite(age) || age < 16) redirect(`/signup?error=${encodeURIComponent("You must be at least 16 years old.")}&next=${encodeURIComponent(next)}`);
  await rememberLanguage(language);

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
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");
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
