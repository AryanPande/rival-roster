import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applyEvent,defaults,isUsed,matchView,remainingBudget,LIMIT} from '../js/engine.js';
import {filtered,makePool} from '../js/characters.js';
import {compare} from '../js/comparison.js';

const catalog=(await Promise.all(['wrestlers','superheroes'].map(async name=>JSON.parse(await readFile(new URL('../data/'+name+'.json',import.meta.url)))))).flat();
function game(options={}) {
  const config={...defaults,first:0,...options};
  const match={config,...makePool(catalog,config,LIMIT)};
  const events=[];
  let time=100000;
  const move=(kind,side=0,opts={})=>{
    const event=applyEvent(match,events,kind,{actor:'user'+side,side,now:time,...opts});
    events.push(event);return event.s;
  };
  move('start',0,{recipient:0});
  return {match,events,move,s:()=>events.at(-1).s,at:value=>{time=value;},teams:()=>matchView(events,match.pool).teams};
}
test('blind turns alternate independently of the recipient and fill exactly five slots each',()=>{
  const g=game();
  assert.throws(()=>g.move('assign',1,{recipient:0}));
  g.move('assign',0,{recipient:0});
  g.move('assign',1,{recipient:1});
  g.move('assign',0,{recipient:1});
  g.move('assign',1,{recipient:0});
  for(let i=0;i<3;i++) g.move('assign',g.s().turn,{recipient:0});
  assert.deepEqual([g.s().n0,g.s().n1],[5,2]);
  assert.throws(()=>g.move('assign',g.s().turn,{recipient:0}));
  for(let i=0;i<3;i++) g.move('autoAssign');
  assert.equal(g.s().phase,'done');
  assert.deepEqual(g.teams().map(t=>t.length),[5,5]);
  assert.equal(new Set(g.teams().flat().map(c=>c.id)).size,10);
  assert.throws(()=>g.move('autoAssign'));
});
test('snake, straight picks, duplicate prevention, and deterministic timeout',()=>{
  for(const snake of [false,true]) {
    const g=game({mode:'picks',size:3,snake,pickTime:5});
    const expected=snake?[0,1,1,0,0,1]:[0,1,0,1,0,1];
    for (const [card,side] of expected.entries()){
      assert.equal(g.s().turn,side);
      if(card) assert.throws(()=>g.move('pick',side,{card:card-1}));
      g.move('pick',side,{card});
    }
    assert.deepEqual(g.teams().map(t=>t.length),[3,3]);
  }
  const g=game({mode:'picks',pickTime:5});
  g.at(g.s().deadline);
  assert.throws(()=>g.move('pick',0,{card:0}));
  assert.throws(()=>g.move('autoPick',1,{card:1}));
  g.move('autoPick',1,{card:0});
  assert(isUsed(g.s().used,0));
});
test('auction budget protection, increments, anti-sniping, permanent passing and charged winner',()=>{
  const g=game({mode:'auction'});
  assert.deepEqual([g.s().m0,g.s().m1],[100,100]);
  assert.equal(remainingBudget(g.s(),g.match.config,0),96);
  assert.throws(()=>g.move('bid',0,{amount:97}));
  assert.throws(()=>g.move('bid',0,{amount:1.25}));
  assert.throws(()=>g.move('bid',0,{amount:1,now:g.s().deadline}));
  g.move('bid',0,{amount:15});
  assert.throws(()=>g.move('bid',0,{amount:16}));
  assert.throws(()=>g.move('bid',1,{amount:15}));
  const deadline=g.s().deadline;
  g.at(deadline-1000);g.move('bid',1,{amount:20});
  assert.equal(g.s().deadline,deadline+4000);
  g.move('bid',0,{amount:25});
  g.move('pass',1);
  assert.throws(()=>g.move('bid',1,{amount:26}));
  assert.throws(()=>g.move('close'));
  g.move('pass',0);g.move('close',1);
  assert.deepEqual([g.s().m0,g.s().m1,g.s().price],[75,100,25]);
  assert.equal(g.teams()[0].length,1);
});
test('unsold lots exhaust the surplus, reserve fills rosters, full teams cannot bid',()=>{
  const g=game({mode:'auction',size:2,manual:true});
  function closeUnsold() {
    if(g.s().n0<2) g.move('pass',0);
    if(g.s().n1<2) g.move('pass',1);
    g.move('close');
    assert.equal(g.s().award,-1);
    g.move('advance');
  }
  for(let i=0;i<2;i++){
    g.move('bid',0,{amount:1});g.move('pass',0);g.move('pass',1);g.move('close');
    g.move('advance');
  }
  assert.throws(()=>g.move('bid',0,{amount:1}));
  while(g.match.count-g.s().round>2) closeUnsold();
  g.move('reserve');g.move('advance');g.move('reserve');
  assert.equal(g.s().phase,'done');
  assert.deepEqual(g.teams().map(t=>t.length),[2,2]);
  assert.deepEqual([g.s().m0,g.s().m1],[98,98]);
});
test('nominations use only available cards and undo/reset require separate players',()=>{
  const g=game({mode:'auction',nominate:true,manual:true});
  assert.throws(()=>g.move('nominate',1,{card:2}));
  g.move('nominate',0,{card:2});
  g.move('pass',0);g.move('pass',1);g.move('close');g.move('advance');
  assert.throws(()=>g.move('nominate',1,{card:2}));
  g.move('nominate',1,{card:5});
  g.move('askUndo',1);
  assert.throws(()=>g.move('undo',1));
  assert.throws(()=>g.move('bid',0,{amount:1}));
  g.move('undo',0);
  assert.equal(g.s().phase,'nominate');
  g.at(g.s().deadline);
  assert.throws(()=>g.move('autoNominate',0,{card:1}));
  g.move('autoNominate',0,{card:0});
  assert.equal(g.s().index,0);
  assert.throws(()=>g.move('askReset',1));
  g.move('askReset',0);g.move('reset',1);
  assert.equal(g.s().phase,'reset');
});
test('catalog counts, versions, filters and comparison are deterministic',()=>{
  for(const universe of ['wrestling','comics']){
    const list=filtered(catalog,{universe});
    assert(new Set(list.map(c=>c.identity)).size>=100);
    assert(list.every(c=>c.description&&Object.values(c.ratings).every(v=>Number.isFinite(v)&&v>0&&v<=100)));
  }
  assert.equal(catalog.length,new Set(catalog.map(c=>c.id)).size);
  const sting=filtered(catalog,{query:'sting',universe:'wrestling',filters:'promotion:WCW'});
  assert(sting.some(c=>c.id==='sting'&&c.version==='Standard'));
  assert(!sting.some(c=>c.version==='Crow'));
  assert(catalog.some(c=>c.id==='iron-man--mcu'));
  assert.equal(filtered(catalog,{query:'sting',universe:'wrestling',exclude:'sting'}).length,0);
  assert.throws(()=>makePool(catalog,{...defaults,universe:'custom',custom:'sting,sting--crow'},LIMIT));
  const teams=[catalog.slice(0,5),catalog.slice(-5)];
  const result=compare(teams,6);
  assert.deepEqual(compare(teams,6),result);
  assert(result.stats.some(r=>r.weight>1));
  assert(result.scores.every(Number.isFinite));
});
