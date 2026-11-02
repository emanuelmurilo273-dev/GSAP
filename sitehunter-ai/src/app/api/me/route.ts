import { getCurrentUser, publicUser } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { getUsage } from "@/lib/usage";

export const GET = route(async () => {
  const user = await getCurrentUser();
  if (!user) return json({ user: null });
  return json({ user: publicUser(user), usage: await getUsage(user.id) });
});
