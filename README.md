<p align="center">
  <img src="icons/icon128.png" width="96" alt="Zendesk Autofill icon">
</p>

<h1 align="center">Zendesk Autofill</h1>

<p align="center">
  A small Chrome extension that fills in the required fields on a Zendesk ticket with one click — with a bit of magic ✨
</p>

---

## What it does

On a ticket page (`https://*.zendesk.com/agent/tickets/<id>`) a purple button labelled **"Autofyll felter — Oslo-utvidelse (ikke Zendesk)"** appears in the ticket tab row. Clicking it fills in:

| Field          | Value                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Type**       | `Spørsmål`                                                                                                             |
| **Tema**       | Taken from the subject: `Ny henvendelse: Annet` → `Annet`                                                              |
| **Virksomhet** | The three letters after `@` in the email, when followed by a dot: `…@hel.oslo.kommune.no` → `hel`. Otherwise `ooo`.     |
| **Sender**     | Only when Sender is **Bookingserver**: the email from *"send e-post til …"* at the end of the message (or the last email found in it) is pasted into the Sender search box. Pick or create the user yourself. |

Each field gets a burst of stars flying from the wand, and glows as it is filled. If you have *reduce motion* turned on in your OS, the animation is skipped.

If something can't be filled, an alert lists what went wrong, and the console logs what was extracted (`[oslo-autofill]`).

## Install (developer mode)

1. Clone or download this repo.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select this folder.
5. Optional: click the puzzle piece in the toolbar and pin **Zendesk Autofill**.
6. Open (or refresh) a ticket in Zendesk — the button appears at the top.

After changing the code, click the reload icon on the extension in `chrome://extensions` and refresh the Zendesk tab.

## Files

| File               | Purpose                                                        |
| ------------------ | -------------------------------------------------------------- |
| `manifest.json`    | Extension manifest (Manifest V3, content script only)          |
| `content.js`       | Injects the button, extracts data, fills fields, star animation |
| `content.css`      | Button, wand, star and field-glow styling                      |
| `icons/`           | Toolbar/extension icons (16, 32, 48, 128 px)                   |
| `tools/make_icons.py` | Regenerates the icons (needs Pillow): `python3 tools/make_icons.py icons` |

## How it works

- Zendesk is a single-page app, so a `MutationObserver` adds the button whenever a ticket is open and removes it otherwise.
- Fields are found by their **visible label** (`Type`, `Tema`, `Virksomhet`, `Sender`) rather than internal IDs, and only in the visible ticket tab.
- Text values are set through the native input setter plus `input`/`change` events, so Zendesk's React code picks them up.
- Dropdowns are opened and the matching `[role="option"]` is clicked.
- Nothing is saved automatically — review the ticket and submit as usual.

## Troubleshooting

- **No button:** make sure the URL is a ticket (`/agent/tickets/<number>`) and the extension is enabled; refresh the tab.
- **"Fant ikke feltet …":** the field label in Zendesk has changed or is hidden. Check the label text matches exactly.
- **"Fant ikke valget …":** the Tema from the subject doesn't match a dropdown option exactly.
