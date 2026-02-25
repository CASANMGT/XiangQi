import React from 'react';
import { Piece as PieceType } from '../logic/xiangqi';

interface PieceProps {
  piece: PieceType;
  isSelected?: boolean;
  isLastMove?: boolean;
  onClick?: () => void;
}

const PIECE_NAMES: Record<string, { red: string; black: string }> = {
  'K': { red: '帥', black: '將' },
  'A': { red: '仕', black: '士' },
  'E': { red: '相', black: '象' },
  'H': { red: '傌', black: '馬' },
  'R': { red: '俥', black: '車' },
  'C': { red: '炮', black: '砲' },
  'P': { red: '兵', black: '卒' },
};

export const Piece: React.FC<PieceProps> = ({ piece, isSelected, isLastMove, onClick }) => {
  const isRed = piece.side === 'red';
  const name = PIECE_NAMES[piece.type][piece.side];

  return (
    <div
      onClick={onClick}
      className={`
        relative w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center cursor-pointer
        transition-all duration-200 transform hover:scale-110 active:scale-95
        border-2 shadow-lg
        ${isRed ? 'bg-red-50 border-red-600 text-red-600' : 'bg-stone-800 border-stone-600 text-white'}
        ${isSelected ? 'ring-4 ring-yellow-400 scale-110 z-10' : ''}
        ${isLastMove ? 'ring-2 ring-blue-400' : ''}
      `}
    >
      <div className={`
        w-7 h-7 sm:w-10 sm:h-10 rounded-full border flex items-center justify-center font-calligraphy text-xl sm:text-3xl
        ${isRed ? 'border-red-200' : 'border-stone-500'}
      `}>
        {name}
      </div>
    </div>
  );
};
