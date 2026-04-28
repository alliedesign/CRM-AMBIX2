import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import dotenv from 'dotenv';
import sgMail from '@sendgrid/mail';
import twilio from 'twilio';

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
  const PORT = process.env.PORT || 3000;

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
        daily_api_key_configured: !!process.env.DAILY_API_KEY,
        daily_domain: process.env.VITE_DAILY_DOMAIN || null,
        node_env: process.env.NODE_ENV
      }
    });
  });

  app.get('/api/test', (req, res) => {
    res.json({ message: 'Success! API is reachable.' });
  });

  // API for outreach (Email/SMS)
  app.post('/api/send-outreach', async (req, res) => {
    console.log('--- Outreach Request ---');
    const { type, recipients, subject, message } = req.body;

    try {
      if (type === 'email') {
        const apiKey = process.env.SENDGRID_API_KEY;
        const fromEmail = process.env.SENDGRID_FROM_EMAIL;

        if (!apiKey || !fromEmail) {
          throw new Error('SendGrid API key or From Email not configured on server.');
        }

        sgMail.setApiKey(apiKey);

        const validRecipients = recipients.filter(r => r.email);
        if (validRecipients.length === 0) {
          throw new Error('No recipients with valid email addresses.');
        }

        const msgs = validRecipients.map(recipient => ({
          to: recipient.email,
          from: fromEmail,
          subject: subject || 'Message from Ambix Allie',
          text: message,
          html: `<div style="font-family: sans-serif; padding: 20px; color: #334155; line-height: 1.6;">
                  <h1 style="color: #0f172a; font-size: 24px;">${subject || 'Message from Allie'}</h1>
                  <p style="font-size: 16px;">${message.replace(/\n/g, '<br>')}</p>
                  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                  <div style="font-size: 11px; color: #94a3b8; text-align: center;">
                    <p>Ambix Allie Agency • Professional Outreach Services</p>
                    <p>Sent via Allie Portal</p>
                  </div>
                 </div>`,
        }));

        await sgMail.send(msgs);
        console.log(`Successfully sent ${msgs.length} emails via SendGrid`);
      } else if (type === 'sms') {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_FROM_NUMBER;

        if (!accountSid || !authToken || !fromNumber) {
          throw new Error('Twilio credentials not configured on server.');
        }

        const client = twilio(accountSid, authToken);

        const validRecipients = recipients.filter(r => r.phone);
        if (validRecipients.length === 0) {
          throw new Error('No recipients with valid phone numbers.');
        }

        const smsPromises = validRecipients.map(recipient => {
          return client.messages.create({
            body: message,
            to: recipient.phone,
            from: fromNumber
          });
        });

        await Promise.all(smsPromises);
        console.log(`Successfully sent ${smsPromises.length} SMS via Twilio`);
      } else {
        return res.status(400).json({ error: 'Invalid outreach type' });
      }

      res.json({ success: true, message: 'Outreach dispatched successfully' });
    } catch (error) {
      console.error('Outreach Error:', error);
      res.status(500).json({ 
        error: 'Outreach failure', 
        message: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // API to generate Daily.co meeting tokens
  app.post('/api/daily-token', async (req, res) => {
    console.log('--- Daily Token Request ---');
    console.log('Room:', req.body.roomName);
    
    try {
      const { roomName, userName, isAdmin } = req.body;
      const apiKey = process.env.DAILY_API_KEY;

      if (!apiKey) {
        console.error('CRITICAL: DAILY_API_KEY is missing in process.env');
        return res.status(500).json({ 
          error: 'Daily.co API Key is not configured on the server.',
          message: 'Please ensure DAILY_API_KEY is set in your environment variables/secrets.' 
        });
      }

      if (!process.env.VITE_DAILY_DOMAIN) {
        console.error('CRITICAL: VITE_DAILY_DOMAIN is missing in process.env');
        return res.status(500).json({ 
          error: 'Daily.co Domain is not configured on the server.',
          message: 'Please ensure VITE_DAILY_DOMAIN is set in your environment variables.' 
        });
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
      const domain = process.env.VITE_DAILY_DOMAIN;
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
    console.log(`Port: ${PORT}`);
    console.log(`Health: /api/health`);
  }).on('error', (err) => {
    console.error('SERVER LISTEN ERROR:', err);
    process.exit(1);
  });
}

startServer().catch(err => {
  console.error('FATAL STARTUP ERROR:', err);
  process.exit(1);
});
