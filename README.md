# 🎲 Ludo Online — Multiplayer

A real-time multiplayer Ludo board game. Create a room, share the code with friends, and play together in your browser!

**Try it locally or deploy your own instance below.**

## Features

- 🏠 **Create rooms** with 6-character invite codes
- 🔒 **Authentication** — register/login with JWT
- 🎮 **4-player** real-time gameplay
- 💬 **In-game chat**
- 🎲 **Animated dice** with token movement
- ⚔️ **Capture** opponent tokens
- 🎯 **Safe zones** (⭐ cells)
- 🏆 **Win detection**
- 📱 **Responsive** dark theme UI

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite |
| Backend | Node.js + Express |
| Realtime | Socket.IO |
| Auth | JWT + bcrypt |
| Build | Vite (client), Nixpacks/Render (server) |

## Quick Start (Local)

```bash
# Clone the repo
git clone https://github.com/sasithedirector/ludo-online.git
cd ludo-online

# Start the server
cd server
npm install
npm start

# In another terminal, start the client
cd client
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Deployment

### Option A: Render (Recommended — Free Tier)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

Or manually:
1. Push this repo to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com) → **New → Web Service**
3. Connect your repo
4. Settings:
   - **Build Command:** `npm run install`
   - **Start Command:** `npm start`
   - **Environment:** `NODE_ENV=production`
5. Click **Deploy**

Render auto-detects `render.yaml` if present.

### Option B: Railway (Free Tier)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

Or manually:
1. Push this repo to GitHub
2. Go to [Railway Dashboard](https://railway.app) → **New Project → Deploy from GitHub**
3. Railway auto-detects Node.js via `railway.json`
4. Set environment variable: `NODE_ENV=production`
5. Deploy!

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `3001` |
| `NODE_ENV` | `development` or `production` | `development` |
| `JWT_SECRET` | Secret for JWT tokens | `ludo-secret-key...` |
| `VITE_API_URL` | API URL for client (empty = same origin) | `''` |

## Project Structure

```
ludo-online/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # Board, Dice, Chat
│   │   ├── App.tsx      # Main app with auth, lobby, game screens
│   │   ├── GameClient.ts # Socket.IO client wrapper
│   │   └── types.ts     # Board constants, interfaces
│   └── vite.config.ts   # Vite config with API proxy
├── server/
│   └── index.js         # Express + Socket.IO server
├── render.yaml          # Render deployment config
├── railway.json         # Railway deployment config
└── package.json         # Root install + start scripts
```

## Game Rules

1. **Roll 6** to bring a token out of home
2. **Move clockwise** around the board
3. **Capture** opponents by landing on them (safe cells ⭐ are protected)
4. **Roll 6** again for an extra turn
5. Enter your **home stretch** from the correct entry cell
6. First to get **all 4 tokens to the center** wins!

## License

MIT
