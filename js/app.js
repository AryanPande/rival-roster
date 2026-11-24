import {connect,configured,emulator,testGuest} from './firebase.js';
import {createRoom,joinRoom,watchRoom,latestMatch,listEvents,startMatch,submit,saveProposal,saveDiscussion} from './lobby.js';
import {defaults,matchView,remainingBudget,LIMIT} from './engine.js';
import {filtered,loadCatalog,loadRetiredCatalog,makePool,title,wrestlingConfig} from './characters.js';
import {auctionAutomation,bidFloor,showAuction} from './auction.js';
import {draftAutomation,showDraft} from './draft.js';
import {compare,discussionPrompt,stipulations,teamText} from './comparison.js';
import {blankDiscussion,button,characterCard,characterDetails,compositionBadge,compositionChoices,comparisonView,configSummary,discussionView,esc,historyView,lobbyView,roomDialog,teamPanel,welcome} from './views.js';
import {icon} from './icons.js';
import {assignSolo,automaticSide,soloNames,startSolo} from './solo.js';
import {soloMenu,soloView} from './solo-view.js';

const main=document.querySelector('main'), dialog=document.querySelector('dialog'), toast=document.querySelector('#toast');
const params=new URLSearchParams(location.search);
const inviteCode=/^\d{6}$/.test(params.get('room'))?params.get('room'):'';
const storage=testGuest?sessionStorage:localStorage;
const roomKey='rival-roster.room.'+(emulator?'demo':'live');
let api,catalog=[],lookup=new Map(),room,code='',side=-1,stop=()=>{},offset=0,connected=false;
let rematch=false,pending=false,lastAuto='',lastAutoAt=0,lastSound='',toastTimeout,audioContext,screenKey='';
let soundOn=localStorage.getItem('rival-roster.sound')==='on';
let landing=inviteCode?'multiplayer':'home',solo=null,soloTimer;
let library={query:'',universe:'mixed',filters:'',page:0};
const clock=()=>Math.round(Date.now()+offset);
const locked=()=>!connected||pending;
const names=()=>[room?.p0?.name||'Red',room?.p1?.name||'Blue'];
const online=i=>Boolean(room?.presence?.[room['p'+i]?.uid]&&Object.keys(room.presence[room['p'+i].uid]).length);
const current=()=>{
  const match=latestMatch(room),events=listEvents(match),event=events.at(-1);
  return {match,events,event,s:event?.s};
};
function notify(message) {
  toast.textContent=message;
  toast.classList.add('shown');
  clearTimeout(toastTimeout);
  toastTimeout=setTimeout(()=>toast.classList.remove('shown'),4000);
}
function fail(error) {
  const message=String(error?.code||error?.message||error).toLowerCase();
  if (message.includes('permission_denied')||message.includes('permission-denied')) {
    return 'The server declined the change. Check the latest room state and try again.';
  }
  if (message.includes('operation-not-allowed')) return 'Enable anonymous sign-in in Firebase Authentication.';
  if (message.includes('network')) return 'Connection interrupted. Wait for the room to reconnect.';
  return error?.message||'Something went wrong. Try again.';
}
function modal(label,content) {
  dialog.innerHTML=`<div class="modal-head"><h2 id="dialog-title">${esc(label)}</h2><button class="icon-button" type="button" data-action="closeDialog" aria-label="Close dialog">${icon('close')}</button></div><div class="modal-content">${content}</div>`;
  if(!dialog.open) dialog.showModal();
  dialog.scrollTop=0;
}
function entry(mode,preferred='blind') {
  modal(mode==='join'?'Join a private room':'Create a private room',roomDialog(mode,inviteCode,configured,preferred));
  dialog.querySelector('input[name=name]')?.focus();
}
async function resumeRoom() {
  const saved=storage.getItem(roomKey);
  if(configured&&saved&&(!inviteCode||saved===inviteCode)){
    api=await connect();
    const snap=await api.get(api.ref(api.db,'rooms/'+saved)).catch(()=>null);
    if(landing!=='multiplayer'||room) return;
    if(snap?.exists()) await openRoom(saved); else {storage.removeItem(roomKey);if(inviteCode) entry('join');}
  } else if(inviteCode) entry('join');
}
function invite(){
  const url=new URL(location.pathname,location.origin);
  url.searchParams.set('room',code);
  if(emulator) url.searchParams.set('emulator','1');
  return url.href;
}
async function copy(value,message){
  try {
    await navigator.clipboard.writeText(value);
    notify(message);
  } catch {
    modal('Copy text',`<textarea readonly rows="10" aria-label="Text to copy">${esc(value)}</textarea>`);
    dialog.querySelector('textarea').select();
  }
}
const share=value=>window.open('https://wa.me/?text='+encodeURIComponent(value),'_blank','noopener,noreferrer');
function updateSoundButton() {
  const sound=document.querySelector('.sound');
  sound.setAttribute('aria-label',soundOn?'Mute game sounds':'Unmute game sounds');
  sound.title=sound.getAttribute('aria-label');
  sound.innerHTML=icon(soundOn?'sound':'mute');
}
function tone(frequency=520) {
  if(!soundOn||!audioContext||audioContext.state!=='running') return;
  const tone=audioContext.createOscillator(), gain=audioContext.createGain(), t=audioContext.currentTime;
  tone.frequency.setValueAtTime(frequency,t);
  gain.gain.setValueAtTime(0.055,t);
  gain.gain.exponentialRampToValueAtTime(0.001,t+0.13);
  tone.connect(gain);gain.connect(audioContext.destination);
  tone.start();tone.stop(t+0.14);
}
function setSound() {
  soundOn=!soundOn;
  localStorage.setItem('rival-roster.sound',soundOn?'on':'off');
  if(soundOn) {
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(Audio) {audioContext??=new Audio();audioContext.resume().then(()=>tone()).catch(()=>{});}
  }
  updateSoundButton();
}
function showLibrary() {
  const promo=[...new Set(catalog.flatMap(card=>card.promotions||[]))].sort();
  const publisher=[...new Set(catalog.map(card=>card.publisher).filter(Boolean))].sort();
  modal('Character library',`<div class="library-filters"><label>Search<input type="search" name="libraryQuery" placeholder="Search by name, version or universe" value="${esc(library.query)}"></label>
  <label>Universe<select name="libraryUniverse">${[['mixed','All universes'],['wrestling','Wrestling'],['comics','Superheroes & villains']].map(([v,n])=>`<option value="${v}" ${library.universe===v?'selected':''}>${n}</option>`).join('')}</select></label>
  <label>Filter<select name="libraryFilter"><option value="">All characters</option>
  ${[['promotion','Promotions',promo],['publisher','Publishers',publisher],['alignment','Alignment',['Hero','Villain','Antihero']]].map(([key,label,values])=>`<optgroup label="${label}">${values.map(val=>`<option value="${esc(key+':'+val)}"${library.filters===key+':'+val?' selected':''}>${esc(val)}</option>`).join('')}</optgroup>`).join('')}
  </select></label></div><div id="library-results"></div>`);
  fillLibrary();
}
function fillLibrary(){
  const result=dialog.querySelector('#library-results');
  if(!result) return;
  let cards=filtered(catalog,library).sort((a,b)=>a.name.localeCompare(b.name)||a.version.localeCompare(b.version));
  if(library.filters.startsWith('promotion:')) cards=cards.filter(c=>c.universe==='wrestling');
  else if(library.filters) cards=cards.filter(c=>c.universe==='comics');
  const first=library.page*12;
  result.innerHTML=`<p class="subtle library-count" role="status">${catalog.length?cards.length+' characters':'Loading catalog…'}</p>
  <div class="library-grid">${cards.slice(first,first+12).map(card=>characterCard(card)).join('')}</div>
  ${cards.length>12?`<div class="form-actions">${button('Previous','libraryPage','secondary',{step:-1,disabled:!first})}
    ${button('Next','libraryPage','secondary',{step:1,disabled:first+12>=cards.length})}</div>`:''}`;
}
function markPresence(){
  for(let i=0;i<2;i++) document.querySelectorAll(`[data-presence="${i}"]`).forEach(el=>{
    el.classList.toggle('online',online(i)); el.textContent=online(i)?'Online':room?.['p'+i]?'Offline':'Waiting';
  });
  const connection=document.querySelector('[data-connection]');
  if(connection) {connection.hidden=connected; connection.textContent=connected?'':'Reconnecting to the room…';}
}
function render(force=false) {
  if(!room) {
    if(screenKey===landing&&!force) return;
    screenKey=landing;
    main.innerHTML=landing==='soloMenu'?soloMenu(catalog):welcome(landing==='multiplayer');
    return;
  }
  const {match,events,event,s}=current();
  const stateKey=JSON.stringify([code,match?.number,event?.seq,room.p1?.uid,
    room.proposal,match?.discussion,rematch,catalog.length]);
  if(!force&&screenKey===stateKey) {markPresence();return;}
  // Keep unsaved input when the other player connects or submits discussion.
  const activeForm=document.activeElement?.closest?.('form');
  const key=activeForm?.id;
  const canRestore=key==='proposal-form'||key==='discussion-form';
  const snapshot=canRestore?[...activeForm.elements].filter(el=>el.name).map(el=>({name:el.name,value:el.value,checked:el.checked,type:el.type})):null;
  const focusName=canRestore?document.activeElement.name:'';
  const oldMode=main.querySelector('select[name=mode]')?.value;
  const historyOpen=main.querySelector('.history')?.open;
  screenKey=stateKey;
  if(!match||rematch||s.phase==='reset') {
    main.innerHTML=lobbyView({room,code,side,catalog,rematch:Boolean(match),online,hasResults:s?.phase==='done'});
  } else {
    const {teams,history}=matchView(events,match.pool);
    const palette=i=>match.config.swapped?1-i:i;
    const composition=match.config.women;
    const slots=i=>{
      if(!Number.isInteger(composition)) return null;
      const women=i?s.w1:s.w0;
      return {women:composition-women,men:match.config.size-composition-teams[i].length+women};
    };
    const roster=i=>teamPanel({name:names()[i],online:online(i),side:i,own:side===i,team:teams[i],s,budget:match.config.mode==='auction',size:match.config.size,lookup,color:palette(i),slots:slots(i)});
    const marker=`<div class="room-meta"><span class="pill">ROOM ${code}</span>${button('Leave room','leave','quiet')}</div>`;
    const asks=['askUndo','askReset'].includes(event.kind);
    const requester=event.actor===api.uid;
    const prompt=asks?`<div class="notice approval"><b>${event.kind==='askUndo'?'Undo last move?':'Reset this match?'}</b>
      <span>${requester?'Waiting for your opponent to approve.':'Your opponent requested this change.'}</span>
      <div class="form-actions">${requester?button('Withdraw','move','secondary',{kind:'withdraw'}):
      button('Approve','move','primary',{kind:event.kind==='askUndo'?'undo':'reset'})+button('Decline','move','secondary',{kind:'decline'})}</div></div>`:'';
    const undoable=['assign','pick','autoAssign','autoPick','bid','pass','close','reserve','compositionAssign','skipIneligible','advance','nominate','autoNominate'].includes(event.kind);
    const renderOpts={side,card:(i,large)=>characterCard(lookup.get(match.pool[i]?.id),large),button,names:names(),escape:esc};
    let content;
    if (s.phase==='done') {
      const {cards,discussion,stip}=results(match,teams);
      const lastWin=event.s.price>0&&event.s.award>=0?`<p class="notice final-sale"><b>SOLD</b> ${esc(title(lookup.get(match.pool[event.s.card]?.id)))} · ₹${event.s.price}</p>`:'';
      content=`<div class="page-heading"><div><p class="eyebrow">MATCH COMPLETE</p><h1>Final rosters</h1></div></div>${lastWin}
      <div class="final-grid">${roster(palette(0))}${roster(palette(1))}</div>
      ${comparisonView(cards,names(),stip,match.config.swapped)}
      <div class="panel share-panel"><h2>Share your match</h2><div class="form-actions">
      ${button('Copy teams','copyTeams','secondary')}${button('Copy discussion prompt','copyPrompt','primary')}
      ${button('Share on WhatsApp','shareResult','secondary',{icon:'share'})}${button('Download JSON','download','secondary')}
      ${side===0?button('Set up rematch','rematch','secondary'):''}</div></div>
      ${discussionView(discussion,cards,names(),side)}
      <details class="panel"><summary>Proposed settings for the rematch</summary>${configSummary(room.proposal)}</details>`;
    } else {
      content=`<div class="game-grid">${roster(palette(0))}<section class="panel play-panel">${match.config.mode==='auction'?
        showAuction(match,event,renderOpts):showDraft(match,event,renderOpts)}</section>${roster(palette(1))}</div>`;
    }
    main.innerHTML=`<div class="page match-page">${marker}${compositionBadge(match.config.size,composition)}<p class="notice" data-connection hidden></p>${prompt}${content}
    ${historyView(history,match,lookup,room)}
    <details class="panel"><summary>Match settings</summary>${configSummary(match.config)}</details>
    ${!asks?`<div class="form-actions game-utilities">${undoable?button('Request undo','move','quiet',{kind:'askUndo'}):''}
    ${side===0&&s.phase!=='done'?button('Reset match','askReset','quiet'):''}</div>`:''}</div>`;
    if(asks) main.querySelectorAll('.play-panel button[data-action="move"],.play-panel button[data-action="customBid"]').forEach(el=>{el.disabled=true;});
    if(historyOpen) main.querySelector('.history').open=true;
    const soundId=match.number+':'+event.seq;
    if(lastSound!==soundId&&event.seq>0) tone(event.s.award>=0?720:450);
    lastSound=soundId;
  }
  markPresence();
  const proposalForm=main.querySelector('#proposal-form');
  if(proposalForm) syncComposition(proposalForm);
  if(snapshot&&main.querySelector('#'+key)) {
    const form=main.querySelector('#'+key);
    [...form.elements].filter(el=>el.name).forEach(el=>{
      const prior=snapshot.find(v=>v.name===el.name&&(el.name!=='filters'||v.value===el.value));
      if(prior) { if(el.type==='checkbox') el.checked=prior.checked; else el.value=prior.value; }
    });
    if(oldMode) syncSettings(form,oldMode);
    if(focusName) form.elements.namedItem(focusName)?.focus?.({preventScroll:true});
  }
}
function results(match,teams) {
  const cards=teams.map(team=>team.map(entry=>lookup.get(entry.id)).filter(Boolean));
  const discussion=[room.p0.uid,room.p1.uid].map(uid=>match.discussion?.[uid]||blankDiscussion);
  const stip=discussion[0].stipulation===discussion[1].stipulation?discussion[0].stipulation:0;
  return {cards,discussion,stip};
}
async function openRoom(newCode) {
  stop();
  code=newCode;
  storage.setItem(roomKey,code);
  const url=new URL(invite());
  if(testGuest) url.searchParams.set('guest','1');
  history.replaceState({},'',url);
  stop=watchRoom(api,code,snapshot=>{
    if(!snapshot) return;
    room=snapshot;
    side=room.p0.uid===api.uid?0:1;
    if (rematch&&current().match&&current().match.number!==rematch.number) rematch=false;
    render();
  },state=>{
    if ('connected' in state) connected=state.connected;
    if ('offset' in state) offset=state.offset;
    markPresence();
  },error=>notify(fail(error)));
}
function leave(){
  landing='multiplayer';
  stop();room=null;code='';side=-1;rematch=false;connected=false;
  storage.removeItem(roomKey);
  const url=new URL(location.href);url.searchParams.delete('room');history.replaceState({},'',url);
  dialog.close();render();
}
function syncSettings(form,mode) {
  form.querySelector('.auction-settings').hidden=mode!=='auction';
  form.querySelector('.draft-settings').hidden=mode==='auction';
  form.querySelector('.snake-setting').hidden=mode!=='picks';
  syncComposition(form);
}
function syncComposition(form) {
  const data=new FormData(form);
  const select=form.elements.split;
  const isWrestling=data.get('universe')==='wrestling';
  select.parentElement.hidden=!isWrestling;
  if(!isWrestling) return;
  const eligible=filtered(catalog,{universe:'wrestling',filters:data.getAll('filters').join(','),exclude:String(data.get('exclude')||'')});
  select.innerHTML=compositionChoices(eligible,Number(data.get('size'))||1,select.value||'men');
}
function proposalFrom(form) {
  const data=new FormData(form);
  const config=Object.fromEntries(Object.entries(defaults).map(([key,base])=>{
    const value=data.get(key);
    return [key,key==='filters'?data.getAll(key).join(','):typeof base==='boolean'?data.has(key):typeof base==='number'?Number(value):String(value??'').trim()];
  }));
  if (config.budget<config.minimum*config.size) throw new Error('Increase the budget or lower the starting bid so both teams can afford every slot.');
  if (config.extension>config.seconds) throw new Error('The anti-sniping window must fit within the countdown.');
  if (config.pickTime>0&&config.pickTime<5) throw new Error('Set the pick timer to zero or at least five seconds.');
  if (config.filters.length>400) throw new Error('Select fewer filters.');
  if(config.universe==='wrestling') config.split=String(data.get('split')||form.elements.split.value||'men');
  makePool(catalog,wrestlingConfig(catalog,config),LIMIT);
  return config;
}
async function configuration(form,start) {
  if(!form.reportValidity()||pending) return;
  if(!connected) return notify('Wait for the room to reconnect.');
  const message=form.querySelector('.form-message');
  pending=true;
  try {
    const proposal=proposalFrom(form);
    const changed=[...Object.keys(defaults),'split'].some(key=>room.proposal[key]!==proposal[key]);
    if (changed) {
      await saveProposal(api,code,proposal);
      notify(start?'Settings shared. Select Start again when your opponent is ready.':'Settings saved for both players.');
      return;
    }
    if(start) {
      if(!room.p1) throw new Error('Wait for your opponent to join before starting.');
      await startMatch(api,code,{...room,proposal},catalog,clock());
    } else notify('Settings saved for both players.');
  } catch(error) { if(message.isConnected) message.textContent=fail(error); else notify(fail(error)); }
  finally {pending=false;}
}
async function move(kind,options={},automatic=false) {
  if(locked()) return;
  pending=true;
  try {await submit(api,code,current().match,kind,{side,now:clock(),...options});}
  catch(error){if(!automatic) notify(fail(error));}
  finally{pending=false;}
}
function tick(){
  const time=clock();
  for (const element of main.querySelectorAll('[data-deadline]')) {
    const remaining=Math.max(0,Number(element.dataset.deadline)-time);
    element.querySelector('[data-clock]').textContent=Math.ceil(remaining/1000)+'s';
    element.querySelector('[data-progress]').style.width=Math.min(100,remaining/10/Number(element.dataset.total))+'%';
    if(!remaining) main.querySelectorAll('[data-time]').forEach(el=>{el.disabled=true;});
  }
  if(!room||rematch||locked()) return;
  const {match,event,s}=current();
  if(!event||['askUndo','askReset'].includes(event.kind)) return;
  const next=match.config.mode==='auction'?auctionAutomation(match,s,time):draftAutomation(match,s,time);
  if(!next) return;
  const key=match.number+':'+event.seq+':'+next[0];
  if(lastAuto===key&&time-lastAutoAt<1200) return;
  lastAuto=key;lastAutoAt=time;
  move(...next,true);
}
async function entrySubmit(form) {
  if (pending) return;
  const data=new FormData(form), name=String(data.get('name')).trim();
  if(!name) {form.querySelector('.form-message').textContent='Enter your display name.';return;}
  pending=true;
  const element=form.querySelector('button[type=submit]');
  element.disabled=true;
  element.textContent='Connecting…';
  try {
    api??=await connect();
    const joined=form.dataset.mode==='join'?await joinRoom(api,String(data.get('code')),name):await createRoom(api,name,form.dataset.preferred);
    dialog.close();await openRoom(joined);
  } catch(error) {form.querySelector('.form-message').textContent=fail(error);}
  finally {pending=false;element.disabled=false;element.textContent=form.dataset.mode==='join'?'Join Room':'Create Room';}
}
function setLanding(next) {
  clearTimeout(soloTimer);
  solo=null;
  landing=next;
  render(true);
}
function drawSolo(showingAssignment=false) {
  screenKey='solo';
  main.innerHTML=soloView(solo,lookup,showingAssignment);
}
function queueSoloReveal() {
  drawSolo();
  if(solo.index===solo.ids.length) {
    main.querySelector('h1').focus();
    return;
  }
  if(automaticSide(solo)===null) return;
  soloTimer=setTimeout(()=>{
    assignSolo(solo,solo.index);
    drawSolo(true);
    soloTimer=setTimeout(queueSoloReveal,850);
  },850);
}
function beginSolo(universe) {
  if(!catalog.length) return;
  clearTimeout(soloTimer);
  const split=main.querySelector('[name=soloSplit]')?.value||(solo?.universe===universe?solo.requested:'men');
  const mode=['men','women'].includes(split)?split:'mixed';
  try {solo=startSolo(catalog,universe,mode,split);}
  catch(error) {notify(fail(error));return;}
  queueSoloReveal();
  main.querySelector('h1').focus();
}
function downloadJson(data,filename) {
  const file=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const link=document.createElement('a');
  link.href=file;
  link.download=filename;
  link.click();
  setTimeout(()=>URL.revokeObjectURL(file),1000);
}
function exportAction(action) {
  const {match,events}=current();
  const {teams,history}=matchView(events,match.pool), {cards,discussion,stip}=results(match,teams);
  const result=compare(cards,stip);
  if(action==='copyTeams') return copy(teamText(cards,names()),'Teams copied.');
  if(action==='copyPrompt') return copy(discussionPrompt(cards,names(),stip,result,discussion),'Discussion prompt copied.');
  if(action==='shareResult') return share(`Rival Roster · ${stipulations[stip]}\n\n${teamText(cards,names())}\n\nRoster scores: ${result.scores.map(v=>v.toFixed(1)).join(' – ')}`);
  const data={
    room:code,match:match.number,config:match.config,players:names(),teams:cards,
    history:history.map(({kind,at,card,amount,recipient,s})=>({kind,at,card,amount,recipient,award:s.award,price:s.price})),
    debate:{stipulation:stipulations[stip],entries:discussion},comparison:result,
  };
  downloadJson(data,`rival-roster-${code}-${match.number+1}.json`);
}
document.addEventListener('click',event=>{
  if(event.target===dialog){dialog.close();return;}
  const target=event.target.closest('[data-action]');
  if (!target||target.disabled) return;
  const {action,mode,id,kind}=target.dataset;
  switch(action){
    case 'home': case 'soloMenu':setLanding(action);break;
    case 'multiplayer':setLanding(action);resumeRoom().catch(error=>notify(fail(error)));break;
    case 'soloStart':beginSolo(target.dataset.universe);break;
    case 'soloPick':
      if(solo&&automaticSide(solo)===null&&assignSolo(solo,Number(target.dataset.index),Number(target.dataset.side))) {
        queueSoloReveal();
        (main.querySelector('[data-action=soloPick]')??main.querySelector('h1')).focus();
      }
      break;
    case 'soloCopy': case 'soloExport': {
      const teams=solo.teams.map(team=>team.map(({id})=>lookup.get(id)));
      if(action==='soloCopy') copy(teamText(teams,soloNames),'Teams copied.');
      else downloadJson({mode:'solo',universe:solo.universe,composition:solo.composition,teams,history:solo.history,comparison:compare(teams)},'rival-roster-solo.json');
      break;
    }
    case 'create':case 'join':entry(action,mode);break;
    case 'closeDialog':dialog.close();break;
    case 'library':showLibrary();break;
    case 'libraryPage':library.page+=Number(target.dataset.step);fillLibrary();break;
    case 'details':{const card=lookup.get(id);if(card) modal(title(card),characterDetails(card));break;}
    case 'sound':setSound();break;
    case 'leave':modal('Leave room?',`<p>Your seat is saved on this browser. Keep your room code to return.</p>${button('Leave room','confirmLeave','primary')}`);break;
    case 'confirmLeave':leave();break;
    case 'copyInvite':copy(invite(),'Room link copied.');break;
    case 'shareInvite':share('Join my Rival Roster room '+code+'\n'+invite());break;
    case 'saveProposal':configuration(main.querySelector('#proposal-form'),false);break;
    case 'move':{
      const options={};
      for(const key of ['amount','recipient','card']) if(target.dataset[key]!==undefined) options[key]=Number(target.dataset[key]);
      move(kind,options);
      break;
    }
    case 'customBid':{
      const {match,s,event:latest}=current(), minimum=bidFloor(match,s), maximum=remainingBudget(s,match.config,side);
      modal('Place a custom bid',`<form id="bid-form" class="form-stack" data-revision="${match.number}:${latest.seq}"><label>Fictional credits (₹)<input type="number" name="amount" min="${minimum}" max="${maximum}" value="${minimum}" required></label><button class="button primary" type="submit">Place bid</button></form>`);
      break;
    }
    case 'askReset':modal('Request a match reset?',`<p>Your opponent must approve before this match ends.</p>${button('Request reset','confirmReset','primary')}`);break;
    case 'confirmReset':dialog.close();move('askReset');break;
    case 'rematch':rematch={number:current().match.number};render(true);main.scrollIntoView({block:'start'});break;
    case 'cancelRematch':rematch=false;render(true);break;
    case 'copyTeams':case 'copyPrompt':case 'shareResult':case 'download':exportAction(action);break;
  }
});
document.addEventListener('submit',event=>{
  event.preventDefault();
  const form=event.target, data=new FormData(form);
  switch(form.id){
    case 'entry-form':entrySubmit(form);break;
    case 'proposal-form':configuration(form,true);break;
    case 'bid-form':{
      dialog.close();
      const {match,event:latest}=current();
      if(form.dataset.revision!==match.number+':'+latest.seq) return notify('The auction changed. Open a new custom bid.');
      move('bid',{amount:Number(data.get('amount'))});
      break;
    }
    case 'discussion-form':{
      if(locked()) return notify('Wait for the room to reconnect.');
      const entry=Object.fromEntries(Object.entries(blankDiscussion).map(([key,base])=>[
        key,typeof base==='boolean'?data.has(key):typeof base==='number'?Number(data.get(key)):String(data.get(key)||'').trim(),
      ]));
      saveDiscussion(api,code,current().match,entry).then(()=>notify('Discussion saved.')).catch(error=>notify(fail(error)));
      break;
    }
  }
});
document.addEventListener('input',event=>{
  if(event.target.name==='libraryQuery') {library.query=event.target.value;library.page=0;fillLibrary();}
});
document.addEventListener('change',event=>{
  const field=event.target;
  if(field.name==='libraryUniverse'||field.name==='libraryFilter'){
    library[field.name==='libraryUniverse'?'universe':'filters']=field.value;library.page=0;fillLibrary();
  }
  if(field.name==='mode') syncSettings(field.form,field.value);
  if(field.form?.id==='proposal-form'&&['size','universe','filters','exclude'].includes(field.name)) syncComposition(field.form);
});
document.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon);});
updateSoundButton();render();
setInterval(tick,150);
try {
  catalog=await loadCatalog();
  lookup=new Map(catalog.map(c=>[c.id,c]));
  if(!solo) {fillLibrary();render(true);}
  loadRetiredCatalog().then(cards=>{for(const card of cards) lookup.set(card.id,card);if(room) render(true);}).catch(()=>{});

  if(inviteCode) await resumeRoom();
} catch(error){notify(fail(error));}
