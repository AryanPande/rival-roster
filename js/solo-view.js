import {MAX_WOMEN} from './composition.js';
import {automaticSide,soloModes,soloNames,soloSize,soloSlots} from './solo.js';
import {button,characterCard,compositionBadge,compositionChoices,comparisonView,teamPanel} from './views.js';

export function soloMenu(catalog) {
  return `<div class="page"><div class="page-heading"><h1>Single Player</h1>${button('Return to Home','home')}</div>
  <div class="mode-grid">${Object.entries(soloModes).map(([universe,label])=>`<section class="panel">
  <h2>${label}</h2><p>Draft one character at a time.</p>
  ${universe==='wrestling'?`<label>Wrestling roster<select name="soloSplit">${compositionChoices(catalog,soloSize,'men',MAX_WOMEN)}</select></label>`:''}
  ${button(universe==='wrestling'?'Start wrestling draft':'Start comics draft','soloStart','primary',{universe,disabled:!catalog.length})}
  </section>`).join('')}</div></div>`;
}

export function soloView(game,lookup,showingAssignment) {
  const split=compositionBadge(game.size,game.composition?.women);
  const roster=side=>teamPanel({name:soloNames[side],side,own:side===0,team:game.teams[side],size:game.size,lookup,slots:game.composition?{men:soloSlots(game,side,'men'),women:soloSlots(game,side,'women')}:null});
  if(game.index===game.ids.length&&!showingAssignment) {
    const teams=game.teams.map(team=>team.map(({id})=>lookup.get(id)));
    return `<div class="page"><div class="page-heading"><h1 tabindex="-1">Final rosters</h1></div>
    ${split}<div class="final-grid">${roster(0)}${roster(1)}</div>
    ${comparisonView(teams,soloNames,0,false,false)}
    <div class="panel form-actions">${button('Play Again','soloStart','primary',{universe:game.universe})}
    ${button('Return to Home','home')}${button('Copy Teams','soloCopy')}${button('JSON Export','soloExport')}</div></div>`;
  }
  const index=showingAssignment?game.index-1:game.index;
  const automatic=automaticSide(game);
  const last=game.history.at(-1);
  const card=lookup.get(game.ids[index]);
  return `<div class="page"><div class="page-heading"><h1 tabindex="-1">${soloModes[game.universe]}</h1>${button('Return to Home','home')}</div>
    ${split}<div class="game-grid">${roster(0)}<section class="panel play-panel" aria-label="Current reveal">
    <p class="pill">Reveal ${index+1} of ${game.ids.length}</p>
    <div class="reveal-stage">${characterCard(card,true)}</div>
    ${showingAssignment?`<p role="status">${soloNames[last.side]} received this card.</p>`:
      automatic!==null?`<p role="status">Assigning this card to ${soloNames[automatic].toLowerCase()}…</p>`:
      `<div class="play-actions">${button('Keep','soloPick','primary',{index,side:0})}
      ${button('Let Go','soloPick','secondary',{index,side:1})}</div>`}
    </section>${roster(1)}</div></div>`;
}
