// Keep fixed bottom UI pinned to the visual viewport on mobile browsers
// whose URL/tool bars resize the visible area while scrolling. Writes a
// CSS custom property `--vos-vv-bottom` that floating elements (chatbot,
// PWA cards, identity card) reference for their `bottom:` offset.
(function () {
  const root = document.documentElement;
  let navRepairFrame = 0;

  function measureVisualViewportBottom() {
    const viewport = window.visualViewport;
    if (!viewport || document.hidden) return 0;

    const raw = window.innerHeight - viewport.height - viewport.offsetTop;
    if (!Number.isFinite(raw)) return 0;

    // iOS standalone PWAs can report stale visualViewport geometry after the
    // app resumes from the background. Treat anything larger than browser
    // chrome as bad data; otherwise fixed bottom UI can jump into mid-screen.
    const chromeInsetLimit = Math.min(96, window.innerHeight * 0.18);
    const bottom = Math.max(0, raw);
    return bottom <= chromeInsetLimit ? bottom : 0;
  }

  function syncVisualViewportBottom() {
    root.style.setProperty('--vos-vv-bottom', `${measureVisualViewportBottom().toFixed(2)}px`);
    syncBottomNavPosition();
  }

  function syncBottomNavPosition() {
    const nav = document.querySelector('.vos-app-nav');
    if (!nav) return;

    if (navRepairFrame) cancelAnimationFrame(navRepairFrame);
    navRepairFrame = requestAnimationFrame(() => {
      navRepairFrame = 0;
      const rect = nav.getBoundingClientRect();
      const expectedBottom = window.innerHeight;
      const delta = expectedBottom - rect.bottom;
      if (!Number.isFinite(delta) || Math.abs(delta) < 3) return;

      // If fixed positioning gets stranded after iOS resumes/restores a page,
      // move the nav back to the viewport bottom. Cap only truly impossible
      // values; legitimate failures can be surprisingly large.
      const currentRepair = Number.parseFloat(
        getComputedStyle(root).getPropertyValue('--vos-nav-y')
      ) || 0;
      const nextRepair = currentRepair + delta;
      const maxRepair = window.innerHeight * 0.9;
      root.style.setProperty('--vos-nav-y', `${Math.abs(nextRepair) <= maxRepair ? nextRepair.toFixed(2) : 0}px`);
    });
  }

  function resyncVisualViewportBottom() {
    root.style.setProperty('--vos-vv-bottom', '0px');
    root.style.setProperty('--vos-nav-y', '0px');
    requestAnimationFrame(syncVisualViewportBottom);
    setTimeout(syncVisualViewportBottom, 120);
    setTimeout(syncVisualViewportBottom, 450);
  }

  resyncVisualViewportBottom();
  window.addEventListener('resize', syncVisualViewportBottom, { passive: true });
  window.addEventListener('scroll', syncBottomNavPosition, { passive: true });
  window.addEventListener('focus', resyncVisualViewportBottom, { passive: true });
  window.addEventListener('pageshow', resyncVisualViewportBottom, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      root.style.setProperty('--vos-vv-bottom', '0px');
      root.style.setProperty('--vos-nav-y', '0px');
    }
    else resyncVisualViewportBottom();
  });
  window.addEventListener('orientationchange', () => {
    root.style.setProperty('--vos-vv-bottom', '0px');
    root.style.setProperty('--vos-nav-y', '0px');
    requestAnimationFrame(resyncVisualViewportBottom);
    setTimeout(syncVisualViewportBottom, 250);
  }, { passive: true });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncVisualViewportBottom, { passive: true });
    window.visualViewport.addEventListener('scroll', syncVisualViewportBottom, { passive: true });
  }
})();
