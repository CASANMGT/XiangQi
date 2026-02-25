/**
 * Xiangqi (Chinese Chess) Game Logic
 */

export type PieceType = 'K' | 'A' | 'E' | 'H' | 'R' | 'C' | 'P'; // King, Advisor, Elephant, Horse, Chariot, Cannon, Soldier
export type Side = 'red' | 'black';

export interface Piece {
  type: PieceType;
  side: Side;
}

export type Board = (Piece | null)[][];

export const INITIAL_BOARD: Board = [
  [
    { type: 'R', side: 'black' }, { type: 'H', side: 'black' }, { type: 'E', side: 'black' }, { type: 'A', side: 'black' }, { type: 'K', side: 'black' }, { type: 'A', side: 'black' }, { type: 'E', side: 'black' }, { type: 'H', side: 'black' }, { type: 'R', side: 'black' }
  ],
  [null, null, null, null, null, null, null, null, null],
  [null, { type: 'C', side: 'black' }, null, null, null, null, null, { type: 'C', side: 'black' }, null],
  [{ type: 'P', side: 'black' }, null, { type: 'P', side: 'black' }, null, { type: 'P', side: 'black' }, null, { type: 'P', side: 'black' }, null, { type: 'P', side: 'black' }],
  [null, null, null, null, null, null, null, null, null],
  // River
  [null, null, null, null, null, null, null, null, null],
  [{ type: 'P', side: 'red' }, null, { type: 'P', side: 'red' }, null, { type: 'P', side: 'red' }, null, { type: 'P', side: 'red' }, null, { type: 'P', side: 'red' }],
  [null, { type: 'C', side: 'red' }, null, null, null, null, null, { type: 'C', side: 'red' }, null],
  [null, null, null, null, null, null, null, null, null],
  [
    { type: 'R', side: 'red' }, { type: 'H', side: 'red' }, { type: 'E', side: 'red' }, { type: 'A', side: 'red' }, { type: 'K', side: 'red' }, { type: 'A', side: 'red' }, { type: 'E', side: 'red' }, { type: 'H', side: 'red' }, { type: 'R', side: 'red' }
  ],
];

export interface Position {
  r: number;
  c: number;
}

export function isValidMove(board: Board, from: Position, to: Position, turn: Side): boolean {
  if (from.r === to.r && from.c === to.c) return false;

  const piece = board[from.r][from.c];
  if (!piece || piece.side !== turn) return false;

  const target = board[to.r][to.c];
  if (target && target.side === turn) return false;

  const dr = to.r - from.r;
  const dc = to.c - from.c;
  const absDr = Math.abs(dr);
  const absDc = Math.abs(dc);

  switch (piece.type) {
    case 'K': // King
      if (absDr + absDc !== 1) return false;
      // Must stay in palace
      if (to.c < 3 || to.c > 5) return false;
      if (piece.side === 'red') {
        if (to.r < 7 || to.r > 9) return false;
      } else {
        if (to.r < 0 || to.r > 2) return false;
      }
      break;

    case 'A': // Advisor
      if (absDr !== 1 || absDc !== 1) return false;
      // Must stay in palace
      if (to.c < 3 || to.c > 5) return false;
      if (piece.side === 'red') {
        if (to.r < 7 || to.r > 9) return false;
      } else {
        if (to.r < 0 || to.r > 2) return false;
      }
      break;

    case 'E': // Elephant
      if (absDr !== 2 || absDc !== 2) return false;
      // Cannot cross river
      if (piece.side === 'red' && to.r < 5) return false;
      if (piece.side === 'black' && to.r > 4) return false;
      // Eye of elephant blocked?
      if (board[from.r + dr / 2][from.c + dc / 2]) return false;
      break;

    case 'H': // Horse
      if (!((absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2))) return false;
      // Horse leg blocked?
      if (absDr === 2) {
        if (board[from.r + dr / 2][from.c]) return false;
      } else {
        if (board[from.r][from.c + dc / 2]) return false;
      }
      break;

    case 'R': // Chariot
      if (dr !== 0 && dc !== 0) return false;
      if (countPiecesBetween(board, from, to) !== 0) return false;
      break;

    case 'C': // Cannon
      if (dr !== 0 && dc !== 0) return false;
      const count = countPiecesBetween(board, from, to);
      if (target) {
        if (count !== 1) return false; // Must jump over exactly one piece to capture
      } else {
        if (count !== 0) return false; // Must have clear path to move
      }
      break;

    case 'P': // Soldier
      if (piece.side === 'red') {
        if (dr === -1 && dc === 0) return true; // Forward
        if (from.r <= 4 && dr === 0 && absDc === 1) return true; // Sideways after river
      } else {
        if (dr === 1 && dc === 0) return true; // Forward
        if (from.r >= 5 && dr === 0 && absDc === 1) return true; // Sideways after river
      }
      return false;
  }

  return true;
}

function countPiecesBetween(board: Board, from: Position, to: Position): number {
  let count = 0;
  if (from.r === to.r) {
    const start = Math.min(from.c, to.c);
    const end = Math.max(from.c, to.c);
    for (let c = start + 1; c < end; c++) {
      if (board[from.r][c]) count++;
    }
  } else if (from.c === to.c) {
    const start = Math.min(from.r, to.r);
    const end = Math.max(from.r, to.r);
    for (let r = start + 1; r < end; r++) {
      if (board[r][from.c]) count++;
    }
  }
  return count;
}

export function isCheck(board: Board, side: Side): boolean {
  // Find king
  let kingPos: Position | null = null;
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (p && p.type === 'K' && p.side === side) {
        kingPos = { r, c };
        break;
      }
    }
    if (kingPos) break;
  }

  if (!kingPos) return false;

  const opponentSide: Side = side === 'red' ? 'black' : 'red';
  
  // Check for Chariots, Cannons, and Kings (Flying General)
  // These are the most common check sources and can be checked along lines
  
  // Check horizontal and vertical from king
  const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  for (const [dr, dc] of directions) {
    let piecesBetween = 0;
    let currR = kingPos.r + dr;
    let currC = kingPos.c + dc;
    
    while (currR >= 0 && currR < 10 && currC >= 0 && currC < 9) {
      const p = board[currR][currC];
      if (p) {
        if (p.side === opponentSide) {
          if (p.type === 'R' || p.type === 'K') {
            if (piecesBetween === 0) return true;
          } else if (p.type === 'C') {
            if (piecesBetween === 1) return true;
          }
          // Any opponent piece blocks further checks along this line (except Cannon which needs 1)
          if (piecesBetween >= 1) break; 
          piecesBetween++;
        } else {
          // Own piece blocks
          piecesBetween++;
          if (piecesBetween > 1) break;
        }
      }
      currR += dr;
      currC += dc;
    }
  }

  // Check for Horses
  const horseDirs = [
    { h: [-2, -1], leg: [-1, 0] }, { h: [-2, 1], leg: [-1, 0] },
    { h: [2, -1], leg: [1, 0] }, { h: [2, 1], leg: [1, 0] },
    { h: [-1, -2], leg: [0, -1] }, { h: [1, -2], leg: [0, -1] },
    { h: [-1, 2], leg: [0, 1] }, { h: [1, 2], leg: [0, 1] }
  ];
  for (const d of horseDirs) {
    const hr = kingPos.r + d.h[0];
    const hc = kingPos.c + d.h[1];
    if (hr >= 0 && hr < 10 && hc >= 0 && hc < 9) {
      const p = board[hr][hc];
      if (p && p.type === 'H' && p.side === opponentSide) {
        // Check if horse leg is blocked
        const lr = kingPos.r + d.leg[0];
        const lc = kingPos.c + d.leg[1];
        if (!board[lr][lc]) return true;
      }
    }
  }

  // Check for Soldiers
  const soldierDirs = side === 'red' ? [[-1, 0], [0, 1], [0, -1]] : [[1, 0], [0, 1], [0, -1]];
  for (const [dr, dc] of soldierDirs) {
    const sr = kingPos.r + dr;
    const sc = kingPos.c + dc;
    if (sr >= 0 && sr < 10 && sc >= 0 && sc < 9) {
      const p = board[sr][sc];
      if (p && p.type === 'P' && p.side === opponentSide) return true;
    }
  }

  return false;
}

export function getAllValidMoves(board: Board, side: Side): { from: Position; to: Position }[] {
  const moves: { from: Position; to: Position }[] = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = board[r][c];
      if (piece && piece.side === side) {
        for (let tr = 0; tr < 10; tr++) {
          for (let tc = 0; tc < 9; tc++) {
            if (isLegalMove(board, { r, c }, { r: tr, c: tc }, side)) {
              moves.push({ from: { r, c }, to: { r: tr, c: tc } });
            }
          }
        }
      }
    }
  }
  return moves;
}

export function isCheckmate(board: Board, side: Side): boolean {
  if (!isCheck(board, side)) return false;
  return getAllValidMoves(board, side).length === 0;
}

export function isStalemate(board: Board, side: Side): boolean {
  if (isCheck(board, side)) return false;
  return getAllValidMoves(board, side).length === 0;
}

export function isLegalMove(board: Board, from: Position, to: Position, turn: Side): boolean {
  if (!isValidMove(board, from, to, turn)) return false;
  
  // Try the move
  const newBoard = board.map(row => [...row]);
  newBoard[to.r][to.c] = newBoard[from.r][from.c];
  newBoard[from.r][from.c] = null;
  
  // Check if king is in check after move
  return !isCheck(newBoard, turn);
}
