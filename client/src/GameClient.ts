import { io, Socket } from 'socket.io-client';
import { API_URL } from './types';
import type { RoomData, ChatMessage } from './types';

class GameClient {
  private socket: Socket | null = null;
  private token: string | null = null;
  private username: string | null = null;
  private listeners: Map<string, Function[]> = new Map();

  constructor() {
    const savedToken = localStorage.getItem('ludo_token');
    const savedUsername = localStorage.getItem('ludo_username');
    if (savedToken && savedUsername) {
      this.token = savedToken;
      this.username = savedUsername;
    }
  }

  isLoggedIn() { return !!this.token; }
  getToken() { return this.token; }
  getUsername() { return this.username; }

  on(event: string, fn: Function) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(fn);
  }

  off(event: string, fn: Function) {
    const arr = this.listeners.get(event);
    if (arr) {
      const idx = arr.indexOf(fn);
      if (idx >= 0) arr.splice(idx, 1);
    }
  }

  private emit(event: string, ...args: any[]) {
    const arr = this.listeners.get(event);
    if (arr) arr.forEach(fn => fn(...args));
  }

  async register(username: string, password: string) {
    const res = await fetch(`${API_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    this.saveAuth(data.token, data.username);
    return data;
  }

  async login(username: string, password: string) {
    const res = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    this.saveAuth(data.token, data.username);
    return data;
  }

  private saveAuth(token: string, username: string) {
    this.token = token;
    this.username = username;
    localStorage.setItem('ludo_token', token);
    localStorage.setItem('ludo_username', username);
  }

  logout() {
    this.token = null;
    this.username = null;
    localStorage.removeItem('ludo_token');
    localStorage.removeItem('ludo_username');
    this.disconnect();
  }

  connectSocket(): Socket {
    if (this.socket?.connected) return this.socket;
    this.socket = io(API_URL, {
      auth: { token: this.token },
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.emit('connected');
    });

    this.socket.on('disconnect', () => {
      this.emit('disconnected');
    });

    this.socket.on('roomUpdate', (data: RoomData) => {
      this.emit('roomUpdate', data);
    });

    this.socket.on('error', (data: { message: string }) => {
      this.emit('error', data.message);
    });

    this.socket.on('chatMessage', (data: ChatMessage) => {
      this.emit('chatMessage', data);
    });

    this.socket.on('joinedRoom', (data: { roomCode: string }) => {
      this.emit('joinedRoom', data);
    });

    return this.socket;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  createRoom() {
    this.socket?.emit('createRoom', { token: this.token });
  }

  joinRoom(roomCode: string) {
    this.socket?.emit('joinRoom', { token: this.token, roomCode });
  }

  toggleReady() {
    this.socket?.emit('toggleReady', { token: this.token });
  }

  startGame() {
    this.socket?.emit('startGame', { token: this.token });
  }

  rollDice() {
    this.socket?.emit('rollDice', { token: this.token });
  }

  moveToken(tokenIdx: number) {
    this.socket?.emit('moveToken', { token: this.token, tokenIdx });
  }

  sendChat(message: string) {
    this.socket?.emit('sendChat', { token: this.token, message });
  }
}

export const gameClient = new GameClient();
