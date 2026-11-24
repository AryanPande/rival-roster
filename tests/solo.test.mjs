import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {assignSolo,automaticSide,startSolo} from '../js/solo.js';

const catalog=['wrestlers','superheroes'].flatMap(name=>JSON.parse(
  readFileSync(new URL('../data/'+name+'.json',import.meta.url))));
const profiles=new Map(catalog.map(card=>[card.id,card]));

for(const universe of ['wrestling','comics']) {
  for(const [scenario,decisions] of Object.entries({
    keep:[0,0,0,0,0], release:[1,1,1,1,1], mixed:[0,1,0,1,0,1,0,1,0],
  })) test(universe+' solo '+scenario,()=>{
    const game=startSolo(catalog,universe);
    assert.equal(game.ids.length,10);
    assert.equal(new Set(game.ids.map(id=>profiles.get(id).identity)).size,10);
    assert(game.ids.every(id=>profiles.get(id).universe===universe));
    for(const side of decisions) {
      assert.equal(automaticSide(game),null);
      const index=game.index;
      assert(assignSolo(game,index,side));
      assert(!assignSolo(game,index,side));
    }
    assert.equal(automaticSide(game),1-decisions.at(-1));
    while(game.index<game.ids.length) assert(assignSolo(game,game.index));
    assert.deepEqual(game.teams.map(team=>team.length),[5,5]);
    assert.equal(new Set(game.teams.flat().map(card=>card.id)).size,10);
    assert.deepEqual(game.history.map(move=>move.id),game.ids);
    assert.deepEqual(game.history.map(move=>move.automatic),game.ids.map((_,i)=>i>=decisions.length));
    assert(!assignSolo(game,game.index,0));
    const restart=startSolo(catalog,universe);
    assert.equal(restart.index,0);
    assert.deepEqual(restart.teams,[[],[]]);
    assert.deepEqual(restart.history,[]);
    assert.notEqual(restart.ids,game.ids);
  });
}

test('wrestling defaults to men and explicit mixed rosters stay aligned',()=>{
  const standard=startSolo(catalog,'wrestling');
  assert(standard.cards.every(card=>card.division==='men'));
  for(const [mode,requested,size,women] of [['women','women',4,4],['mixed','4',5,4],['mixed','1',5,1]]) {
    const match=startSolo(catalog,'wrestling',mode,requested);
    while(match.index<match.ids.length) assert(assignSolo(match,match.index,0));
    for(const team of match.teams) {
      assert.equal(team.length,size);
      assert.equal(team.filter(card=>card.division==='women').length,women);
    }
  }
});

test('mixed options adapt to size and Random excludes unavailable splits',async()=>{
  const {compositionOptions,resolveComposition}=await import('../js/composition.js');
  assert.deepEqual(compositionOptions(catalog,1,'mixed'),[]);
  assert.deepEqual(compositionOptions(catalog,8,'mixed').map(option=>option.women),[1,2,3,4]);
  const limited=[...catalog.filter(card=>card.division==='men'),...catalog.filter(card=>card.division==='women').slice(0,6)];
  assert.match(compositionOptions(limited,5,'mixed').at(-1).reason,/Needs 8 women.*6 available/);
  assert.equal(resolveComposition(limited,5,'mixed','random',size=>size-1).women,3);
  assert.throws(()=>resolveComposition(catalog,5,'women','women',()=>0),/at most four/);
});

test('mixed auction completes with a five-second reveal for the final automatic award',async()=>{
  const {defaults,applyEvent,matchView}=await import('../js/engine.js');
  const {auctionAutomation}=await import('../js/auction.js');
  const config={...defaults,universe:'wrestling',mode:'auction',size:2,women:1,manual:true};
  const pool=['asuka','bayley','kane','sting'].map((id,i)=>({id,i,woman:Number(i<2)}));
  const match={config,count:pool.length,pool};
  const events=[];
  let now=10000;
  const move=(kind,side=0,extra={})=>events.push(applyEvent(match,events,kind,{now,side,actor:String(side),...extra}));
  move('start',0,{recipient:0});
  for(let i=0;i<2;i++) {
    move('pass',0);
    move('pass',1);
    move('close');
    move('advance');
    move('compositionAssign');
    const state=events.at(-1).s;
    now+=4999;
    assert.equal(auctionAutomation(match,state,now),null);
    assert.throws(()=>move('advance'));
    now++;
    assert.deepEqual(auctionAutomation(match,state,now),['advance',{}]);
    move('advance');
  }
  assert.equal(events.at(-1).s.phase,'done');
  const {teams}=matchView(events,pool);
  assert.deepEqual(teams.map(team=>team.length),[2,2]);
  assert(teams.every(team=>team.filter(card=>profiles.get(card.id).division==='women').length===1));
});
