/* Art — which prompt compiler the table is on.
 *
 * Two providers translate a description into image direction. Both assemble
 * the house style from the same configuration, so the choice is who writes
 * the scene, not what the Valley looks like. What is set here is what every
 * player silently gets; the Studio's own row lets the DM override it for one
 * piece to compare the two. */
import { artCompilersEl, artRefreshEl, artStatusEl, setStatus } from './dom.js';
import { adminJson, putJson, withPanel } from './http.js';

function renderCompilers(data) {
  const active = data.active;
  artCompilersEl.innerHTML = '';
  (data.providers || []).forEach((provider) => {
    const row = document.createElement('div');
    row.className = 'vos-dm-art-compiler';
    if (provider.key === active) row.classList.add('is-active');

    const text = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = provider.label;
    const detail = document.createElement('span');
    detail.textContent = provider.configured
      ? `${provider.vendor} · ${provider.model}`
      : `${provider.vendor} · no API key on this server`;
    text.append(name, detail);

    const choose = document.createElement('button');
    choose.type = 'button';
    if (provider.key === active) {
      choose.textContent = 'Active';
      choose.disabled = true;
    } else {
      choose.textContent = 'Make active';
      choose.disabled = !provider.configured;
      choose.addEventListener('click', () => setCompiler(provider));
    }

    row.append(text, choose);
    artCompilersEl.appendChild(row);
  });

  if (!artCompilersEl.children.length) {
    const empty = document.createElement('div');
    empty.className = 'vos-dm-avail-empty';
    empty.textContent = 'No prompt compilers are configured on this server.';
    artCompilersEl.appendChild(empty);
  }

  setStatus(artStatusEl, data.debug
    ? 'Compiler debug logging is on — the whole exchange is in the container log.'
    : '');
}

export function refreshArtCompilers() {
  if (!artCompilersEl) return Promise.resolve(true);
  return withPanel(artStatusEl, null, async () => {
    renderCompilers(await adminJson('/api/studio/compiler'));
  });
}

async function setCompiler(provider) {
  await withPanel(artStatusEl, null, async () => {
    renderCompilers(await putJson('/api/studio/compiler', { provider: provider.key }));
    setStatus(artStatusEl, `${provider.label} is now what the table gets.`);
  }, { loading: 'Switching…' });
}

if (artRefreshEl) {
  artRefreshEl.addEventListener('click', () => refreshArtCompilers());
}
