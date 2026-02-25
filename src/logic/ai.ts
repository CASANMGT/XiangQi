import { Board, Position, Side, Piece, isValidMove, isCheck, isLegalMove } from './xiangqi';

/**
 * Simple Xiangqi AI using Minimax with Alpha-Beta Pruning
 */

const PIECE_VALUES: Record<string, number> = {
  'K': 10000,
  'A': 200,
  'E': 200,
  'H': 450,
  'R': 900,
  'C': 450,
  'P': 100,
};

// Positional bonuses (from red's perspective)
const POSITION_BONUS: Record<string, number[][]> = {
  'P': [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [10, 20, 30, 40, 40, 40, 30, 20, 10],
    [10, 20, 30, 40, 40, 40, 30, 20, 10],
    [10, 20, 30, 40, 40, 40, 30, 20, 10],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  'R': [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [5, 10, 10, 10, 10, 10, 10, 10, 5],
    [0, 0, 5, 5, 5, 5, 5, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 5, 5, 5, 5, 5, 0, 0],
    [5, 10, 10, 10, 10, 10, 10, 10, 5],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  'H': [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 5, 10, 5, 0, 5, 10, 5, 0],
    [0, 10, 15, 10, 5, 10, 15, 10, 0],
    [0, 5, 10, 15, 10, 15, 10, 5, 0],
    [0, 5, 10, 10, 10, 10, 10, 5, 0],
    [0, 5, 10, 10, 10, 10, 10, 5, 0],
    [0, 5, 10, 15, 10, 15, 10, 5, 0],
    [0, 10, 15, 10, 5, 10, 15, 10, 0],
    [0, 5, 10, 5, 0, 5, 10, 5, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ]
};

function evaluateBoard(board: Board, side: Side): number {
  let score = 0;
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = board[r][c];
      if (piece) {
        let val = PIECE_VALUES[piece.type];
        
        // Add positional bonus
        const bonusTable = POSITION_BONUS[piece.type];
        if (bonusTable) {
          const actualRow = piece.side === 'red' ? r : 9 - r;
          val += bonusTable[actualRow][c];
        }

        if (piece.side === side) {
          score += val;
        } else {
          score -= val;
        }
      }
    }
  }
  return score;
}

interface Move {
  from: Position;
  to: Position;
  score?: number;
}

function getAllValidMoves(board: Board, side: Side): Move[] {
  const moves: Move[] = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = board[r][c];
      if (piece && piece.side === side) {
        const from = { r, c };
        
        switch (piece.type) {
          case 'K':
          case 'A': {
            const rRange = piece.side === 'red' ? [7, 8, 9] : [0, 1, 2];
            for (const tr of rRange) {
              for (let tc = 3; tc <= 5; tc++) {
                if (isLegalMove(board, from, { r: tr, c: tc }, side)) {
                  moves.push({ from, to: { r: tr, c: tc } });
                }
              }
            }
            break;
          }
          case 'E': {
            const drs = [2, 2, -2, -2];
            const dcs = [2, -2, 2, -2];
            for (let i = 0; i < 4; i++) {
              const tr = r + drs[i], tc = c + dcs[i];
              if (tr >= 0 && tr < 10 && tc >= 0 && tc < 9) {
                if (isLegalMove(board, from, { r: tr, c: tc }, side)) {
                  moves.push({ from, to: { r: tr, c: tc } });
                }
              }
            }
            break;
          }
          case 'H': {
            const drs = [2, 2, -2, -2, 1, 1, -1, -1];
            const dcs = [1, -1, 1, -1, 2, -2, 2, -2];
            for (let i = 0; i < 8; i++) {
              const tr = r + drs[i], tc = c + dcs[i];
              if (tr >= 0 && tr < 10 && tc >= 0 && tc < 9) {
                if (isLegalMove(board, from, { r: tr, c: tc }, side)) {
                  moves.push({ from, to: { r: tr, c: tc } });
                }
              }
            }
            break;
          }
          case 'P': {
            const dirs = piece.side === 'red' ? [[-1, 0], [0, 1], [0, -1]] : [[1, 0], [0, 1], [0, -1]];
            for (const [dr, dc] of dirs) {
              const tr = r + dr, tc = c + dc;
              if (tr >= 0 && tr < 10 && tc >= 0 && tc < 9) {
                if (isLegalMove(board, from, { r: tr, c: tc }, side)) {
                  moves.push({ from, to: { r: tr, c: tc } });
                }
              }
            }
            break;
          }
          case 'R':
          case 'C': {
            // Check horizontal
            for (let tc = 0; tc < 9; tc++) {
              if (tc !== c && isLegalMove(board, from, { r, c: tc }, side)) {
                moves.push({ from, to: { r, c: tc } });
              }
            }
            // Check vertical
            for (let tr = 0; tr < 10; tr++) {
              if (tr !== r && isLegalMove(board, from, { r: tr, c }, side)) {
                moves.push({ from, to: { r: tr, c } });
              }
            }
            break;
          }
        }
      }
    }
  }
  return moves;
}

function makeMove(board: Board, move: Move): Board {
  const newBoard = board.map(row => [...row]);
  newBoard[move.to.r][move.to.c] = newBoard[move.from.r][move.from.c];
  newBoard[move.from.r][move.from.c] = null;
  return newBoard;
}

function minimax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  aiSide: Side
): number {
  if (depth === 0) {
    return evaluateBoard(board, aiSide);
  }

  const currentSide = isMaximizing ? aiSide : (aiSide === 'red' ? 'black' : 'red');
  const moves = getAllValidMoves(board, currentSide);

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const nextBoard = makeMove(board, move);
      const evaluation = minimax(nextBoard, depth - 1, alpha, beta, false, aiSide);
      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break;
    }
    return maxEval === -Infinity ? -9000 : maxEval; // Checkmate or stalemate
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const nextBoard = makeMove(board, move);
      const evaluation = minimax(nextBoard, depth - 1, alpha, beta, true, aiSide);
      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) break;
    }
    return minEval === Infinity ? 9000 : minEval;
  }
}

export function getBestMove(board: Board, side: Side, depth: number): Move | null {
  const moves = getAllValidMoves(board, side);
  if (moves.length === 0) return null;

  let bestMove: Move | null = null;
  let bestValue = -Infinity;

  // Shuffle moves to add variety
  moves.sort(() => Math.random() - 0.5);

  for (const move of moves) {
    const nextBoard = makeMove(board, move);
    const boardValue = minimax(nextBoard, depth - 1, -Infinity, Infinity, false, side);
    if (boardValue > bestValue) {
      bestValue = boardValue;
      bestMove = move;
    }
  }

  return bestMove;
}
