# Aani UI Rules

This document is the canonical reference for how Aani **looks and behaves**.
Implementation lives in `apps/mobile/design/` and `apps/mobile/components/ui/`.
Architecture (layers, ownership, when to abstract) lives in `UI_ARCHITECTURE.md`.

> **The aesthetic in one sentence:** *warm paper, ink black, one cobalt
> accent — print-magazine restraint, iOS-grade interaction.*

If you would write a value not in this document, you are about to break the
system. Add a token first; never inline.

---

## 1. Principles

1. **Calm over flashy.** Press feedback is `0.98` scale + opacity dip,
   80ms in / 160ms out. No colour flashes, no ripples on iOS, no bounce.
2. **One hero per screen.** A single dominant headline or visual; everything
   else is supporting matter — smaller and dimmer.
3. **One primary action per screen.** Filled, ink-on-paper, anchored. Every
   other control is plain.
4. **One accent per surface.** Cobalt earns its presence. Two cobalt things
   on one screen means one of them is wrong.
5. **Stack, don't nest.** Use `VStack` / `HStack` with `gap`. Never reach
   for absolute positioning, manual margin, or padding hacks.
6. **Hierarchy via size and weight.** Colour is hierarchy's secondary axis,
   never its primary one.
7. **Vertical rhythm is sacred.** Only `space` keys. Never type a raw number
   into `padding`, `margin`, or `gap`.

---

## 2. Colour

| Token | Hex | Use |
| --- | --- | --- |
| `paper` | `#F4EFE7` | App background. Default surface. |
| `paperRaised` | `#FBF7F0` | Sheets, popovers, anything lifted. |
| `paperSunken` | `#EAE4DA` | Pressed/recessed states, inputs. |
| `paperEdge` | `#DCD5C7` | 1px hairlines, scrubber rails. |
| `ink` | `#16130E` | Primary type, primary action surface. |
| `inkSoft` | `#3A352D` | Secondary type, strong icons. |
| `inkMuted` | `#7A7368` | Tertiary type, captions, timestamps. |
| `inkFaint` | `#B5AFA2` | Disabled type, decorative glyphs. |
| `inkInverse` | `#F8F4EC` | Type on `ink` surfaces. |
| `cobalt` | `#4A55A0` | Accent — selection, active, hero artwork. |
| `cobaltDeep` | `#3A4485` | Pressed accent. |
| `cobaltSoft` | `#7A85C4` | Decorative accent (rare). |
| `positive` | `#5A6E48` | Confirmation. |
| `warning` | `#B0793A` | Caution. |
| `critical` | `#A8412C` | Destructive, error. |

**Rules**

- Never use pure white as a surface. `paper` is the bottom of the stack.
- Never use pure black as ink. `ink` is warm, not RGB black.
- Do not introduce a second accent hue. If something needs to feel
  *different*, make it bigger or quieter — not another colour.
- `paperEdge` is the only divider colour. Hairlines are 1px, no exceptions.
- Tints, gradients, and translucency over photos are off the table by
  default. The surface is paper; treat it like paper.

---

## 3. Typography

One family (`fontFamily.sans`, currently System). Eight steps.
Pick a recipe by name; never assemble fontSize + fontWeight + lineHeight by hand.

| Variant | Size / LH | Tracking | Weight | Use |
| --- | --- | --- | --- | --- |
| `eyebrow` | 11 / 14 | +1.2 (UPPER) | 600 | Section labels above a title. |
| `caption` | 13 / 18 | 0 | 400 | Captions, timestamps, metadata. |
| `body` | 15 / 22 | 0 | 400 | Default body copy. |
| `bodyStrong` | 15 / 22 | 0 | 600 | List row titles, button labels. |
| `bodyLg` | 17 / 24 | -0.1 | 400 | Long-form reading. |
| `title` | 22 / 26 | -0.3 | 600 | Section headers, sheet titles. |
| `titleLg` | 28 / 32 | -0.5 | 700 | Screen titles ("So What"). |
| `display` | 36 / 38 | -0.8 | 700 | Hero — at most once per screen. |
| `numeric` | 13 / 18 | 0 | 500 | Tabular nums (timestamps, BPM). |

**Rules**

- **Always use `<Text>` from `components/ui`.** Never `<Text>` from
  `react-native`. The latter has no enforcement of the type ladder.
- **Max hierarchy depth per section is three voices.** If you need a fourth,
  reconsider the screen. Typical: `eyebrow` + `title` + `body` + `caption`.
  *Two* hierarchy steps is often plenty.
- Tight tracking on display sizes is the editorial signature — do not reset.
- Italics are reserved for credits and attributions ("with John Coltrane").
- Underlines are reserved for inline links inside body copy.
- **Numerics** (timestamps, BPM, percentages) use `<Text variant="numeric">`
  *or* `<Text numeric>` to lock digit width. Mixing tabular and proportional
  digits in the same row is a layout bug.
- **Truncation policy:**
  - Titles: `numberOfLines={1}` always.
  - Subtitles: `numberOfLines={1}` in lists; up to 2 in detail screens.
  - Body copy: never truncate. If overflow is a concern, the layout is wrong.
- **Reading width:** body copy never exceeds `layout.maxContentWidth` (560).
  On wider screens, content centres and gutters grow.
- **Multiline titles:** allowed in `display` and `titleLg`; line-height is
  already tight. Do not override `lineHeight` to compress further.
- **Numeric / text alignment in rows:** label left, value right via
  `<Inline>`. Both render in the same baseline; the value uses `numeric`.

---

## 4. Spacing

The spacing scale is **closed** — only these values exist.

| Key | Px | Use |
| --- | ---: | --- |
| `none` | 0 | — |
| `hair` | 1 | Borders only. Never gaps. |
| `xs` | 4 | Tight cluster (icon + counter). |
| `sm` | 8 | Related items in a row. |
| `md` | 12 | Grouped controls. |
| `base` | 16 | Default in-component padding. |
| `lg` | 24 | Screen edge inset, between paragraphs. |
| `xl` | 32 | Between unrelated blocks (section gap). |
| `2xl` | 48 | Section break. |
| `3xl` | 64 | Hero margin. |
| `4xl` | 96 | Ceremonial silence. |

**Rules**

- Never write a numeric `padding`, `margin`, or `gap` outside `components/ui/`
  and `design/`. Always pass a `SpaceKey`.
- `screenInset` is `lg` (24). Anything smaller looks cramped; anything
  larger wastes the column.
- Section gap is `xl` (32). If two adjacent blocks deserve `2xl` between them,
  ask whether they should be on different screens.
- `gap` on a stack replaces margin between siblings. Don't combine them.

### Rhythm violations (anti-patterns)

| Symptom | What's wrong | Fix |
| --- | --- | --- |
| Two adjacent `VStack` siblings each with their own `padY` | Both blocks claim the gap → space is doubled. | Lift the spacing into the parent's `gap`. |
| `<View style={{ marginTop: 12 }}>` inside a stack | Margin fights the parent's gap; one of them wins, you can't predict which. | Use `gap` on the parent. |
| `gap="lg"` between every section, then `padY="lg"` on the screen | Top/bottom gap doubles up at the edges. | `<Screen>` already insets; don't add `padY`. |
| `gap={4}` (raw number) | Bypasses the scale. | `gap="xs"`. |

---

## 5. Layout & Composition

The full primitive list lives in `UI_ARCHITECTURE.md`. The short version:

| Primitive | Role |
| --- | --- |
| `Screen` | Page shell — safe-area, surface tint, edge inset, optional sticky footer. |
| `PageSection` | Top-level section with optional eyebrow + title header. |
| `ContentBlock` | A semantic vertical block within a section. |
| `HeroSection` | The one ceremonial visual + headline. ≤1 per screen. |
| `ListSection` | Eyebrow header + ListRows + auto-inserted hairlines. |
| `Surface` | Card / sheet / popover container. Owns tone, radius, lift. |
| `VStack` / `HStack` | Generic flex containers. Typed `SpaceKey` for `gap`. |
| `Cluster` | Wrap-friendly horizontal group (chips, filters). |
| `Inline` | Non-wrapping label-on-left / value-on-right row. |

### Canonical compositions

**Screen shell**

```tsx
<Screen>
  <AppBar title="…" onBack={…} trailing={…} />
  <VStack gap="xl">
    <PageSection>...</PageSection>
    <PageSection eyebrow="Recently played">...</PageSection>
  </VStack>
</Screen>
```

**Hero block**

```tsx
<HeroSection
  visual={<Artwork />}
  title={track.title}
  subtitle={track.artist}
  actions={<TransportCluster />}
/>
```

**Browseable list**

```tsx
<ListSection eyebrow="Active downloads">
  <ListRow title="Track A" subtitle="64%" trailing={<Progress />} />
  <ListRow title="Track B" subtitle="22%" trailing={<Progress />} />
</ListSection>
```

For long, virtualised lists: keep the `FlatList`, render a `ListRow` per
item, and use `<Divider indent={64} inset="none" />` as
`ItemSeparatorComponent`. Don't replace `FlatList` with `ListSection`.

**Sheet**

```tsx
<Surface tone="raised" lift="sheet" rounded="xl" pad="lg">
  <SheetHandle />
  {children}
</Surface>
```

### Hierarchy violations (anti-patterns)

| Symptom | What's wrong | Fix |
| --- | --- | --- |
| Two `display` titles on one screen | Hero is by definition singular. | Demote the second to `titleLg` or `title`. |
| A `title` inside a `ContentBlock` inside a `PageSection` that already has a `title` | Three nested headings. | Drop the redundant heading; let the section title carry the meaning. |
| `bodyStrong` next to `bodyStrong` next to `bodyStrong` | All three weights compete; nothing reads as primary. | Demote two to `body` + `caption`. |
| `cobalt` text adjacent to a `cobalt` icon adjacent to a `cobalt` rail | Three accents on one surface. | Pick one; demote the others to `inkSoft`. |

---

## 6. Iconography

- **Library:** `@expo/vector-icons` Ionicons.
- **Default size:** 24 (`icon.size.md`). Inline glyphs use 16 or 20.
- **Colour:** `ink` on paper, `inkInverse` on ink. Cobalt only for *active*
  state, never just decoration.
- **Weight:** outline first. The single exception is the *primary* action
  on a given screen, which uses the filled glyph (e.g. `pause`/`play`).
- **No emoji** in shipped UI strings. Use a glyph or omit.
- **No second icon library.** Heroicons / Lucide / Material Icons are
  forbidden — Ionicons is the chosen voice.

---

## 7. Motion

| Concern | Rule |
| --- | --- |
| Press feedback | Built into `<Pressable>`. Don't recreate locally. Don't disable on the primary action. |
| Standard transition | `motion.duration.base` (240ms) with `easing.standard` `[0.2, 0, 0, 1]`. |
| Sheet enter | `motion.duration.slow` (360ms) with `easing.decelerate`. |
| Sheet exit | `motion.duration.base` with `easing.accelerate`. |
| Screen change | `motion.duration.slow` cross-fade; no slide-from-side unless dictated by Expo Router. |
| Continuous motion | Allowed only for the vinyl/artwork rotation while playing (one full revolution per 6s). Freeze when paused. |
| Spring presets | Critically damped on purpose. There is no `bouncy` preset. Use `motion.spring.soft` for sheets, `motion.spring.snappy` for swipe dismissals. |
| Choreography | Stagger is forbidden by default. If two elements must enter together, they enter together — same duration, same easing. |
| Gestures | Direct manipulation is preferred over button taps for scrubbing, dragging, and rate adjustment. Buttons are for irreversible commits. |

### Forbidden motion

- Bounce / overshoot springs.
- Parallax.
- Hover states (this is mobile).
- Continuous attention-seeking motion (pulses, shimmers) outside the
  sanctioned vinyl rotation.
- Motion-on-mount for static content (no fade-in for an app bar).
- Decorative loading spinners — use `<ProgressBar>` or static skeleton
  blocks in `paperSunken`.

---

## 8. NativeWind & Code Conventions

This system is **NativeWind-first inside primitives**, **typed-props-first
at the call site**.

| Layer | Style mechanism | Notes |
| --- | --- | --- |
| `design/` | Raw values | Source of truth (raw.js) consumed by both Tailwind and TS. |
| `components/ui/` (primitives) | RN style + className | Primitives may use either; keep choices consistent within a file. Use `cn()` (`apps/mobile/lib/cn.ts`) for conditional classes. |
| `components/` (composed) | Typed primitive props | Compose primitives. Reach for className only for layout overrides (margin, alignSelf). Never for tone, colour, or typography. |
| `app/` (screens) | Typed primitive props | Same. Screens are compositions of primitives, not styled HTML. |

### When inline `style` is allowed

- Inside primitives, for **dynamic** values that depend on runtime state:
  animated transforms, computed widths (`${value * 100}%`), gesture offsets,
  shadow props (RN doesn't support shadows via className).
- At call sites, for **layout only** when no primitive expresses it (e.g.
  `style={{ flexBasis: 0 }}` to make a column row equally weighted).
- **Never** for colour, font, radius, spacing, or anything tokenised.

### When `className` is allowed at call sites

- Layout overrides that are not domain-meaningful: `className="self-end"`,
  `className="flex-1"`, `className="opacity-70"` (state-driven dimming).
- **Never** for tone (`text-ink`, `bg-paper-raised`) — pass `tone` /
  `surface` props on the primitive.
- **Never** for spacing (`p-4`) — pass `pad` / `padX` / `padY` on the
  primitive.
- **Never** for typography (`text-title`) — pass `variant` on `<Text>`.

### Composition philosophy

- **Primitives expose typed props for everything tokenised.** The TypeScript
  type system is the primary enforcement mechanism.
- **Primitives expose `className` only when layout-override flexibility is
  unavoidable.** Most primitives don't expose it.
- **Primitives never expose `style`** as a public prop. Channel everything
  through props or className.
- **Variants are hand-rolled lookup tables.** No `cva` — too much abstraction
  for a system this small. A `Record<Variant, ClassValue>` plus `cn()` is
  enough.
- **`cn()` over template strings.** Conditional classNames go through
  `cn(...)`; never hand-concatenate with `${}`.

---

## 9. Forbidden — anti-pattern catalogue

These produce the generic Tailwind/Material aesthetic the brief explicitly
rejects. None of them ship.

### Colour

- `bg-white`, `bg-gray-*`, `bg-slate-*` — use `paper` / `paperRaised` / etc.
- Default Tailwind blues (`bg-blue-500`, `bg-indigo-500`) — use `cobalt`.
- `text-gray-500` etc. — semantic tone (`muted`, `faint`) only.
- Two accent hues on one screen.
- Pure `#000` or `#fff` as a surface or as type.
- Translucent black overlay ≥ 0.5 alpha (the backdrop is `ink` at 0.45).

### Surface / shape

- Drop shadows below `paperRaised` surfaces — paper does not float.
- Gradients. Period. (Vinyl is a flat fill, not a gradient.)
- Border-radius `2xl` / `3xl` / pill on rectangles — pills are pills,
  cards are `lg`, sheets are `xl`.
- Glassmorphism / blur backdrops.
- Nested `Surface` lifts (a `lift="sheet"` inside another `lift="sheet"`).

### Typography

- `<Text>` from `react-native`. Always `Text` from `components/ui`.
- Hand-assembled `style={{ fontSize, fontWeight, color }}`.
- Manual `letterSpacing` / `lineHeight` overrides.
- Italics on body copy. Italics are reserved for credits.

### Layout

- `marginTop` / `marginBottom` between siblings of a stack — use parent `gap`.
- `position: absolute` for layout (allowed only for genuinely overlaid UI:
  modal backdrops, drag handles, decorative elements).
- Raw numbers in `padding`, `margin`, `gap`.
- Two competing scrolls (a `ScrollView` inside another `ScrollView`).
- `flex: 1` containers nested four levels deep — collapse and lift instead.

### Motion

- `Animated.spring` with `friction < 7` or `tension > 200` — bouncy.
- `Easing.elastic(*)`, `Easing.bounce`.
- Looping animations on idle UI.
- Custom press handlers that re-implement scale + opacity.

### Iconography

- Heroicons, Lucide, Material Icons — Ionicons only.
- Coloured icons that aren't `ink`, `inkInverse`, `inkMuted`, `inkSoft`,
  `cobalt` (active), `positive`, `warning`, `critical`.
- Emoji in shipped UI strings.

### Other

- Dark mode toggling. This palette is daylight only; if a night palette
  ships, it is its own palette, not an inversion.
- Per-screen `StyleSheet.create` for anything tokenised.
- Inline `colors.gray[N]` style indexing.
- Importing from `tokens.ts` *just* to read a colour for a one-off — use the
  primitive's tone prop or extend the primitive.

---

## 10. AI agent decision tree

When implementing a screen, follow this order. The system is designed so
that each step has *one* right answer.

1. **Page shell?** → `<Screen>`. If sticky bottom bar, `<Screen footer={…}>`.
2. **Header?** → `<AppBar>`. One `IconButton` in `trailing`.
3. **Layout the body** as `<VStack gap="xl">` of `<PageSection>`s.
4. **Section header?** → `eyebrow` + `title` props on `<PageSection>`.
5. **Hero on this screen?** → exactly one `<HeroSection>`. Otherwise omit.
6. **Browseable rows?** → `<ListSection>` for short lists, `<FlatList>`
   with `<ListRow>` items + `<Divider indent={64} inset="none" />` separators
   for long ones.
7. **Form / settings rows?** → `<Inline>` (label + value/control).
8. **Chip group?** → `<Cluster gap="sm">`.
9. **Need a card?** → `<Surface tone="raised" rounded="lg" pad="base">`.
10. **Tappable?** → `<Pressable>` (never bare RN). For icons, `<IconButton>`.
    For labelled buttons, `<Button>`.
11. **Text?** → `<Text variant="…" tone="…">`. Never bare `<Text>`.

**If your situation isn't on this list:**
- Check `UI_ARCHITECTURE.md` for the layer model.
- If you'd write three lines of inline styles, you've found a missing
  primitive — propose it before writing the screen.
- If you'd write a token literal, the token doesn't exist yet — add it
  to `raw.js` + `tokens.ts` first.

---

## 11. Adding to the system

When you genuinely need something new:

1. **Token first.** Add to `raw.js` (if NativeWind needs to know) + `tokens.ts`
   with a name that describes its role, not appearance (`paperEdge`, not
   `gray-300`).
2. **Update this file** with the new token.
3. **Add a primitive only when the pattern repeats 3+ times.** Until then,
   compose existing primitives.
4. **Update `UI_ARCHITECTURE.md`** if the new primitive shifts a layer
   boundary.

If you find yourself writing inline styles that aren't trivial layout
adjustments, that's a signal — either there's a missing primitive or
you're solving the wrong problem.
