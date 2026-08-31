/* Enzo, offered inside the work.
 *
 * He used to hold a tab, which made asking him something a place you went
 * rather than a thing you did — you left the page you had the question about
 * in order to ask about it. The tab is Studio now, and this puts the asking
 * where the question is.
 *
 * Every action does the same small thing: open the widget and put a question
 * in the box, already written, not yet sent. Sending it for the reader would
 * take away the edit that makes it their question.
 *
 * Mark up an action with data-enzo-ask="<the question>" on any button. The
 * seed may carry {title} and {selection}, filled in here.
 */
const OPEN_KEY = 'loreMasterOpen';

function widget() {
  return document.getElementById('chatbot-widget');
}

function openWidget() {
  const host = widget();
  if (!host) return false;
  host.classList.remove('chatbot-collapsed');
  try { localStorage.setItem(OPEN_KEY, 'true'); } catch (error) { /* private mode */ }
  return true;
}

export function askEnzo(seed) {
  if (!openWidget()) return;
  // The widget's input is swapped for a textarea by a compatibility pass in
  // enzo-widget.js, so read it back rather than holding a reference.
  const input = document.getElementById('chat-input');
  if (!input) return;
  input.value = seed || '';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  try { input.focus(); } catch (error) { /* focus is a courtesy */ }
  const at = input.value.length;
  if (input.setSelectionRange) {
    try { input.setSelectionRange(at, at); } catch (error) { /* not all inputs */ }
  }
}

/* What this page is about, in the reader's words rather than the tab bar's.
 * The app bar carries the character's name on every page for a signed-in
 * player and the tab's own name on an index, so neither is the subject of
 * the question — the page's own heading is. */
function pageTitle() {
  const heading = document.querySelector('main h1, .vos-page-shell h1');
  if (heading && heading.textContent.trim()) return heading.textContent.trim();
  const crumbs = document.querySelectorAll('.vos-app-crumbs li');
  if (crumbs.length) return crumbs[crumbs.length - 1].textContent.trim();
  const bar = document.querySelector('.vos-app-bar .vos-app-title');
  if (bar && bar.textContent.trim()) return bar.textContent.trim();
  return (document.title || 'this page').split('·')[0].trim();
}

function fillSeed(template) {
  const title = pageTitle();
  let selection = '';
  try { selection = String(window.getSelection() || '').trim().slice(0, 300); }
  catch (error) { /* no selection is the normal case */ }
  return String(template || '')
    .replace('{title}', title)
    .replace('{selection}', selection);
}

export function initEnzoActions() {
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-enzo-ask]');
    if (!trigger) return;
    event.preventDefault();
    askEnzo(fillSeed(trigger.dataset.enzoAsk));
  });
}
