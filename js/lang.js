/* DPMO! — English or Italian.

   Only the English home picks a language, and it does it from <head>, before anything is drawn:
   a visitor goes to /it/ if they chose Italian with the footer switcher, or if they haven't chosen,
   came from outside the site and their browser lists Italian before English.
   The choice lives in localStorage ("lang") and never leaves the browser. */
(() => {
  'use strict';

  const KEY = 'lang';

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-lang]');
    if (!link) { return; }
    try { localStorage.setItem(KEY, link.dataset.lang); } catch { /* storage blocked: the link still works */ }
  });

  if (location.pathname !== '/') { return; }

  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch { /* storage blocked */ }

  // Whichever of Italian and English comes first in the browser's preferences
  const browser = (navigator.languages || [navigator.language])
    .map((tag) => tag.slice(0, 2).toLowerCase())
    .find((code) => code === 'it' || code === 'en');

  // Landing here from another page of the site (switcher, Home link) means English was chosen
  const fromThisSite = document.referrer.startsWith(`${location.origin}/`);
  const lang = saved || (fromThisSite ? 'en' : browser);

  if (lang === 'it') { location.replace(`/it/${location.hash}`); }
})();
