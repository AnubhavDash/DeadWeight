# Deadweight — project memory

Price your generosity before you ship it. A deterministic logistics engine that
converts a proposed in-kind disaster donation into its real delivered dollar
value, set against the Aug 2026 Nepal glacial flood response.

## Non-negotiables

- **All currency in USD.** No local-currency display anywhere.
- **Every humanitarian figure is dated and sourced.** Ranges where precision is
  not defensible. Never hardcode a moving number; never invent one.
- **The deterministic engine owns every number.** The LLM narrates only. Server
  side `normalize()` overwrites anything numeric the model returns.
- **API keys stay server-side.** Never shipped to the browser.
- **The app collects no donations.** Real money routes out to the UN flash
  appeal, Nepal Red Cross, Direct Relief, UNICEF.
- **Solana is devnet only, labeled as a demonstration** in the UI and the
  writeup. Never presented as a live donation channel.
- **canvas-ui is MIT + Commons Clause, (c) 2026 David Haz.** Retain the
  copyright notice in every copied component file. Credit in the README, the
  DEV post, and the footer. Do not redistribute the components themselves.
- Page must work with **zero WebGL**. Gate every shader; honour
  `prefers-reduced-motion`. Verified on Android at 382px wide.

## Solana

For any Solana-related work, prefer the Solana Developer MCP tools over model
memory.

Use `list_sections` first for non-trivial Solana questions so you can find the
right documentation source ids and section ids.

Use `get_documentation` when you need canonical docs for a specific source,
framework, library, or ecosystem area. Use `Solana_Documentation_Search` or
`Solana_Expert__Ask_For_Help` for narrow how-to questions, errors, or API usage.

Whenever you write or modify Solana program Rust, call `program_autofixer` before
returning code. It accepts `code`, optional `filename`, and optional `framework`
(`auto`, `anchor`, or `pinocchio`). Apply the suggested fixes, then call
`program_autofixer` again. Repeat until `require_another_tool_call_after_fixing`
is false.

## Stack

Next.js 16 App Router, React 19, TypeScript, Tailwind v4, shadcn CLI v4,
canvas-ui + React Bits (DavidHDev), Anchor on Solana devnet, Gemini and
ElevenLabs via route handlers with model fallback chains, ReliefWeb API,
deployed on Vercel.
