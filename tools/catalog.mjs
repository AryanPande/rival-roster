import {readFileSync,writeFileSync} from 'node:fs';
const read = name => readFileSync(new URL(name,import.meta.url),'utf8').trim().split('\n').map(line=>line.split('|'));
const write = (name,data) => writeFileSync(new URL(name,import.meta.url), JSON.stringify(data,null,2)+'\n');
const slug = name => name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const list = text => text.split(',').map(v=>v.trim());
const comicProfiles = {
  Tactician:[91,52,66,68,83,65,81], Warrior:[75,68,79,77,95,71,84],
  Cosmic:[77,95,86,94,76,95,75], Speedster:[76,64,96,67,78,81,83],
  Psychic:[90,61,70,74,72,94,84], Mystic:[88,62,73,78,74,94,80],
  Blaster:[75,76,81,81,75,92,81], Bruiser:[63,93,63,94,76,80,72],
};
function ratings(names,baseline,id) {
  // Small, reproducible variation within authored playstyle profiles.
  return Object.fromEntries(names.map((key,i)=>{
    const hash=[...id].reduce((sum,ch)=>((sum*33)^ch.charCodeAt(0))>>>0,5381+i*101);
    return [key,Math.max(1,Math.min(99,baseline[i]+hash%9-4))];
  }));
}
const readJson = name => JSON.parse(readFileSync(new URL(name,import.meta.url),'utf8'));
const wrestlers=readJson('wrestlers.json');
const comics=read('comics.txt').map(([name,publisher,alignment,abilities,style,description])=>{
  const id=slug(name);
  return {id,identity:id,name,universe:'comics',version:'Standard',publisher,alignment,abilities:list(abilities),
    ratings:ratings(['intelligence','strength','speed','durability','combat','power','teamwork'],comicProfiles[style],id),description:description+'.'};
});
const versions=[
  ['magneto','Classic','power',5],['iron-man','MCU','teamwork',5],['iron-man','Comics','power',5],
];
for (const [base,version,key,delta] of versions) {
  const card=comics.find(c=>c.id===base);
  comics.push({...card,id:`${base}--${slug(version)}`,version,ratings:{...card.ratings,
    [key]:Math.min(100,card.ratings[key]+delta)}});
}
const active=[...wrestlers,...comics];
const activeIds=new Set(active.map(c=>c.id));
const retired=readJson('retired-wrestlers.json');
const all=[...active,...retired];
if (wrestlers.length!==154 || new Set(wrestlers.map(c=>c.identity)).size!==154 ||
    wrestlers.some(c=>c.universe!=='wrestling'||c.version!=='Standard'||c.id!==c.identity) ||
    new Set(all.map(c=>c.id)).size!==all.length || retired.some(c=>activeIds.has(c.id))) {
  throw new Error('Invalid wrestling roster or duplicate card ID');
}
const catalog=Object.fromEntries(all.map(c=>[c.id,c.identity]));
write('../data/wrestlers.json',wrestlers);
write('../data/superheroes.json',comics);
write('../data/retired-wrestlers.json',retired);
write('../firebase/catalog.seed.json',catalog);
write('../firebase/seed.json',{catalog});
console.log(wrestlers.length,comics.length,retired.length,'active wrestlers, active comics and retired wrestling cards');
