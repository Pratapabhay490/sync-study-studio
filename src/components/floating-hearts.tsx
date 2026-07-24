import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

let idCounter = 0;
const listeners = new Set<(id: number, emoji: string) => void>();

export function fireHearts(emoji = "💛") {
  const id = ++idCounter;
  listeners.forEach((l) => l(id, emoji));
}

export function FloatingHearts() {
  const [items, setItems] = useState<{ id: number; emoji: string; x: number }[]>([]);
  useEffect(() => {
    const cb = (id: number, emoji: string) => {
      const bursts = Array.from({ length: 6 }, (_, i) => ({
        id: id * 10 + i,
        emoji,
        x: Math.random() * 60 - 30,
      }));
      setItems((prev) => [...prev, ...bursts]);
      setTimeout(() => {
        setItems((prev) => prev.filter((p) => !bursts.some((b) => b.id === p.id)));
      }, 1600);
    };
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);
  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-[90] -translate-x-1/2">
      <AnimatePresence>
        {items.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 0, x: item.x, scale: 0.6 }}
            animate={{ opacity: 1, y: -120, scale: 1.1 }}
            exit={{ opacity: 0, y: -160 }}
            transition={{ duration: 1.4, ease: "easeOut" }}
            className="absolute text-3xl"
          >
            {item.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
