---
name: research
description: Read and search before writing any code. Prevents hallucinations and costly corrections. Use when starting any implementation task.
---

# Research

Before writing any code, complete these steps. Do not skip them.

## Process

### 1. Read existing code

Search the codebase for files related to the task. Read them. Understand the patterns already in use (naming, structure, error handling, imports).

### 2. Check for prior art

Look for similar features already implemented in the project. If a pattern exists, follow it. Do not invent a new pattern unless the existing one is clearly broken.

### 3. Check external docs

If the task involves a library, framework, or API you are not certain about, search the web or read bundled documentation before proceeding.

### 4. State your findings

Before writing code, output a brief summary:

- **Existing patterns found**: what you will follow
- **Dependencies**: libraries/modules you will use
- **Assumptions**: anything you are not certain about (flag these for the user)
- **Risks**: anything that could go wrong

### 5. Get confirmation

If assumptions or risks are non-trivial, ask the user before proceeding. Do not guess.

## Why this matters

Every line of code written from a wrong assumption costs 10x to fix later. Five minutes of reading saves hours of corrections and wasted tokens.
