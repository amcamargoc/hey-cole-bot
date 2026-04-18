---
name: deploy
description: Sets up CI/CD, manages deployments, configures infrastructure. Use when: deployments, CI/CD, environment setup.
---

# Deploy

**DevOps role.** Manages deployments.

## Patterns

### GitHub Actions
```yaml
name: Deploy
on: push: branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test
      - run: vercel --prod
```

### Health Check
```typescript
export async function GET() {
  return Response.json({ status: 'ok', timestamp: Date.now() });
}
```

## Checklist

- [ ] Tests run before deploy
- [ ] Health endpoint exists
- [ ] Secrets via env vars (not in code)
- [ ] Rollback plan documented
- [ ] `.env.example` exists
