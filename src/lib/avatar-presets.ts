import avatarFox from "@/assets/avatars/avatar-fox.webp";
import avatarPanda from "@/assets/avatars/avatar-panda.webp";
import avatarAstronaut from "@/assets/avatars/avatar-astronaut.webp";
import avatarCat from "@/assets/avatars/avatar-cat.webp";
import avatarOwl from "@/assets/avatars/avatar-owl.webp";

// Animated versions (AI-generated from each preset's source image)
import foxIdle from "@/assets/avatar-anims/fox-idle.webp";
import foxHappy from "@/assets/avatar-anims/fox-happy.webp";
import foxCheering from "@/assets/avatar-anims/fox-cheering.webp";
import foxStudying from "@/assets/avatar-anims/fox-studying.webp";
import pandaIdle from "@/assets/avatar-anims/panda-idle.webp";
import pandaHappy from "@/assets/avatar-anims/panda-happy.webp";
import pandaCheering from "@/assets/avatar-anims/panda-cheering.webp";
import pandaStudying from "@/assets/avatar-anims/panda-studying.webp";
import astronautIdle from "@/assets/avatar-anims/astronaut-idle.webp";
import astronautHappy from "@/assets/avatar-anims/astronaut-happy.webp";
import astronautCheering from "@/assets/avatar-anims/astronaut-cheering.webp";
import astronautStudying from "@/assets/avatar-anims/astronaut-studying.webp";
import catIdle from "@/assets/avatar-anims/cat-idle.webp";
import catHappy from "@/assets/avatar-anims/cat-happy.webp";
import catCheering from "@/assets/avatar-anims/cat-cheering.webp";
import catStudying from "@/assets/avatar-anims/cat-studying.webp";
import owlIdle from "@/assets/avatar-anims/owl-idle.webp";
import owlHappy from "@/assets/avatar-anims/owl-happy.webp";
import owlCheering from "@/assets/avatar-anims/owl-cheering.webp";
import owlStudying from "@/assets/avatar-anims/owl-studying.webp";
// sleepy/dancing/waving/sad clips were never generated — alias to the
// closest existing clip so every mood still resolves to a real asset.
const foxSleepy = foxIdle;
const foxDancing = foxCheering;
const foxWaving = foxHappy;
const foxSad = foxIdle;
const pandaSleepy = pandaIdle;
const pandaDancing = pandaCheering;
const pandaWaving = pandaHappy;
const pandaSad = pandaIdle;
const astronautSleepy = astronautIdle;
const astronautDancing = astronautCheering;
const astronautWaving = astronautHappy;
const astronautSad = astronautIdle;
const catSleepy = catIdle;
const catDancing = catCheering;
const catWaving = catHappy;
const catSad = catIdle;
const owlSleepy = owlIdle;
const owlDancing = owlCheering;
const owlWaving = owlHappy;
const owlSad = owlIdle;

import type { MascotMood } from "@/components/study-mascot/mascot-brain";

export const AVATAR_PRESETS = [
  { id: "fox", src: avatarFox, label: "Fox" },
  { id: "panda", src: avatarPanda, label: "Panda" },
  { id: "astronaut", src: avatarAstronaut, label: "Astronaut" },
  { id: "cat", src: avatarCat, label: "Cat" },
  { id: "owl", src: avatarOwl, label: "Owl" },
] as const;

export type AvatarPresetId = (typeof AVATAR_PRESETS)[number]["id"];

/** Animated WebP per preset per mood. */
const PRESET_ANIMS: Record<string, Record<string, string>> = {
  fox: { idle: foxIdle, happy: foxHappy, cheering: foxCheering, studying: foxStudying, sleepy: foxSleepy, dancing: foxDancing, waving: foxWaving, sad: foxSad },
  panda: { idle: pandaIdle, happy: pandaHappy, cheering: pandaCheering, studying: pandaStudying, sleepy: pandaSleepy, dancing: pandaDancing, waving: pandaWaving, sad: pandaSad },
  astronaut: { idle: astronautIdle, happy: astronautHappy, cheering: astronautCheering, studying: astronautStudying, sleepy: astronautSleepy, dancing: astronautDancing, waving: astronautWaving, sad: astronautSad },
  cat: { idle: catIdle, happy: catHappy, cheering: catCheering, studying: catStudying, sleepy: catSleepy, dancing: catDancing, waving: catWaving, sad: catSad },
  owl: { idle: owlIdle, happy: owlHappy, cheering: owlCheering, studying: owlStudying, sleepy: owlSleepy, dancing: owlDancing, waving: owlWaving, sad: owlSad },
};

/** Map brain moods to the 8 animated clips. */
function moodClip(mood: MascotMood): string {
  switch (mood) {
    case "happy":
      return "happy";
    case "waving":
    case "peeking":
      return "waving";
    case "listening":
      return "sad";
    case "cheering":
      return "cheering";
    case "dancing":
      return "dancing";
    case "studying":
    case "thinking":
      return "studying";
    case "sleepy":
      return "sleepy";
    default:
      return "idle";
  }
}

/**
 * Animated avatar for a preset + mood. Returns undefined for non-presets
 * (custom uploads) or unknown moods — callers fall back to the static image.
 */
export function animatedAvatar(presetId: string | null, mood: MascotMood): string | undefined {
  if (!presetId) return undefined;
  return PRESET_ANIMS[presetId]?.[moodClip(mood)];
}

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
