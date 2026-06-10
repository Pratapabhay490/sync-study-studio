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
          width={1024}
          height={1024}
          loading={priority ? "eager" : "lazy"}
          className="clay-character absolute bottom-0 left-2 w-36 drop-shadow-2xl sm:w-44"
        />
        <img
          src={girlDoctor}
          alt=""
          width={1024}
          height={1024}
          loading="lazy"
          className="clay-character clay-character-delay absolute bottom-0 right-2 w-32 drop-shadow-2xl sm:w-40"
        />
        <FloatingClayIcon className="left-[42%] top-4" icon="stethoscope" />
        <FloatingClayIcon className="right-[18%] top-10 animation-delay-2" icon="heart" />
      </div>
    );
  }

  return (
    <div className={cn("pointer-events-none relative", className)}>
      <img
        src={source}
        alt={alt}
        width={1024}
        height={1024}
        loading={priority ? "eager" : "lazy"}
        className="clay-character relative z-10 mx-auto w-full max-w-[260px] drop-shadow-2xl"
      />
      <FloatingClayIcon className="left-2 top-4" icon="sparkles" />
      <FloatingClayIcon
        className="bottom-8 right-4 animation-delay-2"
        icon={variant === "icons" ? "book" : "stethoscope"}
      />
    </div>
  );
}

function FloatingClayIcon({
  className,
  icon,
}: {
  className?: string;
  icon: "sparkles" | "stethoscope" | "heart" | "book";
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
        "clay-floater absolute grid h-12 w-12 place-items-center rounded-2xl bg-card text-primary shadow-clay-sm",
        className,
      )}
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
