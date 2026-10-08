# Architecture rules

- Avatar animation imports use validated WebP asset pointers; LivingAvatar uses AvatarImage with a static fallback so failed clips cannot display broken images or duplicate initials.