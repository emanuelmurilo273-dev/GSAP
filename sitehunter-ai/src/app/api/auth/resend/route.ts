import { requireUser } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { sendVerificationEmail } from "@/lib/authEmails";

export const POST = route(async () => {
  const user = await requireUser();
  await rateLimit(`resend:${user.id}`, 3, 3600);
  await sendVerificationEmail(user);
  return json({ ok: true });
});
