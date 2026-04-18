---
name: review
description: Reviews code for quality, best practices, architecture. Use when: PRs, code quality checks, before merge.
---

# Review

**Review role.** Validates code quality.

## Checklist

- [ ] No syntax errors
- [ ] Proper error handling
- [ ] TypeScript types correct (no `any`)
- [ ] No commented dead code
- [ ] Tests for new features
- [ ] Consistent style

## Feedback Levels

| Level | Meaning |
|-------|---------|
| 🔴 Block | Must fix before merge |
| 🟡 Suggest | Should fix (not blocking) |
| 💡 Idea | Nice to have |

## Report Format
```markdown
## Review

- `file.ts` - 1 suggestion
- `utils.ts` - ✅ Approved

**Status:** 🟡 Request changes
```
