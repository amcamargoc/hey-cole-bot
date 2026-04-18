---
name: clarify
description: Clarifies vague ideas into specific requirements. Use when: user describes a project vaguely, needs help defining scope, unclear requirements, "I want to build something like X".
---

# Clarify

**Transforms broad ideas into specific, actionable requirements.**

## Process

### 1. Clarify the "What"

Ask the user to clarify:
- Who is this for? (users, internal team, enterprise)
- What's the core value? (one sentence)
- What's the MVP scope? (must-have vs nice-to-have)

### 2. Define Requirements

Output structured requirements:

```markdown
## Project: [Name]

### Users
- Primary: [user type]
- Secondary: [user type]

### Core Features (MVP)
1. [Feature] - [1 sentence description]
2. [Feature] - [1 sentence description]

### Out of Scope
- [Feature]
- [Feature]

### Tech Stack (Suggested)
- Frontend: [framework]
- Backend: [runtime]
- Database: [type]
- Auth: [approach]

### Success Metrics
- [Metric 1]
- [Metric 2]
```

### 3. Break Into Tasks

Convert requirements into issues/tasks:
1. Each feature = one task
2. Each task has acceptance criteria
3. Dependencies noted

## Questions to Ask

| Category | Questions |
|----------|-----------|
| Scope | "What's the minimum viable version?" |
| Users | "Who will use this? What's their technical level?" |
| Auth | "Do you need user accounts? Social login?" |
| Data | "What data will you store? Any sensitive info?" |
| Scale | "How many users? Current/predicted?" |
| Integrations | "Any external services? (payments, email, etc.)" |
| Budget | "Any budget constraints?" |

## Example

**Input:** "I want to build a habit tracker"

**Output:**
```markdown
## Project: Habit Tracker

### Users
- Primary: Individuals tracking personal habits
- Secondary: None (personal app)

### Core Features
1. Daily habit logging - Check off habits each day
2. Streaks - Track consecutive days
3. Statistics - Weekly/monthly progress charts
4. Reminders - Push notifications (future)

### Out of Scope
- Social features
- Team/group tracking
- Premium features

### Tech Stack
- Frontend: Next.js + Tailwind
- Backend: Next.js API routes
- Database: PostgreSQL (Supabase)
- Auth: Email magic link

### Tasks
- [ ] Setup project with Next.js + Supabase
- [ ] Create habits table with user relation
- [ ] Build daily check-in UI
- [ ] Implement streak calculation
- [ ] Add statistics dashboard
```
