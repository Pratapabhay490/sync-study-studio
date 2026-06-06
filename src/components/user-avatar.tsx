import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Profile } from "@/lib/data-context";

export function UserAvatar({ profile, size = 40, ring }: { profile?: Profile | null; size?: number; ring?: boolean }) {
  const initials =
    profile?.name
      ?.split(" ")
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ?? "?";

  const isAishwarya = profile?.name?.toLowerCase().includes("aishwarya");
  const bg = isAishwarya ? "bg-gradient-aishwarya" : "bg-gradient-abhay";

  return (
    <Avatar
      style={{ width: size, height: size }}
      className={ring ? "ring-2 ring-background ring-offset-2 ring-offset-background" : ""}
    >
      {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={profile.name} /> : null}
      <AvatarFallback className={`${bg} text-white font-semibold`}>{initials}</AvatarFallback>
    </Avatar>
  );
}
