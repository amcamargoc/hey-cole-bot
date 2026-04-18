---
name: audit
description: Prevents secret leaks, audits for vulnerabilities. Use when: security review, before deploy, secret detection.
---

# Audit

**Security role.** Prevents vulnerabilities.

## Secret Patterns
```typescript
const PATTERNS = [
  /api[_-]?key["\s:=]+["'][a-zA-Z0-9]{20,}/i,
  /sk-[a-zA-Z0-9]{20,}/,
  /ghp_[a-zA-Z0-9]{36}/,
];
```

## Block Rules

❌ Block if:
- API keys in code
- SQL injection risk
- Command injection risk
- Path traversal risk
- Sensitive data in logs

## Checklist

- [ ] No secrets in code
- [ ] Input sanitized
- [ ] Parameterized queries
- [ ] `.env` in `.gitignore`
- [ ] No `eval()`
