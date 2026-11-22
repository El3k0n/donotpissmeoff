# Don't Piss Me Off!

Source of [donotpissmeoff.com](https://donotpissmeoff.com), the portfolio of Diego Pignattini, web developer in Rome.

It is a static site in English and Italian: a home, a privacy notice and a 404 page in each language, one stylesheet, three small scripts. No framework, no build step, no dependencies, no third-party requests. The whole home page, pigeon included, weighs less than most cookie banners.

![Don't Piss Me Off! logo](assets/logo-480.png)

## What's inside

```
index.html          home
privacy.html        privacy notice (served as /privacy)
404.html            not-found page, served for every missing URL
it/                 the same three pages in Italian (/it/, /it/privacy, 404 under /it/)
css/style.css       all the styles: tokens, components, sections, responsive rules
js/main.js          page interactions: one state object, one render(), strings in both languages
js/mo.js            Mo the pigeon's animation (SVG clipping over the PNG artwork)
js/lang.js          language: sends Italian browsers to /it/, remembers the footer switcher
assets/             artwork, screenshots, self-hosted fonts
deploy.sh           publishes the public files to the server (rsync)
deploy/Caddyfile    web server config: HTTPS, headers, caching, clean URLs, 404
deploy/contact/     contact form backend: a small Python relay and its systemd unit
deploy/mail/        forward-only mail server (Postfix) for the domain's addresses
docs/               notes on Mo's artwork and animation
```

## How it's built

**HTML.** Semantic and class-based, no inline styles or scripts. Works without JavaScript: the navigation, the translator's phrase list and every section stay readable; scripts only add the interactive parts.

**CSS.** One file, read top to bottom: fonts and tokens, base, layout helpers, shared components, then one block per section. Four colours and two typefaces, all defined once as custom properties. Desktop is the baseline and two media queries (1023px, 767px) adapt it. Motion stops under `prefers-reduced-motion`.

**JavaScript.** `js/main.js` keeps one `state` object and one `render()` function. The markup declares what it needs:

| Attribute | Meaning |
| --- | --- |
| `data-action` (+ `data-value`) | a button that changes the state |
| `data-if="flag"` | shown only while the flag is true |
| `data-text="slot"` | text filled in from the state |
| `aria-pressed` | the selected button of a group, styled from the attribute |

Adding an interaction means adding a field to `state`, an entry in `actions` and an attribute in the HTML.

**Two languages.** Each language has its own pages and URLs (`/` and `/it/`), linked with `hreflang`, so search engines index both. The text the scripts write lives in one table per language in `main.js`, picked by the page's `lang`. `js/lang.js` loads before the stylesheet: on a first visit to the English home it sends browsers that prefer Italian to `/it/` before anything is drawn, and a choice made with the footer switcher is remembered in `localStorage` and always wins. Arriving from another page of the site counts as a choice too, so nobody gets bounced back and forth.

**Mo.** The pigeon is raster line art. `js/mo.js` wraps each large illustration in an inline SVG, cuts out the part that moves (head or wing) with a clip path and lets CSS keyframes rotate it; eyelids and steam are vectors drawn on top. Animations pause when off-screen. Details in [docs/mo-animation.md](docs/mo-animation.md).

**Contact form.** The browser posts JSON to `/api/contact`. Caddy proxies it to a relay on localhost ([deploy/contact/contact_relay.py](deploy/contact/contact_relay.py), Python standard library only) that validates the input, drops bots (honeypot field, minimum fill time), rate-limits per IP, writes the message to a spool on disk and forwards it to a signed webhook. A message is confirmed to the visitor only once it is on disk, and stays in the spool until the webhook accepts it, so nothing is lost if the receiving side is down. The service runs as its own user under a locked-down systemd unit; secrets live on the server, never in this repository.

**Server.** [Caddy](https://caddyserver.com) with automatic HTTPS, HSTS, a Content-Security-Policy that allows this origin only, and access logs with truncated IP addresses. No cookies and no analytics: the [privacy notice](https://donotpissmeoff.com/privacy) is short because there is little to disclose.

**Mail.** The domain's few addresses are handled by Postfix on the same server, configured to do one thing: accept mail for those addresses and forward it ([deploy/mail](deploy/mail)). No mailboxes, no relaying, TLS with the certificate Caddy already renews, sender rewriting (SRS) so forwarded mail still passes SPF.

## Run it locally

```sh
npx serve .
```

Or any other static server. The contact form needs the relay, so locally it answers with an error message (which is also a way to see the error state).

## Deploy

```sh
./deploy.sh                    # site files -> web root
./deploy/contact/install.sh    # contact relay (only when it changes)
./deploy/mail/install.sh       # mail forwarding (only when it changes)
```

All three expect an SSH host alias (`DEPLOY_HOST`, default `vex-vps`). CSS, JS and images are cached for an hour and not fingerprinted: bump the `?v=N` in the HTML files of both languages when they change.

## Rights

The code is here to be read, and you're welcome to learn from it. The "Don't Piss Me Off!" name and logo, Mo the pigeon and all his artwork, the copy and the project screenshots are © Diego Pignattini and not free to reuse. The fonts (Anton, Work Sans) are under the SIL Open Font License; their licence texts are in [assets/fonts](assets/fonts).

© 2026 Diego Pignattini
