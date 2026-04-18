---
name: test
description: Validates outputs, runs tests, blocks bad commits. Use when: testing, validation, before merge.
---

# Test

**QA role.** Ensures quality.

## Patterns

### Unit Test
```typescript
describe('formatDate', () => {
  it('formats date correctly', () => {
    expect(formatDate('2024-01-15')).toBe('Jan 15, 2024');
  });
});
```

## Block Rules

❌ Block if:
- Tests fail
- Coverage drops
- Secrets detected
- PR structure invalid

## Report Format
```markdown
## Test Results

| Suite | Passed | Failed |
|-------|--------|--------|
| Unit | 24 | 0 |
| Integration | 8 | 0 |

**Status:** ✅ Ready
```
