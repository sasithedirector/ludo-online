import { useState, useEffect } from 'react';
import { gameClient } from './GameClient';
import type { RoomData } from './types';
import Board from './components/Board';
import Dice from './components/Dice';
import Chat from './components/Chat';
import './App.css';

type Screen = 'auth' | 'lobby' | 'game';

function App() {
  const [screen, setScreen] = useState<Screen>('auth');
  const [room, setRoom] = useState<RoomData | null>(null);
  const [error, setError] = useState('');
  const [token, setToken] = useState<string | null>(gameClient.getToken());
  const [username, setUsername] = useState<string | null>(gameClient.getUsername());

  useEffect(() => {
    gameClient.on('roomUpdate', (data: RoomData) => {
      setRoom(data);
      if (data.status === 'playing' || data.status === 'finished') {
        setScreen('game');
      } else {
        setScreen('lobby');
      }
    });

    gameClient.on('error', (msg: string) => {
      setError(msg);
      setTimeout(() => setError(''), 3000);
    });

    return () => {
      gameClient.off('roomUpdate', setRoom);
    };
  }, []);

  // If already logged in, connect socket
  useEffect(() => {
    if (token) {
      gameClient.connectSocket();
    }
  }, [token]);

  if (!token || !username || screen === 'auth') {
    return <AuthScreen onAuth={(t, u) => { setToken(t); setUsername(u); setScreen('lobby'); gameClient.connectSocket(); }} />;
  }

  if (screen === 'game' && room?.game) {
    return (
      <GameScreen
        room={room}
        username={username}
        onLogout={() => { gameClient.logout(); setToken(null); setUsername(null); setScreen('auth'); setRoom(null); }}
      />
    );
  }

  // Default: show lobby (room may be null = not in a room yet)

  return (
    <LobbyScreen
      room={room}
      username={username}
      error={error}
      onLogout={() => { gameClient.logout(); setToken(null); setUsername(null); setScreen('auth'); setRoom(null); }}
    />
  );
}

function AuthScreen({ onAuth }: { onAuth: (token: string, username: string) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const data = isLogin
        ? await gameClient.login(username, password)
        : await gameClient.register(username, password);
      onAuth(data.token, data.username);
    } catch (e: any) {
      setErr(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>🎲 LUDO</h1>
        <h2>{isLogin ? 'Sign In' : 'Create Account'}</h2>
        {err && <div className="error-msg">{err}</div>}
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            minLength={3}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={4}
          />
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '...' : isLogin ? 'Sign In' : 'Register'}
          </button>
        </form>
        <p className="switch-auth">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button className="link-btn" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Register' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  );
}

function LobbyScreen({ room, username, error, onLogout }: {
  room: RoomData | null;
  username: string;
  error: string;
  onLogout: () => void;
}) {
  const [roomCode, setRoomCode] = useState('');
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    if (room?.code) {
      navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="lobby-container">
      <div className="lobby-header">
        <h1>🎲 LUDO</h1>
        <div className="user-info">
          <span>👤 {username}</span>
          <button className="btn-small" onClick={onLogout}>Logout</button>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {!room ? (
        <div className="lobby-actions">
          <button className="btn-primary large" onClick={() => gameClient.createRoom()}>
            🏠 Create Room
          </button>
          <div className="or-divider">— OR —</div>
          <div className="join-room">
            <input
              type="text"
              placeholder="Enter room code"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              maxLength={6}
            />
            <button className="btn-secondary" onClick={() => roomCode && gameClient.joinRoom(roomCode)}>
              Join Room
            </button>
          </div>
        </div>
      ) : (
        <div className="room-lobby">
          <div className="room-code-section">
            <h2>Room Code</h2>
            <div className="room-code" onClick={copyCode}>
              {room.code}
              <span className="copy-hint">{copied ? '✓ Copied!' : 'Click to copy'}</span>
            </div>
            <p>Share this code with friends to invite them!</p>
          </div>

          <div className="players-list">
            <h3>Players ({room.players.length}/{room.maxPlayers})</h3>
            {room.players.map(p => (
              <div key={p.username} className={`player-row color-${p.color}`}>
                <span className="player-color-dot" />
                <span className="player-name">{p.username} {p.username === username ? '(You)' : ''}</span>
                <span className="player-host">{p.username === room.host ? '👑 Host' : ''}</span>
                <span className={`player-ready ${p.ready ? 'ready' : ''}`}>
                  {p.ready ? '✓ Ready' : 'Not Ready'}
                </span>
              </div>
            ))}

            {/* Empty slots */}
            {Array.from({ length: room.maxPlayers - room.players.length }).map((_, i) => (
              <div key={`empty-${i}`} className="player-row empty">
                <span className="player-color-dot" />
                <span className="player-name">Waiting for player...</span>
              </div>
            ))}
          </div>

          <div className="lobby-buttons">
            <button className="btn-secondary" onClick={() => gameClient.toggleReady()}>
              {room.players.find(p => p.username === username)?.ready ? 'Not Ready' : 'Ready'}
            </button>
            {room.host === username && (
              <button
                className="btn-primary"
                onClick={() => gameClient.startGame()}
                disabled={room.players.length < 2 || !room.players.every(p => p.ready)}
              >
                🎮 Start Game
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function GameScreen({ room, username, onLogout }: {
  room: RoomData;
  username: string;
  onLogout: () => void;
}) {
  const game = room.game!;
  const currentPlayer = game.players[game.turn];
  const isMyTurn = currentPlayer?.username === username;
  const myPlayer = game.players.find(p => p.username === username);
  const winner = game.phase === 'gameover' ? game.players.find(p => p.finished) : null;

  return (
    <div className="game-layout">
      <div className="game-header">
        <h2>🎲 Room: {room.code}</h2>
        <div className="game-players">
          {game.players.map(p => (
            <span
              key={p.username}
              className={`game-player ${p.color} ${game.turn === game.players.indexOf(p) ? 'active' : ''} ${p.finished ? 'finished' : ''}`}
            >
              {p.color === 'red' ? '🔴' : p.color === 'green' ? '🟢' : p.color === 'yellow' ? '🟡' : '🔵'}
              {p.username}
              {p.finished ? ' 🏆' : ''}
            </span>
          ))}
        </div>
        <button className="btn-small" onClick={onLogout}>Leave</button>
      </div>

      <div className="game-main">
        <div className="board-section">
          {winner && (
            <div className="winner-banner">
              🎉 {winner.username} ({winner.color}) wins! 🎉
            </div>
          )}
          <Board
            game={game}
            myColor={myPlayer?.color}
            isMyTurn={isMyTurn}
            phase={game.phase}
            onMoveToken={(idx: number) => gameClient.moveToken(idx)}
          />
          <div className="game-controls">
            {isMyTurn && game.phase === 'roll' && (
              <button className="btn-primary dice-btn" onClick={() => gameClient.rollDice()}>
                🎲 Roll Dice
              </button>
            )}
            {game.phase === 'move' && isMyTurn && (
              <span className="turn-msg">Select a highlighted token to move!</span>
            )}
            {!isMyTurn && game.phase !== 'gameover' && (
              <span className="turn-msg waiting">
                Waiting for {currentPlayer?.username} ({currentPlayer?.color})...
              </span>
            )}
          </div>
          <Dice value={game.dice} rolling={false} />
        </div>

        <div className="side-panel">
          <GameStatus game={game} username={username} />
          <Chat username={username} />
        </div>
      </div>
    </div>
  );
}

function GameStatus({ game }: { game: RoomData['game']; username: string }) {
  return (
    <div className="game-status">
      <h3>Game Status</h3>
      {game?.players.map(p => (
        <div key={p.username} className={`status-row ${p.color}`}>
          <span>{p.color === 'red' ? '🔴' : p.color === 'green' ? '🟢' : p.color === 'yellow' ? '🟡' : '🔵'}</span>
          <span>{p.username}</span>
          <span>{p.tokens.filter(t => t.pos === 58).length}/4 home</span>
        </div>
      ))}
    </div>
  );
}

export default App;
