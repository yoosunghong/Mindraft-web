import { rotateCells } from '../public/puzzles.js';
// Independent exact-cover search verifies the authored cargo puzzles.
export function solveCargo(t){
 const occupied=new Set(t.obstacles),result=Array(t.pieces.length).fill(null);
 function search(i){if(i===t.pieces.length)return occupied.size===t.size*t.size;
  for(let r=0;r<4;r++){const shape=rotateCells(t.pieces[i].cells,r);for(let y=0;y<t.size;y++)for(let x=0;x<t.size;x++){
   if(shape.some(([dx,dy])=>x+dx>=t.size||y+dy>=t.size||occupied.has((y+dy)*t.size+x+dx)))continue;
   const cells=shape.map(([dx,dy])=>(y+dy)*t.size+x+dx);cells.forEach(n=>occupied.add(n));result[i]={x,y,r};if(search(i+1))return true;cells.forEach(n=>occupied.delete(n));
  }}result[i]=null;return false;
 }if(!search(0))throw Error('No cargo solution');return result;
}
