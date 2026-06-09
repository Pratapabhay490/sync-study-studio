import confetti from "canvas-confetti";

export function celebrate(originX = 0.5, originY = 0.5) {
  confetti({
    particleCount: 60,
    spread: 70,
    startVelocity: 35,
    origin: { x: originX, y: originY },
    colors: ["#60a5fa", "#a78bfa", "#f472b6", "#34d399", "#fbbf24"],
    scalar: 0.9,
    ticks: 120,
  });
}
