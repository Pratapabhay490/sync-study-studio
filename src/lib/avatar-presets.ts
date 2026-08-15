import avatarFox from "@/assets/avatars/avatar-fox.png";
import avatarPanda from "@/assets/avatars/avatar-panda.png";
import avatarAstronaut from "@/assets/avatars/avatar-astronaut.png";
import avatarCat from "@/assets/avatars/avatar-cat.png";
import avatarOwl from "@/assets/avatars/avatar-owl.png";

export const AVATAR_PRESETS = [
  { id: "fox", src: avatarFox, label: "Fox" },
  { id: "panda", src: avatarPanda, label: "Panda" },
  { id: "astronaut", src: avatarAstronaut, label: "Astronaut" },
  { id: "cat", src: avatarCat, label: "Cat" },
  { id: "owl", src: avatarOwl, label: "Owl" },
] as const;

export type AvatarPresetId = (typeof AVATAR_PRESETS)[number]["id"];

/** Stable value stored in the database for a preset. */
export const presetValue = (id: string) => `preset:${id}`;

/**
 * Resolve a stored avatar_url to a usable image src.
 * Handles: preset ids, legacy build-hashed asset paths, and plain URLs.
 */
export function resolveAvatar(url?: string | null): string | undefined {
  if (!url) return undefined;
  const direct = AVATAR_PRESETS.find((p) => presetValue(p.id) === url || p.id === url);
  if (direct) return direct.src;
  // Legacy: "/assets/avatar-fox-eW_QrM6N.png" written before presets were stable.
  const legacy = AVATAR_PRESETS.find((p) => url.includes(`avatar-${p.id}`));
  if (legacy) return legacy.src;
  return url;
}

/** Which preset (if any) a stored value corresponds to. */
export function presetIdOf(url?: string | null): string | null {
  if (!url) return null;
  const match = AVATAR_PRESETS.find(
    (p) => presetValue(p.id) === url || p.id === url || url.includes(`avatar-${p.id}`),
  );
  return match?.id ?? null;
}
