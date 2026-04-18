# Hey cole - personal assistant

<img src="assets/cole.png" alt="Hey Cole" width="300">

![**Cole**]([https://opencode.ai](https://share.google/aimode/9kV6DNPTUiMUktL6v)) is a personal assistant, radically honest. Powered by [OpenCode](https://opencode.ai), it acts as a strategic partner who challenges your ideas and manages your high-level planning from Telegram.

## ⚠️ Security Warning & Disclaimer

**Hey Cole is a powerful tool with full access to your computer and connected accounts. Improper configuration can lead to catastrophic data loss or security breaches.**

### Why this is dangerous:
1.  **Computer Access**: Hey Cole has permission to read and write files on your local machine. A misinterpreted command or a "hallucination" could result in the deletion of critical system files or private data.
2.  **GitHub Access**: With a Personal Access Token (PAT), the bot can push code, create repositories, and modify your projects. While we have restricted repository deletion in the prompt, the underlying token may still have that power if not restricted at the GitHub level.
3.  **Google Workspace**: Access to your Calendar and Gmail means the bot can read private communications and send emails on your behalf.
4.  **Telegram exposure**: If you do not set an `OWNER_CHAT_ID`, anyone who finds your bot token or link could potentially control your computer.

### Best Practices:
*   **ALWAYS** set `OWNER_CHAT_ID` to your specific Telegram ID.
*   **DO NOT** run this bot on a production server or a machine with unencrypted sensitive data.
*   **USE FINE-GRAINED TOKENS**: When creating a GitHub PAT, only grant the minimum necessary scopes.
*   **MONITOR LOGS**: Keep an eye on the console output to see what commands the bot is executing.

## Features

### 1. Idea refinement

**Example:**
```
> **You:** "I want to start a side project building a new CRM."
> **Cole:** "juepa, but wait—what makes yours better than the 500 existing ones? Who is paying for this on Day 1? And why build from scratch when you can use X?"
``` 
**When to use:** Ideation, strategic pivots, and "shameless" shortcut validation.

### 2. Strategic Todos & Execution Plans
Cole maintains your `todos.md` natively. For every task you add, he generates a **3-5 step Execution Plan** automatically.

**Example:**
```
> **You:** "Add a todo to implement Auth."
> **Cole:** "⚡ Done. Here is your plan: 1. Setup Passport.js, 2. Create JWT middleware, 3. Build Login UI, 4. Test edge cases."
```

**When to use:** Task management, project breakdown, daily focus.

### 3. Executive Assistant (Google Workspace)
With Google Workspace integration, Cole manages your calendar and email.

**Example:**
```
> **You:** "What's on my calendar tomorrow?"
> **Cole:** (Queries Google Calendar) "You have 3 events. Should we prep for the 10am meeting?"
```
**When to use:** Daily standups, meeting prep, bi-weekly planning.

### 4. Professional Delegation (GitHub)
Cole manages your GitHub repositories through MCP. He can identify collaborators and "delegate" issues by drafting technical specs as comments.

**Example:**
```
> **You:** "Delegate issue #5."
> **Cole:** (Analyzes and creates a detailed spec comment) "I've drafted the requirements. Should I assign this to @collaborator?"
```

**When to use:** Issue management, team coordination, code review.

### 5. Multi-Project Support


You can manage multiple projects simultaneously. Each project has its own isolated conversation history.
*   Use `/project my-startup` to start a new project or switch to an existing one.
*   By default, you are in the `main` project.
*   Use `/history` to see which project you are currently in.

## Model Tiers & Dual-Brain Logic 🧠🍍

Hey Cole uses a **$0 budget, high-intelligence** strategy. Choose between three "Brains" served via OpenCode Zen:

1.  **⚡ Fast**: Uses `big-pickle`. Balanced speed & quality for daily tasks.
2.  **🧠 Smart**: Uses `minimax-m2.5-free`. High intelligence for complex code.
3.  **🚀 Pro**: Uses `gemini-3-flash`. Top-tier reasoning for difficult problems.

Use `/models` to select your brain tier.

### 🛡️ Dual-Brain Precision Mode (Cross-Verification)
When you turn on `/precision`, Cole engages **Cross-Verification**:
*   If you are in **Smart**, the **Pro** brain verifies the work.
*   If you are in **Pro**, the **Smart** brain verifies the work.
*   **The Benefit**: Using two different model families to check each other is the single best way to kill hallucinations for free.



## Google Workspace Setup (Optional)

To enable Calendar and Gmail features:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Gmail API and Google Calendar API
4. Go to APIs & Services > Credentials
5. Create OAuth 2.0 Client ID for Desktop App
6. Download credentials JSON
7. The bot will handle OAuth flow on first use:
   ```bash
   node src/skills/google.js setup
   ```

## GitHub Integration (Optional)

To enable GitHub commands:

1. Create Personal Access Token: https://github.com/settings/tokens
2. Select scopes: `repo`, `read:user`, `workflow`
3. Add to `.env`: `GITHUB_TOKEN=your_token`

### GitHub Integration via MCP

Hey Cole uses the native `github` MCP server. It uses your `GITHUB_TOKEN` directly to manage your repositories.

> **You:** "List my repositories"
> **Hey Cole:** (Queries GitHub MCP) "Here are your recent repositories..."

> **You:** "Create a new issue on the hey-cole repo"
> **Hey Cole:** (Uses `create_issue` tool) "Issue #12 created successfully."

**Security Note:** Hey Cole is instructed never to delete repositories or close issues without explicit confirmation.



### 2. Configure OpenCode (The "Brain")
El Coleto relies on a local [OpenCode](https://opencode.ai) server to handle models and projects.

1.  **Install OpenCode**: Follow the [official guide](https://opencode.ai/docs/intro).
2.  **Authenticate (One-time)**: Link your Zen or other model providers directly in your terminal:
    ```bash
    opencode /connect  # Use the interactive UI to link Zen
    # OR
    opencode auth login # For specific providers
    ```
    > [!IMPORTANT]
    > **Note on Credentials**: You do **not** need to put your Zen or OpenAI API keys in the bot's `.env`. Cole automatically uses whatever credentials you've configured in your local OpenCode CLI.

3.  **Start the Server**:
    ```bash
    opencode serve
    ```

---

## Quick Setup

### 1. Create Telegram Bot

1. Open [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow instructions
3. Copy the bot token

### 2. Install & Configure

```bash
# Clone or download this project
cd hey-cole-bot

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your settings
# Required: TELEGRAM_BOT_TOKEN=<your_token>
# Required: BOT_PASSWORD=<strong_password>
```

### 3. Run

```bash
npm start
```

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from @BotFather |
| `OWNER_CHAT_ID` | No | Your Telegram ID (for owner-only access) |
| `BOT_PASSWORD` | Strong | Password for user authorization |
| `GOOGLE_CLIENT_ID` | No | For Calendar/Gmail features |
| `GOOGLE_CLIENT_SECRET` | No | For Calendar/Gmail features |
| `GITHUB_TOKEN` | No | For GitHub MCP integration |

## Security

Hey Cole enforces strong password protection:

*   **Minimum 12 characters**
*   **Must include**: Uppercase, lowercase, numbers, and symbols
*   **Rate Limited**: 3 attempts per 10 minutes before lockout (5 min)

### Security Modes

1. **Owner-Only (Recommended)**: Set `OWNER_CHAT_ID` in `.env`
   - Only your Telegram account can access the bot
   - No `/auth` command accepted
   - safest mode
2. **Password-Protected**: Set `BOT_PASSWORD` in `.env` (without OWNER_CHAT_ID)
   - Users must `/auth <password>` to use the bot
3. **Public**: Leave both empty (NOT recommended)

## Commands

| Command | Description |
|--------|-------------|
| `/start` | Welcome message |
| `/help` | Show all commands |
| `/project <name>` | Switch between project contexts (multi-project support) |
| `/models` | Select AI model |
| `/precision` | Toggle dual-verification mode |
| `/new` | Start new session in current project |
| `/clear` | Clear conversation in current project |
| `/abort` | Cancel generation |
| `/undo` | Revert last message |
| `/summarize` | Summarize conversation |
| `/history` | Session & Project info |
| `/health` | Bot status |
| `/myid` | Get your chat ID |
| `/auth <password>` | Authorize (if password set) |

## Architecture

```
src/
├── index.js              # Bot entry point & security check
├── handlers/
│   ├── commandHandler.js  # Telegram commands & project switching
│   └── messageHandler.js # Message processing & MCP bridge
├── services/
│   ├── opencode.js    # OpenCode SDK client
│   └── session.js     # Session & Project management
├── middleware/
│   └── auth.js       # Authorization & rate limiting
├── utils.js         # Password validation & message splitting
└── skills/
    └── google.js    # Google Workspace legacy bridge
```

## Testing

```bash
# Run unit tests
npm test
```

## Troubleshooting

### "Event stream not supported"
This is normal - falls back to request/response mode.

### Bot not responding
- Check `.env` configuration
- Verify bot token is correct
- Run `/health` to check status

### MCP permission errors
- The bot will prompt for permissions automatically.
- Click "Allow" or "Deny" inline buttons.

## License

MIT
