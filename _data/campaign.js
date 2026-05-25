// ===== CAMPAIGN STATE - edit after each session, then rebuild =====
module.exports = {
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

  nextGathering: {
    date: "May 30, 2026",
    timeLocation: "The Cask and Cube / short campaign-character scene",
    notes: [
      "Bring something small to add to the tavern if you have it.",
      "Send 4-8 sentences about your character's typical day by May 28.",
    ],
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
    {
      name: "The Cask and Cube",
      role: "Next gathering",
      kind: "Table",
      emblem: "CC",
      link: "/en/Updates/campaign-update-4",
    },
  ],
};
