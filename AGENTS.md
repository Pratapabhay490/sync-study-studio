# Architecture rules

- Avatar animation imports use validated WebP asset pointers; LivingAvatar loads only the requested mood, keeps the last loaded clip during transitions, and uses a static fallback for failed loads, hidden tabs, or reduced motion to avoid flicker and unnecessary animation work.- The floating duo pill (both mascots) is mounted once in the authenticated layout; LivingAvatar takes a mood override so a partner mascot can render without its own mascot brain.
