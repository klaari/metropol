# Aani — Agent Instructions

## Canonical References

- UI_RULES.md
- UI_ARCHITECTURE.md

## Core Principles

- Keep diffs minimal.
- Do not refactor unrelated code.
- Prefer simplicity over cleverness.
- Prefer explicit/simple architecture over abstraction.
- Prefer composition over configuration.
- Existing behavior must remain identical unless explicitly requested.

## UI Constraints

- No raw hex values outside design/.
- No raw spacing numbers outside design/ and primitives.
- No react-native Text or Pressable outside primitives.
- No StyleSheet.create outside components/ui/.
- Prefer extending the system over bypassing it.
- Prefer existing primitives before creating new abstractions.

## Architecture

- Tokens define the visual language.
- Primitives implement reusable UI building blocks.
- Composed components combine primitives into domain-specific UI.
- Screens compose components and avoid token-level styling.
- Prefer composition through primitives over local styling.

## NativeWind

- Typed props first.
- className only for layout overrides.
- Use cn() for conditional classes.
- No generic Tailwind color palette classes.
