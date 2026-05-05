# Aani UI Architecture

Companion to `UI_RULES.md`. UI_RULES describes how the app **looks and
behaves**; this document describes how the design system is **organised**:
layers, ownership, composition rules, and the discipline that keeps it
from sprawling.

If a rule here conflicts with UI_RULES, UI_RULES wins — the visual identity
takes precedence over the architecture.

---

## 1. Layer model

The system has four layers. Each layer composes the layer below; nothing
ever skips upward.

```
┌──────────────────────────────────────────────────────────────────────┐
│  4. Screen layer       app/**/*.tsx                                  │
│     Compose primitives + composed components. No styling decisions.  │
├──────────────────────────────────────────────────────────────────────┤
│  3. Composed layer     components/*.tsx, components/ui/Composed*     │
│     Domain-aware components: MiniPlayer, QueueSheet, TrackItem.      │
│     Built from primitives. Knows about state; doesn't author tokens. │
├──────────────────────────────────────────────────────────────────────┤
│  2. Primitive layer    components/ui/                                │
│     Visual & layout primitives: Text, Surface, Stack, ListRow.       │
│     The only layer that resolves token values into RN style.         │
├──────────────────────────────────────────────────────────────────────┤
│  1. Token layer        design/                                       │
│     raw.js (Tailwind + TS source) + tokens.ts (TS surface).          │
│     No JSX, no React.                                                │
└──────────────────────────────────────────────────────────────────────┘
```

### Ownership boundaries

| Concern | Owned by |
| --- | --- |
| Hex literals, px values, font sizes | Layer 1 (tokens) — and *only* layer 1. |
| RN `StyleSheet.create`, inline `style` for tokenised values | Layer 2 (primitives). |
| `className` strings | Layer 2 (primitives) for static styling. Layer 3/4 only for layout overrides (see UI_RULES §8). |
| Animation, gesture, timing | Layer 2 (primitives like `Pressable`) for canonical interactions. Layer 3 for domain-specific motion (vinyl spin, sheet drag). |
| State, data fetching, side effects | Layer 3 and above. Primitives are pure. |
| Routing, safe-area wiring | Layer 4 (screens, via `<Screen>`). |

A primitive that imports from a Zustand store, calls a hook other than
React hooks, or knows about a domain (track, playlist) is misplaced — it
belongs in layer 3.

A composed component that reaches into `tokens.ts` for a literal hex value
is misplaced — extend the primitive's prop surface instead.

A screen that writes `StyleSheet.create` is broken — find or build the
missing primitive.

---

## 2. The primitive catalogue

All exports from `apps/mobile/components/ui/index.ts`.

### Atoms

| Primitive | Responsibility | Key props |
| --- | --- | --- |
| `Text` | The only text renderer. Encodes the type ladder. | `variant`, `tone`, `numeric`, `align`, `italic` |
| `Pressable` | The only press surface. Owns canonical press animation. | `flat`, `disabled`, `onPress`, `hitSlop` |
| `Divider` | 1px hairline. | `inset`, `indent` |
| `ProgressBar` | Thin scrubber rail. | `value`, `trackColor`, `fillColor` |

### Surfaces

| Primitive | Responsibility | Key props |
| --- | --- | --- |
| `Surface` | Card / sheet / popover container. | `tone`, `pad`, `rounded`, `lift`, `bordered` |
| `Screen` | Page shell — safe-area, surface tint, edge inset, optional sticky footer. | `scroll`, `inset`, `surface`, `footer` |

### Layout — flex containers

| Primitive | Responsibility | Default behaviour |
| --- | --- | --- |
| `VStack` | Vertical flex. The dominant layout primitive. | `gap?: SpaceKey` |
| `HStack` | Horizontal flex. | `align="center"` by default |
| `Cluster` | Wrap-friendly horizontal group (chips, tags). | `flexWrap: "wrap"`, `gap="sm"` |
| `Inline` | Non-wrapping label/value row. | `justify="between"` |
| `Spacer` | Symmetric box for the rare case `gap` doesn't fit. | `size="base"` |

### Layout — semantic blocks

| Primitive | Responsibility | When to reach for it |
| --- | --- | --- |
| `PageSection` | Top-level section with optional eyebrow + title header. | Every chunk of a screen that has its own header or its own theme. |
| `ContentBlock` | A semantic vertical block within a section. | When the JSX benefits from naming the grouping. |
| `HeroSection` | The one ceremonial visual + headline. | At most once per screen. |
| `ListSection` | Eyebrow header + ListRows + auto-inserted hairlines. | Short, non-virtualised browseable lists. |

### Composed components

| Component | Responsibility |
| --- | --- |
| `AppBar` | 3-slot top bar — back / title / trailing. |
| `Button` | Labelled button (primary / secondary / ghost / destructive). |
| `IconButton` | Icon-only button (plain / filled — *one* filled per screen). |
| `ListRow` | The canonical 56px row with leading / title+subtitle / trailing slots. |

### Tokens (re-exported from primitives barrel)

`palette`, `space`, `radius`, `border`, `elevation`, `motion`, `layout`,
`icon`, `z`, `tokens`, `typeScale`, `fontFamily`, `fontWeight`.

Reach for these only when:
- You're writing a primitive (layer 2).
- You're writing animation logic that needs a duration or spring config.

If you're reading from `palette.cobalt` inside a screen, you're skipping
the primitive layer — that's the bug.

---

## 3. Composition rules

### Spacing ownership

Exactly **one** layer in any rendered subtree owns the gap between two
siblings. The owner is always the **parent stack** (`VStack` / `HStack`).

```tsx
// ✅ Parent owns the rhythm.
<VStack gap="lg">
  <Title />
  <Body />
  <Caption />
</VStack>

// ❌ Children own the rhythm. Now adding a sibling needs a margin guess.
<View>
  <Title style={{ marginBottom: 24 }} />
  <Body style={{ marginBottom: 24 }} />
  <Caption />
</View>

// ❌ Two layers fight over the gap.
<VStack gap="lg">
  <Title style={{ marginBottom: 12 }} />
  <Body />
</VStack>
```

### Nesting rules

- A `PageSection` may contain `ContentBlock`s, plain content, or other
  `PageSection`s — but two levels of nested `PageSection` is the limit.
  Three nested means the screen wants a different shape.
- `HeroSection` does **not** nest inside a `PageSection`. Hero is its own
  top-level child of the screen's outer `VStack`.
- `Surface lift="sheet"` does **not** nest inside another `Surface
  lift="sheet"`. Pick one floating layer.
- `Screen` is always the outermost; never inside a `Surface` or stack.
- `ScrollView`s do not nest. If a sheet has its own scroll, the parent
  `Screen scroll={false}`.

### Composition philosophy

- **Compose by props, not by className.** A consumer reaches for `<Surface
  tone="raised" rounded="xl">`, not `<Surface className="bg-paper-raised
  rounded-xl">`.
- **Variants are typed unions.** Each primitive enumerates its variants in
  TypeScript; new variants require a new union member, not an arbitrary
  string.
- **Primitives never expose `style`.** All styling flows through props.
- **Primitives expose `className` only when layout-override flexibility is
  unavoidable** (e.g. a wrapper that needs `flex-1` from outside).
  Most don't expose it.
- **No `forwardRef` / `as` polymorphism unless required.** A `Button` is
  always a `Pressable`-shaped element. If you need a different shape,
  build a new primitive.

---

## 4. When abstraction is allowed

A new primitive is **earned**, not designed.

| Threshold | Reach for | Example |
| --- | --- | --- |
| 1 use | Inline composition. Don't abstract. | A one-off layout. |
| 2 uses | Inline composition with shared sub-tree extracted to a *local* component in the same file. | Reused row layout in a single screen. |
| 3+ uses across files | New primitive in `components/ui/`. | The pattern is now structural; bake it in. |

A "primitive" is small (≤120 LOC), has no domain knowledge, and reads RN
+ tokens only. If a candidate is bigger, it's a composed component
(layer 3), not a primitive.

### When abstraction is forbidden

- **No "Box" primitive.** Use `View` or `VStack`. A nameless container
  with twenty optional props is the design system anti-pattern that
  trains everyone to default to it.
- **No abstract `Card` primitive on top of `Surface`.** `Surface` is the
  abstract card.
- **No "smart" primitives that look up theme values from a context.** The
  theme is the imported tokens; there is no `ThemeProvider`.
- **No CSS-in-JS variants framework (`stitches`, `vanilla-extract`, `cva`).**
  Hand-rolled lookup tables + `cn()` are sufficient.
- **No prop pass-through soup.** A primitive should not have more than 8
  props. If it does, it's modelling two concepts; split it.

---

## 5. Variant patterns

Variants are encoded as discriminated string unions. Resolution is a plain
lookup table, ideally typed `Record<Variant, …>`.

```tsx
// Pattern: variant union + lookup table + cn()
type Variant = "primary" | "secondary" | "ghost" | "destructive";

const surfaceClass: Record<Variant, string> = {
  primary: "bg-ink",
  secondary: "bg-paper border-hair border-ink",
  ghost: "bg-transparent",
  destructive: "bg-critical",
};

function Button({ variant = "primary", ... }) {
  return (
    <Pressable className={cn("rounded-full px-lg h-[48px]", surfaceClass[variant])}>
      ...
    </Pressable>
  );
}
```

### Why not `cva`?

- `cva` requires a runtime dependency and a configuration grammar.
- Our variant cardinality is small (rarely > 4 per primitive).
- Hand-rolled tables surface every variant in plain TS — a reader sees
  the table, not a config object.

### Why not `tailwind-merge`?

- Class collisions inside our token surface are rare (tone, spacing, radius
  rarely overlap inside a single primitive).
- NativeWind's runtime resolves last-wins; for the few cases that matter,
  ordering inside `cn()` is sufficient.

If a real merge problem appears later, add `tailwind-merge` *then* — not
prophylactically.

---

## 6. NativeWind ergonomics

### Inside primitives

- Prefer `className` for static surface, tone, radius, border, padding,
  type. The Tailwind theme already encodes our tokens.
- Use RN `style` for:
  - Animated values (`Animated.Value`, Reanimated `useAnimatedStyle`).
  - Computed extents (`width: ${value * 100}%`).
  - Shadow props (RN doesn't ship `shadow-*` Tailwind utilities).
  - Token-driven values that the Tailwind theme can't reach (motion timing,
    elevation objects).
- **Pick one approach per file.** Don't mix `className` and inline `style`
  for the same concern within a primitive — readers should not have to scan
  both.

### At the call site

- Prefer **typed props** on primitives.
- Reach for `className` only for layout overrides not covered by props
  (`self-end`, `flex-1`, `opacity-70` for state-driven dimming).
- **Never** for tone (`text-ink`), spacing (`p-4`), or typography (`text-title`)
  — those live on primitives.

### Conditional classes

```tsx
import { cn } from "../lib/cn";

<Surface
  className={cn(
    "rounded-lg",
    isActive && "border-thick border-cobalt",
    error && "bg-critical/10",
  )}
/>
```

`cn()` is at `apps/mobile/lib/cn.ts`. It is intentionally tiny — a few
lines, no dependency. If you want clsx semantics, you already have them.

### When to extend the Tailwind theme

If a primitive needs a class that doesn't resolve, the answer is almost
always:

1. The token doesn't exist in `raw.js` — add it there.
2. The mapping into Tailwind is missing — add it to `tailwind.config.js`.

Adding *only* to `tailwind.config.js` is forbidden — both must agree.

---

## 7. Enforcement

The system is enforced by, in order of severity:

1. **TypeScript types** — `SpaceKey`, `TypeVariant`, variant unions reject
   raw numbers and strings at the call site.
2. **The primitive surface** — primitives accept tokenised props only;
   you cannot pass `gap={5}` because `5` isn't a `SpaceKey`.
3. **The forbidden Tailwind classes** — `tailwind.config.js` overrides
   (not extends) `colors`, `spacing`, `fontSize`. Generic Tailwind colour
   classes (`bg-blue-500`, `text-gray-300`) **do not resolve at all**.
4. **ESLint rules** (see `UI_MIGRATION.md` §7).
5. **CI grep guard** (see `UI_MIGRATION.md` §7.2) — catches raw hex outside
   the design layer.
6. **Code review** for the residue.

The cheapest enforcement is the strongest: if a hex literal can't appear
in the file because the type system rejects every API that accepts one,
no review is needed.

### Lint rules at a glance

```js
// .eslintrc.js
{
  rules: {
    "no-restricted-imports": ["warn", {
      paths: [{
        name: "react-native",
        importNames: ["Text", "Pressable"],
        message: "Import Text/Pressable from components/ui instead.",
      }],
    }],
    "no-restricted-syntax": ["warn",
      {
        selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
        message: "Use palette.* from design/tokens instead of raw hex.",
      },
      // Reject raw numeric padding/margin/gap properties:
      {
        selector:
          "Property[key.name=/^(padding|margin|gap)(Top|Bottom|Left|Right|Horizontal|Vertical)?$/] > Literal[value=/^[0-9]+$/]",
        message: "Use SpaceKey-typed primitive props instead of numeric padding/margin/gap.",
      },
    ],
  },
  overrides: [
    { files: ["components/ui/**", "design/**"],
      rules: { "no-restricted-imports": "off", "no-restricted-syntax": "off" } },
  ],
}
```

Promote each rule from `warn` → `error` after the migration phase that
clears it (see `UI_MIGRATION.md`).

---

## 8. AI-assisted development

The system is built so a coding agent (Claude, Codex, Cursor) can implement
a screen with minimal ambiguity. Concretely:

| Property | How the system supports it |
| --- | --- |
| **Minimise ambiguity** | Each concern has exactly one expression. Spacing → `SpaceKey`. Type → `variant`. Tone → `tone`. There is no "creative" route. |
| **Minimise ad-hoc styling** | Primitives don't expose `style`. Type system blocks raw hex / raw spacing inside primitive props. Tailwind theme overrides reject generic palette classes. |
| **Make incorrect UI hard to produce** | The default of every primitive is the on-system answer (e.g. `IconButton variant="plain"` — the filled accent is opt-in). |
| **Deterministic composition** | The decision tree in UI_RULES §10 has exactly one right answer per step. |
| **Forbidden patterns are explicit** | UI_RULES §9 enumerates anti-patterns by category. Agents can self-check against the list. |
| **Layer boundaries** | Section 1 of this doc names which layer owns which concern. An agent knows whether a change belongs in tokens, primitives, composed, or screens. |

When in doubt as an agent: **prefer the primitive over the inline style**.
The primitive has been considered; the inline style has not.

---

## 9. File structure

```
apps/mobile/
├── app/                        # Layer 4 — screens
│   └── (routing groups)
├── components/                 # Layer 3 — composed
│   ├── *.tsx                   #   domain-aware components
│   └── ui/                     # Layer 2 — primitives
│       ├── AppBar.tsx
│       ├── Button.tsx
│       ├── Cluster.tsx
│       ├── ContentBlock.tsx
│       ├── Divider.tsx
│       ├── HeroSection.tsx
│       ├── IconButton.tsx
│       ├── Inline.tsx
│       ├── ListRow.tsx
│       ├── ListSection.tsx
│       ├── PageSection.tsx
│       ├── Pressable.tsx
│       ├── ProgressBar.tsx
│       ├── Screen.tsx
│       ├── Stack.tsx           # VStack / HStack / Spacer
│       ├── Surface.tsx
│       ├── Text.tsx
│       └── index.ts            # barrel
├── design/                     # Layer 1 — tokens
│   ├── raw.js                  #   source of truth (CommonJS)
│   └── tokens.ts               #   TS surface; adds RN-shaped tokens
├── lib/
│   └── cn.ts                   # className utility
├── tailwind.config.js          # consumes design/raw.js
└── global.css
```

Keep `components/ui/` flat. Subdirectories within `ui/` are forbidden — if
the catalogue grows beyond ~25 primitives, that itself is the bug, not
the lack of folders.

---

## 10. When the system is missing something

Resolution path, identical to UI_RULES §11 but emphasising the architecture
side:

1. **Stop and ask:** is this a new pattern, or am I reaching for an old
   habit? 80% of the time it's the latter.
2. **If genuinely new:** add a token first. Tokens are cheap; ad-hoc
   values are not.
3. **If the pattern repeats 3+ times:** add a primitive. Until then,
   compose existing primitives.
4. **Update both `UI_RULES.md` and this document** in the same PR. An
   undocumented primitive *is* drift.
5. Never inline a hex literal "just for now" — there is no later.

The single most important enforcement mechanism is this rule. Drift starts
with the first exception.
