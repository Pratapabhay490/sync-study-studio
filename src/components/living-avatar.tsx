/**
 * living-avatar — the user's chosen avatar, brought to life.
 *
 * Instead of a separate floating mascot, the user's own profile character
 * (fox, panda, astronaut, cat, owl) lives in the header's top-left spot.
 * Each preset has AI-generated animated versions (idle, happy, cheering,
 * studying, sleepy, dancing, waving, sad)
 * studying) that swap based on the mascot brain's mood:
 *
 *   idle       gentle breathing (default)
 *   happy      bounce (topic/task ticks, greeting, tap)
 *   cheering   celebration (streaks, badges, focus done)
 *   studying   calm focus (focus timer running, quiz generating)
 *
 * Custom uploads fall back to the static image with subtle CSS motion.
 * Tapping the avatar pokes the brain for a contextual bubble, shown below.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Profile } from "@/lib/data-context";
import { animatedAvatar, presetIdOf, resolveAvatar } from "@/lib/avatar-presets";
import { useMascot } from "./study-mascot/mascot-brain";

export function LivingAvatar({
  profile,
  size = 44,
  ring,
}: {
  profile?: Profile | null;
  size?: number;
  ring?: boolean;
}) {
  const { mood, bubble, dispatch } = useMascot();

  const presetId = presetIdOf(profile?.avatar_url);
  const animSrc = animatedAvatar(presetId, mood);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  // Animated WebP for presets; static image (or fallback) otherwise.
  const src = animSrc && failedSrc !== animSrc ? animSrc : resolveAvatar(profile?.avatar_url);

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
    <div className="relative">
      <motion.button
        type="button"
        aria-label="Your avatar — tap for a nudge"
        onClick={() => dispatch({ type: "poke" })}
        className="block cursor-pointer"
        whileTap={{ scale: 0.9 }}
      >
        {/* Swap the animated clip on mood change; the WebP itself carries the motion */}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={src}
            initial={{ opacity: 0.6, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Avatar
              style={{ width: size, height: size }}
              className={ring ? "ring-2 ring-background ring-offset-2 ring-offset-background" : ""}
            >
              {src ? (
                <AvatarImage src={src} alt={profile?.name ?? ""} className="object-cover" draggable={false} onLoadingStatusChange={(status) => {
                  if (status === "error") setFailedSrc(src);
                }} />
              ) : null}
              <AvatarFallback className={`${bg} text-white font-semibold`}>
                {initials}
              </AvatarFallback>
            </Avatar>
          </motion.div>
        </AnimatePresence>
      </motion.button>

      {/* Speech bubble */}
      <AnimatePresence>
        {bubble && (
          <motion.div
            key="avatar-bubble"
            initial={{ opacity: 0, y: -4, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -2, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 26 }}
            className="absolute left-0 top-full z-50 mt-2 max-w-[200px] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-card"
          >
            {bubble}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
