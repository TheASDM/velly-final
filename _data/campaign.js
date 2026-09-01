// ===== CAMPAIGN STATE - edit after each session, then rebuild =====
// The next gathering is no longer defined here: it lives in the
// calendar_events table (DM-scheduled from /dm/) and pages hydrate it
// from /api/calendar/next.
//
// The chronicler writes _data/campaign-state.json when the DM publishes a
// session chronicle, and whatever it contains wins over the defaults below.
// Editing this file by hand still works — the merge is per top-level key, so
// a hand-written openThreads survives a chronicle that proposed none.
const fs = require("node:fs");
const path = require("node:path");

function publishedState() {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(__dirname, "campaign-state.json"), "utf8")
    );
  } catch (error) {
    // No file, or a half-written one mid-publish: the defaults below are
    // always a valid campaign state, so a broken merge costs a stale front
    // page rather than a failed build.
    if (error.code !== "ENOENT") {
      console.warn(`[campaign] ignoring campaign-state.json: ${error.message}`);
    }
    return {};
  }
}

const defaults = {
  latestSession: {
    number: "Update 4",
    arc: "Road to Session 1",
    title: "Campaign Update #4 - 5/21/2026",
    lastPlayed: "May 21, 2026",
    updated: "May 22, 2026",
    recap:
      "The table is moving from setup into play: scheduling has moved to Timeful, the new Eldryn and Venturia maps are live, and the first in-character scene will begin with troubling news from the Overlook.",
    link: "/en/Updates/campaign-update-4",
  },

  openThreads: [
    {
      question:
        "What happened to Maruk Grommarg the night he vanished from the Overlook?",
      status: "hot",
      tag: "Missing person",
    },
    {
      question:
        "Why did a burned stranger appear at the fog line on the same night?",
      status: "pending",
      tag: "Fog-line omen",
    },
    {
      question:
        "How will each character's ordinary day pull them toward the first scene?",
      status: "slow",
      tag: "Character hooks",
    },
  ],

  inPlay: [
    {
      name: "Noname",
      role: "Fog Warden patient",
      kind: "PC",
      emblem: "FW",
      link: "/en/Venturia/Characters/PCs/noname",
    },
    {
      name: "Maruk Grommarg",
      role: "Missing fiance",
      kind: "NPC",
      emblem: "MG",
      link: "/en/Venturia/Characters/NPCs/maruk-grommarg",
    },
    {
      name: "Fog Wardens' Garrison",
      role: "The Overlook",
      kind: "Location",
      emblem: "OV",
      link: "/en/Venturia/Locations/fog-wardens-garrison",
    },
    {
      name: "Vallombrosa",
      role: "Fog boundary",
      kind: "Location",
      emblem: "VB",
      link: "/en/Venturia/Locations/vallombrosa",
    },
  ],
};

const state = publishedState();

module.exports = {
  ...defaults,
  ...state,
  latestSession: { ...defaults.latestSession, ...(state.latestSession || {}) },
};
