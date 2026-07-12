---
title: Character Record
description: Your Valley of Shadows character record.
permalink: /questionnaire/
---

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;0,900;1,500;1,700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

<style>
.vos-q{
  --ink:#0b0e14; --panel:#121722; --panel-2:#0f141d;
  --line:#28303d; --bone:#e9e3d5; --muted:#8b8778;
  --accent:#c9a86a;
  --display:"Playfair Display",Georgia,serif;
  --body:"Newsreader",Georgia,serif;
  --util:"Inter",system-ui,sans-serif;
  max-width:760px; margin:0 auto;
  font-family:var(--body); font-size:17px; line-height:1.5; color:var(--bone);
}
.vos-q .doc{
  border:1px solid var(--line); background:linear-gradient(180deg,var(--panel),var(--panel-2));
  padding:clamp(18px,5vw,56px);
  box-shadow:0 0 0 1px rgba(0,0,0,.4), inset 0 0 0 1px color-mix(in srgb, var(--accent) 10%, transparent);
}
.vos-q header{text-align:center; padding-bottom:24px; border-bottom:1px solid var(--line); margin-bottom:28px}
.vos-q .crest{width:92px; height:auto; display:block; margin:0 auto 14px}
.vos-q .eyebrow{font-family:var(--util); text-transform:uppercase; letter-spacing:.34em;
  font-size:11px; color:var(--muted); margin:0 0 10px}
.vos-q h1{font-family:var(--display); font-weight:900; font-size:clamp(2rem,7vw,3.3rem);
  line-height:1.04; margin:0 0 10px; color:var(--bone)}
.vos-q .role{font-family:var(--body); font-style:italic; color:var(--accent); font-size:1.02rem; margin:0}
.vos-q .intro{color:var(--muted); font-size:.98rem; max-width:52ch; margin:18px auto 0}
.vos-q .aside{font-family:var(--util); font-size:12.5px; color:var(--muted); line-height:1.55;
  border-left:2px solid color-mix(in srgb,var(--accent) 60%,transparent);
  padding:8px 0 8px 14px; margin:16px auto 0; max-width:56ch; text-align:left}
.vos-q .part{margin-top:36px}
.vos-q .part-head{display:flex; align-items:baseline; gap:14px; margin:0 0 18px}
.vos-q .roman{font-family:var(--display); font-weight:700; font-style:italic;
  font-size:1.9rem; color:var(--accent); line-height:1}
.vos-q .part-title{font-family:var(--util); text-transform:uppercase; letter-spacing:.22em;
  font-size:12px; color:var(--bone)}
.vos-q .part-title small{display:block; letter-spacing:.02em; text-transform:none;
  font-family:var(--body); font-style:italic; color:var(--muted); font-size:13.5px; margin-top:3px}
.vos-q .rule{flex:1; height:1px; background:var(--line); align-self:center; min-width:16px}
.vos-q .field{margin:0 0 18px}
.vos-q label{display:block; font-family:var(--body); color:var(--bone); font-size:1.04rem; margin:0 0 8px}
.vos-q .num{font-family:var(--util); font-size:11px; color:var(--accent); letter-spacing:.1em;
  margin-right:10px; vertical-align:1px}
.vos-q label strong{font-weight:600}
.vos-q textarea,.vos-q input[type=text]{
  width:100%; background:#0c1119; color:var(--bone);
  border:1px solid var(--line); border-radius:2px; padding:11px 12px;
  font-family:var(--body); font-size:16px; resize:vertical;
}
.vos-q textarea{min-height:74px; line-height:1.5}
.vos-q textarea::placeholder,.vos-q input::placeholder{color:#4c5566}
.vos-q textarea:focus,.vos-q input:focus{outline:none; border-color:var(--accent);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 22%,transparent)}
.vos-q :focus-visible{outline:2px solid var(--accent); outline-offset:2px}
.vos-q .vgroup{font-family:var(--util); text-transform:uppercase; letter-spacing:.2em; font-size:11px;
  color:var(--accent); margin:24px 0 12px; padding-bottom:6px; border-bottom:1px dashed var(--line)}
.vos-q .vgrid{display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:14px 18px}
.vos-q .vfield.wide{grid-column:1 / -1}
.vos-q .vfield label{font-family:var(--util); font-size:11.5px; letter-spacing:.05em; text-transform:uppercase;
  color:var(--muted); margin-bottom:6px; display:flex; align-items:center; flex-wrap:wrap; gap:6px}
.vos-q .onfile{color:var(--accent); font-size:10px; letter-spacing:.12em;
  border:1px solid color-mix(in srgb,var(--accent) 45%,transparent); border-radius:2px;
  padding:1px 5px; text-transform:uppercase}
.vos-q .js-edit{background:none; border:none; color:var(--accent); font-family:var(--util);
  font-size:10px; letter-spacing:.12em; text-transform:uppercase; cursor:pointer; padding:0;
  text-decoration:underline; text-underline-offset:2px}
.vos-q input[readonly]{color:var(--muted); border-style:dashed; background:#0a0f16}
.vos-q input.unlocked{color:var(--bone); border-style:solid; background:#0c1119}
.vos-q .rollrow{display:flex; gap:8px; align-items:stretch}
.vos-q .rollrow input{flex:1; min-width:0}
.vos-q .die{flex:0 0 auto; width:46px; display:inline-flex; align-items:center; justify-content:center;
  background:transparent; color:var(--accent);
  border:1px solid color-mix(in srgb,var(--accent) 45%,transparent); border-radius:2px; cursor:pointer;
  transition:box-shadow .15s ease, transform .1s ease}
.vos-q .die:hover{box-shadow:0 0 14px color-mix(in srgb,var(--accent) 30%,transparent); border-color:var(--accent)}
.vos-q .die:active{transform:translateY(1px)}
.vos-q .die.rolled{color:var(--muted); border-style:dashed; cursor:default; box-shadow:none; transform:none}
.vos-q input.rolled{color:var(--accent); border-style:dashed; border-color:color-mix(in srgb,var(--accent) 45%,transparent)}
.vos-q .coda .part-title{color:var(--bone)}
.vos-q .seal{text-align:center; margin-top:40px; padding-top:28px; border-top:1px solid var(--line)}
.vos-q .btn-seal{
  font-family:var(--util); font-weight:600; letter-spacing:.14em; text-transform:uppercase;
  font-size:12.5px; color:var(--ink); background:var(--accent); border:none; border-radius:2px;
  padding:15px 34px; cursor:pointer;
  box-shadow:0 0 0 1px color-mix(in srgb,var(--accent) 40%,transparent), 0 0 22px color-mix(in srgb,var(--accent) 25%,transparent);
  transition:transform .12s ease, box-shadow .2s ease;
}
.vos-q .btn-seal:hover{box-shadow:0 0 0 1px var(--accent), 0 0 30px color-mix(in srgb,var(--accent) 40%,transparent)}
.vos-q .btn-seal:active{transform:translateY(1px)}
.vos-q .btn-seal:disabled{opacity:.55; cursor:default}
.vos-q .seal p{color:var(--muted); font-size:12.5px; font-family:var(--util); margin:14px 0 0}
.vos-q footer{text-align:center; color:#3f4756; font-family:var(--util); font-size:10.5px;
  letter-spacing:.28em; text-transform:uppercase; margin:24px 0 6px}
/* App-integration additions: save bar + states */
.vos-q .savebar{
  position:sticky; bottom:calc(var(--vos-app-nav-h, 72px) + 10px); z-index:20;
  display:flex; align-items:center; gap:12px; margin-top:26px;
  border:1px solid var(--line); background:rgba(11,14,20,.96); border-radius:4px;
  padding:10px 14px; backdrop-filter:blur(6px);
}
.vos-q .btn-save{
  font-family:var(--util); font-weight:600; letter-spacing:.12em; text-transform:uppercase;
  font-size:11.5px; color:var(--accent); background:transparent;
  border:1px solid color-mix(in srgb,var(--accent) 50%,transparent); border-radius:2px;
  padding:10px 18px; cursor:pointer; min-height:40px;
}
.vos-q .btn-save:hover{border-color:var(--accent)}
.vos-q .btn-save:disabled{opacity:.5; cursor:default}
.vos-q .savestate{font-family:var(--util); font-size:12px; color:var(--muted); flex:1}
.vos-q .savestate.is-error{color:#d4726a}
.vos-q .savestate.is-saved{color:#9dbb8e}
.vos-q .qnotice{
  border:1px solid var(--line); background:linear-gradient(180deg,var(--panel),var(--panel-2));
  padding:clamp(18px,5vw,42px); text-align:center; color:var(--muted); font-family:var(--util); font-size:14px;
}
.vos-q .qnotice button{
  display:inline-block; margin-top:14px; font-family:var(--util); font-weight:600; letter-spacing:.12em;
  text-transform:uppercase; font-size:12px; color:var(--ink); background:var(--accent);
  border:none; border-radius:2px; padding:12px 26px; cursor:pointer;
}
.vos-q .dm-picker{display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-bottom:18px}
.vos-q .dm-picker button{
  font-family:var(--util); font-size:11.5px; letter-spacing:.08em; text-transform:uppercase;
  color:var(--bone); background:transparent; border:1px solid var(--line); border-radius:2px;
  padding:8px 14px; cursor:pointer; min-height:38px;
}
.vos-q .dm-picker button.is-active{border-color:var(--accent); color:var(--accent)}
.vos-q .dm-note{font-family:var(--util); font-size:11.5px; color:var(--muted); text-align:center; margin:0 0 14px}
@media (max-width:560px){
  .vos-q .doc{padding:20px 15px}
  .vos-q header{padding-bottom:20px; margin-bottom:22px}
  .vos-q .crest{width:78px}
  .vos-q h1{font-size:1.9rem}
  .vos-q .part-head{flex-wrap:wrap; gap:8px}
  .vos-q .roman{font-size:1.6rem}
  .vos-q .vgrid{grid-template-columns:1fr; gap:12px}
  .vos-q .btn-seal{width:100%}
  .vos-q .aside{margin-left:0; margin-right:0}
  .vos-q .savebar{flex-wrap:wrap}
}
@media (prefers-reduced-motion:reduce){.vos-q *{transition:none!important}}
</style>

<div class="vos-q" id="vos-q-root">
  <div class="qnotice">Loading your character record&hellip;</div>
</div>

<script src="/js/vos-questionnaire.js" defer></script>
