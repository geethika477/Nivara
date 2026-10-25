<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep language selection in a root React context with explicit translated labels; persist only after hydration so all pages share one SSR-safe locale.
- Keep weather requests deduplicated and briefly cached in the existing geographic helper; unavailable observations must remain unavailable, never synthetic dry weather.
- Keep mapped-waterway animation in its own disposable Leaflet layer group attached to the persistent map; distinguish illustrative stream motion from simulated downhill drainage.
- Safe-zone candidates must come from named mapped places with valid terrain and eligible risk, ranked by geodesic distance before limiting when a citizen origin is supplied; never backfill unsafe or fictional locations.
