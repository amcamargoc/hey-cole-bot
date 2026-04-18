---
name: auth
description: Implements authentication (email/password, OAuth, magic links). Use when: adding login, signup, password reset, session management.
---

# Auth

**Adds authentication to your app.**

## Options

| Method | Use Case | Complexity |
|--------|----------|------------|
| NextAuth.js | Full-featured, flexible | Medium |
| Clerk | Managed, fast setup | Low |
| Auth.js | Open-source, self-hosted | Medium |
| Custom + JWT | Simple, no provider | Low |

## NextAuth.js Setup

### Install
```bash
npm install next-auth
```

### Configuration
```typescript
// src/lib/auth.ts
import NextAuth from "next-auth"
import GitHubProvider from "next-auth/providers/github"
import EmailProvider from "next-auth/providers/email"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { db } from "./db"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
    EmailProvider({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
})
```

### Prisma Schema
```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  accounts      Account[]
  sessions      Session[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token         String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### Protected Route
```typescript
// src/lib/get-user.ts
import { auth } from "./auth"

export async function getUser() {
  const session = await auth()
  if (!session?.user) return null
  return session.user
}
```

### Middleware
```typescript
// middleware.ts
export { auth as middleware } from "@/auth"

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*"]
}
```

## Common Patterns

### Login Form
```tsx
export function LoginForm() {
  return (
    <form action="/api/auth/signin/github" method="POST">
      <button type="submit">Sign in with GitHub</button>
    </form>
  )
}
```

### Get Session (Client)
```tsx
"use client"
import { useSession } from "next-auth/react"

export function UserAvatar() {
  const { data: session } = useSession()
  
  if (!session) return <SignInButton />
  
  return <img src={session.user.image} alt={session.user.name} />
}
```

### Protected Page
```tsx
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const session = await auth()
  
  if (!session) {
    redirect("/login")
  }
  
  return <h1>Welcome, {session.user.name}</h1>
}
```
