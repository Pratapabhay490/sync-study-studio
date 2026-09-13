# Mobile dashboard and Home fit

## What will change
- Tighten mobile page spacing and card padding on Dashboard and Home.
- Make the countdown controls and four time cells fit within narrow phone screens without horizontal clipping.
- Make the task board header, partner columns, task input, and task rows shrink cleanly on mobile.
- Reflow the focus timer status, duration presets, custom duration form, member labels, actions, and history rows for phone widths.
- Preserve all behavior, data, realtime updates, desktop layout, and visual styling.

## Verification
- Check Dashboard and Home at a phone viewport for horizontal overflow and overlapping text.
- Confirm the countdown, task controls, and focus controls remain usable.
- Confirm the build and browser console are clean.

## Technical details
- Changes are limited to responsive layout classes in the existing presentation components.
- No backend, data, notification, or business-logic changes are required.
