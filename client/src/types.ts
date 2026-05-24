/* eslint-disable @typescript-eslint/no-explicit-any */
export const API_URL = import.meta.env.VITE_API_URL || '';

export const COLORS = ['red', 'green', 'yellow', 'blue'] as const;
export type Color = (typeof COLORS)[number];

export const PATH: [number, number][] = [
  [6,0],[6,1],[6,2],[6,3],[6,4],[6,5],[6,6],
  [5,6],[4,6],[3,6],[2,6],[1,6],
  [1,7],[1,8],
  [2,8],[3,8],[4,8],[5,8],[6,8],
  [6,9],[6,10],[6,11],[6,12],[6,13],
  [7,13],[8,13],
  [8,12],[8,11],[8,10],[8,9],[8,8],
  [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
  [14,7],[14,6],
  [13,6],[12,6],[11,6],[10,6],[9,6],[8,6],
  [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0]
];

export const HOME_STRETCH: Record<string, [number, number][]> = {
  red:    [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
  green:  [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  yellow: [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
  blue:   [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]]
};

export const HOME_CELLS: Record<string, [number, number][]> = {
  red:    [[1,1],[1,4],[4,1],[4,4]],
  green:  [[1,10],[1,13],[4,10],[4,13]],
  yellow: [[10,10],[10,13],[13,10],[13,13]],
  blue:   [[10,1],[10,4],[13,1],[13,4]]
};

export const START_POS: Record<string, number> = { red: 0, green: 13, yellow: 26, blue: 39 };
export const SAFE_POS = [0, 11, 25, 37];

// ─── Type interfaces ───

export interface Player {
  username: string;
  color: string;
  ready?: boolean;
  tokens?: { pos: number }[];
  finished?: boolean;
}

export interface GameState {
  turn: number;
  phase: 'roll' | 'move' | 'gameover';
  dice: number;
  currentColor: string;
  players: {
    username: string;
    color: string;
    tokens: { pos: number }[];
    finished: boolean;
  }[];
}

export interface RoomData {
  code: string;
  host: string;
  status: 'waiting' | 'playing' | 'finished';
  maxPlayers: number;
  players: Player[];
  game: GameState | null;
}

export interface ChatMessage {
  username: string;
  message: string;
  timestamp: number;
}
