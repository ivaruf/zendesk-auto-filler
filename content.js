// Zendesk Autofill — bare-bones content script.
// Selectors marked TODO are guesses until we have real HTML from the ticket page.

const BTN_ID = 'oslo-autofill-btn';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const visible = (el) => el && el.offsetParent !== null;
const clean = (s) => (s || '').replace(/\*/g, '').trim();

// Zendesk keeps several ticket tabs in the DOM; only use the visible one.
function $$visible(selector, root = document) {
  return [...root.querySelectorAll(selector)].filter(visible);
}

// --- Data extraction -------------------------------------------------------

function getTicketId() {
  const m = location.pathname.match(/\/agent\/tickets\/(\d+)/);
  return m && m[1];
}

function getConversationText() {
  // TODO: replace with the real message-body selector.
  const bodies = $$visible('[data-test-id="omni-log-comment-item"], [data-test-id*="comment"]');
  return bodies.map((b) => b.innerText).join('\n');
}

function extractEmail(text) {
  const explicit = text.match(/send e-?post til\s+([^\s@]+@[^\s]+?)\.?(\s|$)/i);
  if (explicit) return explicit[1];
  const all = text.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g);
  return all ? all[all.length - 1].replace(/\.$/, '') : null;
}

function extractTema() {
  // Subject looks like "Ny henvendelse: Annet"
  // TODO: confirm subject selector.
  const subject = $$visible('[data-test-id="omni-header-subject"], h1, h2')
    .map((e) => e.innerText)
    .find((t) => /henvendelse:/i.test(t));
  return subject ? subject.split(':').pop().trim() : null;
}

function virksomhetFromEmail(email) {
  // tonjehov.gronlie@hel.oslo.kommune.no -> "hel"; anything else -> "ooo"
  const m = email && email.match(/@([a-zæøå]{3})\./i);
  return m ? m[1].toLowerCase() : 'ooo';
}

// --- Field helpers ---------------------------------------------------------

function findLabel(labelText) {
  return $$visible('label').find((l) => clean(l.innerText) === labelText);
}

function findFieldContainer(labelText) {
  const label = findLabel(labelText);
  return label && (label.closest('[data-garden-id="forms.field"]') || label.parentElement);
}

function findFieldByLabel(labelText) {
  const label = findLabel(labelText);
  if (!label) return null;
  if (label.htmlFor) {
    const el = document.getElementById(label.htmlFor);
    if (el) return el;
  }
  return findFieldContainer(labelText).querySelector('input, textarea, [role="combobox"]');
}

// React ignores plain .value assignment; use the native setter.
function setNativeValue(el, value) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

async function setTextField(labelText, value) {
  const el = findFieldByLabel(labelText);
  if (!el) throw new Error(`Fant ikke feltet "${labelText}"`);
  el.focus();
  setNativeValue(el, value);
  el.blur();
}

async function setDropdown(labelText, optionText) {
  const el = findFieldByLabel(labelText);
  if (!el) throw new Error(`Fant ikke nedtrekksfeltet "${labelText}"`);
  el.click();
  for (let i = 0; i < 20; i++) {
    await sleep(100);
    // TODO: confirm Garden listbox markup.
    const opt = $$visible('[role="option"]').find((o) => clean(o.innerText) === optionText);
    if (opt) { opt.click(); return; }
  }
  document.body.click();
  throw new Error(`Fant ikke valget "${optionText}" i "${labelText}"`);
}

function senderIsBookingserver() {
  const container = findFieldContainer('Sender');
  return !!container && /bookingserver/i.test(container.innerText);
}

// Sender is a search combobox: just paste the email and leave the rest to the agent.
async function setSender(email) {
  const el = findFieldByLabel('Sender');
  if (!el) throw new Error('Fant ikke "Sender"-feltet');
  el.click();
  await sleep(150);
  const input = document.activeElement instanceof HTMLInputElement
    ? document.activeElement
    : findFieldContainer('Sender').querySelector('input');
  if (!input) throw new Error('Fant ikke søkefeltet i "Sender"');
  setNativeValue(input, email);
}

// --- Magic -----------------------------------------------------------------

const STARS = ['✦', '★', '✧', '✨'];
const STAR_COLORS = ['#ffcc33', '#ffffff', '#ff8fd8', '#9be7ff'];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const center = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

// Fly a burst of stars from the wand to the target along curved paths.
function sparkleTo(target) {
  const wand = document.querySelector(`#${BTN_ID} svg`);
  if (reducedMotion || !target || !wand) return Promise.resolve();
  const from = center(wand.getBoundingClientRect());
  const to = center(target.getBoundingClientRect());
  const flights = [];
  for (let i = 0; i < 14; i++) {
    const star = document.createElement('span');
    star.className = 'oslo-autofill-star';
    star.textContent = STARS[i % STARS.length];
    star.style.color = STAR_COLORS[i % STAR_COLORS.length];
    star.style.fontSize = `${10 + Math.random() * 14}px`;
    document.body.appendChild(star);

    // Quadratic bezier with a random bulge, sampled into keyframes.
    const end = { x: to.x + (Math.random() - 0.5) * 80, y: to.y + (Math.random() - 0.5) * 24 };
    const ctrl = {
      x: (from.x + end.x) / 2 + (Math.random() - 0.5) * 400,
      y: Math.min(from.y, end.y) - 60 - Math.random() * 140,
    };
    const spin = (Math.random() - 0.5) * 720;
    const frames = [];
    for (let s = 0; s <= 10; s++) {
      const t = s / 10, u = 1 - t;
      const x = u * u * from.x + 2 * u * t * ctrl.x + t * t * end.x;
      const y = u * u * from.y + 2 * u * t * ctrl.y + t * t * end.y;
      const scale = 0.4 + Math.sin(t * Math.PI) * 1.1;
      frames.push({
        transform: `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${spin * t}deg) scale(${scale})`,
        opacity: t < 0.85 ? 1 : (1 - t) / 0.15,
      });
    }
    const anim = star.animate(frames, {
      duration: 650 + Math.random() * 350,
      delay: i * 25,
      easing: 'cubic-bezier(.45,.05,.55,.95)',
      fill: 'both',
    });
    flights.push(anim.finished.then(() => star.remove()));
  }
  // Resolve roughly when the first stars land, so the field changes "on impact".
  return Promise.race([Promise.all(flights), sleep(700)]);
}

function pulse(target) {
  if (!target) return;
  target.classList.remove('oslo-autofill-pulse');
  void target.offsetWidth; // restart animation
  target.classList.add('oslo-autofill-pulse');
  setTimeout(() => target.classList.remove('oslo-autofill-pulse'), 1200);
}

// --- Main ------------------------------------------------------------------

async function autofill() {
  const errors = [];
  const run = async (label, fn) => {
    const target = findFieldContainer(label);
    await sparkleTo(target);
    try { await fn(); pulse(target); } catch (e) { errors.push(e.message); }
  };

  const btn = document.getElementById(BTN_ID);
  btn.classList.add('oslo-autofill-casting');
  setTimeout(() => btn.classList.remove('oslo-autofill-casting'), 600);

  const email = extractEmail(getConversationText());
  const tema = extractTema();
  const virksomhet = virksomhetFromEmail(email);

  await run('Type', () => setDropdown('Type', 'Spørsmål'));
  if (tema) await run('Tema', () => setDropdown('Tema', tema));
  await run('Virksomhet', () => setTextField('Virksomhet', virksomhet));
  // Only re-point the sender when the ticket came in via the booking contact form.
  if (senderIsBookingserver()) {
    if (email) await run('Sender', () => setSender(email));
    else errors.push('Fant ingen e-postadresse i meldingen');
  }

  console.log('[oslo-autofill]', { ticket: getTicketId(), email, tema, virksomhet, errors });
  if (errors.length) alert('Autofill delvis feilet:\n' + errors.join('\n'));
}

function ensureButton() {
  const onTicket = !!getTicketId();
  let btn = document.getElementById(BTN_ID);
  if (onTicket && !btn) {
    btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="m3 21 12-12"/><path d="m13 7 4 4"/>' +
      '<path d="M18 2v3M16.5 3.5h3M21 8v2M20 9h2M9 2v2M8 3h2"/></svg>' +
      '<span>Autofyll felter<small>Oslo-utvidelse (ikke Zendesk)</small></span>';
    btn.addEventListener('click', autofill);
    document.body.appendChild(btn);
  } else if (!onTicket && btn) {
    btn.remove();
  }
}

// Zendesk is a SPA: re-check on DOM changes.
new MutationObserver(ensureButton).observe(document.body, { childList: true, subtree: true });
ensureButton();
