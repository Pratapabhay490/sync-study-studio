# Architecture rules

- Destructive account actions derive identity from authenticated server middleware, validate typed confirmation on both sides, and use scoped database functions; account cleanup transfers shared ownership before hard auth deletion to preserve partner data.
- Content routes own their unique title and social metadata; pageMeta provides common tags without relative image URLs.

- Avatar animation imports use validated WebP asset pointers; LivingAvatar loads only the requested mood, keeps the last loaded clip during transitions, and uses a static fallback for failed loads, hidden tabs, or reduced motion to avoid flicker and unnecessary animation work.- The floating duo pill (both mascots) is mounted once in the authenticated layout; LivingAvatar takes a mood override so a partner mascot can render without its own mascot brain.
