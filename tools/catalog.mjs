import {readFileSync,writeFileSync} from 'node:fs';
const read = name => readFileSync(new URL(name,import.meta.url),'utf8').trim().split('\n').map(line=>line.split('|'));
const write = (name,data) => writeFileSync(new URL(name,import.meta.url), JSON.stringify(data,null,2)+'\n');
const slug = name => name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const list = text => text.split(',').map(v=>v.trim());
const wrestlingProfiles = {
  Brawler:[83,75,88,70,87,86,84], Showman:[92,74,79,73,69,81,94],
  Powerhouse:[76,69,94,65,74,82,86], Technician:[77,95,77,78,69,91,81],
  'High-flyer':[74,78,68,95,78,85,85], Hybrid:[83,86,80,85,76,87,87],
  Hardcore:[83,68,79,75,96,91,87],
};
const comicProfiles = {
  Tactician:[91,52,66,68,83,65,81], Warrior:[75,68,79,77,95,71,84],
  Cosmic:[77,95,86,94,76,95,75], Speedster:[76,64,96,67,78,81,83],
  Psychic:[90,61,70,74,72,94,84], Mystic:[88,62,73,78,74,94,80],
  Blaster:[75,76,81,81,75,92,81], Bruiser:[63,93,63,94,76,80,72],
};
const styles = {
  Brawler:'pressures opponents with strikes and physical exchanges.', Showman:'builds momentum with crowd work and signature sequences.',
  Powerhouse:'uses strength to dictate position and finish exchanges.', Technician:'controls the pace through holds and precise counters.',
  'High-flyer':'creates openings with aerial attacks and rapid movement.',
  Hybrid:'mixes striking, grappling and aerial offense.', Hardcore:'keeps fighting through chaotic, physical matches.',
};
const weight = { 'rey-mysterio':'Cruiserweight',pac:'Cruiserweight','jushin-thunder-liger':'Junior heavyweight',
  'zack-sabre-jr':'Heavyweight', 'andre-the-giant':'Super heavyweight','big-show':'Super heavyweight',
  vader:'Super heavyweight', 'brock-lesnar':'Heavyweight', 'yoshihiro-tajiri':'Junior heavyweight' };
function ratings(names,baseline,id) {
  // Small, reproducible variation within authored playstyle profiles.
  return Object.fromEntries(names.map((key,i)=>{
    const hash=[...id].reduce((sum,ch)=>((sum*33)^ch.charCodeAt(0))>>>0,5381+i*101);
    return [key,Math.max(1,Math.min(99,baseline[i]+hash%9-4))];
  }));
}
const wrestlers=read('wrestlers.txt').map(([name,promotions,era,style,signatures,finisher])=>{
  const id=slug(name);
  return {id,identity:id,name,universe:'wrestling',version:'Standard',promotions:list(promotions),era,weightClass:weight[id]??null,style,
    signatures:list(signatures),finisher,ratings:ratings(['promo','technical','strength','speed','hardcore','endurance','star'],wrestlingProfiles[style],id),
    description:`${name} ${styles[style]}`};
});
const comics=read('comics.txt').map(([name,publisher,alignment,abilities,style,description])=>{
  const id=slug(name);
  return {id,identity:id,name,universe:'comics',version:'Standard',publisher,alignment,abilities:list(abilities),
    ratings:ratings(['intelligence','strength','speed','durability','combat','power','teamwork'],comicProfiles[style],id),description:description+'.'};
});
const versions=[
  ['samoa-joe','Prime TNA','technical',5],['jon-moxley','Death Rider','hardcore',5],['finn-balor','The Demon','power',5],
  ['sting','Prime WCW','endurance',5],['sting','Crow','star',4],['the-undertaker','Prime Undertaker','endurance',6],
  ['roman-reigns','Tribal Chief','promo',6],['magneto','Classic','power',5],['iron-man','MCU','teamwork',5],
  ['iron-man','Comics','power',5],
];
for (const [base,version,key,delta] of versions) {
  const group=wrestlers.some(c=>c.id===base)?wrestlers:comics;
  const card=group.find(c=>c.id===base);
  const activeKey=card.ratings[key] ? key : 'star';
  group.push({...card,id:`${base}--${slug(version)}`,version,ratings:{...card.ratings,
    [activeKey]:Math.min(100, card.ratings[activeKey]+delta)}});
}
const all=[...wrestlers,...comics];
if (new Set(all.map(c=>c.id)).size!==all.length || [wrestlers,comics].some(group=>new Set(group.map(c=>c.identity)).size<100)) {
  throw new Error('Invalid character count or duplicate ID');
}
write('../data/wrestlers.json',wrestlers);
write('../data/superheroes.json',comics);
write('../firebase/catalog.seed.json',Object.fromEntries(all.map(c=>[c.id,c.identity])));
write('../firebase/seed.json',{catalog:Object.fromEntries(all.map(c=>[c.id,c.identity]))});
console.log(wrestlers.length, comics.length, 'cards including versions');
