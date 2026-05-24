// Serve static frontend in production
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import express from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// In production, serve the built client
if (process.env.NODE_ENV === 'production') {
  const clientBuild = join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientBuild));
  app.get('*', (req, res) => {
    res.sendFile(join(clientBuild, 'index.html'));
  });
}
