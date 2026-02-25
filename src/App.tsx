import React, { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import { 
  Board as BoardType, 
  INITIAL_BOARD, 
  Position, 
  isValidMove, 
  Side, 
  isCheck,
  isLegalMove,
  isCheckmate,
  isStalemate
} from './logic/xiangqi';
import { Piece } from './components/Piece';
import { Trophy, Users, RefreshCw, Hash, MessageSquare, ShieldAlert, ChevronLeft, Home, Sparkles, Share2, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { getBestMove } from './logic/ai';

const App: React.FC = () => {
  const [socket, setSocket] = useState<any>(null);
  const [roomId, setRoomId] = useState<string>('');
  const [joined, setJoined] = useState(false);
  const [board, setBoard] = useState<BoardType>(INITIAL_BOARD);
  const [history, setHistory] = useState<BoardType[]>([]);
  const [turn, setTurn] = useState<Side>('red');
  const [selected, setSelected] = useState<Position | null>(null);
  const [mySide, setMySide] = useState<Side | 'spectator'>('red');
  const [playerCount, setPlayerCount] = useState(0);
  const [lastMove, setLastMove] = useState<{ from: Position; to: Position } | null>(null);
  const [checkSide, setCheckSide] = useState<Side | null>(null);
  const [gameMode, setGameMode] = useState<'single' | 'multi'>('single');
  const [difficulty, setDifficulty] = useState<'entry' | 'advance'>('entry');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiAvatar, setAiAvatar] = useState<string | null>(null);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [hint, setHint] = useState<{ move: { from: Position; to: Position }; reason: string } | null>(null);
  const [isGettingHint, setIsGettingHint] = useState(false);
  const [scores, setScores] = useState({ red: 0, black: 0 });
  const [winner, setWinner] = useState<Side | null>(null);
  const [gameOverType, setGameOverType] = useState<'checkmate' | 'stalemate' | 'capture' | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      setRoomId(room);
      setGameMode('multi');
    }
  }, []);

  const checkGameOver = useCallback((currentBoard: BoardType, lastTurn: Side) => {
    const nextTurn = lastTurn === 'red' ? 'black' : 'red';
    
    // 1. King capture (backup check)
    let redKing = false;
    let blackKing = false;
    for (const row of currentBoard) {
      for (const piece of row) {
        if (piece?.type === 'K') {
          if (piece.side === 'red') redKing = true;
          else blackKing = true;
        }
      }
    }
    if (!redKing) return { winner: 'black' as Side, type: 'capture' as const };
    if (!blackKing) return { winner: 'red' as Side, type: 'capture' as const };

    // 2. Checkmate
    if (isCheckmate(currentBoard, nextTurn)) {
      return { winner: lastTurn, type: 'checkmate' as const };
    }

    // 3. Stalemate
    if (isStalemate(currentBoard, nextTurn)) {
      return { winner: lastTurn, type: 'stalemate' as const };
    }

    return null;
  }, []);

  const getHint = async () => {
    if (isGettingHint || turn !== 'red' || !joined) return;
    setIsGettingHint(true);
    setHint(null);

    try {
      const move = getBestMove(board, 'red', 2);
      if (!move) {
        setHint({ move: { from: { r: 0, c: 0 }, to: { r: 0, c: 0 } }, reason: "No valid moves found. You might be in checkmate or stalemate." });
        return;
      }

      const piece = board[move.from.r][move.from.c];
      const target = board[move.to.r][move.to.c];
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `In Chinese Chess (Xiangqi), I am playing as RED. 
        The AI suggests moving ${piece?.type} from (${move.from.r}, ${move.from.c}) to (${move.to.r}, ${move.to.c}).
        ${target ? `This move captures a ${target.type}.` : ''}
        Provide a brief, one-sentence strategic reason for this move to help me learn. 
        Focus on concepts like controlling the center, protecting the king, or developing pieces.
        Keep it under 20 words.`,
      });

      setHint({
        move,
        reason: response.text || "This move improves your board position and piece development."
      });
    } catch (error) {
      console.error("Failed to get hint:", error);
    } finally {
      setIsGettingHint(false);
    }
  };

  // Gemini Image Generation
  const generateAiAvatar = async () => {
    if (isGeneratingAvatar) return;
    
    let usePro = false;
    try {
      if (await (window as any).aistudio.hasSelectedApiKey()) {
        usePro = true;
      }
    } catch (e) {
      console.warn("Key selection check failed", e);
    }

    setIsGeneratingAvatar(true);
    try {
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      const modelName = usePro ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
      
      const response = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: [{ text: `A cinematic, high-detail artistic portrait of a legendary Chinese Chess General from the Three Kingdoms era, wearing ornate red and gold armor, intense expression, dramatic lighting, digital painting style, 4k, epic atmosphere.` }],
        },
        config: usePro ? { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } } : undefined
      });
      
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          setAiAvatar(`data:image/png;base64,${part.inlineData.data}`);
          break;
        }
      }
    } catch (error: any) {
      console.error("Failed to generate avatar:", error);
      if (usePro || error?.message?.includes('PERMISSION_DENIED')) {
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: "A cinematic artistic portrait of a Chinese Chess General, red armor, epic style" }] }
          });
          for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
              setAiAvatar(`data:image/png;base64,${part.inlineData.data}`);
              break;
            }
          }
        } catch (e) {
          console.error("Fallback failed too", e);
        }
      }
    } finally {
      setIsGeneratingAvatar(false);
    }
  };

  useEffect(() => {
    if (joined && gameMode === 'single' && !aiAvatar) {
      generateAiAvatar();
    }
  }, [joined, gameMode, aiAvatar]);

  useEffect(() => {
    if (gameMode === 'multi') {
      const newSocket = io();
      setSocket(newSocket);

      newSocket.on('init-game', ({ side, game }) => {
        setMySide(side);
        if (game.board) {
          setBoard(game.board);
          setTurn(game.turn);
        }
      });

      newSocket.on('player-joined', ({ count }) => {
        setPlayerCount(count);
      });

      newSocket.on('remote-move', ({ from, to, board: newBoard, turn: nextTurn }) => {
        setBoard(newBoard);
        setTurn(nextTurn);
        setLastMove({ from, to });
        setSelected(null);
      });

      newSocket.on('game-reset', () => {
        setBoard(INITIAL_BOARD);
        setTurn('red');
        setLastMove(null);
        setSelected(null);
        setCheckSide(null);
        setHistory([]);
      });

      return () => {
        newSocket.disconnect();
      };
    }
  }, [gameMode]);

  const triggerAiMove = useCallback(() => {
    if (isAiThinking) return;
    
    console.log("AI Turn Triggered");
    setIsAiThinking(true);
    
    // Small delay to let UI update
    setTimeout(() => {
      try {
        console.log("AI starting to calculate move...");
        const depth = difficulty === 'entry' ? 1 : 2;
        const move = getBestMove(board, 'black', depth);
        
        if (move) {
          console.log("AI found move:", move);
          const newBoard = board.map(row => [...row]);
          newBoard[move.to.r][move.to.c] = newBoard[move.from.r][move.from.c];
          newBoard[move.from.r][move.from.c] = null;
          
          const result = checkGameOver(newBoard, 'black');
          if (result) {
            setWinner(result.winner);
            setGameOverType(result.type);
            setScores(prev => ({ ...prev, [result.winner]: prev[result.winner] + 1 }));
          }

          setHistory(prev => [...prev, board]);
          setBoard(newBoard);
          setTurn('red');
          setLastMove({ from: move.from, to: move.to });
        } else {
          console.warn("AI found no valid moves. Switching turn back to player.");
          setTurn('red'); 
        }
      } catch (e) {
        console.error("AI Logic Error:", e);
        setTurn('red');
      } finally {
        setIsAiThinking(false);
      }
    }, 500);
  }, [board, difficulty, isAiThinking]);

  // AI Logic Effect
  useEffect(() => {
    if (gameMode === 'single' && turn === 'black' && !isAiThinking && joined) {
      triggerAiMove();
    }
  }, [turn, gameMode, isAiThinking, joined, triggerAiMove]);

  useEffect(() => {
    if (isCheck(board, 'red')) setCheckSide('red');
    else if (isCheck(board, 'black')) setCheckSide('black');
    else setCheckSide(null);
  }, [board]);

  const handleJoin = (mode: 'single' | 'multi') => {
    setGameMode(mode);
    if (mode === 'multi') {
      if (roomId && socket) {
        socket.emit('join-room', roomId);
        setJoined(true);
        setWinner(null);
        setGameOverType(null);
      }
    } else {
      setMySide('red');
      setJoined(true);
      setBoard(INITIAL_BOARD);
      setTurn('red');
      setHistory([]);
      setWinner(null);
      setGameOverType(null);
    }
  };

  const handleCellClick = (r: number, c: number) => {
    if (mySide === 'spectator' || turn !== mySide || isAiThinking) return;

    if (selected) {
      if (selected.r === r && selected.c === c) {
        setSelected(null);
        return;
      }

      if (isLegalMove(board, selected, { r, c }, turn)) {
        const newBoard = board.map(row => [...row]);
        newBoard[r][c] = newBoard[selected.r][selected.c];
        newBoard[selected.r][selected.c] = null;

        const result = checkGameOver(newBoard, turn);
        if (result) {
          setWinner(result.winner);
          setGameOverType(result.type);
          setScores(prev => ({ ...prev, [result.winner]: prev[result.winner] + 1 }));
        }

        const nextTurn = turn === 'red' ? 'black' : 'red';
        
        setHistory(prev => [...prev, board]);
        setBoard(newBoard);
        setTurn(nextTurn);
        setLastMove({ from: selected, to: { r, c } });
        setSelected(null);
        setHint(null);

        if (gameMode === 'multi') {
          socket?.emit('move', {
            roomId,
            from: selected,
            to: { r, c },
            board: newBoard,
            turn: nextTurn
          });
        }
      } else {
        const piece = board[r][c];
        if (piece && piece.side === turn) {
          setSelected({ r, c });
        } else {
          setSelected(null);
        }
      }
    } else {
      const piece = board[r][c];
      if (piece && piece.side === turn) {
        setSelected({ r, c });
      }
    }
  };

  const undoMove = () => {
    if (history.length > 0 && !isAiThinking) {
      const newHistory = [...history];
      const lastBoard = newHistory.pop()!;
      
      // In single player, undoing one move of player means also undoing AI's move if it's player's turn now
      if (gameMode === 'single' && turn === 'red' && newHistory.length > 0) {
        const playerLastBoard = newHistory.pop()!;
        setBoard(playerLastBoard);
        setHistory(newHistory);
      } else {
        setBoard(lastBoard);
        setHistory(newHistory);
        setTurn(turn === 'red' ? 'black' : 'red');
      }
      
      setLastMove(null);
      setSelected(null);
      setHint(null);
    }
  };

  const returnToMenu = () => {
    setJoined(false);
    setHistory([]);
    setBoard(INITIAL_BOARD);
    setTurn('red');
    setLastMove(null);
    setSelected(null);
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
  };

  const resetGame = () => {
    setWinner(null);
    setGameOverType(null);
    if (gameMode === 'multi') {
      if (socket && roomId) {
        socket.emit('reset-game', roomId);
      }
    } else {
      setBoard(INITIAL_BOARD);
      setTurn('red');
      setLastMove(null);
      setSelected(null);
      setCheckSide(null);
      setHistory([]);
      setHint(null);
    }
  };

  const copyRoomLink = () => {
    const url = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(url);
    alert('Battle link copied to clipboard! Share it with your opponent.');
  };

  if (!joined) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Cinematic Background */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://picsum.photos/seed/ancient-china/1920/1080?blur=5" 
            className="w-full h-full object-cover opacity-40"
            alt="Background"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-stone-900/80 via-transparent to-stone-900" />
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 bg-[#f4e4bc] scroll-texture p-8 sm:p-12 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-lg w-full border-x-[12px] border-stone-800 mx-4"
        >
          <div className="flex justify-center mb-8">
            <motion.div 
              animate={{ rotate: [0, -5, 5, 0] }}
              transition={{ duration: 6, repeat: Infinity }}
              className="w-24 h-24 bg-red-800 rounded-full flex items-center justify-center shadow-2xl border-4 border-red-900"
            >
              <span className="text-white text-5xl font-calligraphy">帥</span>
            </motion.div>
          </div>
          
          <h1 className="text-5xl font-sans font-extrabold text-center text-stone-900 mb-2 tracking-widest">XIANGQI</h1>
          <p className="text-stone-700 font-cursive text-2xl text-center mb-10">The Art of War on a Scroll</p>
          
          <div className="space-y-6">
            <div className="flex gap-4 p-2 bg-stone-800/10 rounded-full mb-6">
              <button 
                onClick={() => setGameMode('single')}
                className={`flex-1 py-3 rounded-full text-sm font-sans font-bold transition-all ${gameMode === 'single' ? 'bg-red-800 text-white shadow-lg' : 'text-stone-600'}`}
              >
                SOLO
              </button>
              <button 
                onClick={() => setGameMode('multi')}
                className={`flex-1 py-3 rounded-full text-sm font-sans font-bold transition-all ${gameMode === 'multi' ? 'bg-red-800 text-white shadow-lg' : 'text-stone-600'}`}
              >
                DUEL
              </button>
            </div>

            {gameMode === 'multi' ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <label className="block text-xs font-sans font-bold text-stone-700 mb-2 ml-1 uppercase tracking-wider">ROOM SEAL</label>
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500 w-5 h-5" />
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    placeholder="ENTER SEAL..."
                    className="w-full pl-12 pr-4 py-4 bg-white/50 border-b-2 border-stone-800 font-sans font-medium outline-none transition-all placeholder:text-stone-400"
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <label className="block text-xs font-sans font-bold text-stone-700 mb-2 ml-1 text-center uppercase tracking-wider">STRATEGY LEVEL</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setDifficulty('entry')}
                    className={`flex-1 py-3 rounded-full border border-stone-800 font-sans font-bold text-xs transition-all ${difficulty === 'entry' ? 'bg-stone-800 text-white shadow-lg' : 'text-stone-800 hover:bg-stone-800/5'}`}
                  >
                    ENTRY
                  </button>
                  <button 
                    onClick={() => setDifficulty('advance')}
                    className={`flex-1 py-3 rounded-full border border-stone-800 font-sans font-bold text-xs transition-all ${difficulty === 'advance' ? 'bg-stone-800 text-white shadow-lg' : 'text-stone-800 hover:bg-stone-800/5'}`}
                  >
                    ADVANCE
                  </button>
                </div>
              </motion.div>
            )}

            <button
              onClick={() => handleJoin(gameMode)}
              disabled={gameMode === 'multi' && !roomId}
              className="w-full py-5 bg-red-900 text-white font-sans font-bold text-lg rounded-full shadow-xl hover:bg-red-800 transition-all disabled:opacity-50 mt-8 border-b-4 border-red-950 active:border-b-0 active:translate-y-1"
            >
              BEGIN BATTLE
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-[#1a1a1a] flex flex-col lg:flex-row font-sans overflow-hidden select-none">
      {/* Mobile Header */}
      <div className="lg:hidden w-full bg-[#f4e4bc] scroll-texture border-b-4 border-stone-900 p-3 flex items-center justify-between shadow-md z-30 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-red-800 rounded-full flex items-center justify-center text-white font-calligraphy text-lg shadow-inner">帥</div>
          <div className="flex flex-col">
            <span className="text-xs font-black text-stone-900 leading-none tracking-tighter">XIANGQI</span>
            {gameMode === 'multi' && <span className="text-[8px] font-mono text-red-800 font-bold">SEAL: {roomId}</span>}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <div className="flex gap-2 text-[10px] font-black tracking-tighter">
              <span className="text-red-800">R:{scores.red}</span>
              <span className="text-stone-900">B:{scores.black}</span>
            </div>
            <div className="flex items-center gap-1">
              {isAiThinking && <RefreshCw className="w-2 h-2 animate-spin text-stone-400" />}
              <span className={`text-[10px] font-black ${turn === 'red' ? 'text-red-800' : 'text-stone-900'}`}>
                {turn === 'red' ? 'RED' : 'BLK'} TURN
              </span>
            </div>
          </div>
          {gameMode === 'multi' && (
            <button 
              onClick={copyRoomLink}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-900 text-white rounded-full shadow-lg active:scale-95 transition-transform"
            >
              <Share2 className="w-3 h-3" />
              <span className="text-[10px] font-black">SHARE</span>
            </button>
          )}
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:w-80 bg-[#f4e4bc] scroll-texture border-r-8 border-stone-900 p-6 flex-col shadow-2xl z-20 overflow-y-auto shrink-0">
        <div className="flex items-center gap-3 mb-8 border-b-2 border-stone-800 pb-4">
          <div className="w-10 h-10 bg-red-800 rounded-full flex items-center justify-center text-white font-calligraphy text-2xl">帥</div>
          <h2 className="text-2xl font-sans font-extrabold text-stone-900 tracking-tighter">XIANGQI</h2>
        </div>

        <div className="space-y-6 flex-1 pr-2">
          {gameMode === 'single' && (
            <div className="bg-stone-900 rounded-xl overflow-hidden border-4 border-stone-800 shadow-2xl shrink-0">
              <div className="relative h-32 bg-stone-800 flex items-center justify-center">
                {aiAvatar ? (
                  <img src={aiAvatar} alt="AI General" className="w-full h-full object-cover opacity-90" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-stone-500">
                    <Sparkles className={`w-6 h-6 ${isGeneratingAvatar ? 'animate-spin' : ''}`} />
                    <span className="text-[8px] font-sans font-bold uppercase tracking-widest">Summoning...</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-transparent to-transparent" />
                <div className="absolute bottom-2 left-3 right-3">
                  <div className="text-[8px] font-sans font-bold text-red-500 uppercase tracking-widest mb-0.5">THE OPPONENT</div>
                  <div className="text-sm font-cursive text-white">The Iron Strategist</div>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 shrink-0">
            {gameMode === 'multi' && (
              <div className="bg-stone-800/5 p-4 rounded-xl border-2 border-stone-800/20 flex flex-col justify-center">
                <div className="flex items-center gap-2 text-stone-500 text-[10px] font-sans font-bold mb-2 tracking-wider">
                  <Hash className="w-3 h-3" />
                  ROOM SEAL
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between bg-white/50 p-2 rounded-lg border border-stone-800/20">
                    <span className="font-mono font-bold text-red-800 text-sm truncate">{roomId}</span>
                    <Hash className="w-3 h-3 text-stone-400" />
                  </div>
                  <button 
                    onClick={copyRoomLink}
                    className="flex items-center justify-center gap-2 w-full py-3 bg-red-900 text-white rounded-full text-xs font-black hover:bg-red-800 transition-all shadow-lg border-b-4 border-red-950 active:border-b-0 active:translate-y-1"
                  >
                    <Share2 className="w-4 h-4" />
                    SHARE PUBLIC LINK
                  </button>
                </div>
              </div>
            )}

            <div className="bg-stone-800/5 p-4 rounded-xl border-2 border-stone-800/20 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-stone-500 text-[10px] font-sans font-bold mb-3 tracking-wider">
                <Users className="w-3 h-3" />
                BATTLE LOG
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-stone-600 text-xs">RED SCORE:</span>
                <span className="font-sans font-black text-red-800 text-xl">{scores.red}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-600 text-xs">BLACK SCORE:</span>
                <span className="font-sans font-black text-stone-900 text-xl">{scores.black}</span>
              </div>
            </div>

            <div className="bg-stone-800/5 p-4 rounded-xl border-2 border-stone-800/20 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-stone-500 text-[10px] font-sans font-bold mb-3 tracking-wider">
                <Trophy className="w-3 h-3" />
                STATUS
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-600 text-xs">TURN:</span>
                <div className="flex items-center gap-2">
                  {isAiThinking && <RefreshCw className="w-3 h-3 animate-spin text-stone-400" />}
                  <span className={`text-sm font-sans font-bold ${turn === 'red' ? 'text-red-800' : 'text-stone-900'}`}>
                    {turn.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 shrink-0">
            <button
              onClick={undoMove}
              disabled={history.length === 0 || isAiThinking || winner !== null}
              className="flex items-center justify-center gap-2 py-3 bg-stone-800 text-white text-[10px] font-sans font-bold rounded-full hover:bg-stone-700 disabled:opacity-30 transition-all tracking-wider"
            >
              <ChevronLeft className="w-3 h-3" />
              RETREAT
            </button>
            <button
              onClick={getHint}
              disabled={turn !== 'red' || isAiThinking || isGettingHint || winner !== null}
              className="flex items-center justify-center gap-2 py-3 bg-red-900 text-white text-[10px] font-sans font-bold rounded-full hover:bg-red-800 disabled:opacity-30 transition-all tracking-wider"
            >
              <Sparkles className={`w-3 h-3 ${isGettingHint ? 'animate-pulse' : ''}`} />
              INSIGHT
            </button>
          </div>
        </div>

        <button
          onClick={returnToMenu}
          className="mt-6 flex items-center justify-center gap-2 w-full py-4 border-2 border-stone-800 text-stone-800 font-sans font-bold text-xs rounded-full hover:bg-stone-800 hover:text-white transition-all tracking-widest"
        >
          <Home className="w-4 h-4" />
          ABANDON
        </button>
      </div>

      {/* Main Board Area */}
      <div className="flex-1 flex flex-col items-center justify-center relative bg-stone-900 overflow-hidden">
        {/* Floating Overlays */}
        <div className="absolute top-4 left-4 right-4 z-30 flex flex-col gap-2 pointer-events-none">
          <AnimatePresence>
            {hint && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white/95 backdrop-blur-md border-l-8 border-red-800 p-4 rounded-2xl shadow-2xl pointer-events-auto max-w-xs sm:max-w-md"
              >
                <div className="text-[10px] font-sans font-bold text-red-800 mb-1 tracking-wider">STRATEGIC ADVICE</div>
                <p className="text-xs sm:text-sm text-stone-800 font-cursive text-lg leading-tight">
                  {hint.reason}
                </p>
                <button 
                  onClick={() => setHint(null)}
                  className="mt-3 text-[10px] font-sans font-bold text-stone-500 hover:text-stone-800 tracking-wider underline"
                >
                  DISMISS
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {checkSide && !winner && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-red-800/95 backdrop-blur-md text-white p-4 rounded-2xl flex items-center gap-4 shadow-2xl pointer-events-auto w-fit border-2 border-white/20"
              >
                <ShieldAlert className="w-6 h-6 animate-pulse" />
                <div>
                  <div className="font-sans font-black text-xs tracking-widest uppercase">CHECK!</div>
                  <div className="text-[10px] font-cursive text-xl">{checkSide.toUpperCase()} KING IN PERIL</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Background Atmosphere */}
        <div className="absolute inset-0 z-0 opacity-40">
          <img 
            src="https://picsum.photos/seed/xiangqi-battle/1920/1080?blur=8" 
            className="w-full h-full object-cover"
            alt="Atmosphere"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-stone-900 via-transparent to-stone-900" />
        </div>

        <div className="relative z-10 bg-[#d2b48c] board-texture p-4 lg:p-10 rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.8)] border-[8px] lg:border-[24px] border-stone-800 transform scale-[0.8] sm:scale-100 transition-transform duration-500">
          {/* Board Grid Lines */}
          <div className="relative grid grid-cols-8 grid-rows-9 w-[280px] h-[315px] sm:w-[540px] sm:h-[600px] border-4 border-stone-900">
            {/* Horizontal Lines */}
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={`h-${i}`} className="absolute w-full h-1 bg-stone-900/80" style={{ top: `${(i / 9) * 100}%` }} />
            ))}
            {/* Vertical Lines */}
            {Array.from({ length: 9 }).map((_, i) => (
              <div 
                key={`v-${i}`} 
                className={`absolute w-1 bg-stone-900/80 ${i === 0 || i === 8 ? 'h-full' : 'h-[44.44%] top-0'} `} 
                style={{ left: `${(i / 8) * 100}%` }} 
              />
            ))}
            {Array.from({ length: 9 }).map((_, i) => (
              <div 
                key={`v2-${i}`} 
                className={`absolute w-1 bg-stone-900/80 ${i === 0 || i === 8 ? 'hidden' : 'h-[44.44%] bottom-0'} `} 
                style={{ left: `${(i / 8) * 100}%` }} 
              />
            ))}

            {/* River Text */}
            <div className="absolute top-[44.44%] left-0 w-full h-[11.11%] flex items-center justify-around pointer-events-none">
              <span className="text-3xl sm:text-5xl font-calligraphy text-stone-900 opacity-40 rotate-180">楚河</span>
              <span className="text-3xl sm:text-5xl font-calligraphy text-stone-900 opacity-40">漢界</span>
            </div>

            {/* Palace Diagonals */}
            <svg className="absolute top-0 left-[37.5%] w-[25%] h-[22.22%] pointer-events-none">
              <line x1="0" y1="0" x2="100%" y2="100%" stroke="rgba(28,25,23,0.8)" strokeWidth="3" />
              <line x1="100%" y1="0" x2="0" y2="100%" stroke="rgba(28,25,23,0.8)" strokeWidth="3" />
            </svg>
            <svg className="absolute bottom-0 left-[37.5%] w-[25%] h-[22.22%] pointer-events-none">
              <line x1="0" y1="0" x2="100%" y2="100%" stroke="rgba(28,25,23,0.8)" strokeWidth="3" />
              <line x1="100%" y1="0" x2="0" y2="100%" stroke="rgba(28,25,23,0.8)" strokeWidth="3" />
            </svg>

            {/* Pieces and Click Targets */}
            <div className="absolute inset-0 grid grid-cols-9 grid-rows-10 -m-5 sm:-m-7">
              {board.map((row, r) => 
                row.map((piece, c) => {
                  const isSelected = selected?.r === r && selected?.c === c;
                  const isLastMoveFrom = lastMove?.from.r === r && lastMove?.from.c === c;
                  const isLastMoveTo = lastMove?.to.r === r && lastMove?.to.c === c;
                  const isHintFrom = hint?.move.from.r === r && hint?.move.from.c === c;
                  const isHintTo = hint?.move.to.r === r && hint?.move.to.c === c;

                  return (
                    <div 
                      key={`${r}-${c}`} 
                      className="flex items-center justify-center relative"
                      onClick={() => handleCellClick(r, c)}
                    >
                      {/* Move indicator */}
                      {selected && isLegalMove(board, selected, { r, c }, turn) && (
                        <div className="absolute w-4 h-4 bg-red-800 rounded-full opacity-40 animate-pulse z-20" />
                      )}
                      
                      {piece && (
                        <Piece 
                          piece={piece} 
                          isSelected={isSelected}
                          isLastMove={isLastMoveFrom || isLastMoveTo}
                        />
                      )}

                      {/* Hint Indicators */}
                      {isHintFrom && (
                        <div className="absolute inset-0 border-4 border-yellow-600/50 rounded-full animate-pulse z-10" />
                      )}
                      {isHintTo && (
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                          <div className="w-12 h-12 sm:w-14 sm:h-14 border-4 border-dashed border-yellow-600 rounded-full animate-spin-slow" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Winner Overlay */}
        <AnimatePresence>
          {gameOverType === 'checkmate' && (
            <motion.div
              initial={{ x: '-100%', opacity: 0 }}
              animate={{ x: '0%', opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 100 }}
              className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none overflow-hidden"
            >
              <motion.div 
                initial={{ rotate: -10, scale: 0.5 }}
                animate={{ rotate: -5, scale: 1.2 }}
                className="bg-red-800/90 text-white px-10 lg:px-20 py-6 lg:py-10 shadow-[0_0_100px_rgba(255,0,0,0.5)] border-y-8 border-white/20 backdrop-blur-md text-center"
              >
                <h2 className="text-4xl lg:text-8xl font-black tracking-[0.2em] italic uppercase mb-2">CHECKMATE</h2>
                <div className="text-3xl lg:text-6xl font-calligraphy text-white/80">将死</div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {winner && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            >
              <motion.div 
                initial={{ scale: 0.8, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-[#f4e4bc] scroll-texture p-8 lg:p-12 rounded-2xl border-x-[16px] border-stone-800 text-center max-w-md w-full shadow-[0_0_100px_rgba(255,0,0,0.3)] mx-4"
              >
                <Trophy className={`w-12 h-12 lg:w-20 lg:h-20 mx-auto mb-6 ${winner === 'red' ? 'text-red-800' : 'text-stone-900'}`} />
                <h2 className="text-2xl lg:text-4xl font-sans font-black text-stone-900 mb-2 tracking-widest uppercase">VICTORY</h2>
                <p className="text-xl lg:text-2xl font-cursive text-stone-700 mb-8">
                  {winner === 'red' ? 'The Red Army has triumphed!' : 'The Black Legion has conquered!'}
                </p>
                <button 
                  onClick={resetGame}
                  className="w-full py-4 bg-red-900 text-white font-sans font-bold rounded-full hover:bg-red-800 transition-all shadow-xl tracking-widest"
                >
                  RE-ENGAGE
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Mobile Footer */}
        <div className="lg:hidden w-full bg-[#f4e4bc] scroll-texture border-t-4 border-stone-900 p-4 flex items-center justify-around shadow-2xl z-30 shrink-0">
          <button
            onClick={undoMove}
            disabled={history.length === 0 || isAiThinking || winner !== null}
            className="flex flex-col items-center gap-1 text-stone-800 disabled:opacity-30"
          >
            <ChevronLeft className="w-6 h-6" />
            <span className="text-[10px] font-black">RETREAT</span>
          </button>
          <button
            onClick={getHint}
            disabled={turn !== 'red' || isAiThinking || isGettingHint || winner !== null}
            className="flex flex-col items-center gap-1 text-red-900 disabled:opacity-30"
          >
            <Sparkles className={`w-6 h-6 ${isGettingHint ? 'animate-pulse' : ''}`} />
            <span className="text-[10px] font-black">INSIGHT</span>
          </button>
          <button
            onClick={returnToMenu}
            className="flex flex-col items-center gap-1 text-stone-600"
          >
            <Home className="w-6 h-6" />
            <span className="text-[10px] font-black">EXIT</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
