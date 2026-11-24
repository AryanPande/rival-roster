export const labels = {
  promo:'Promo ability',technical:'Technical wrestling',strength:'Strength',speed:'Speed',hardcore:'Hardcore experience',endurance:'Endurance',
  star:'Star power',intelligence:'Intelligence',durability:'Durability',combat:'Combat skill',power:'Powers',teamwork:'Teamwork',
};
async function loadCards(name) {
  const response=await fetch(new URL('../data/'+name+'.json',import.meta.url));
  if (!response.ok) throw new Error('Could not load the character catalog. Refresh to retry.');
  return response.json();
}
export async function loadCatalog() {
  const lists=await Promise.all(['wrestlers','superheroes'].map(loadCards));
  return lists.flat();
}
export const loadRetiredCatalog=()=>loadCards('retired-wrestlers');
export const tag=(card)=>card.universe==='wrestling'?'Wrestling':card.publisher;
export const title=card=>!card?'Unknown character':card.version==='Standard' ? card.name : card.name+' · '+card.version;
export const groups = cards=>({
  promotions:[...new Set(cards.flatMap(c=>c.promotions||[]))].sort(),
  publishers:[...new Set(cards.map(c=>c.publisher).filter(Boolean))].sort(),
  alignments:['Hero','Villain','Antihero'],
});
export function filtered(cards,{universe='mixed',query='',filters='',exclude='',custom=''}={}) {
  const split=value=>value.split(',').map(v=>v.trim()).filter(Boolean);
  const tags=split(filters), exclusions=new Set(split(exclude)), customIds=new Set(split(custom));
  const q=query.toLowerCase().trim();
  const matches=(prefix,values)=>{
    const selected=tags.filter(t=>t.startsWith(prefix+':'));
    return !selected.length||values.some(v=>selected.includes(prefix+':'+v));
  };
  return cards.filter(card=>{
    if (universe==='custom'&&!customIds.has(card.id)) return false;
    if (!['custom','mixed'].includes(universe)&&universe!==card.universe) return false;
    if (exclusions.has(card.id)||exclusions.has(card.identity)) return false;
    if (q&&! [card.name,card.version,card.id,card.publisher,card.alignment,...card.promotions||[]].join(' ').toLowerCase().includes(q)) return false;
    return card.universe==='wrestling' ? matches('promotion',card.promotions) :
      matches('publisher',[card.publisher])&&matches('alignment',[card.alignment]);
  });
}
const sampleInteger=max=>{
  const buffer=new Uint32Array(1);
  const last=2**32-(2**32%max);
  do { crypto.getRandomValues(buffer); } while(buffer[0]>=last);
  return buffer[0]%max;
};
export const randomSide=()=>sampleInteger(2);
export function shuffle(cards) {
  const result=[...cards];
  for(let i=result.length-1;i>0;i--) {
    const j=sampleInteger(i+1);
    [result[i],result[j]]=[result[j],result[i]];
  }
  return result;
}
export function makePool(cards,config,limit) {
  const order=shuffle(filtered(cards,config));
  const used=new Set();
  const eligible=order.filter(c=>{
    const key=config.versions?c.id:c.identity;
    if(used.has(key)) return false;
    used.add(key);
    return true;
  });
  if(eligible.length<2*config.size) throw new Error(`Choose at least ${config.size*2} eligible identities.`);
  const cap=config.mode==='blind'?config.size*2:Math.min(limit,config.size*2+(config.mode==='auction'?8:6));
  const selected=eligible.slice(0,cap);
  return {
    count:selected.length,
    pool:Object.fromEntries(selected.map((c,i)=>[i,{i,id:c.id,bit:2**i}])),
    ids:Object.fromEntries(selected.map((c,i)=>[config.versions?c.id:c.identity,i])),
  };
}
