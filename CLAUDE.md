# DPMO! — Diego Pignattini portfolio

Personal site / portfolio of Diego Pignattini, web developer based in Rome.
It reuses the "Don't Piss Me Off!" (DPMO!) brand identity. Site language: English.

## What is here

- `index.html` — home (hero, work, the deal, translator, services, tools, process, Mo, FAQ, contact)
- `privacy.html` — privacy notice, served as `/privacy`
- `404.html` — not-found page
- `css/style.css` — all styles: tokens, base, layout helpers, components, one block per section, responsive rules
- `js/main.js` — page interactions (vanilla JS, no dependencies, no build step)
- `js/mo.js` — articulated mascot animation; notes in `docs/mo-animation.md`
- `assets/` — logo, Mo's five poses in two sizes (transparent PNGs, black line art; the site uses the `-hd.png` files),
  project screenshots, self-hosted fonts (`assets/fonts`, with their OFL licences)
- `robots.txt`, `sitemap.xml` — add new public pages to the sitemap
- `README.md` — the public face of the repo

Static site: serve the folder (`npx serve .`).

The repo is public (https://github.com/El3k0n/donotpissmeoff) and linked from the site footer as a
showcase of how Diego builds. Keep it that way:

- No inline `style` attributes, no inline scripts or styles. The server sends a strict
  Content-Security-Policy (`default-src 'self'`), so they would not run anyway. For the same reason
  nothing is loaded from other origins (fonts are self-hosted).
- Class names: component blocks with `__part` and `--variant` (`.work-card__body`, `.btn--lime`), a few
  helpers (`.wrap`, `.stack`, `.split`, `.bg-*`, `.text-*`, `.invert`). Colours and fonts only through
  the custom properties at the top of `style.css`.
- `box-sizing: border-box` everywhere. Desktop is the baseline; the `max-width: 1023px` and
  `max-width: 767px` blocks at the end of `style.css` adapt it. No `!important` except `[hidden]`
  and the animation pause.
- Never commit secrets, the webhook URL, server addresses or access details, internal to-do notes,
  or placeholder content. Private notes go in `CLAUDE.local.md`, which is git-ignored.
- Commits use the GitHub noreply address set in this repo's git config; don't override it.
- Images are committed without metadata (EXIF, XMP, provenance chunks): strip it before adding new ones.

## Hosting

Live at https://donotpissmeoff.com. Caddy serves the static files and proxies the contact form to
a small relay; the config is `deploy/Caddyfile`, the relay is in `deploy/contact/`.
Server details, access and operational notes are in `CLAUDE.local.md` (not in the repository).

- Deploy: `./deploy.sh` (rsync of the public files only: html, favicon, robots, sitemap, css, js, assets).
  New top-level public files must be added to the include list in `deploy.sh`.
- Missing pages get `404.html` with a real 404 status; it uses absolute paths (`/css/...`) so it
  works at any depth. The footer "Do not click" link points to `/do-not-click` on purpose.
- Clean URLs: Caddy tries `{path}.html`, so `/privacy` serves `privacy.html`.
- CSS/JS are cached for 1h and not fingerprinted: bump the `?v=N` on `style.css` / `main.js` / `mo.js`
  in all three HTML files whenever you change them. Fonts are cached for a year.
- Only `404.html` carries `noindex`; everything else is indexable.
- Access logs mask IP addresses (`ip_mask` in `deploy/Caddyfile`); the privacy notice says so.
- Mail: Postfix on the same server forwards the domain's addresses to an outside mailbox
  (`deploy/mail/`, update with `./deploy/mail/install.sh`). Which addresses and where they go is
  on the server only (`/etc/postfix/virtual`), never in the repo.
- Contact form: browser `POST /api/contact` (JSON) → Caddy → relay on localhost → signed webhook.
  The relay validates, drops bots, rate-limits per IP (in memory only, forgotten after 24h) and
  spools to disk before forwarding. Update it with `./deploy/contact/install.sh`.

## Brand

- Colors: Piss Pink `#ef709d`, Acid Lime `#ebfd51`, Dirty Black `#000000`, Off White `#ffffff`. Nothing else.
- Type: Anton (headlines, uppercase, tight line-height) + Work Sans (body). Loaded from Google Fonts.
- Look: punk, raw, deliberately imperfect. 3px black borders, hard offset shadows
  (no blur), slight rotations, flat colour blocks. No gradients, no rounded cards, no emoji.
- Mascot: Mo, a pigeon. Urban, shameless, permanently annoyed. Not cute, not trying to be liked.
  Images are black on transparent; on dark backgrounds use `filter: invert(1)`.
- Voice: direct, dry, provocative, short sentences. Mildly rude is fine ("no bullshit"),
  never insulting to the reader. The deal: fast, well-built, honest price — in return the
  client doesn't drive Diego insane.
- Diego is a developer. He does NOT do branding or logos; do not add it as a service.

## Privacy notice

`privacy.html` describes what the site really does. If any of it changes (what the form collects,
where messages go, retention, server location, logging, cookies or third-party requests), update the
page and its "Last updated" date in the same commit.

## How the interactions work

`js/main.js` holds one `state` object and one `render()`. Markup hooks:
`data-action` (+ `data-value`) on buttons, `data-if` on blocks that show/hide,
`data-text` on text slots, `aria-pressed` for selected toggles. `render()` sets the `hidden`
attribute, text content, `aria-pressed` and `data-state`; how those look is up to the stylesheet.
`main.js` adds the class `js` to `<html>`: rules that collapse things (mobile menu, phrase list)
are scoped to `.js`, so without JavaScript everything stays visible.

- Hero: "Poke the pigeon" — patience bar, quote and pose change; at 6 pokes Mo dies and can be revived.
- Work: filter buttons show/hide the project cards (`showEcom`, `showApps`, `showSites`).
- Translator: pick a client phrase, see what Diego hears.
- Meet Mo: pick a situation, pose and caption change.
- Contact: project-type pills, pledge checkbox enables the submit button. Submit POSTs to
  `/api/contact`; the confirmation shows only on a 2xx, otherwise `state.formError` is shown.

### Responsive layout

- Up to 767px: collapsible navigation, smaller section spacing, single-column work
  cards, compact process steps, and a two-column mood picker.
- Up to 1023px: the translator uses a native select sharing `state.phrase` with the
  desktop buttons. Without JavaScript the original list and navigation stay visible.
- The move from inline styles to classes (2026-11-14) was checked in headless Chrome at
  320/390/768/1024/1440px against the previous version: same block heights, plus all interactions
  under the production CSP. These are browser viewport checks, not tests on physical phones.
