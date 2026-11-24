import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {copyFileSync,mkdirSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {characterDetails} from '../js/views.js';

const repo=path=>new URL('../'+path,import.meta.url);
const json=path=>JSON.parse(readFileSync(repo(path)));
const wrestlers=json('data/wrestlers.json');
const comics=json('data/superheroes.json');
const retired=json('data/retired-wrestlers.json');
const seed=json('firebase/catalog.seed.json');

test('active catalog and archive preserve distinct IDs and Firebase mappings',()=>{
  const all=[...wrestlers,...comics,...retired];
  assert.equal(new Set(all.map(card=>card.id)).size,all.length);
  assert.equal(wrestlers.length,154);
  assert.equal(new Set(wrestlers.map(card=>card.identity)).size,154);
  assert(wrestlers.every(card=>card.version==='Standard'));
  assert.deepEqual(comics.filter(card=>card.version!=='Standard').map(card=>card.id),
    ['magneto--classic','iron-man--mcu','iron-man--comics']);
  assert(retired.some(card=>card.id==='sting--crow'));
  assert.deepEqual(seed,Object.fromEntries(all.map(card=>[card.id,card.identity])));
  assert.deepEqual(json('firebase/seed.json'),{catalog:seed});
});

test('wrestling Raven and comic Raven render their distinct profiles',()=>{
  const wrestler=wrestlers.find(card=>card.id==='wrestler-raven');
  const comic=comics.find(card=>card.id==='raven');
  assert.equal(wrestler.identity,'wrestler-raven');
  assert.equal(comic.identity,'raven');
  assert.match(characterDetails(wrestler),/Signature moves/);
  assert.match(characterDetails(comic),/Primary abilities/);
});

test('catalog generation is byte-for-byte reproducible in a disposable folder',()=>{
  const temp=mkdtempSync(join(tmpdir(),'rival-catalog-'));
  try {
    for(const dir of ['tools','data','firebase']) mkdirSync(join(temp,dir));
    for(const input of ['catalog.mjs','wrestlers.json','retired-wrestlers.json','comics.txt']) {
      copyFileSync(repo('tools/'+input),join(temp,'tools',input));
    }
    execFileSync(process.execPath,[join(temp,'tools/catalog.mjs')]);
    for(const artifact of ['data/wrestlers.json','data/superheroes.json','data/retired-wrestlers.json','firebase/catalog.seed.json','firebase/seed.json']) {
      assert.deepEqual(readFileSync(join(temp,artifact)),readFileSync(repo(artifact)),artifact);
    }
  } finally {rmSync(temp,{recursive:true,force:true});}
});
