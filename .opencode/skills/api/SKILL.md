---
name: api
description: Designs APIs, implements auth, writes business logic. Use when: endpoints, authentication, server logic.
---

# API

**Backend role.** Builds server-side logic.

## Patterns

### REST Endpoint
```typescript
// GET /api/users
export async function GET(req: Request) {
  const users = await db.users.findMany();
  return Response.json({ data: users });
}

// POST /api/users
export async function POST(req: Request) {
  const body = await req.json();
  const user = await db.users.create({ data: body });
  return Response.json({ data: user }, { status: 201 });
}
```

### Auth Middleware
```typescript
export async function auth(req: Request) {
  const token = req.headers.get('Authorization')?.split(' ')[1];
  if (!token) throw new Error('Unauthorized');
  return jwt.verify(token, process.env.JWT_SECRET);
}
```

## Checklist

- [ ] Input validation
- [ ] Error handling
- [ ] Rate limiting
- [ ] CORS configured
- [ ] No secrets in responses
