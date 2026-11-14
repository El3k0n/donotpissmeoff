/* DPMO! — page interactions. Vanilla JS, no dependencies, no build step.

   One `state` object, one `render()`. The markup declares what it needs:
     data-action (+ data-value)  a button that changes the state
     data-if="flag"              shown only while the flag is true
     data-text="slot"            text filled in from the state
     aria-pressed                the selected button of a group
   The same file runs on the 404 page, so every lookup tolerates missing elements. */
(() => {
  'use strict';

  const MAX_PATIENCE = 6;

  const QUOTES = [
    'Yes, I am working.',
    'Don’t.',
    'I said don’t.',
    'This is why I charge up front.',
    'Do you poke your accountant too?',
    'Last warning.',
    'You killed him. Happy?'
  ];

  // [what the client says, what Diego hears]
  const TRANSLATIONS = [
    ['Can you make the logo bigger?', 'I have not looked at anything else.'],
    ['It should be a quick one.', 'It will not be a quick one.'],
    ['Just one small change.', 'Seven changes in a trench coat.'],
    ['Can you make it pop?', 'I don’t know what I want. I’ll know when I don’t see it.'],
    ['My nephew could do this.', 'Great. Call your nephew.'],
    ['We need it by yesterday.', 'We started thinking about it today.'],
    ['Can we hop on a quick call?', 'This could have been two lines of text.']
  ];

  const MOOD_CAPTIONS = [
    'Fine. This he can work with.',
    'Gone before anything breaks.',
    'Cause of death: "one last tweak".',
    'Done. Now leave.'
  ];

  // 404 page: one line per attempt to revive Mo
  const REVIVE_LINES = [
    'R.I.P. Mo (back tomorrow)',
    'Nope. Still dead.',
    'He twitched. Probably wind.',
    'One eye opened. It judged you.',
    'He says: fix your links.',
    'Stop. Let him rest.'
  ];

  // Shown when /api/contact answers with an error status
  const FORM_ERRORS = {
    400: 'Something in there looks off. Check your name, email and brief.',
    429: 'Easy. That’s enough messages for now. Try again later.',
    other: 'Mo dropped it. Try again in a minute.'
  };

  const state = {
    pokes: 0,          // hero: times Mo was poked
    filter: 'all',     // work: all | ecom | apps | sites
    phrase: 0,         // translator: index into TRANSLATIONS
    mood: 0,           // meet Mo: index into MOOD_CAPTIONS
    type: null,        // contact: selected project type
    pledged: false,    // contact: checkbox ticked
    sending: false,
    sent: false,
    formError: '',
    reviveTries: 0     // 404 page
  };

  // The relay drops submissions sent less than 3s after the form appeared (bots).
  let formShownAt = Date.now();

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);
  const last = (list, index) => list[Math.min(index, list.length - 1)];

  const form = $('#contact-form');
  const pledge = $('#contact-pledge');
  const sendButton = $('#send-btn');
  const phraseSelect = $('#phrase-select');
  const navToggle = $('.nav-toggle');
  const navLinks = $('#nav-links');

  function render() {
    const patience = Math.max(0, MAX_PATIENCE - state.pokes);
    const dead = patience === 0;

    const flags = {
      moCalm: state.pokes < 3,
      moAngry: state.pokes >= 3 && !dead,
      moDead: dead,
      showEcom: state.filter === 'all' || state.filter === 'ecom',
      showApps: state.filter === 'all' || state.filter === 'apps',
      showSites: state.filter === 'all' || state.filter === 'sites',
      mood0: state.mood === 0,
      mood1: state.mood === 1,
      mood2: state.mood === 2,
      mood3: state.mood === 3,
      sent: state.sent,
      notSent: !state.sent,
      formError: state.formError !== ''
    };

    let sendLabel = 'Swear first.';
    if (state.sending) { sendLabel = 'Sending…'; }
    else if (state.pledged) { sendLabel = 'Send it. No take-backs.'; }

    const texts = {
      moQuote: last(QUOTES, state.pokes),
      patienceLabel: `${patience} / ${MAX_PATIENCE}`,
      pokeLabel: dead ? 'Say sorry & revive Mo' : 'Poke the pigeon',
      heardSays: TRANSLATIONS[state.phrase][0],
      heardMeans: TRANSLATIONS[state.phrase][1],
      moodCaption: MOOD_CAPTIONS[state.mood],
      sendLabel,
      formError: state.formError,
      status: last(REVIVE_LINES, state.reviveTries)
    };

    // data-value is always a string, so compare as strings
    const selected = {
      filter: state.filter,
      phrase: String(state.phrase),
      mood: String(state.mood),
      type: state.type
    };

    $$('[data-if]').forEach((el) => { el.hidden = !flags[el.dataset.if]; });
    $$('[data-text]').forEach((el) => { el.textContent = texts[el.dataset.text]; });
    $$('[data-action][aria-pressed]').forEach((el) => {
      el.setAttribute('aria-pressed', String(selected[el.dataset.action] === el.dataset.value));
    });

    // Patience bar: segments empty from the right, the last two turn pink
    $$('.seg').forEach((seg, i) => {
      if (i >= patience) { seg.dataset.state = 'empty'; }
      else { seg.dataset.state = patience <= 2 ? 'low' : 'full'; }
    });

    if (phraseSelect) { phraseSelect.value = String(state.phrase); }
    if (sendButton) { sendButton.disabled = !state.pledged || state.sending; }
  }

  const actions = {
    poke() { state.pokes = state.pokes >= MAX_PATIENCE ? 0 : state.pokes + 1; },
    filter(value) { state.filter = value; },
    phrase(value) { state.phrase = Number(value); },
    mood(value) { state.mood = Number(value); },
    type(value) { state.type = value; },
    revive() { state.reviveTries += 1; },
    reset() {
      state.sent = false;
      state.pledged = false;
      state.type = null;
      state.formError = '';
      formShownAt = Date.now();
    }
  };

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    const action = button && actions[button.dataset.action];
    if (!action) { return; }
    action(button.dataset.value);
    render();
  });

  // Contact form: the confirmation shows only once the server has stored the
  // message (any 2xx). Anything else leaves the form filled in, with an error.
  async function send() {
    const payload = {
      name: form.elements.name.value,
      email: form.elements.email.value,
      message: form.elements.message.value,
      projectType: state.type,
      pledge: true,
      website: form.elements.website.value,   // honeypot, people leave it empty
      elapsedMs: Date.now() - formShownAt
    };

    state.sending = true;
    state.formError = '';
    render();

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        form.reset();
        state.sent = true;
        state.pledged = false;
        state.type = null;
      } else {
        state.formError = FORM_ERRORS[response.status] || FORM_ERRORS.other;
      }
    } catch (networkError) {
      state.formError = FORM_ERRORS.other;
    }

    state.sending = false;
    render();
  }

  if (form && pledge) {
    pledge.addEventListener('change', () => {
      state.pledged = pledge.checked;
      render();
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (state.pledged && !state.sending) { send(); }
    });
  }

  // Translator on small screens: a native select that shares state.phrase with the buttons.
  if (phraseSelect) {
    TRANSLATIONS.forEach(([says], i) => {
      phraseSelect.add(new Option(says, String(i)));
    });
    phraseSelect.addEventListener('change', () => {
      actions.phrase(phraseSelect.value);
      render();
    });
  }

  // Mobile menu
  if (navToggle && navLinks) {
    const setMenu = (open) => {
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.textContent = open ? 'Close −' : 'Menu +';
    };
    const isOpen = () => navToggle.getAttribute('aria-expanded') === 'true';

    navToggle.addEventListener('click', () => setMenu(!isOpen()));
    navLinks.addEventListener('click', (event) => {
      if (event.target.closest('a')) { setMenu(false); }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isOpen()) {
        setMenu(false);
        navToggle.focus();
      }
    });
  }

  // The stylesheet only collapses the menu and the phrase list when this class
  // is present, so without JavaScript everything stays visible.
  document.documentElement.classList.add('js');
  render();
})();
