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
