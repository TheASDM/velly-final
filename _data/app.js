/* The release identity, in one place.
 *
 * Read by the About panel in Settings. Bump `build` on every deploy that
 * players will see, and `version` when the app is meaningfully a different
 * thing than it was.
 *
 * Deliberately separate from CACHE_VERSION in sw.js: that is a cache-busting
 * counter the service worker needs and nobody should have to read, and it
 * changes for reasons a player does not care about. About shows both, because
 * the useful question when something looks wrong is not "what did we ship"
 * but "what is this device actually running".
 */
module.exports = {
  name: "Foglight",
  version: "2.0",
  build: 6,
};
