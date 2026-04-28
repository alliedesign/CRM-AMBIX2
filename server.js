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

  // helper to normalize phone numbers to E.164 if possible
  const formatE164 = (phone) => {
    if (!phone) return null;
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 10) return `+1${clean}`;
    if (clean.length > 10 && !phone.startsWith('+')) return `+${clean}`;
    return phone.startsWith('+') ? phone : `+${phone}`;
  };

  // API for outreach (Email/SMS)
  app.post('/api/send-outreach', async (req, res) => {
    console.log('--- Outreach Request ---');
    const { type, recipients, subject, message } = req.body;

    const fromEmail = process.env.SENDGRID_FROM_EMAIL;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    try {
      if (type === 'email') {
        const apiKey = process.env.SENDGRID_API_KEY;
        if (!apiKey || !fromEmail) {
          throw new Error('SendGrid API key or From Email (SENDGRID_FROM_EMAIL) not configured in Settings.');
        }

        sgMail.setApiKey(apiKey);
        const validRecipients = recipients.filter(r => r.email);
        
        if (validRecipients.length === 0) {
          throw new Error('No recipients with valid email addresses were found.');
        }

        const msgs = validRecipients.map(recipient => ({
          to: recipient.email.trim().toLowerCase(),
          from: fromEmail,
          subject: subject || 'Message from Ambix Allie',
          text: message,
          html: `<div style="font-family: sans-serif; padding: 20px; color: #334155; line-height: 1.6;">
                  <h1 style="color: #0f172a; font-size: 24px;">${subject || 'Outreach Broadcast'}</h1>
                  <p style="font-size: 16px;">${message.replace(/\n/g, '<br>')}</p>
                  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                  <div style="font-size: 11px; color: #94a3b8; text-align: center;">
                    <p>Sent via Allie Portal • Ambix Allie Agency</p>
                  </div>
                 </div>`,
        }));

        try {
          await sgMail.send(msgs);
          console.log(`[SendGrid] Successfully dispatched ${msgs.length} emails from ${fromEmail}`);
        } catch (sgError) {
          const body = sgError.response?.body;
          console.error('[SendGrid Error Details]:', JSON.stringify(body, null, 2));
          
          if (sgError.code === 403) {
            throw new Error(`SendGrid Forbidden: The "From" email "${fromEmail}" is not verified in your SendGrid dashboard. Please complete "Sender Authentication".`);
          }
          if (sgError.code === 401) {
            throw new Error('SendGrid Unauthorized: Your API Key is invalid or expired.');
          }
          throw new Error(body?.errors?.[0]?.message || sgError.message);
        }
      } else if (type === 'sms') {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;

        if (!accountSid || !authToken || !fromNumber) {
          throw new Error('Twilio credentials or From Number (TWILIO_FROM_NUMBER) not configured in Settings.');
        }

        const client = twilio(accountSid, authToken);
        const validRecipients = recipients.filter(r => r.phone);

        if (validRecipients.length === 0) {
          throw new Error('No recipients with valid phone numbers were found.');
        }

        const results = [];
        for (const recipient of validRecipients) {
          const to = formatE164(recipient.phone);
          try {
            const smsResp = await client.messages.create({
              body: message,
              to: to,
              from: fromNumber
            });
            console.log(`[Twilio] SMS to ${to} - SID: ${smsResp.sid}, Status: ${smsResp.status}`);
            results.push({ to, success: true });
          } catch (twilioErr) {
            console.error(`[Twilio Error] to ${to}:`, twilioErr.message);
            results.push({ to, success: false, error: twilioErr.message });
          }
        }

        const failures = results.filter(r => !r.success);
        if (failures.length === results.length) {
          const lastErr = failures[0].error;
          if (lastErr.includes('Trial')) {
            throw new Error(`Twilio Trial Account: You can only send SMS to numbers you have verified in the Twilio Console.`);
          }
          throw new Error(`Twilio Error: ${lastErr}`);
        }
      }

      res.json({ success: true, message: 'Outreach dispatched' });
    } catch (error) {
      console.error('Outreach API Error:', error);
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
