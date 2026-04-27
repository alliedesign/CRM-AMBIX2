import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors());
  app.use(express.json());

  // API to generate Jitsi JaaS tokens
  app.post('/api/jitsi-token', (req, res) => {
    try {
      const { roomName, userName, isAdmin } = req.body;
      const appId = process.env.VITE_JITSI_APP_ID;
      const apiKey = process.env.JITSI_API_KEY;
      const privateKey = process.env.JITSI_PRIVATE_KEY;

      if (!appId || !apiKey || !privateKey) {
        return res.status(200).json({ token: null, message: 'JaaS not configured' });
      }

      // Format private key if it's missing newlines
      let formattedKey = privateKey;
      if (!privateKey.includes('\n')) {
        formattedKey = privateKey.replace(/\\n/g, '\n');
      }

      const payload = {
        aud: 'jitsi',
        iss: 'chat',
        sub: appId,
        room: roomName === '*' ? '*' : roomName,
        exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
        nbf: Math.floor(Date.now() / 1000) - 10,
        context: {
          user: {
            name: userName || (isAdmin ? 'Allie (Host)' : 'Client'),
            affiliation: isAdmin ? 'owner' : 'member',
            moderator: isAdmin ? true : false,
          },
          features: {
            livestreaming: true,
            recording: true,
            transcription: true,
            'outbound-call': true,
          }
        }
      };

      const token = jwt.sign(payload, formattedKey, {
        algorithm: 'RS256',
        header: {
          kid: apiKey,
          typ: 'JWT',
          alg: 'RS256'
        }
      });

      res.json({ token });
    } catch (error) {
      console.error('Error generating Jitsi token:', error);
      res.status(500).json({ error: 'Failed to generate token' });
    }
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
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

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
