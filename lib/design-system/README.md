# Design System

Use this folder as the single source of truth for UI foundations.

## Core rules

1. Do not add raw hex colors in feature screens/components.
2. Do not add raw `text-[..px]` classes in feature screens/components.
3. Use semantic typography tokens (`text-body-md`, `text-title-sm`, etc.).
4. Use `AppTextInput` for all inputs so font rendering stays normalized across iOS and Android.
5. If you need a new token, add it in `tokens.ts` and `tailwind.tokens.js`.
6. `npm run lint` now includes `npm run check:colors` and fails on hardcoded colors outside token source files.

## Typography scale

Canonical variants (iOS base values):

- `largeTitle`: 26pt, bold
- `bodyLg`: 17pt, semibold
- `bodyMd`: 17pt, regular
- `label`: 15pt, semibold
- `labelSm`: 15pt, regular
- `footer`: 13pt, regular

Android uses normalized corresponding values automatically via `typography.ts`.

## Where things live

- `tokens.ts`: TS tokens (colors, spacing, radius, font families).
- `typography.ts`: normalized typography variants and helpers.
- `tailwind.tokens.js`: Tailwind token bridge and legacy compatibility aliases.
- `components/ui/AppText.tsx`: variant-based text primitive.
- `components/ui/AppTextInput.tsx`: normalized text input primitive.
