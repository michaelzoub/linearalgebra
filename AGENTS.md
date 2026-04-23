<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Linear Algebra Visualizer — Project Guide

## Purpose
Interactive linear algebra learning app. Every concept is taught through a **Minecraft / video game narrative** — vectors are blocks, transformations are enchantments or spells, coordinate systems belong to characters (Steve = standard world, Alex = alternate basis). This framing is intentional and must be preserved across all tabs.

## Stack
- **Next.js 16** (App Router, Turbopack) — all pages in `app/`
- **React 19**, TypeScript, Tailwind CSS v4
- **mathjs** for all linear algebra computation (never hand-roll matrix math)
- **Canvas API** for 2D visualizations (no external charting libs)
- `@maximeheckel/design-system` is installed but its **React components must NOT be used** — stitches CSS-in-JS breaks under Next.js 16 Turbopack. Use it only for global CSS variables via `globalStyles()` in `components/Providers.tsx`.

## Design rules
- Dark background (`#050510`), Dracula-inspired palette
- **3–4 semantic colors max per tab** — each color owns a concept, never reused
- Glow effects on canvas arrows (`ctx.shadowColor / shadowBlur`)
- Step-by-step "chapter" reveal (5 chapters per tab) — never dump everything at once
- Plain HTML + Tailwind for UI (no CSS-in-JS); inline styles for color variables
- Input sliders use native `<input type="range">` with `accentColor`

## Tabs (components in `components/`)
| Tab | File | Concept | Minecraft frame |
|-----|------|---------|-----------------|
| Change of Basis | `ChangeOfBasis.tsx` | B⁻¹·M·B | Steve (Overworld) vs Alex (Nether) coordinate systems |
| Eigenvalues | `Eigenvalues.tsx` | Av = λv | Ender Dragon's "Power Axes" — directions enchantments can't rotate |

## Color conventions (reuse across tabs where possible)
- Sky blue `#7dd3fc` — standard world / Steve's coordinates
- Pink `#f0abfc` — alternate world / custom basis
- Amber `#fbbf24` — transformations / enchantments
- Lime `#86efac` — results / outputs
- Purple `#a78bfa` — eigenvalue-related (transformed shapes)
- Gold `#fbbf24` — eigenvectors / special directions

## Adding a new tab
1. Create `components/YourConcept.tsx` — follow chapter structure of `Eigenvalues.tsx`
2. Add entry to `TABS` array in `app/page.tsx`
3. Update the table above in this file

## Math conventions
- `B` = change-of-basis matrix (columns are basis vectors)
- `B⁻¹ · M · B` = M conjugated into basis B
- `Av = λv` — eigenvector definition (λ is eigenvalue, v is eigenvector)
- For 2D: real eigenvectors exist iff discriminant `(tr A)² - 4 det A ≥ 0`
- Eigenvalues of a pure rotation matrix are complex (no real eigenvectors in 2D)
- In 3D: axis of rotation is the eigenvector with λ = 1
