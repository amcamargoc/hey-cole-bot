---
name: Google Workspace
description: Interact natively with Google Calendar and Gmail (Read/Write)
---

## Google Workspace Actions

You can execute actions on the user's personal Google Calendar and Gmail using the internal `src/skills/google.js` CLI tool natively wrapped inside the bot architecture. 
You must execute this script using `node` inside the `bash` environment.

### Commands

1. **Check Calendar Events**:
   ```bash
   node src/skills/google.js events
   ```
   *Fetches up to 10 of the user's upcoming events.*

2. **Create Calendar Event**:
   ```bash
   node src/skills/google.js create-event '{"summary":"Lunch with Beto","start":"2026-04-18T13:00:00Z","duration":60,"description":"Discuss project details"}'
   ```
   *Creates an event. `start` must be an ISO string. `duration` is in minutes (default 60). `timeZone` defaults to UTC.*

3. **Check Unread Emails**:
   ```bash
   node src/skills/google.js emails
   ```
   *Fetches the 5 most recent unread emails from the user's Gmail.*

4. **Send Email**:
   ```bash
   node src/skills/google.js send-email '{"to":"recipient@example.com","subject":"Updates","body":"Hello, here are the updates..."}'
   ```
   *Dispatches an email via the API.*

### CRITICAL: Authentication Error
If the bash command yields an error saying "MISSING SECRETS", "credentials.json not found", "token.json not found" or "OAuth setup required", immediately halt and instruct the user to run the setup command in their terminal (NOT via chat).
