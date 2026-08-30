/* Tap an image in a sheet-dialect document and it opens in the deep-zoom
 * viewer the wiki's maps use — OpenSeadragon, with pinch, pan, a navigator
 * minimap, and a Reset. It overlays the whole screen rather than zooming
 * inline, because a pan surface inside a scrolling handout fights the thumb
 * for every gesture.
 *
 * The library loads from the same CDN the map pages use, once, on the first
 * tap — a sheet that never opens an image never pays for the viewer. If the
 * CDN is unreachable the tap degrades to opening the original in a new tab.
 */

const OSD_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/openseadragon/4.1.0/openseadragon.min.js';
const OSD_PREFIX = 'https://cdnjs.cloudflare.com/ajax/libs/openseadragon/4.1.0/images/';

let osdLoading = null;

function loadOsd() {
  if (window.OpenSeadragon) return Promise.resolve();
  if (osdLoading) return osdLoading;
  osdLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = OSD_SRC;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => { osdLoading = null; reject(new Error('viewer unavailable')); };
    document.head.appendChild(script);
  });
  return osdLoading;
}

function toolbarButton(label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'vos-map-action';
  button.textContent = label;
  return button;
}

export async function openImageViewer(src, caption) {
  try {
    await loadOsd();
  } catch (error) {
    window.open(src, '_blank', 'noopener');
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'vos-zoom-overlay';

  const viewerEl = document.createElement('div');
  viewerEl.className = 'vos-map-viewer';

  const toolbar = document.createElement('div');
  toolbar.className = 'vos-map-toolbar';
  if (caption) {
    const cap = document.createElement('div');
    cap.className = 'vos-map-toolbar-caption';
    cap.textContent = caption;
    toolbar.appendChild(cap);
  }
  const original = document.createElement('a');
  original.className = 'vos-map-action';
  original.href = src;
  original.target = '_blank';
  original.rel = 'noopener';
  original.textContent = 'Open Original';
  const reset = toolbarButton('Reset');
  const close = toolbarButton('Close');
  toolbar.append(original, reset, close);

  overlay.append(viewerEl, toolbar);
  document.body.appendChild(overlay);
  const bodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  const viewer = window.OpenSeadragon({
    element: viewerEl,
    prefixUrl: OSD_PREFIX,
    showNavigator: true,
    navigatorPosition: 'BOTTOM_RIGHT',
    navigatorHeight: '120px',
    navigatorWidth: '160px',
    visibilityRatio: 0.6,
    constrainDuringPan: true,
    minZoomImageRatio: 0.5,
    maxZoomPixelRatio: 4,
    animationTime: 0.6,
    gestureSettingsTouch: { pinchRotate: false },
    tileSources: { type: 'image', url: src },
  });

  function teardown() {
    document.removeEventListener('keydown', onKey);
    try { viewer.destroy(); } catch (error) { /* already gone */ }
    overlay.remove();
    document.body.style.overflow = bodyOverflow;
  }
  function onKey(event) {
    if (event.key === 'Escape') teardown();
  }
  document.addEventListener('keydown', onKey);
  reset.addEventListener('click', () => viewer.viewport.goHome(false));
  close.addEventListener('click', teardown);
}

/* Delegate taps on document images inside `root`. The renderer marks them
 * with .vos-sheet-image, so anything the sheet dialect can show, this can
 * zoom — handouts today, story-sheet images the day they exist. */
export function wireImageZoom(root) {
  if (!root) return;
  root.addEventListener('click', (event) => {
    const img = event.target.closest('.vos-sheet-image img');
    if (!img || !root.contains(img)) return;
    const figure = img.closest('.vos-sheet-image');
    const captionEl = figure && figure.querySelector('figcaption');
    openImageViewer(img.getAttribute('src'), captionEl ? captionEl.textContent : '');
  });
}
