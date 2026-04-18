---
name: ui
description: Builds UI components, pages, responsive layouts. Use when: new pages, components, layouts, styling.
---

# UI

**UI role.** Builds user interfaces.

## Patterns

### Next.js App Router
```tsx
export default async function Page() {
  return <main>...</main>;
}

export async function generateMetadata() {
  return { title: 'Page Title', description: '...' };
}
```

### Component
```tsx
export function Button({ 
  children, 
  variant = 'primary',
  onClick,
  disabled = false,
}: ButtonProps) {
  return (
    <button 
      className={styles[variant]}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
```

## Checklist

- [ ] Semantic HTML
- [ ] Responsive (mobile-first)
- [ ] Loading states
- [ ] Error boundaries
- [ ] Accessible (ARIA labels)
- [ ] Optimized images (`next/image`)
