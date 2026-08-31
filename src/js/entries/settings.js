// Settings page wiring.
//
// Reads from / writes to window.VOS_PWA (defined by pwa-client.js) for
// identity + push. Talks to the service worker registration directly for
// update checks. All sections degrade gracefully when the underlying API
// isn't available (e.g. push on iOS Safari pre-16.4).
(function () {
  if (!document.getElementById('vos-settings-profile')) return;

  function waitForVosPwa(timeoutMs) {
    return new Promise((resolve) => {
      if (window.VOS_PWA) return resolve(window.VOS_PWA);
      const deadline = Date.now() + (timeoutMs || 4000);
      const id = setInterval(() => {
        if (window.VOS_PWA) {
          clearInterval(id);
          resolve(window.VOS_PWA);
        } else if (Date.now() > deadline) {
          clearInterval(id);
          resolve(null);
        }
      }, 50);
    });
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setHidden(id, hidden) {
    const el = document.getElementById(id);
    if (el) el.hidden = hidden;
  }

  // ── Profile ───────────────────────────────────────────────────────
  function renderProfile(api) {
    const name = api && api.getPlayerName ? api.getPlayerName() : null;
    const nameEl = document.getElementById('vos-settings-profile-name');
    const subEl = document.getElementById('vos-settings-profile-sub');
    const avatarImg = document.getElementById('vos-settings-avatar');
    const switchBtn = document.getElementById('vos-settings-switch-player');
    const signOutBtn = document.getElementById('vos-settings-sign-out');

    if (name) {
      const display = api.getProfileDisplayName ? api.getProfileDisplayName(name) : name;
      const player = api.lookupPlayer ? api.lookupPlayer(name) : null;
      nameEl.textContent = display;
      subEl.textContent = display === name ? '' : name;
      if (player && player.avatar) {
        avatarImg.src = player.avatar;
        avatarImg.classList.add('is-loaded');
      } else {
        avatarImg.classList.remove('is-loaded');
      }
      switchBtn.textContent = 'Switch player';
      signOutBtn.hidden = false;
    } else {
      nameEl.textContent = 'Not signed in';
      subEl.textContent = '';
      avatarImg.classList.remove('is-loaded');
      switchBtn.textContent = 'Sign in';
      signOutBtn.hidden = true;
    }
  }

  // ── Notifications ─────────────────────────────────────────────────
  async function renderPush(api) {
    const button = document.getElementById('vos-settings-push-toggle');
    if (!api || !api.getPushStatus) {
      setText('vos-settings-push-status', 'Push API unavailable in this build.');
      button.disabled = true;
      return;
    }

    const status = await api.getPushStatus();
    button.disabled = false;

    if (status === 'unsupported') {
      setText('vos-settings-push-status', 'Push isn’t supported on this device or browser.');
      button.disabled = true;
      button.textContent = 'Enable notifications';
    } else if (status === 'denied') {
      setText(
        'vos-settings-push-status',
        'Notifications are blocked. Allow them in your browser or system settings, then check back.'
      );
      button.disabled = true;
      button.textContent = 'Enable notifications';
    } else if (status === 'enabled') {
      setText('vos-settings-push-status', 'Notifications are enabled on this device.');
      button.textContent = 'Disable notifications';
    } else {
      setText('vos-settings-push-status', 'Notifications are disabled on this device.');
      button.textContent = 'Enable notifications';
    }
  }

  async function togglePush(api) {
    const button = document.getElementById('vos-settings-push-toggle');
    const prev = button.textContent;
    button.disabled = true;
    button.textContent = 'Working…';
    try {
      const current = await api.getPushStatus();
      if (current === 'enabled') {
        await api.disablePush();
        setText('vos-settings-push-status', 'Notifications disabled.');
      } else {
        await api.enablePush();
        setText('vos-settings-push-status', 'Notifications enabled.');
      }
    } catch (error) {
      setText('vos-settings-push-status', error.message || 'Could not change notification setting.');
      button.textContent = prev;
      button.disabled = false;
      return;
    }
    await renderPush(api);
  }

  // ── App updates ───────────────────────────────────────────────────
  let waitingWorker = null;
  let reloadAfterControllerChange = false;

  async function checkForUpdates() {
    const status = (text) => setText('vos-settings-update-status', text);
    if (!('serviceWorker' in navigator)) {
      status('Service workers aren’t supported in this browser.');
      return;
    }
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      status('No service worker is registered yet — load any page first.');
      return;
    }

    status('Checking…');
    try {
      await registration.update();
    } catch (error) {
      status(`Update check failed: ${error.message}`);
      return;
    }

    if (registration.waiting) {
      waitingWorker = registration.waiting;
      status('A new version is ready.');
      setHidden('vos-settings-apply-update', false);
      return;
    }

    if (registration.installing) {
      const installing = registration.installing;
      status('Installing new version…');
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          waitingWorker = installing;
          status('A new version is ready.');
          setHidden('vos-settings-apply-update', false);
          return;
        }
        /* A worker whose install fails goes straight to redundant. Without
           this branch the screen kept saying "Installing new version…" — the
           same thing it says while the install is healthy — so a build that
           could never ship looked indistinguishable from one that was three
           seconds away. It stayed that way for four releases. */
        if (installing.state === 'redundant') {
          status('That version could not install. It is a bug in the app, not '
               + 'this device — tell the DM, and check again once it is fixed.');
        }
      });
      return;
    }

    status('Up to date.');
  }

  function applyUpdate() {
    if (!waitingWorker) {
      window.location.reload();
      return;
    }
    reloadAfterControllerChange = true;
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloadAfterControllerChange) window.location.reload();
    });
  }

  // ── Wire it up ────────────────────────────────────────────────────
  // App-bar back button: return to whatever same-origin page the user
  // came from. Falls back to home when settings was a direct entry
  // (bookmark, refresh on /settings/, new tab).
  const backButton = document.getElementById('vos-settings-back');
  if (backButton) {
    backButton.addEventListener('click', () => {
      let cameFromSameOrigin = false;
      if (document.referrer) {
        try { cameFromSameOrigin = new URL(document.referrer).origin === location.origin; }
        catch (e) {}
      }
      if (cameFromSameOrigin || history.length > 1) {
        history.back();
      } else {
        location.href = '/';
      }
    });
  }

  document.getElementById('vos-settings-check-updates').addEventListener('click', checkForUpdates);
  document.getElementById('vos-settings-apply-update').addEventListener('click', applyUpdate);
  setText('vos-settings-update-status', 'Press “Check for updates” to look for a newer version.');

  waitForVosPwa().then((api) => {
    if (!api) {
      setText('vos-settings-profile-name', 'Profile unavailable');
      setText('vos-settings-push-status', 'Push API unavailable in this build.');
      return;
    }

    renderProfile(api);
    renderPush(api);

    document.getElementById('vos-settings-switch-player').addEventListener('click', () => {
      api.openIdentitySettings();
    });
    document.getElementById('vos-settings-sign-out').addEventListener('click', () => {
      api.signOut();
      renderProfile(api);
    });
    document.getElementById('vos-settings-push-toggle').addEventListener('click', () => togglePush(api));

    window.addEventListener('vos:identity', () => renderProfile(api));
    window.addEventListener('focus', () => renderPush(api));
  });
})();
