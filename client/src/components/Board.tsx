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

// ─── Client-side game logic (must match server) ───
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
      const stepsBeforeEntry = homeEntry - t.pos;
      const homeStep = diceVal - stepsBeforeEntry;
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

// Get CSS class for each cell
function getCellClass(r: number, c: number): string {
  // Home quadrants
  if (r <= 5 && c <= 5) return 'hr';
  if (r <= 5 && c >= 9) return 'hg';
  if (r >= 9 && c >= 9) return 'hy';
  if (r >= 9 && c <= 5) return 'hb';

  // Center 3x3
  if (r >= 6 && r <= 8 && c >= 6 && c <= 8) {
    if (r === 7 && c === 7) return 'hc';
    if (r === 7 && c >= 1 && c <= 6) return 'st-r';
    if (r >= 1 && r <= 6 && c === 7) return 'st-g';
    if (r === 7 && c >= 8 && c <= 13) return 'st-y';
    if (r >= 8 && r <= 13 && c === 7) return 'st-b';
    return 'hc';
  }

  // Home stretch (outside center)
  if (r === 7 && c >= 1 && c <= 6) return 'st-r';
  if (r >= 1 && r <= 6 && c === 7) return 'st-g';
  if (r === 7 && c >= 8 && c <= 13) return 'st-y';
  if (r >= 8 && r <= 13 && c === 7) return 'st-b';

  // Main path
  const pathIdx = PATH.findIndex(p => p[0] === r && p[1] === c);
  if (pathIdx >= 0) {
    if (SAFE_POS.includes(pathIdx)) return 'sf';
    return 'pp';
  }

  // Home base positions
  const homeBases: Record<string, [number,number][]> = {
    red: [[1,1],[1,4],[4,1],[4,4]],
    green: [[1,10],[1,13],[4,10],[4,13]],
    yellow: [[10,10],[10,13],[13,10],[13,13]],
    blue: [[10,1],[10,4],[13,1],[13,4]],
  };
  if (homeBases.red.some(([hr,hc]) => hr===r && hc===c)) return 'hb-r';
  if (homeBases.green.some(([hr,hc]) => hr===r && hc===c)) return 'hb-g';
  if (homeBases.yellow.some(([hr,hc]) => hr===r && hc===c)) return 'hb-y';
  if (homeBases.blue.some(([hr,hc]) => hr===r && hc===c)) return 'hb-b';

  return 'empty';
}

export default function Board({ game, myColor, isMyTurn, phase, onMoveToken }: BoardProps) {
  const prevDiceRef = useRef(0);

  // Token map: position -> tokens
  const tokenMap = useMemo(() => {
    const map = new Map<string, { color: string; tokenIdx: number; username: string }[]>();
    for (const player of game.players) {
      for (let i = 0; i < 4; i++) {
        const pos = player.tokens[i].pos;
        let key: string;
        if (pos === -1) {
          const hc = HOME_CELLS[player.color as string][i];
          key = `home-${hc[0]}-${hc[1]}-${player.color}-${i}`;
        } else if (pos < 52) {
          const p = PATH[pos];
          key = `path-${p[0]}-${p[1]}`;
        } else if (pos < 58) {
          const h = HOME_STRETCH[player.color as string][pos - 52];
          key = `stretch-${h[0]}-${h[1]}`;
        } else {
          key = 'center-7-7';
        }
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({ color: player.color, tokenIdx: i, username: player.username });
      }
    }
    return map;
  }, [game]);

  // Dice animation trigger
  useEffect(() => {
    if (game.dice > 0 && game.dice !== prevDiceRef.current) {
      prevDiceRef.current = game.dice;
      const diceEl = document.getElementById('dc');
      if (diceEl) {
        diceEl.classList.add('dk');
        setTimeout(() => diceEl.classList.remove('dk'), 400);
      }
    }
  }, [game.dice]);

  // ─── Auto-move: if exactly one token can move, move it automatically ───
  const autoMoveRef = useRef<number | null>(null);
  const currentPlayer = game.players[game.turn];
  const isMyTurnAndMove = isMyTurn && phase === 'move' && myColor && currentPlayer?.color === myColor;

  useEffect(() => {
    if (autoMoveRef.current) clearTimeout(autoMoveRef.current);
    if (isMyTurnAndMove && game.dice > 0) {
      const movableCount = countMovableTokens(game, myColor, game.dice);
      if (movableCount === 1) {
        const movableIdx = [0, 1, 2, 3].find(i => canMoveToken(game, myColor, i, game.dice));
        if (movableIdx !== undefined) {
          autoMoveRef.current = window.setTimeout(() => {
            autoMoveRef.current = null;
            onMoveToken(movableIdx);
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

  // Collect overlay tokens (home areas, stretches, center)
  const overlays: React.JSX.Element[] = [];

  // Home area tokens
  for (const color of COLORS) {
    for (let i = 0; i < 4; i++) {
      const hc = HOME_CELLS[color as string][i];
      const key = `home-${hc[0]}-${hc[1]}-${color}-${i}`;
      const tokens = tokenMap.get(key);
      if (tokens && tokens.length > 0) {
        for (const t of tokens) {
          const movable = canMove(t.color, t.tokenIdx);
          overlays.push(
            <div key={`home-tok-${color}-${i}`} className="home-base"
              style={{ top: `${(hc[0]/15)*100}%`, left: `${(hc[1]/15)*100}%`, width: `${100/15}%`, height: `${100/15}%`,
                pointerEvents: movable ? 'auto' : 'none', zIndex: movable ? 10 : 1 }}>
              <Token color={t.color} tokenIdx={t.tokenIdx} canMove={movable}
                onClick={movable ? () => onMoveToken(t.tokenIdx) : undefined} size="home" offset={0} />
            </div>
          );
        }
      }
    }
  }

  // Home stretch tokens
  for (const color of COLORS) {
    for (let si = 0; si < 6; si++) {
      const [hr, hc] = HOME_STRETCH[color as string][si];
      const key = `stretch-${hr}-${hc}`;
      const tokens = tokenMap.get(key);
      if (tokens && tokens.length > 0) {
        for (const t of tokens) {
          const movable = canMove(t.color, t.tokenIdx);
          overlays.push(
            <div key={`stretch-tok-${color}-${si}`}
              style={{ position:'absolute', top:`${(hr/15)*100}%`, left:`${(hc/15)*100}%`, width:`${100/15}%`, height:`${100/15}%`,
                display:'flex', alignItems:'center', justifyContent:'center',
                pointerEvents: movable ? 'auto' : 'none', zIndex: movable ? 10 : 1 }}>
              <Token color={t.color} tokenIdx={t.tokenIdx} canMove={movable}
                onClick={movable ? () => onMoveToken(t.tokenIdx) : undefined} size="small" offset={0} />
            </div>
          );
        }
      }
    }
  }

  // Finished tokens at center
  const finishedTokens = game.players.flatMap(p =>
    p.tokens.map((t, i) => ({ ...t, color: p.color, username: p.username, tokenIdx: i })).filter(t => t.pos === 58)
  );
  finishedTokens.forEach((t, idx) => {
    overlays.push(
      <div key={`center-${t.color}-${idx}`}
        style={{ position:'absolute', top:`${(7/15)*100}%`, left:`${(7/15)*100}%`, width:`${100/15}%`, height:`${100/15}%`,
          display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
        <Token color={t.color} size="tiny" offset={idx} finished />
      </div>
    );
  });

  return (
    <div className="board-container">
      <div className="board">
        {Array.from({ length: 15 }, (_, r) =>
          Array.from({ length: 15 }, (_, c) => {
            const cellClass = getCellClass(r, c);
            const pathKey = `path-${r}-${c}`;
            const tokens = tokenMap.get(pathKey) || [];
            return (
              <div key={`${r}-${c}`} className={`cell ${cellClass}`}>
                {tokens.map((t, idx) => (
                  <Token key={`${t.color}-${t.tokenIdx}`} color={t.color} tokenIdx={t.tokenIdx}
                    canMove={canMove(t.color, t.tokenIdx)}
                    onClick={canMove(t.color, t.tokenIdx) ? () => onMoveToken(t.tokenIdx) : undefined}
                    size={tokens.length > 1 ? 'small' : 'normal'} offset={idx} />
                ))}
              </div>
            );
          })
        )}
        {overlays}
      </div>
    </div>
  );
}

function Token({ color, canMove = false, onClick, size, offset, finished }: {
  color: string; tokenIdx?: number; canMove?: boolean; onClick?: () => void;
  size: 'normal' | 'small' | 'home' | 'tiny'; offset?: number; finished?: boolean;
}) {
  const sizeMap = { normal: '68%', small: '54%', home: '46%', tiny: '36%' };
  const s = sizeMap[size];
  const offs = [{dx:0,dy:0},{dx:7,dy:-7},{dx:-7,dy:7},{dx:7,dy:7}];
  const {dx,dy} = offs[(offset||0)%4];
  return (
    <div className={`tok ${color} ${size==='home'?'hi':''} ${canMove?'movable':''} ${finished?'':''}`}
      onClick={onClick}
      style={{ width: s, height: s, top: `calc((100% - ${s})/2 + ${dy}%)`, left: `calc((100% - ${s})/2 + ${dx}%)`, cursor: canMove ? 'pointer' : 'default' }}>
      <div className="token-inner" />
    </div>
  );
}
