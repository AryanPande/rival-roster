import {isUsed,remainingBudget} from './engine.js';
const openSlot=(s,size,side)=>s[side===0?'n0':'n1']<size;
export const reserveLot=(match,s)=>match.count-s.round===2*match.config.size-s.n0-s.n1;
const passed=(s,side)=>Boolean(s.passed & (side===0?1:2));
export const bidFloor=(match,s)=>s.leader<0?match.config.minimum:s.bid+match.config.increment;
export const closeAllowed=(match,s,time)=>time>=s.deadline||s.passed===3||
  (!openSlot(s,match.config.size,0)&&s.passed===2)||(!openSlot(s,match.config.size,1)&&s.passed===1);
export function showAuction(match,event,{side,card,button,names,escape}) {
  const {s}=event,{config}=match;
  const max=remainingBudget(s,config,side);
  const floor=bidFloor(match,s);
  const allowed=openSlot(s,config.size,side)&&!passed(s,side);
  const reserve=reserveLot(match,s);
  if (s.phase==='nominate') {
    const who=openSlot(s,config.size,s.turn)?s.turn:1-s.turn;
    return `<div class="play-title"><div><p class="eyebrow">LIVE AUCTION</p><h1>${who===side?'Nominate a character':escape(names[who])+' nominates'}</h1></div></div>
    <div class="clock" data-deadline="${s.deadline}" data-total="${config.seconds}"><span data-clock></span><div class="clock-track"><i data-progress></i></div></div>
    <div class="pick-grid">${Array.from({length:match.count},(_,i)=>isUsed(s.used,i)?'':`<div>${card(i)}
    ${button('Nominate','move','secondary',{kind:'nominate',card:i,disabled:who!==side,time:true})}</div>`).join('')}</div>`;
  }
  if (s.phase==='settled') return `<div class="play-title"><div><p class="eyebrow">LIVE AUCTION</p><h1>Lot settled</h1></div></div>
  <div class="reveal-stage settled">${card(s.index,true)}<span class="sold">${s.leader<0&&s.bid===0&&s.price===0?'UNSOLD':'SOLD'}</span></div>
  <p class="auction-note">${s.price>0?'Sold for ₹'+s.price+' fictional credits.':'No bids were placed.'}</p>
  ${config.manual?button('Next lot','move','primary',{kind:'advance'}):'<p class="subtle auction-note">The next lot is opening.</p>'}`;
  const enabled=allowed&&side!==s.leader&&!reserve;
  return `<div class="play-title"><div><p class="eyebrow">LIVE AUCTION</p><h1>Lot ${s.round+1} of ${match.count}</h1></div><span class="pill">Fictional credits</span></div>
  ${reserve?'':`<div class="clock" data-deadline="${s.deadline}" data-total="${config.seconds}"><span data-clock></span><div class="clock-track"><i data-progress></i></div></div>`}
  <div class="reveal-stage">${card(s.index,true)}</div>
  ${reserve?'<p class="auction-note">Reserve lot · Assigned at the starting price to fill open slots.</p>':`
  <div class="bid-status"><div><span>Highest bid</span><strong>₹${s.bid}</strong></div><div><span>Leading bidder</span><strong>${s.leader<0?'No bids yet':escape(names[s.leader])}</strong></div><div><span>Your maximum</span><strong>₹${allowed?max:0}</strong></div></div>
  <div class="play-actions auction-actions">
    ${button(s.leader<0?'Bid ₹'+floor:'Bid +₹'+config.increment,'move','primary',{kind:'bid',amount:floor,disabled:!enabled||floor>max,time:true})}
    ${button('Bid +₹5','move','secondary',{kind:'bid',amount:Math.max(floor,s.bid+5),disabled:!enabled||Math.max(floor,s.bid+5)>max,time:true})}
    ${button('Custom bid','customBid','secondary',{disabled:!enabled||floor>max,time:true})}
    ${button(passed(s,side)?'Passed':'Pass','move','quiet',{kind:'pass',disabled:!allowed,time:true})}
  </div><p class="subtle auction-note">Passing ends your bidding for this lot. A leading bid stays in place.</p>`}`;
}
export function auctionAutomation(match,s,time) {
  if (s.phase==='settled'&&!match.config.manual&&time>=s.deadline+2250) return ['advance',{}];
  if (s.phase==='nominate'&&time>=s.deadline) {
    const card=Array.from({length:match.count},(_,i)=>i).find(i=>!isUsed(s.used,i));
    return ['autoNominate',{card}];
  }
  if (s.phase!=='auction') return null;
  if(reserveLot(match,s)) return ['reserve',{}];
  if(closeAllowed(match,s,time)) return ['close',{}];
  return null;
}
