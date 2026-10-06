import type { Locale } from "@/lib/i18n";

/** Also recognize the provider message in links generated before code-based errors. */
export function authErrorMessage(error: string | null, locale: Locale): string | null {
  if (error === "over_email_send_rate_limit" || error?.toLowerCase() === "email rate limit exceeded") {
    return locale === "lv"
      ? "Pašlaik sasniegts e-pastu nosūtīšanas limits. Jaunu saiti neizdevās nosūtīt. Lūdzu, mēģini vēlāk."
      : "The email sending limit has been reached. A new link could not be sent. Please try again later.";
  }
  return error;
}
