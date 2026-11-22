import {isUsed} from './engine.js';
export function showDraft(match,event,{side,card,button}) {
  const {s,kind}=event;
  const {size,mode,pickTime}=match.config;
  const blind=mode==='blind';
  const choice=s.turn===side;
  const full=s.n0===size||s.n1===size;
  const available=choice&&(!blind||!full);
  const turnLabel=full&&blind?'Automatic assignment':choice?'Your turn':'Opponent’s turn';
  return `<div class="play-title"><div><p class="eyebrow">${blind?'BLIND DRAFT':'ALTERNATING PICKS'}</p><h1>${turnLabel}</h1></div>
  <span class="pill">${size*2-s.round} picks remaining</span></div>
  ${pickTime&&!full?`<div class="clock" data-deadline="${s.deadline}" data-total="${pickTime}"><span data-clock></span><div class="clock-track"><i data-progress></i></div></div>`:''}
  ${blind?`<div class="reveal-stage">${card(s.index,true)}</div><div class="play-actions">
    ${button('Recruit to my team','move','primary',{kind:'assign',recipient:side,disabled:!available})}
    ${button('Assign to opponent','move','secondary',{kind:'assign',recipient:1-side,disabled:!available})}
  </div>`:`<div class="pick-grid">${Array.from({length:match.count},(_,i)=>isUsed(s.used,i)?'':`<div>${card(i)}
    ${button('Draft character','move','secondary',{kind:'pick',card:i,disabled:!choice})}</div>`).join('')}</div>`}
  ${['assign','autoAssign','pick','autoPick'].includes(kind)?'<p class="subtle latest">Last pick recorded in draft history.</p>':''}`;
}
export const draftAutomation = (match,s,time) => {
  const {config:{size,mode},count}=match;
  if (s.phase!=='draft') return null;
  if (mode==='blind'&&(s.n0===size||s.n1===size)) return ['autoAssign',{}];
  if (!s.deadline||time<s.deadline) return null;
  if(mode==='blind') return ['autoAssign',{}];
  const card=Array.from({length:count},(_,i)=>i).find(i=>!isUsed(s.used,i));
  return ['autoPick',{card}];
};
