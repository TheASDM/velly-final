// esbuild is resolved through createRequire rather than a bare ESM import:
// in the container it lives in /opt/eleventy/node_modules (outside the /site
// bind mount) and is found via NODE_PATH, which Node honours for CommonJS
// resolution but ignores entirely for ESM.
import { createRequire } from 'node:module';

const { build } = createRequire(import.meta.url)('esbuild');

const scriptEntries = {
  'pwa-client': 'src/js/pwa/index.js',
  'vos-dm': 'src/js/dm/index.js',
  chatbot: 'src/js/chatbot/index.js',
  'enzo-widget': 'src/js/entries/enzo-widget.js',
  'in-play-live': 'src/js/entries/in-play-live.js',
  'pwa-manager': 'src/js/entries/pwa-manager.js',
  'search-init': 'src/js/entries/search-init.js',
  settings: 'src/js/entries/settings.js',
  'viewport-handler': 'src/js/entries/viewport-handler.js',
  'vos-calendar': 'src/js/entries/vos-calendar.js',
  'vos-dossiers': 'src/js/dossiers/index.js',
  'vos-questionnaire': 'src/js/questionnaire/index.js',
  'vos-sheet': 'src/js/sheet/player.js',
  'vos-sheets': 'src/js/sheet/dm.js',
  'vos-party': 'src/js/play/party.js',
  'vos-tabs': 'src/js/entries/vos-tabs.js',
  'vos-art-submissions': 'src/js/pages/vos-art-submissions.js',
  'vos-home': 'src/js/pages/vos-home.js',
  'vos-chat': 'src/js/chat/index.js',
  'vos-messages': 'src/js/chat/page.js',
  'vos-monsters': 'src/js/pages/vos-monsters.js',
  'vos-notes': 'src/js/pages/vos-notes.js',
  'vos-studio': 'src/js/studio/index.js',
  'vos-submit-lore': 'src/js/pages/vos-submit-lore.js',
  'gallery-carousel': 'src/js/components/gallery-carousel.js',
};

await build({
  entryPoints: scriptEntries,
  outdir: 'public/js',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  minify: true,
  legalComments: 'none',
  logLevel: 'info',
});

const styleEntries = {
  'app-shell': 'src/css/app-shell.css',
  'art-submissions': 'src/css/pages/art-submissions.css',
  chatbot: 'src/css/chatbot.css',
  dm: 'src/css/pages/dm.css',
  dossiers: 'src/css/pages/dossiers.css',
  home: 'src/css/pages/home.css',
  monsters: 'src/css/pages/monsters.css',
  notes: 'src/css/pages/notes.css',
  sheet: 'src/css/pages/sheet.css',
  studio: 'src/css/pages/studio.css',
  'submit-lore': 'src/css/pages/submit-lore.css',
  'gallery-carousel': 'src/css/components/gallery-carousel.css',
};

await build({
  entryPoints: styleEntries,
  outdir: 'public/css',
  bundle: true,
  external: ['/images/*'],
  minify: true,
  legalComments: 'none',
  logLevel: 'info',
});
