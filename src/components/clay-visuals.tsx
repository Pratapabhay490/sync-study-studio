import { BookOpen, HeartPulse, Sparkles, Stethoscope } from "lucide-react";
import boyReading from "@/assets/clay-boy-reading.png";
import girlDoctor from "@/assets/clay-girl-doctor.png";
import medicalIcons from "@/assets/clay-medical-icons.png";
import { cn } from "@/lib/utils";

type ClayVisualProps = {
  variant?: "boy" | "girl" | "icons" | "duo";
  className?: string;
  priority?: boolean;
};

export function ClayVisual({ variant = "boy", className, priority = false }: ClayVisualProps) {
  const source = variant === "girl" ? girlDoctor : variant === "icons" ? medicalIcons : boyReading;
  const alt =
    variant === "girl"
      ? "3D clay girl doctor with stethoscope"
      : variant === "icons"
        ? "3D clay medical study icons"
        : "3D clay boy reading a medical book";

  if (variant === "duo") {
    return (
      <div
        className={cn("pointer-events-none relative h-56 w-full sm:h-64", className)}
        aria-hidden="true"
      >
        <img
          src={boyReading}
          alt=""
          loading={priority ? "eager" : "lazy"}
          className="clay-character absolute bottom-0 left-2 w-36 drop-shadow-2xl sm:w-44"
        />
        <img
          src={girlDoctor}
          alt=""
          loading="lazy"
          className="clay-character clay-character-delay absolute bottom-0 right-2 w-32 drop-shadow-2xl sm:w-40"
        />
      </div>
    );
  }

  return (
    <div className={cn("pointer-events-none relative", className)} aria-hidden="true">
      <img
        src={source}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        className="clay-character relative z-10 mx-auto w-full max-w-[260px] drop-shadow-2xl"
      />
    </div>
  );
}

/**
 * A horizontal strip where the boy "walks" across the container — tasteful, contextual,
 * placed at the bottom of a hero section to feel like he's strolling through the dashboard.
 */
export function ClayWalkingStrip({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none relative h-20 w-full overflow-hidden",
        className,
      )}
      aria-hidden="true"
    >
      {/* soft path */}
      <div className="absolute inset-x-4 bottom-3 h-1 rounded-full bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      <div className="clay-walker absolute bottom-1 left-0 h-20 w-20 will-change-transform">
        <div className="clay-stepper h-full w-full">
          <img
            src={boyReading}
            alt=""
            className="h-full w-full object-contain drop-shadow-xl"
          />
        </div>
      </div>
    </div>
  );
}

/** A small clay character that peeks into the corner of a card — contextual, not random. */
export function ClayPeek({
  variant = "boy",
  className,
}: {
  variant?: "boy" | "girl";
  className?: string;
}) {
  const src = variant === "girl" ? girlDoctor : boyReading;
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className={cn(
        "clay-peeker pointer-events-none absolute h-28 w-28 object-contain drop-shadow-2xl",
        className,
      )}
    />
  );
}

export function ClayChip({
  icon = "stethoscope",
  className,
}: {
  icon?: "sparkles" | "stethoscope" | "heart" | "book";
  className?: string;
}) {
  const Icon =
    icon === "stethoscope"
      ? Stethoscope
      : icon === "heart"
        ? HeartPulse
        : icon === "book"
          ? BookOpen
          : Sparkles;
  return (
    <div
      className={cn(
        "clay-floater grid h-12 w-12 place-items-center rounded-2xl bg-card text-primary shadow-clay-sm",
        className,
      )}
      aria-hidden="true"
    >
      <Icon className="h-5 w-5" />
    </div>
  );
}

export function ClayLoader({ label = "Syncing study data" }: { label?: string }) {
  return (
    <div className="grid min-h-[280px] place-items-center p-8">
      <div className="text-center">
        <div className="relative mx-auto h-28 w-28">
          <div className="clay-loader-orb absolute inset-0 rounded-[2rem] bg-gradient-primary shadow-glow" />
          <div className="clay-loader-orb clay-loader-orb-delay absolute inset-5 rounded-[1.5rem] bg-card shadow-clay-inset" />
          <BookOpen className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-primary" />
        </div>
        <p className="mt-5 font-display text-sm font-semibold text-foreground">{label}</p>
        <div className="mt-3 flex justify-center gap-2" aria-hidden="true">
          <span className="clay-dot" />
          <span className="clay-dot animation-delay-1" />
          <span className="clay-dot animation-delay-2" />
        </div>
      </div>
    </div>
  );
}
