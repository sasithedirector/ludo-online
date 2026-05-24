import { useMemo } from 'react';
import type { GameState } from '../types';
import { PATH, HOME_STRETCH, HOME_CELLS, COLORS, SAFE_POS } from '../types';

interface BoardProps {
  game: GameState;
  myColor?: string;
  isMyTurn: boolean;
  phase: string;
  onMoveToken: (idx: number) => void;
}

export default function Board({ game, myColor, isMyTurn, phase, onMoveToken }: BoardProps) {
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

  const canMove = (color: string, _tokenIdx: number) => {
    return isMyTurn && phase === 'move' && myColor === color;
  };

  // Collect all overlay tokens (home areas, stretches, center)
  const overlays: React.JSX.Element[] = [];

  // Home area tokens
  for (const color of COLORS) {
    for (let i = 0; i < 4; i++) {
      const hc = HOME_CELLS[color as string][i];
      const key = `home-${hc[0]}-${hc[1]}-${color}-${i}`;
      const tokens = tokenMap.get(key);
      if (tokens && tokens.length > 0) {
        for (const t of tokens) {
          overlays.push(
            <div
              key={`home-tok-${color}-${i}`}
              style={{
                position: 'absolute', top: `${(hc[0] / 15) * 100}%`, left: `${(hc[1] / 15) * 100}%`,
                width: `${100 / 15}%`, height: `${100 / 15}%`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none'
              }}
            >
              <Token color={t.color} size="home" offset={0} />
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
          overlays.push(
            <div
              key={`stretch-tok-${color}-${si}`}
              style={{
                position: 'absolute', top: `${(hr / 15) * 100}%`, left: `${(hc / 15) * 100}%`,
                width: `${100 / 15}%`, height: `${100 / 15}%`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none'
              }}
            >
              <Token color={t.color} size="small" offset={0} />
            </div>
          );
        }
      }
    }
  }

  // Finished tokens at center
  const finishedTokens = game.players.flatMap(p =>
    p.tokens.map((t, i) => ({ ...t, color: p.color, username: p.username, tokenIdx: i }))
             .filter(t => t.pos === 58)
  );
  if (finishedTokens.length > 0) {
    finishedTokens.forEach((t, idx) => {
      overlays.push(
        <div
          key={`center-${t.color}-${idx}`}
          style={{
            position: 'absolute', top: `${(7 / 15) * 100}%`, left: `${(7 / 15) * 100}%`,
            width: `${100 / 15}%`, height: `${100 / 15}%`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none'
          }}
        >
          <Token color={t.color} size="tiny" offset={idx} finished />
        </div>
      );
    });
  }

  return (
    <div className="board-container">
      <div className="board">
        {Array.from({ length: 15 }, (_, r) =>
          Array.from({ length: 15 }, (_, c) => {
            const cellClass = getCellClass(r, c);
            const isSafe = PATH.some((p, idx) => p[0] === r && p[1] === c && SAFE_POS.includes(idx));
            const isPathCell = PATH.some(p => p[0] === r && p[1] === c);
            const pathKey = `path-${r}-${c}`;
            const tokens = tokenMap.get(pathKey) || [];

            return (
              <div key={`${r}-${c}`} className={`cell ${cellClass}`}>
                {isSafe && isPathCell && <span className="safe-star">⭐</span>}
                {tokens.map((t, idx) => (
                  <Token
                    key={`${t.color}-${t.tokenIdx}`}
                    color={t.color}
                    tokenIdx={t.tokenIdx}
                    canMove={canMove(t.color, t.tokenIdx)}
                    onClick={canMove(t.color, t.tokenIdx) ? () => onMoveToken(t.tokenIdx) : undefined}
                    size={tokens.length > 1 ? 'small' : 'normal'}
                    offset={idx}
                  />
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
  color: string;
  tokenIdx?: number;
  canMove?: boolean;
  onClick?: () => void;
  size: 'normal' | 'small' | 'home' | 'tiny';
  offset?: number;
  finished?: boolean;
}) {
  const sizeMap = { normal: 72, small: 58, home: 48, tiny: 38 };
  const s = sizeMap[size];
  const offs = [
    { dx: 0, dy: 0 }, { dx: 8, dy: -8 }, { dx: -8, dy: 8 }, { dx: 8, dy: 8 },
  ];
  const { dx, dy } = offs[(offset || 0) % 4];

  return (
    <div
      className={`token ${color} ${size} ${canMove ? 'movable' : ''} ${finished ? 'finished' : ''}`}
      onClick={onClick}
      style={{
        width: `${s}%`, height: `${s}%`,
        top: `calc(${(100 - s) / 2}% + ${dy}%)`,
        left: `calc(${(100 - s) / 2}% + ${dx}%)`,
        cursor: canMove ? 'pointer' : 'default',
      }}
    >
      <div className="token-inner" />
    </div>
  );
}

function getCellClass(r: number, c: number): string {
  if (r <= 5 && c <= 5) return 'home-red';
  if (r <= 5 && c >= 9) return 'home-green';
  if (r >= 9 && c >= 9) return 'home-yellow';
  if (r >= 9 && c <= 5) return 'home-blue';
  if (r >= 6 && r <= 8 && c >= 6 && c <= 8) {
    if (r === 7 && c === 7) return 'center-cell';
    return 'center-cell';
  }
  if (r === 7 && c >= 1 && c <= 6) return 'stretch-red';
  if (r >= 1 && r <= 6 && c === 7) return 'stretch-green';
  if (r === 7 && c >= 8 && c <= 13) return 'stretch-yellow';
  if (r >= 8 && r <= 13 && c === 7) return 'stretch-blue';
  if (PATH.some(p => p[0] === r && p[1] === c)) return 'path';
  return 'empty';
}
