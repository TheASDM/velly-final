// PWA install + service worker update flow.
//
// This is the only place that registers /sw.js. pwa-client.js reads the
// resulting registration (via navigator.serviceWorker.ready) for push
// subscriptions, but never registers separately.
(function () {
  const installCard = document.getElementById('vos-pwa-install');
  const installTitle = document.getElementById('vos-pwa-install-title');
  const installText = document.getElementById('vos-pwa-install-text');
  const installAction = document.getElementById('vos-pwa-install-action');
  const installDismiss = document.getElementById('vos-pwa-install-dismiss');
  const updateCard = document.getElementById('vos-pwa-update');
  const refreshButton = document.getElementById('vos-pwa-refresh');
  const INSTALL_DISMISSED = 'vos.pwa.installDismissed';
  let deferredInstallPrompt = null;
  let waitingWorker = null;
  const hadControllerAtLoad = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
  let reloadAfterControllerChange = false;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
  }

  function isIOS() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  }

  function wasDismissed() {
    try { return localStorage.getItem(INSTALL_DISMISSED) === '1'; } catch (e) { return false; }
  }

  function setDismissed() {
    try { localStorage.setItem(INSTALL_DISMISSED, '1'); } catch (e) {}
  }

  function showInstallCard(mode) {
    if (!installCard || isStandalone() || wasDismissed()) return;
    if (mode === 'ios') {
      installTitle.textContent = 'Install Foglight';
      installText.textContent = 'Open Share, then choose Add to Home Screen.';
      installAction.textContent = 'Got It';
    } else if (mode === 'android') {
      installTitle.textContent = 'Install Foglight';
      installText.textContent = 'Add this app to your home screen.';
      installAction.textContent = 'Install';
    } else {
      installTitle.textContent = 'Install Foglight';
      installText.textContent = 'Add this app from your browser menu.';
      installAction.textContent = 'Got It';
    }
    installCard.hidden = false;
  }

  function hideInstallCard() {
    if (installCard) installCard.hidden = true;
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    showInstallCard('android');
  });

  if (installAction) {
    installAction.addEventListener('click', async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice.catch(() => null);
        deferredInstallPrompt = null;
      }
      setDismissed();
      hideInstallCard();
    });
  }

  if (installDismiss) {
    installDismiss.addEventListener('click', () => {
      setDismissed();
      hideInstallCard();
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    if (!isStandalone() && !wasDismissed() && isIOS()) {
      showInstallCard('ios');
    }
  });

  function showUpdatePrompt(worker) {
    waitingWorker = worker || waitingWorker;
    if (updateCard) updateCard.hidden = false;
  }

  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      if (waitingWorker) {
        reloadAfterControllerChange = true;
        waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      } else {
        window.location.reload();
      }
    });
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

        function watchWorker(worker) {
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdatePrompt(worker);
            }
          });
        }

        watchWorker(registration.installing);
        if (registration.waiting && navigator.serviceWorker.controller) {
          showUpdatePrompt(registration.waiting);
        }
        registration.addEventListener('updatefound', () => {
          watchWorker(registration.installing);
        });

        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'VOS_SW_UPDATED' && hadControllerAtLoad) {
            showUpdatePrompt(registration.waiting);
          }
        });

        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!reloadAfterControllerChange) return;
          window.location.reload();
        });
      } catch (error) {
        console.warn('Service worker registration failed', error);
      }
    });
  }
})();
