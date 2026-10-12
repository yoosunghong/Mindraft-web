// Shared deterministic rules. The server owns scoring; the browser uses these for previews.
export const rotateCells = (cells, turns=1) => {
  let out=cells.map(p=>[...p]);
  for(let i=0;i<turns%4;i++){out=out.map(([x,y])=>[-y,x]);const x=Math.min(...out.map(p=>p[0])),y=Math.min(...out.map(p=>p[1]));out=out.map(p=>[p[0]-x,p[1]-y]);}
  return out;
};
export function circuit(task, rotations){
  const ports=task.tiles.map((t,i)=>t.ports.map(p=>(p+rotations[i])%4));
  const live=new Set(),queue=ports[task.source].includes(3)?[task.source]:[];
  while(queue.length){const i=queue.shift();if(live.has(i)||task.tiles[i].broken)continue;live.add(i);
    for(const p of ports[i]){const x=i%task.size,y=Math.floor(i/task.size),nx=x+[0,1,0,-1][p],ny=y+[-1,0,1,0][p],n=ny*task.size+nx;
      if(nx>=0&&nx<task.size&&ny>=0&&n<task.tiles.length&&ports[n].includes((p+2)%4)&&!live.has(n))queue.push(n);}}
  const power=[...live].reduce((s,i)=>s+task.tiles[i].cost,0),connected=live.has(task.goal)&&ports[task.goal].includes(1);
  const required=task.required.every(i=>live.has(i));
  return {live:[...live],power,connected,required,success:connected&&required&&power<=task.budget};
}
export function cargoBoard(task, placements){
  const board=Array(task.size**2).fill(-1);task.obstacles.forEach(i=>board[i]=-2);
  for(let i=0;i<placements.length;i++){const p=placements[i];if(p==null)continue;
    if(!Number.isInteger(p.x)||!Number.isInteger(p.y)||!Number.isInteger(p.r)||p.r<0||p.r>3)return null;
    for(const [dx,dy] of rotateCells(task.pieces[i].cells,p.r)){const x=p.x+dx,y=p.y+dy,n=y*task.size+x;if(x<0||x>=task.size||y<0||y>=task.size||board[n]!==-1)return null;board[n]=i;}}
  return board;
}
export function signalTargets(task){return task.sequence.filter(s=>!s.decoy&&!(s.ignore===s.key));}
