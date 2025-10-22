"use strict";

function checkWinner(board){
  const b = board || Array(9).fill(null);
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (const [a,bx,c] of lines){
    const va = b[a], vb = b[bx], vc = b[c];
    if (va && va===vb && vb===vc) return va;
  }
  if (b.every(v => v==='X' || v==='O')) return 'draw';
  return null;
}

function isValidMove(board, index){
  const i = Number(index);
  if (!Number.isInteger(i) || i<0 || i>8) return false;
  const b = board || Array(9).fill(null);
  return b[i]===null || typeof b[i]==='undefined';
}

module.exports = { checkWinner, isValidMove };
