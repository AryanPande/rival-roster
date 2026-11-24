import {makePool,sampleInteger} from './characters.js';
import {MAX_WOMEN,resolveComposition} from './composition.js';

export const soloNames = ['Your team', 'Opponent'];
export const soloModes = {wrestling:'Wrestling · Keep or Let Go', comics:'Comics · Blind Draft'};
export const soloSize = 5;

export function startSolo(catalog, universe, mode='men', requested='random') {
  const size=universe==='wrestling'&&mode==='women'?MAX_WOMEN:soloSize;
  const config={universe,mode:'blind',size};
  const composition=universe==='wrestling'?resolveComposition(catalog,size,mode,requested,sampleInteger):null;
  if(composition) config.women=composition.women;
  const {pool}=makePool(catalog,config,2*size);
  const cards=Object.values(pool).map(card=>({...card,division:composition?(card.woman?'women':'men'):undefined}));
  return {universe,mode,requested,size,composition,ids:cards.map(card=>card.id),cards,teams:[[],[]],history:[],index:0};
}

export function soloSlots(game,side,division) {
  if(!game.composition) return game.size-game.teams[side].length;
  return game.composition[division]-game.teams[side].filter(card=>card.division===division).length;
}

export function automaticSide(game) {
  if(game.index>=game.cards.length) return null;
  const {division}=game.cards[game.index];
  if(!soloSlots(game,0,division)) return 1;
  if(!soloSlots(game,1,division)) return 0;
  return null;
}

export function assignSolo(game, index, side) {
  if(index!==game.index||index>=game.ids.length) return false;
  const automatic=automaticSide(game);
  const recipient=automatic??side;
  const {id,division}=game.cards[index];
  if((recipient!==0&&recipient!==1)||!soloSlots(game,recipient,division)) return false;
  game.teams[recipient].push({id,division});
  game.history.push({id,side:recipient,automatic:automatic!==null});
  game.index++;
  return true;
}
