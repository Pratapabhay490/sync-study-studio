# Architecture rules

- Avatar animation imports use validated WebP asset pointers; LivingAvatar loads only the requested mood, keeps the last loaded clip during transitions, and uses a static fallback for failed loads, hidden tabs, or reduced motion to avoid flicker and unnecessary animation work.