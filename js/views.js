import {compositionOptions,splitLabel} from './composition.js';
import {groups,labels,tag,title} from './characters.js';
import {compare,stipulations} from './comparison.js';
import {icon} from './icons.js';

export const esc = value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const checked=value=>value?' checked':'';
const disabled=value=>value?' disabled':'';
export const button=(label,action,style='secondary',options={})=>{
  const {icon:art,disabled:lock,...data}=options;
  return `<button type="button" class="button ${style}" data-action="${action}" ${Object.entries(data).map(([k,v])=>`data-${k}="${esc(v)}"`).join(' ')}${disabled(lock)}>${art?icon(art):''}${esc(label)}</button>`;
};
export const modeNames={blind:'Blind Draft',picks:'Alternating Picks',auction:'Live Auction'};
export function welcome(multiplayer=false) {
  return `<section class="hero" aria-labelledby="hero-title">
    <div class="hero-image"></div>
    <div class="hero-content">
      <p class="eyebrow hero-label"><i></i> ${multiplayer?'LIVE MULTIPLAYER':'DRAFT GAME'}</p>
      <h1 id="hero-title">RIVAL<br><em>ROSTER</em></h1>
      <p class="hero-description">Draft legends. Outbid your rival.<br>Build the team that wins the debate.</p>
      <div class="hero-actions">
        ${multiplayer?button('Create Room','create','primary',{icon:'plus'}):button('Single Player','soloMenu','primary')}
        ${multiplayer?button('Join Room','join','secondary',{icon:'people'}):button('Multiplayer','multiplayer','secondary')}
      </div>
      <p class="hero-note">${multiplayer?'2 players · Private rooms · No sign-up':'Solo drafts and private multiplayer rooms'}</p>
      ${multiplayer?button('Return to Home','home','quiet'):''}
    </div>
  </section>
  ${multiplayer?`<section class="mode-section" aria-labelledby="modes-title">
    <div class="section-heading"><h2 id="modes-title">CHOOSE YOUR GAME</h2><span></span></div>
    <div class="mode-grid">
      <article class="mode-card draft-mode">
        <div class="mode-line"><span class="mode-icon">${icon('swords')}</span><span class="mode-tag">TURN-BASED</span></div>
        <h3>Blind Draft</h3><p>Reveal a character. Recruit them to your roster or hand them to your rival.</p>
        ${button('Start a draft','create','text-button',{mode:'blind'})}
      </article>
      <article class="mode-card auction-mode">
        <div class="mode-line"><span class="mode-icon">${icon('hammer')}</span><span class="mode-tag">REAL-TIME</span></div>
        <h3>Live Auction</h3><p>Start with ₹100 in fictional credits. Bid on every lot and make your budget count.</p>
        ${button('Start an auction','create','text-button',{mode:'auction'})}
      </article>
    </div>
  </section>`:''}`;
}
export function roomDialog(mode,code,available,preferred) {
  return `<form id="entry-form" class="form-stack" data-mode="${mode}" data-preferred="${esc(preferred)}">
    ${mode==='join'? `<label>Room code<input name="code" required inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" placeholder="000000" value="${esc(code)}"></label>`:''}
    <label>Your display name<input name="name" type="text" required maxlength="28" placeholder="Enter your name" autocomplete="nickname"></label>
    ${available?'':'<p class="notice">Online rooms require Firebase configuration. See SETUP.md in the source project.</p>'}
    <button type="submit" class="button primary"${disabled(!available)}>${mode==='join'?'Join Room':'Create Room'}</button>
    <p class="form-message" role="status"></p>
  </form>`;
}
const select=(name,options,value,label)=>`<label>${label}<select name="${name}">${options.map(([key,text])=>`<option value="${esc(key)}"${String(value)===String(key)?' selected':''}>${esc(text)}</option>`).join('')}</select></label>`;
const numeric=(name,value,label,min,max)=>`<label>${label}<input name="${name}" type="number" min="${min}" max="${max}" step="1" value="${value}" required></label>`;
const checkbox=(name,value,label)=>`<label class="check"><input type="checkbox" name="${name}"${checked(value)}>${label}</label>`;
export function compositionChoices(cards,size,selected='men',womenSize=size) {
  const men=compositionOptions(cards,size,'men')[0];
  const women=compositionOptions(cards,womenSize,'women')[0];
  const mixed=compositionOptions(cards,size,'mixed');
  const options=[
    ['men','Men only',men.reason],['women',womenSize===size?'Women only':`Women only · ${womenSize}v${womenSize}`,women.reason],
    ['random','Mixed · Random',mixed.some(option=>!option.reason)?'':'No mixed split available.'],
    ...mixed.map(({men,women,reason})=>[String(women),'Mixed · '+splitLabel(men,women),reason]),
  ];
  return options.map(([value,label,reason])=>`<option value="${value}"${value===selected?' selected':''}${reason?' disabled':''}>${esc(label+(reason?' · '+reason:''))}</option>`).join('');
}
export function compositionBadge(size,women) {
  return Number.isInteger(women)?`<p class="pill" role="status">Per team · ${splitLabel(size-women,women)}</p>`:'';
}
export function proposalForm(config,catalog,rematch=false) {
  const {promotions,publishers,alignments}=groups(catalog);
  const selected=new Set(config.filters.split(','));
  const sets=[['promotion','Wrestling promotions',promotions],['publisher','Comic universes',publishers],['alignment','Comic alignment',alignments]];
  return `<form id="proposal-form" class="form-stack">
    <div class="form-grid">
      ${select('mode',Object.entries(modeNames),config.mode,'Game mode')}
      ${select('universe',[['mixed','Mixed universe'],['wrestling','Wrestling only'],['comics','Superheroes & villains'],['custom','Custom pool']],config.universe,'Character universe')}
      ${numeric('size',config.size,'Characters per team',1,8)}
      ${select('first',[[-1,'Random'],[0,'Host'],[1,'Guest']],config.first,'First player')}
    </div>
    <label class="composition-settings"${config.universe==='wrestling'?'':' hidden'}>Wrestling roster
    <select name="split">${compositionChoices(catalog,config.size,config.split)}</select></label>
    <div class="form-grid auction-settings"${config.mode!=='auction'?' hidden':''}>
      ${numeric('budget',config.budget,'Fictional budget (₹)',1,1000)}
      ${numeric('minimum',config.minimum,'Opening bid (₹)',1,100)}
      ${numeric('increment',config.increment,'Bid increment (₹)',1,100)}
      ${numeric('seconds',config.seconds,'Countdown (seconds)',5,120)}
      ${numeric('extension',config.extension,'Anti-sniping window (seconds)',0,30)}
      <div class="form-stack">${checkbox('manual',config.manual,'Advance lots manually')}${checkbox('nominate',config.nominate,'Players nominate lots')}</div>
    </div>
    <div class="form-grid draft-settings"${config.mode==='auction'?' hidden':''}>
      ${numeric('pickTime',config.pickTime,'Pick timer (0 turns it off)',0,120)}
      <div class="snake-setting"${config.mode!=='picks'?' hidden':''}>${checkbox('snake',config.snake,'Snake order')}</div>
    </div>
    ${rematch?checkbox('swapped',config.swapped,'Swap team colors'):`<input name="swapped" type="checkbox" hidden ${checked(config.swapped)}>`}
    <details class="filter-settings"><summary>Character filters and versions</summary>
      ${sets.map(([prefix,label,items])=>`<fieldset><legend>${label}</legend><div class="filter-checks">${items.map(item=>`<label class="check"><input type="checkbox" name="filters" value="${esc(prefix+':'+item)}"${checked(selected.has(prefix+':'+item))}>${esc(item)}</label>`).join('')}</div></fieldset>`).join('')}
      <label>Exclude character IDs<input name="exclude" maxlength="4000" placeholder="sting, iron-man" value="${esc(config.exclude)}"></label>
      <label>Custom pool character IDs<input name="custom" maxlength="4000" placeholder="sting, iron-man, wonder-woman" value="${esc(config.custom)}"></label>
      <p class="subtle">Character IDs are listed in the library. Separate IDs with commas.</p>
      ${checkbox('versions',config.versions,'Allow multiple versions of the same identity')}
    </details>
    <div class="form-actions"><button type="submit" class="button primary">${rematch?'Start rematch':'Start game'}</button>
    ${button('Save settings','saveProposal','secondary')}</div>
    <p class="form-message" role="status"></p>
  </form>`;
}
export function configSummary(c) {
  const universe={mixed:'Mixed universe',wrestling:'Wrestling only',comics:'Superheroes & villains',custom:'Custom pool'};
  return `<dl class="rules-summary">
    <div><dt>Mode</dt><dd>${modeNames[c.mode]}${c.mode==='picks'&&c.snake?' · Snake':''}</dd></div>
    <div><dt>Universe</dt><dd>${universe[c.universe]}</dd></div>
    <div><dt>Team size</dt><dd>${c.size} characters each</dd></div>
    ${c.split?`<div><dt>Wrestling roster</dt><dd>${Number.isInteger(c.women)?splitLabel(c.size-c.women,c.women):c.split==='random'?'Mixed · Random':c.split==='men'?'Men only':c.split==='women'?'Women only':splitLabel(c.size-Number(c.split),Number(c.split))}</dd></div>`:''}
    <div><dt>First player</dt><dd>${c.first===-1?'Random':c.first===0?'Host':'Guest'}</dd></div>
    ${c.mode==='auction'?`<div><dt>Fictional credits</dt><dd>₹${c.budget} each</dd></div><div><dt>Lot timer</dt><dd>${c.seconds}s · ${c.extension}s extension</dd></div><div><dt>Opening / increment</dt><dd>₹${c.minimum} / ₹${c.increment}</dd></div><div><dt>Nomination / advance</dt><dd>${c.nominate?'Player nomination':'Random order'} / ${c.manual?'Manual':'Automatic'}</dd></div>`:`<div><dt>Pick timer</dt><dd>${c.pickTime?c.pickTime+'s':'Off'}</dd></div>`}
    <div><dt>Versions</dt><dd>${c.versions?'Duplicate identities allowed':'One version per identity'}</dd></div>
    ${c.filters?`<div><dt>Filters</dt><dd>${esc(c.filters.split(',').join(', '))}</dd></div>`:''}
    ${c.exclude?`<div><dt>Excluded IDs</dt><dd>${esc(c.exclude)}</dd></div>`:''}
    ${c.universe==='custom'?`<div><dt>Custom IDs</dt><dd>${esc(c.custom)}</dd></div>`:''}
  </dl>`;
}
export function playerCard(player,side,own,online,color=side) {
  return `<div class="player-card team-${color}"><span class="avatar">${esc(player?.name?.slice(0,1).toUpperCase()||'?')}</span>
    <div><strong>${esc(player?.name||'Waiting for opponent')}${own?' <small>· You</small>':''}</strong><span>${color===0?'RED TEAM':'BLUE TEAM'}</span></div>
    <span class="presence ${online?'online':''}" data-presence="${side}">${online?'Online':player?'Offline':'Waiting'}</span></div>`;
}
export function lobbyView({room,code,side,catalog,rematch,online,hasResults}) {
  return `<div class="page"><div class="page-heading"><div><p class="eyebrow">PRIVATE ROOM</p><h1>${rematch?'Set up a rematch':'Room lobby'}</h1></div>${hasResults&&side===0?button('Back to results','cancelRematch','quiet'):button('Leave room','leave','quiet')}</div>
  <div class="lobby-grid">
    <section class="panel invites"><h2>Invite your rival</h2><p class="subtle">Send the room link or share this code.</p>
    <strong class="room-code">${code}</strong>
    <div class="form-actions">${button('Copy link','copyInvite','secondary',{icon:'link'})}${button('WhatsApp','shareInvite','secondary',{icon:'share'})}</div>
    <div class="players">${[0,1].map(i=>playerCard(room['p'+i],i,side===i,online(i))).join('')}</div>
    ${!room.p1?'<p class="waiting">Waiting for an opponent to join.</p>':''}
    </section>
    <section class="panel"><h2>Game settings</h2>${side===0?'<p class="subtle">Save your settings so both players can review them before you start.</p>'+proposalForm(room.proposal,catalog,rematch):configSummary(room.proposal)+'<p class="waiting">Waiting for the host to start.</p>'}</section>
  </div></div>`;
}

const initials=card=>card.name.split(/[ -]/).filter(word=>!['the','of','a'].includes(word.toLowerCase())).slice(0,3).map(word=>word[0]).join('');
export function characterCard(card,large=false) {
  if(!card) return '<p class="notice">Character unavailable.</p>';
  const accent=card.universe==='wrestling'?'wrestling':'comics';
  return `<button type="button" class="character-card ${accent}${large?' large':''}" data-action="details" data-id="${esc(card.id)}">
    <div class="card-art" aria-hidden="true"><span>${esc(initials(card))}</span></div>
    <div class="card-copy"><span class="card-tag">${esc(tag(card))}${card.alignment?' · '+esc(card.alignment):''}</span><strong>${esc(card.name)}</strong><small>${esc(card.version==='Standard'?(card.style||card.abilities[0]):card.version)}</small></div></button>`;
}
export function characterDetails(card) {
  return `<div class="form-stack">${characterCard(card,true)}
    <p>${esc(card.description)}</p>
    <dl class="rules-summary">${Object.entries(card.universe==='wrestling'?
      {'Character ID':card.id,'Era':card.era,'Promotions':card.promotions.join(', '),'Weight class':card.weightClass||'Unlisted','Signature moves':card.signatures.join(', '),'Finisher':card.finisher}:
      {'Character ID':card.id,'Universe':card.publisher,'Alignment':card.alignment,'Primary abilities':card.abilities.join(', ')})
      .map(([label,value])=>`<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>
    <h3>Subjective game ratings</h3>
    <div class="rating-list">${Object.entries(card.ratings).map(([key,value])=>`<div><span>${labels[key]}</span><meter min="0" max="100" value="${value}">${value}</meter><b>${value}</b></div>`).join('')}</div>
    ${button('Back to library','library','secondary')}</div>`;
}
export function teamPanel({name,online,side,own,team,s,budget,size,lookup,color=side,slots}) {
  return `<aside class="panel roster team-${color}">
    ${online===undefined?`<h2>${esc(name)}</h2>`:playerCard({name},side,own,online,color)}
    <div class="roster-header"><h2>Roster</h2><strong>${team.length}/${size}</strong></div>
    ${slots?`<p class="subtle">${slots.men}M-${slots.women}W open</p>`: ''}
    ${budget?`<p class="team-budget">₹${side===0?s.m0:s.m1} <span>fictional credits left</span></p>`:''}
    <ol class="roster-list">${[...team,...Array(Math.max(0,size-team.length)).fill(null)].map((entry,i)=>entry?
      `<li><button type="button" data-action="details" data-id="${esc(entry.id)}"><span>${i+1}</span><strong>${esc(title(lookup.get(entry.id)))}</strong>${entry.price?`<b>₹${entry.price}</b>`:''}</button></li>`:
      `<li><span class="empty-slot"><b>${i+1}</b> Open slot</span></li>`).join('')}</ol>
  </aside>`;
}
export function historyView(events,match,lookup,room) {
  const name=uid=>room.p0.uid===uid?room.p0.name:room.p1.name;
  const item=event=>{
    const card=lookup.get(match.pool[event.s.card]?.id);
    if(event.s.award>=0&&card) return `${title(card)} ${event.s.price?'sold to':'joined'} ${room['p'+event.s.award].name}${event.s.price?' for ₹'+event.s.price:''}`;
    if(event.kind==='close'&&card) return title(card)+' went unsold';
    if(event.kind==='bid') return name(event.actor)+' bid ₹'+event.amount;
    if(event.kind==='pass') return name(event.actor)+' passed';
    return '';
  };
  const lines=events.slice().reverse().map(item).filter(Boolean);
  return `<details class="panel history"><summary>${match.config.mode==='auction'?'Auction':'Draft'} history · ${lines.length}</summary>
    ${lines.length?`<ol>${lines.map(t=>`<li>${esc(t)}</li>`).join('')}</ol>`:'<p class="subtle">No moves recorded yet.</p>'}</details>`;
}
export const blankDiscussion={captain:'',stipulation:0,matchups:'',strategy:'',argument:'',ready:false,vote:-1,concluded:false};
export function discussionView(discussion,teams,names,side) {
  const own=discussion[side]||blankDiscussion, other=discussion[1-side]||blankDiscussion;
  return `<section class="panel" id="discussion"><h2>Team debate</h2>
    <div class="discussion-grid">
    <form id="discussion-form" class="form-stack">
      ${select('captain',[['','Select captain'],...teams[side].map(c=>[c.id,title(c)])],own.captain,'Team captain')}
      ${select('stipulation',stipulations.map((text,i)=>[i,text]),own.stipulation,'Preferred stipulation')}
      <label>Preferred matchups<textarea name="matchups" maxlength="240" rows="2">${esc(own.matchups)}</textarea></label>
      <label>Strategy notes<textarea name="strategy" maxlength="500" rows="2">${esc(own.strategy)}</textarea></label>
      <label>Your argument<textarea name="argument" maxlength="600" rows="3">${esc(own.argument)}</textarea></label>
      ${select('vote',[[-1,'Abstain'],[0,names[0]],[1,names[1]]],own.vote,'Debate vote')}
      ${checkbox('ready',own.ready,'Ready to debate')}${checkbox('concluded',own.concluded,'Conclude debate')}
      <button class="button primary" type="submit">Save discussion</button>
    </form>
    <div class="opponent-debate"><h3>${esc(names[1-side])}’s argument</h3>
      <p class="presence ${other.ready?'online':''}">${other.ready?'Ready to debate':'Preparing'}</p>
      <dl class="rules-summary">
      ${[['Captain',teams[1-side].find(c=>c.id===other.captain)?.name||'Undecided'],['Stipulation',stipulations[other.stipulation]],
      ['Matchups',other.matchups||'Pending'],['Strategy',other.strategy||'Pending'],['Argument',other.argument||'Pending'],
      ['Debate vote',other.vote===-1?'Abstained':names[other.vote]]].map(([key,value])=>`<div><dt>${key}</dt><dd>${esc(value)}</dd></div>`).join('')}
      </dl>
      <p class="notice">${own.concluded&&other.concluded?'Both players concluded the debate.':'Debate votes are separate from the roster score.'}</p>
    </div></div></section>`;
}
export function comparisonView(teams,names,stip,swapped=false,hasCaptain=true) {
  const result=compare(teams,stip);
  const score=result.winner<0?'Projected draw':esc(names[result.winner])+' has the edge';
  return `<section class="panel result-score"><div class="result-trophy">${icon('trophy')}</div><p class="eyebrow">${esc(stipulations[stip])}</p>
  <h2>${score}</h2><p class="subtle">Weighted averages of subjective game ratings.</p>
  <div class="scores">${result.scores.map((value,side)=>`<div class="team-${swapped?1-side:side}"><strong>${value.toFixed(1)}</strong><span>${esc(names[side])}</span></div>`).join('')}</div>
  <table class="compare-table${swapped?' swapped':''}"><thead><tr><th>${esc(names[0])}</th><th>Category</th><th>${esc(names[1])}</th></tr></thead>
  <tbody>${result.stats.map(({label,values,weight})=>`<tr><td>${values[0].toFixed(1)}</td><th scope="row">${label}${weight>1?' ×'+weight:''}</th><td>${values[1].toFixed(1)}</td></tr>`).join('')}</tbody></table>
  <div class="result-strategy">${result.ranked.map((ranked,i)=>`<div><h3>${esc(names[i])}</h3>
    <p><b>Strength</b> ${ranked[0].label}</p><p><b>Weakness</b> ${ranked.at(-1).label}</p>
    <p><b>Strategy</b> Create matchups that emphasize ${result.edges[i].label.toLowerCase()} and cover ${ranked.at(-1).label.toLowerCase()} ${hasCaptain?'with your captain.':'through the suggested matchups.'}</p></div>`).join('')}</div>
  <details class="matchups"><summary>Suggested matchups</summary><ol>${result.matchups.map(([a,b])=>`<li>${esc(title(a))} vs ${esc(title(b))}</li>`).join('')}</ol></details>
  </section>`;
}
