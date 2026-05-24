# Railway Deployment Configuration
# ==================================
#
# Deploy this repo on Railway.
#
# Option A: Use railway.json (recommended)
#   1. Push this file to your repo root
#   2. Go to Railway Dashboard → New Project → Deploy from GitHub
#   3. Railway auto-detects this config
#
# Option B: Use Nixpacks (auto-detected from package.json)
#   1. Go to Railway Dashboard → New Project → Deploy from GitHub
#   2. Railway auto-detects Node.js and uses the start script
#   3. Set environment variable: NODE_ENV = production
#
# Environment Variables to set on Railway:
#   NODE_ENV = production
#   PORT = 3001
