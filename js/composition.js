export const MAX_WOMEN=4;
export const splitLabel=(men,women)=>`${men}M-${women}W`;

export function compositionOptions(cards,size,mode) {
  const counts=Object.fromEntries(['men','women'].map(division=>[
    division,new Set(cards.filter(card=>card.universe==='wrestling'&&card.division===division).map(card=>card.identity)).size,
  ]));
  const quotas=mode==='mixed'?
    Array.from({length:Math.min(MAX_WOMEN,size-1)},(_,index)=>index+1):
    [mode==='women'?size:0];
  return quotas.map(women=>{
    const men=size-women;
    const shortfalls=['men','women'].filter(division=>counts[division]<2*(division==='men'?men:women)).map(division=>
      `Needs ${2*(division==='men'?men:women)} ${division} across both teams. ${counts[division]} available.`);
    if(women>MAX_WOMEN) shortfalls.unshift('A roster can contain at most four women.');
    return {men,women,reason:shortfalls.join(' ')};
  });
}

export function resolveComposition(cards,size,mode,requested,randomIndex) {
  if(!['men','women','mixed'].includes(mode)) throw new Error('Choose a wrestling division.');
  const options=compositionOptions(cards,size,mode);
  if(mode==='mixed'&&requested==='random') {
    const available=options.filter(option=>!option.reason);
    if(available.length) return available[randomIndex(available.length)];
    throw new Error(options.length?
      'No mixed split is available. '+options.map(({men,women,reason})=>splitLabel(men,women)+': '+reason).join(' '):
      'Mixed requires at least two wrestlers per team.');
  }
  const selected=mode==='mixed'?options.find(option=>String(option.women)===requested):options[0];
  if(!selected||selected.reason) throw new Error(selected?.reason||'Choose a valid wrestling split.');
  return selected;
}
