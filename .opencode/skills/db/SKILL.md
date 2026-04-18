---
name: db
description: Designs schemas, optimizes queries, manages migrations. Use when: data models, tables, queries, migrations.
---

# DB

**Data role.** Architects data layer.

## Patterns

### Schema
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
```

### Migration
```typescript
export async function up(db) {
  await db.query('ALTER TABLE users ADD COLUMN avatar VARCHAR(255)');
}
export async function down(db) {
  await db.query('ALTER TABLE users DROP COLUMN avatar');
}
```

## Checklist

- [ ] Primary keys defined
- [ ] Indexes on foreign keys
- [ ] Soft deletes where needed
- [ ] Timestamps (created_at, updated_at)
- [ ] No SELECT * in production
