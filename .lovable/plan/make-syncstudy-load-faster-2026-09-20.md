# Make SyncStudy load faster

Your list has 20 items. Some are already done or handled automatically — I'll be straight about those instead of pretending to add them. The rest are real wins, and the biggest one by far is your images.

## The actual problem

The app ships **9.5 MB of clay artwork** as PNG files. Two pictures alone (the landing and sign-in hero) are 1.3 MB each. Every visitor downloads these before the page feels ready. That is the single largest cause of the slowness.

## What I will do

**1. Shrink every image (biggest win)**
Convert all clay artwork, mascots, subject icons and avatars to modern compressed format at sensible sizes. Expect roughly 9.5 MB down to under 1 MB with no visible quality loss.

**2. Lazy-load images**
Pictures below the first screen only download when scrolled to; the hero image gets priority so it appears first.

**3. Split the code into chunks**
Heavy parts load only when opened:
- Practice module (the largest page) and its document reader (PDF/Word parsing)
- Charts on Analytics and Practice Stats
- The animated background on the landing/sign-in pages

**4. Cache data instead of refetching**
Subjects, topics and progress are refetched on every page visit. I'll cache them and reuse across pages, so moving between pages is instant. Live partner updates keep working exactly as now.

**5. Fewer wasted re-renders + debounced typing**
Memoise expensive calculations (progress, readiness, focus hours) and debounce the search/filter inputs so typing doesn't re-render the whole list.

**6. Paginate/virtualise long lists**
Topic lists, quiz history and activity feeds render in pages instead of all at once.

**7. Remove unused dependencies**
Drop the extra icon library used in one spot, and any other package nothing imports.

**8. Skeleton loading**
Already added last time — I'll extend it to the remaining pages that still flash blank.

**9. Measure before/after**
Run a Lighthouse-style audit on the preview and report the actual numbers.

## Already handled — nothing to add

- **CDN, load balancer, response compression, JS/CSS minification** — your hosting already does all four on every request. Adding compression in the app would actually break the site.
- **Database indexes, connection pooling, N+1 queries** — indexes were added and verified in an earlier session; pooling is managed by the backend.
- **Server-side caching** — pages that can be pre-rendered already are; the rest are per-user and must stay live.

## Guarantees

No change to how anything looks or works: same design, same features, same live syncing. I'll confirm the build is clean and check the pages afterwards.
