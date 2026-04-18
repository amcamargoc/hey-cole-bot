import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { google } from 'googleapis';
import http from 'http';
import { exec } from 'child_process';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
];

const TOKEN_PATH = path.join(process.cwd(), '.google-token.json');
const REDIRECT_PORT = 3000;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}`;

async function getOAuthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('MISSING SECRETS: Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file.');
  }

  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );
}

async function loadSavedCredentials(client) {
  try {
    const content = await fs.readFile(TOKEN_PATH, 'utf8');
    const tokens = JSON.parse(content);
    client.setCredentials(tokens);
    return client;
  } catch (err) {
    return null;
  }
}

async function saveCredentials(tokens) {
  await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens));
}

async function authorize() {
  const client = await getOAuthClient();
  const loadedClient = await loadSavedCredentials(client);
  if (loadedClient) return loadedClient;

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      console.log(`Received request: ${req.url}`);
      try {
        const url = new URL(req.url, REDIRECT_URI);
        const code = url.searchParams.get('code');
        
        if (code) {
          res.end('Authentication successful! You can close this tab and return to the terminal.');
          server.close();
          
          const { tokens } = await client.getToken(code);
          client.setCredentials(tokens);
          await saveCredentials(tokens);
          console.log('Token securely saved locally to .google-token.json.');
          resolve(client);
        }
      } catch (e) {
        reject(e);
      }
    }).listen(REDIRECT_PORT, () => {
      const authUrl = client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
      });
      console.log('--- ACTION REQUIRED ---');
      console.log('Opening browser for authorization...');
      console.log('If it does not open automatically, visit this URL:\n');
      console.log(authUrl);
      console.log('\n-----------------------');
      
      const startCommand = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${startCommand} "${authUrl}"`);
    });
  });
}

async function listEvents(auth) {
  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  });
  
  const events = res.data.items;
  if (!events || events.length === 0) {
    console.log('No upcoming events found.');
    return;
  }
  
  console.log('Upcoming events:');
  events.forEach((event, i) => {
    const start = event.start.dateTime || event.start.date;
    console.log(`${i + 1}. [${start}] ${event.summary}`);
  });
}

async function createEvent(auth, details) {
  const calendar = google.calendar({ version: 'v3', auth });
  const event = {
    summary: details.summary,
    description: details.description || '',
    start: {
      dateTime: details.start,
      timeZone: details.timeZone || 'UTC',
    },
    end: {
      dateTime: details.end || new Date(new Date(details.start).getTime() + (details.duration || 60) * 60000).toISOString(),
      timeZone: details.timeZone || 'UTC',
    },
  };
  const res = await calendar.events.insert({
    calendarId: 'primary',
    resource: event,
  });
  console.log(`Event created successfully: ${res.data.htmlLink}`);
}

async function listEmails(auth) {
  const gmail = google.gmail({ version: 'v1', auth });
  const res = await gmail.users.messages.list({
    userId: 'me',
    maxResults: 5,
    q: 'is:unread',
  });
  
  const messages = res.data.messages;
  if (!messages || messages.length === 0) {
    console.log('No unread emails found.');
    return;
  }
  
  console.log('Recent Unread Emails:');
  for (const m of messages) {
    const msg = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'metadata', metadataHeaders: ['Subject', 'From'] });
    const headers = msg.data.payload.headers;
    const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
    const from = headers.find(h => h.name === 'From')?.value || 'Unknown sender';
    console.log(`- From: ${from} | Subject: ${subject} | Snippet: ${msg.data.snippet}`);
  }
}

async function sendEmail(auth, details) {
  const gmail = google.gmail({ version: 'v1', auth });
  
  const message = [
    `To: ${details.to}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${details.subject}`,
    '',
    details.body,
  ].join('\r\n');

  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await gmail.users.messages.send({
    userId: 'me',
    resource: {
      raw: encodedMessage,
    },
  });
  console.log(`Email sent successfully. ID: ${res.data.id}`);
}

async function main() {
  const command = process.argv[2];
  const args = process.argv[3] ? JSON.parse(process.argv[3]) : {};
  
  if (command === 'setup') {
    try {
      if (await fs.stat(TOKEN_PATH).catch(() => false)) {
        await fs.unlink(TOKEN_PATH);
      }
      await authorize();
      console.log('OAuth setup completed successfully!');
    } catch (e) {
      console.error('Setup failed:', e.message);
    }
    process.exit();
  }
  
  const auth = await authorize();
  
  try {
    switch (command) {
      case 'events':
        await listEvents(auth);
        break;
      case 'create-event':
        await createEvent(auth, args);
        break;
      case 'emails':
        await listEmails(auth);
        break;
      case 'send-email':
        await sendEmail(auth, args);
        break;
      default:
        console.log('Valid commands: setup, events, create-event, emails, send-email');
    }
  } catch (err) {
    console.error(`Command '${command}' failed:`, err.message);
  }
}

main().catch(console.error);
