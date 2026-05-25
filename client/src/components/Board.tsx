import { useMemo, useRef, useEffect } from 'react';
import type { GameState } from '../types';
import { PATH, HOME_STRETCH, HOME_CELLS, COLORS, SAFE_POS, START_POS } from '../types';

interface BoardProps {
  game: GameState;
  myColor?: string;
  isMyTurn: boolean;
  phase: string;
  onMoveToken: (idx: number) => void;
}

function canMoveToken(game: GameState, color: string, tokenIdx: number, diceVal: number): boolean {
  const player = game.players.find(p => p.color === color);
  if (!player) return false;
  const t = player.tokens[tokenIdx];
  if (t.pos === 58) return false;
  if (t.pos === -1) {
    if (diceVal !== 6) return false;
    const startPos = START_POS[color] ?? 0;
    return !player.tokens.some((ot, i) => i !== tokenIdx && ot.pos === startPos);
  }
  if (t.pos >= 52) return t.pos + diceVal <= 58;
  const newPos = t.pos + diceVal;
  const entry: Record<string, number> = { red: 51, green: 11, yellow: 25, blue: 37 };
  const homeEntry = entry[color] ?? 0;
  for (let i = t.pos + 1; i <= newPos; i++) {
    if (i === homeEntry) {
      const homeStep = diceVal - (homeEntry - t.pos);
      return homeStep <= 5;
    }
  }
  return newPos < 52;
}

function countMovableTokens(game: GameState, color: string, diceVal: number): number {
  let count = 0;
  for (let i = 0; i < 4; i++) {
    if (canMoveToken(game, color, i, diceVal)) count++;
  }
  return count;
}

export default function Board({ game, myColor, isMyTurn, phase, onMoveToken }: BoardProps) {
  // Build token position map
  const tokenPositions = useMemo(() => {
    const positions: Record<string, { color: string; tokenIdx: number; username: string }[]> = {};
    for (const player of game.players) {
      for (let i = 0; i < 4; i++) {
        const pos = player.tokens[i].pos;
        let key: string;
        if (pos === -1) {
          const hc = HOME_CELLS[player.color as string][i];
          key = `h-${hc[0]}-${hc[1]}`;
        } else if (pos < 52) {
          const p = PATH[pos];
          key = `p-${p[0]}-${p[1]}`;
        } else if (pos < 58) {
          const h = HOME_STRETCH[player.color as string][pos - 52];
          key = `s-${h[0]}-${h[1]}`;
        } else {
          key = 'c-7-7';
        }
        if (!positions[key]) positions[key] = [];
        positions[key].push({ color: player.color, tokenIdx: i, username: player.username });
      }
    }
    return positions;
  }, [game]);

  // Auto-move single token
  const autoMoveRef = useRef<number | null>(null);
  const currentPlayer = game.players[game.turn];
  const isMyTurnAndMove = isMyTurn && phase === 'move' && myColor && currentPlayer?.color === myColor;

  useEffect(() => {
    if (autoMoveRef.current) clearTimeout(autoMoveRef.current);
    if (isMyTurnAndMove && game.dice > 0) {
      const count = countMovableTokens(game, myColor, game.dice);
      if (count === 1) {
        const idx = [0,1,2,3].find(i => canMoveToken(game, myColor, i, game.dice));
        if (idx !== undefined) {
          autoMoveRef.current = window.setTimeout(() => {
            autoMoveRef.current = null;
            onMoveToken(idx);
          }, 800);
        }
      }
    }
    return () => { if (autoMoveRef.current) clearTimeout(autoMoveRef.current); };
  }, [isMyTurnAndMove, game.dice, myColor, game.turn, phase]);

  const canMove = (color: string, tokenIdx: number) => {
    if (!isMyTurn || phase !== 'move' || !myColor || color !== myColor) return false;
    if (game.dice <= 0) return false;
    return canMoveToken(game, color, tokenIdx, game.dice);
  };

  // Get cell background color
  const getCellBg = (r: number, c: number): string => {
    // Home quadrants
    if (r <= 5 && c <= 5) return '#e74c3c';
    if (r <= 5 && c >= 9) return '#2ecc71';
    if (r >= 9 && c >= 9) return '#f1c40f';
    if (r >= 9 && c <= 5) return '#3498db';
    // Center
    if (r >= 6 && r <= 8 && c >= 6 && c <= 8) return '#fff';
    // Home stretch
    if (r === 7 && c >= 1 && c <= 6) return '#fab1a0';
    if (r >= 1 && r <= 6 && c === 7) return '#55efc4';
    if (r === 7 && c >= 8 && c <= 13) return '#ffeaa7';
    if (r >= 8 && r <= 13 && c === 7) return '#74b9ff';
    // Path
    if (PATH.some(p => p[0] === r && p[1] === c)) return '#f5e6c8';
    return 'transparent';
  };

  // Check if cell is safe
  const isSafe = (r: number, c: number): boolean => {
    const idx = PATH.findIndex(p => p[0] === r && p[1] === c);
    return idx >= 0 && SAFE_POS.includes(idx);
  };

  // Check if cell is home base
  const homeBase = (r: number, c: number): string | null => {
    if ([[1,1],[1,4],[4,1],[4,4]].some(([a,b]) => a===r && b===c)) return 'red';
    if ([[1,10],[1,13],[4,10],[4,13]].some(([a,b]) => a===r && b===c)) return 'green';
    if ([[10,10],[10,13],[13,10],[13,13]].some(([a,b]) => a===r && b===c)) return 'yellow';
    if ([[10,1],[10,4],[13,1],[13,4]].some(([a,b]) => a===r && b===c)) return 'blue';
    return null;
  };

  const cellSize = `${100/15}%`;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Render 15x15 grid */}
      {Array.from({ length: 15 }, (_, r) =>
        Array.from({ length: 15 }, (_, c) => {
          const bg = getCellBg(r, c);
          const safe = isSafe(r, c);
          const hb = homeBase(r, c);
          const pathKey = `p-${r}-${c}`;
          const homeKey = `h-${r}-${c}`;
          const stretchKey = `s-${r}-${c}`;
          const centerKey = 'c-7-7';
          const tokens = tokenPositions[pathKey] || tokenPositions[homeKey] || tokenPositions[stretchKey] || tokenPositions[centerKey] || [];
          // Only show tokens on their specific cells
          const cellTokens = r >= 6 && r <= 8 && c >= 6 && c <= 8
            ? (tokenPositions[centerKey] || [])
            : r === 7 && c >= 1 && c <= 6
            ? (tokenPositions[stretchKey] || [])
            : r >= 1 && r <= 6 && c === 7
            ? (tokenPositions[stretchKey] || [])
            : r === 7 && c >= 8 && c <= 13
            ? (tokenPositions[stretchKey] || [])
            : r >= 8 && r <= 13 && c === 7
            ? (tokenPositions[stretchKey] || [])
            : (tokenPositions[pathKey] || tokenPositions[homeKey] || []);

          return (
            <div key={`${r}-${c}`} style={{
              position: 'absolute', top: `${(r/15)*100}%`, left: `${(c/15)*100}%`,
              width: cellSize, height: cellSize, backgroundColor: bg,
              border: '1px solid rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: PATH.some(p=>p[0]===r&&p[1]===c) ? '50%' : hb ? '50%' : '0',
              boxShadow: hb ? 'inset 0 0 6px rgba(0,0,0,0.3)' : 'none',
            }}>
              {safe && <span style={{ fontSize: '8px', color: '#8b6914' }}>★</span>}
              {hb && <div style={{
                width: '70%', height: '70%', borderRadius: '50%',
                backgroundColor: hb==='red'?'#c0392b':hb==='green'?'#27ae60':hb==='yellow'?'#d4ac0d':'#2980b9',
                border: `2px solid ${hb==='red'?'#922b21':hb==='green'?'#1e8449':hb==='yellow'?'#9a7d0a':'#1f618d'}`,
                boxShadow: 'inset 0 0 4px rgba(0,0,0,0.3)'
              }} />}
              {cellTokens.map((t, idx) => {
                const movable = canMove(t.color, t.tokenIdx);
                return (
                  <div key={`${t.color}-${t.tokenIdx}`} className={`tok ${t.color} ${movable?'movable':''}`}
                    onClick={movable ? () => onMoveToken(t.tokenIdx) : undefined}
                    style={{
                      width: cellTokens.length > 1 ? '50%' : '65%',
                      height: cellTokens.length > 1 ? '50%' : '65%',
                      top: `calc((100% - ${cellTokens.length>1?'50%':'65%'})/2 + ${idx%2===0?-6:6}%)`,
                      left: `calc((100% - ${cellTokens.length>1?'50%':'65%'})/2 + ${idx<2?-6:6}%)`,
                      cursor: movable ? 'pointer' : 'default',
                    }}>
                    <div style={{ width:'35%',height:'35%',borderRadius:'50%',background:'rgba(255,255,255,0.4)',border:'1px solid rgba(255,255,255,0.5)' }} />
                  </div>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
}
