const KIND_PREFIXES = [
  ["/en/Venturia/Characters/PCs/", "PC"],
  ["/en/Venturia/Characters/NPCs/", "NPC"],
  ["/en/Venturia/Characters/", "Character"],
  ["/en/Venturia/Locations/", "Location"],
  ["/en/Venturia/Lore/", "Lore"],
  ["/en/Venturia/Factions/", "Faction"],
  ["/en/Venturia/Items/", "Item"],
  ["/en/Venturia/Maps/", "Map"],
  ["/en/Venturia/Creatures/", "Creature"],
  ["/en/Venturia/Culture/", "Culture"],
  ["/en/Venturia/Government/", "Government"],
  ["/en/Venturia/College-of-the-Masquerade-Bard/", "Masquerade-Bard"],
  ["/en/Articles/", "Article"],
  ["/en/Updates/", "Update"],
  ["/en/Session-Chronicles/", "Session"],
];

function resolveActiveTabId(navigationData, currentUrl) {
  if (!currentUrl) return null;
  const exactHit = navigationData.tabs.find(
    (tab) => tab.match === "exact" && tab.href === currentUrl,
  );
  if (exactHit) return exactHit.id;
  const exactHrefs = new Set(
    navigationData.tabs.filter((tab) => tab.match === "exact").map((tab) => tab.href),
  );
  if (currentUrl.startsWith("/en/") && !exactHrefs.has(currentUrl)) {
    const wikiTab = navigationData.tabs.find((tab) => tab.match === "wiki");
    if (wikiTab) return wikiTab.id;
  }
  return null;
}

function deriveWikiKind(url) {
  if (!url) return "";
  for (const [prefix, kind] of KIND_PREFIXES) {
    if (url.startsWith(prefix)) return kind;
  }
  return "";
}

function wikiPagesJson(pages) {
  const items = (pages || [])
    .filter((page) => page.data && page.data.published === true)
    .filter((page) => page.url && page.url.startsWith("/en/"))
    .filter((page) => !(page.url || "").startsWith("/en/Venturia/DM/"))
    .filter((page) => page.data && page.data.title)
    .map((page) => ({
      url: page.url,
      title: page.data.title,
      kind: deriveWikiKind(page.url),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
  return JSON.stringify(items);
}

function appBarMeta(navigationData, currentUrl, fallbackTitle) {
  const tab = navigationData.tabs.find((item) => item.href === currentUrl);
  if (tab) return { title: tab.title, eyebrow: tab.eyebrow };
  const eyebrow = currentUrl && currentUrl.startsWith("/en/") ? "Wiki" : "Vallombrosa";
  return { title: fallbackTitle || "Vallombrosa", eyebrow };
}

module.exports = { appBarMeta, resolveActiveTabId, wikiPagesJson };
