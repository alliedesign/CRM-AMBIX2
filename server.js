import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('--- SERVER STARTING ---');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DAILY_API_KEY exists:', !!process.env.DAILY_API_KEY);
console.log('VITE_DAILY_DOMAIN exists:', !!process.env.VITE_DAILY_DOMAIN);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // IMPORTANT: Root-level CORS and headers
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  app.use(express.json());

  // Global timeout middleware
  app.use((req, res, next) => {
    res.setTimeout(30000, () => {
      console.error(`Request timeout: ${req.method} ${req.url}`);
      res.status(408).send('Request Timeout');
    });
    next();
  });

  // Debug middleware to log only API requests
  app.use((req, res, next) => {
    if (req.url.startsWith('/api/')) {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    }
    next();
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(), 
      message: 'Secure Video API is online',
      env: {
        daily: !!process.env.DAILY_API_KEY,
        domain: !!process.env.VITE_DAILY_DOMAIN
      }
    });
  });

  app.get('/api/test', (req, res) => {
    res.json({ message: 'Success! API is reachable.' });
  });

  // API to generate Daily.co meeting tokens
  app.post('/api/daily-token', async (req, res) => {
    console.log('--- Daily Token Request ---');
    console.log('Room:', req.body.roomName);
    
    try {
      const { roomName, userName, isAdmin } = req.body;
      const apiKey = process.env.DAILY_API_KEY;

      if (!apiKey) {
        console.error('DAILY_API_KEY is missing in process.env');
        return res.status(500).json({ error: 'Daily.co API Key is missing' });
      }

      const cleanRoomName = roomName.replace(/[^a-zA-Z0-9_-]/g, '-');
      
      // 1. Create Room (ignoring 400 errors as room might exist)
      const roomRes = await fetch('https://api.daily.co/v1/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          name: cleanRoomName,
          properties: {
            enable_chat: true,
            exp: Math.floor(Date.now() / 1000) + (60 * 60 * 2)
          }
        })
      });
      console.log('Room creation status:', roomRes.status);

      // 2. Generate token
      const tokenRes = await fetch('https://api.daily.co/v1/meeting-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          properties: {
            room_name: cleanRoomName,
            is_owner: isAdmin,
            user_name: userName || (isAdmin ? 'Allie (Host)' : 'Client'),
          }
        })
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error('Daily Token Error:', errText);
        return res.status(tokenRes.status).json({ error: 'Daily API error', details: errText });
      }

      const tokenData = await tokenRes.json();
      const domain = process.env.VITE_DAILY_DOMAIN || 'your-domain';
      const roomUrl = `https://${domain}.daily.co/${cleanRoomName}`;

      console.log('Token generated successfully');
      res.json({ 
        token: tokenData.token, 
        roomUrl: roomUrl 
      });
    } catch (error) {
      console.error('Critical Server Error:', error);
      res.status(500).json({ error: 'Internal Server Error', message: error instanceof Error ? error.message : String(error) });
    }
  });

  // Catch-all for other API routes to prevent falling through to Vite
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`--- SERVER READY ---`);
    console.log(`URL: http://0.0.0.0:${PORT}`);
    console.log(`Health: http://0.0.0.0:${PORT}/api/health`);
  });
}

startServer();
