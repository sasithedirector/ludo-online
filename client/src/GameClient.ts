import { io, Socket } from 'socket.io-client';
import { API_URL } from './types';
import type { RoomData, ChatMessage } from './types';

class GameClient {
  private socket: Socket | null = null;
  private token: string | null = null;
  private username: string | null = null;
  private listeners: Map<string, Function[]> = new Map();
  private connected: boolean = false;
  private pendingEmit: Array<{ event: string; data: any }> = [];

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
  isConnected() { return this.connected; }

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
    this.connected = false;
    localStorage.removeItem('ludo_token');
    localStorage.removeItem('ludo_username');
    this.disconnect();
  }

  connectSocket(): Socket {
    if (this.socket?.connected) return this.socket;
    this.socket = io(API_URL, {
      auth: { token: this.token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.connected = true;
      this.emit('connected');
      // Flush any pending emits
      while (this.pendingEmit.length > 0) {
        const { event, data } = this.pendingEmit.shift()!;
        this.socket?.emit(event, data);
      }
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      this.emit('disconnected');
    });

    this.socket.on('roomUpdate', (data: RoomData) => {
      this.emit('roomUpdate', data);
    });

    this.socket.on('error', (data: { message: string }) => {
      console.error('Socket error:', data.message);
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
      this.connected = false;
    }
  }

  // ─── Safe emit: queues if not connected ───
  private safeEmit(event: string, data: any) {
    if (this.connected && this.socket) {
      this.socket.emit(event, data);
    } else {
      console.warn(`Socket not connected, queuing event: ${event}`);
      this.pendingEmit.push({ event, data });
    }
  }

  createRoom() {
    this.safeEmit('createRoom', { token: this.token });
  }

  joinRoom(roomCode: string) {
    this.safeEmit('joinRoom', { token: this.token, roomCode });
  }

  toggleReady() {
    this.safeEmit('toggleReady', { token: this.token });
  }

  startGame() {
    this.safeEmit('startGame', { token: this.token });
  }

  rollDice() {
    this.safeEmit('rollDice', { token: this.token });
  }

  moveToken(tokenIdx: number) {
    this.safeEmit('moveToken', { token: this.token, tokenIdx });
  }

  sendChat(message: string) {
    this.safeEmit('sendChat', { token: this.token, message });
  }
}

export const gameClient = new GameClient();
