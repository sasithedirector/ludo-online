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

// ─── Full game logic matching server + Ludo rules ───
function canMoveToken(game: GameState, color: string, tokenIdx: number, diceVal: number): boolean {
  const player = game.players.find(p => p.color === color);
  if (!player) return false;
  const t = player.tokens[tokenIdx];
  if (t.pos === 58) return false; // already finished

  if (t.pos === -1) {
    // In home — need exactly 6 to bring out
    if (diceVal !== 6) return false;
    const startPos = START_POS[color] ?? 0;
    // Can only bring out if no other token is on the start square
    return !player.tokens.some((ot, i) => i !== tokenIdx && ot.pos === startPos);
  }

  if (t.pos >= 52) {
    // On home stretch — need exact number to reach center (pos 58)
    return t.pos + diceVal === 58;
  }

  // On main path
  const newPos = t.pos + diceVal;
  const homeEntry: Record<string, number> = { red: 51, green: 11, yellow: 25, blue: 37 };
  const entry = homeEntry[color] ?? 0;

  // Check if token passes through home entry
  for (let i = t.pos + 1; i <= newPos; i++) {
    if (i === entry) {
      // Token enters home stretch — need exact number
      const stepsToEntry = entry - t.pos;
      const remainingSteps = diceVal - stepsToEntry;
      // Home stretch positions: 52,53,54,55,56,57 → finish at 58
      // remainingSteps must be 1-6 (exactly landing on 52-57, or exactly 6 to finish)
      return remainingSteps >= 1 && remainingSteps <= 6;
    }
  }

  // Normal path move — can't go past 51
  return newPos <= 51;
}

function countMovableTokens(game: GameState, color: string, diceVal: number): number {
  let count = 0;
  for (let i = 0; i < 4; i++) {
    if (canMoveToken(game, color, i, diceVal)) count++;
  }
  return count;
}

export default function Board({ game, myColor, isMyTurn, phase, onMoveToken }: BoardProps) {
  const autoMoveRef = useRef<number | null>(null);

  // Build token position map
  const tokenPositions = useMemo(() => {
    const positions: Record<string, { color: string; tokenIdx: number; username: string }[]> = {};
    for (const player of game.players) {
      for (let i = 0; i < 4; i++) {
        const pos = player.tokens[i].pos;
        let key: string;
        if (pos === -1) {
          const hc = HOME_CELLS[player.color as string][i];
          key = `home-${hc[0]}-${hc[1]}`;
        } else if (pos < 52) {
          const p = PATH[pos];
          key = `path-${p[0]}-${p[1]}`;
        } else if (pos < 58) {
          const h = HOME_STRETCH[player.color as string][pos - 52];
          key = `stretch-${h[0]}-${h[1]}`;
        } else {
          key = 'center';
        }
        if (!positions[key]) positions[key] = [];
        positions[key].push({ color: player.color, tokenIdx: i, username: player.username });
      }
    }
    return positions;
  }, [game]);

  // Auto-move: only when exactly 1 token can move AND it's not a 6 (player should choose which token to bring out)
  const currentPlayer = game.players[game.turn];
  const isMyTurnAndMove = isMyTurn && phase === 'move' && myColor && currentPlayer?.color === myColor;

  useEffect(() => {
    if (autoMoveRef.current) clearTimeout(autoMoveRef.current);
    if (isMyTurnAndMove && game.dice > 0) {
      const count = countMovableTokens(game, myColor, game.dice);
      // Only auto-move if exactly 1 token can move AND dice is not 6 (let player choose which token to bring out)
      if (count === 1 && game.dice !== 6) {
        const idx = [0, 1, 2, 3].find(i => canMoveToken(game, myColor, i, game.dice));
        if (idx !== undefined) {
          autoMoveRef.current = window.setTimeout(() => {
            autoMoveRef.current = null;
            onMoveToken(idx);
          }, 600);
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

  // Cell styling
  const getCellStyle = (r: number, c: number): React.CSSProperties => {
    const bg = getCellColor(r, c);
    const isPath = PATH.some(p => p[0] === r && p[1] === c);
    const isHB = homeBaseColor(r, c);
    return {
      position: 'absolute',
      top: `${(r / 15) * 100}%`,
      left: `${(c / 15) * 100}%`,
      width: `${100 / 15}%`,
      height: `${100 / 15}%`,
      backgroundColor: bg,
      border: '1px solid rgba(0,0,0,0.08)',
      borderRadius: (isPath || isHB) ? '50%' : '0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: isHB ? 'inset 0 0 8px rgba(0,0,0,0.35)' : 'none',
    };
  };

  const getCellColor = (r: number, c: number): string => {
    if (r <= 5 && c <= 5) return '#e74c3c';
    if (r <= 5 && c >= 9) return '#2ecc71';
    if (r >= 9 && c >= 9) return '#f1c40f';
    if (r >= 9 && c <= 5) return '#3498db';
    if (r >= 6 && r <= 8 && c >= 6 && c <= 8) return '#fff';
    if (r === 7 && c >= 1 && c <= 6) return '#fab1a0';
    if (r >= 1 && r <= 6 && c === 7) return '#55efc4';
    if (r === 7 && c >= 8 && c <= 13) return '#ffeaa7';
    if (r >= 8 && r <= 13 && c === 7) return '#74b9ff';
    if (PATH.some(p => p[0] === r && p[1] === c)) return '#f5e6c8';
    return 'transparent';
  };

  const isSafeCell = (r: number, c: number): boolean => {
    const idx = PATH.findIndex(p => p[0] === r && p[1] === c);
    return idx >= 0 && SAFE_POS.includes(idx);
  };

  const homeBaseColor = (r: number, c: number): string | null => {
    if ([[1,1],[1,4],[4,1],[4,4]].some(([a,b]) => a===r && b===c)) return '#c0392b';
    if ([[1,10],[1,13],[4,10],[4,13]].some(([a,b]) => a===r && b===c)) return '#27ae60';
    if ([[10,10],[10,13],[13,10],[13,13]].some(([a,b]) => a===r && b===c)) return '#d4ac0d';
    if ([[10,1],[10,4],[13,1],[13,4]].some(([a,b]) => a===r && b===c)) return '#2980b9';
    return null;
  };

  const renderToken = (t: { color: string; tokenIdx: number; username: string }, key: string, size: number, offset: number) => {
    const movable = canMove(t.color, t.tokenIdx);
    const colorMap: Record<string, string> = {
      red: 'radial-gradient(circle at 35% 30%,#ff7675,#d63031)',
      green: 'radial-gradient(circle at 35% 30%,#55efc4,#00b894)',
      yellow: 'radial-gradient(circle at 35% 30%,#ffeaa7,#e1b12c)',
      blue: 'radial-gradient(circle at 35% 30%,#74b9ff,#0984e3)',
    };
    const borderMap: Record<string, string> = {
      red: '#922b21', green: '#1e8449', yellow: '#9a7d0a', blue: '#1f618d',
    };
    const offs = [{x:0,y:0},{x:7,y:-7},{x:-7,y:7},{x:7,y:7}];
    const {x,y} = offs[offset % 4];

    return (
      <div key={key} className={movable ? 'tok movable' : 'tok'}
        onClick={movable ? () => onMoveToken(t.tokenIdx) : undefined}
        style={{
          width: `${size}%`, height: `${size}%`,
          top: `calc((100% - ${size}%)/2 + ${y}%)`,
          left: `calc((100% - ${size}%)/2 + ${x}%)`,
          background: colorMap[t.color] || '#ccc',
          border: `2px solid ${borderMap[t.color] || '#666'}`,
          cursor: movable ? 'pointer' : 'default',
          boxShadow: movable
            ? '0 0 14px 3px rgba(255,255,255,.6), 0 2px 6px rgba(0,0,0,.4)'
            : '0 2px 6px rgba(0,0,0,.4), inset 0 -2px 4px rgba(0,0,0,.2), inset 0 2px 4px rgba(255,255,255,.3)',
        }}>
        <div style={{ width:'30%',height:'30%',borderRadius:'50%',background:'rgba(255,255,255,.35)' }} />
      </div>
    );
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '6px', overflow: 'hidden' }}>
      {Array.from({ length: 15 }, (_, r) =>
        Array.from({ length: 15 }, (_, c) => {
          const style = getCellStyle(r, c);
          const safe = isSafeCell(r, c);
          const hb = homeBaseColor(r, c);

          // Get tokens for this cell
          const pathKey = `path-${r}-${c}`;
          const homeKey = `home-${r}-${c}`;
          const stretchKey = `stretch-${r}-${c}`;
          const centerKey = 'center';
          let tokens: { color: string; tokenIdx: number; username: string }[] = [];
          if (r >= 6 && r <= 8 && c >= 6 && c <= 8) {
            tokens = tokenPositions[centerKey] || [];
          } else if ((r === 7 && c >= 1 && c <= 6) || (r >= 1 && r <= 6 && c === 7) || (r === 7 && c >= 8 && c <= 13) || (r >= 8 && r <= 13 && c === 7)) {
            tokens = tokenPositions[stretchKey] || [];
          } else {
            tokens = tokenPositions[pathKey] || tokenPositions[homeKey] || [];
          }

          return (
            <div key={`${r}-${c}`} style={style}>
              {safe && !hb && <span style={{ fontSize:'9px',color:'#8b6914',position:'absolute' }}>★</span>}
              {hb && <div style={{ width:'65%',height:'65%',borderRadius:'50%',backgroundColor:hb,border:`3px solid ${hb}`,boxShadow:'inset 0 0 6px rgba(0,0,0,.35)' }} />}
              {tokens.map((t, idx) => renderToken(t, `${t.color}-${t.tokenIdx}`, tokens.length > 1 ? 48 : 62, idx))}
            </div>
          );
        })
      )}
    </div>
  );
}
