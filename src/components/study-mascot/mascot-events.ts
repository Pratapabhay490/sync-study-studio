/**
 * mascot-events — tiny typed event emitter for the study buddy mascot.
 *
 * Producers (topic ticks, task board, badges, focus card, tab reporter, taps)
 * emit events here; the mascot brain subscribes and reacts. No dependencies.
 */

export type MascotEvent =
  | { type: "topic:completed" }
  | { type: "task:completed" }
  | { type: "badge:earned" }
  | { type: "focus:started" }
  | { type: "focus:ended" }
  | { type: "tab:changed"; tab: string }
  | { type: "streak:milestone"; days: number }
  | { type: "quiz:generating" }
  | { type: "app:foregrounded" }
  | { type: "poke" };

type Handler = (e: MascotEvent) => void;

const handlers = new Set<Handler>();

export const mascotEvents = {
  emit(e: MascotEvent): void {
    handlers.forEach((h) => {
      try {
        h(e);
      } catch {
        // One bad handler must never break the others.
      }
    });
  },
  subscribe(h: Handler): () => void {
    handlers.add(h);
    return () => {
      handlers.delete(h);
    };
  },
};
