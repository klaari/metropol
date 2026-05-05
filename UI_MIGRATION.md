# Aani UI Migration Spec

Migration from ad-hoc `StyleSheet` + hex literals to the design system in
`apps/mobile/design/` and the primitives in `apps/mobile/components/ui/`.
Companion to `UI_RULES.md` (look & behaviour) and `UI_ARCHITECTURE.md`
(layers & composition) — read those first.

This is a redesign as much as a port. The current app is dark-themed with
~50 unique hex literals scattered across 22 files; the new system is
warm-paper, ink, single cobalt accent. We are not tokenizing the dark
look — we are replacing it.

Token sources of truth:
- `apps/mobile/design/raw.js` — colour, spacing, radius, type values
  consumed by both Tailwind config and TS code. Cannot drift.
- `apps/mobile/design/tokens.ts` — TS surface; re-exports raw values and
  adds RN-shaped tokens (motion, elevation, layout, icon, z) that don't
  map to NativeWind classes.
- `apps/mobile/lib/cn.ts` — `cn()` utility for conditional classNames
  inside primitives. Tiny, no dependency.

---

## 1. Goals & Non-Goals

### Goals
- Every screen rendered through the design system (no `StyleSheet.create`
  outside `design/` or `components/ui/`).
- Zero raw hex literals or raw spacing numbers in `app/` or `components/`.
- All `<Text>`, `<Pressable>`, page-level `<View>` use the UI primitives.
- Visual consistency with the editorial reference: paper bg, ink type,
  cobalt accent, hairline dividers, one filled-glyph primary action per
  screen.
- Lint rules in place that prevent regression after the migration lands.

### Non-Goals
- No feature changes. Behavior must be identical post-migration. If a
  redesign reveals a UX bug, file it separately and fix in a follow-up.
- No backend, store, or hook changes. Only the view layer moves.
- No dark-mode toggle. The new palette is daylight only (per UI_RULES §8).
- No animation rework beyond replacing ad-hoc easing with `motion.*`.
- No NativeWind-vs-StyleSheet ideology — both are allowed inside primitives;
  outside, prefer NativeWind classes for layout, primitives for everything
  with semantic meaning.

---

## 2. Inventory

22 files, ~6,500 lines. Sized roughly by complexity, not LOC.

### Tier A — Reference surfaces (highest visibility)
| File | LOC | Notes |
| --- | ---: | --- |
| `app/player/[id].tsx` | 938 | The screen the design was extracted from. Biggest single migration; rewrite, don't translate. |
| `components/MiniPlayer.tsx` | 303 | Sticky bottom bar, visible on every authenticated screen. |
| `app/_layout.tsx` | 82 | Loading state has hardcoded dark colors. |
| `app/(tabs)/_layout.tsx` | 71 | Tab bar styling. |

### Tier B — Heavily used lists
| File | LOC | Notes |
| --- | ---: | --- |
| `app/(tabs)/library.tsx` | 770 | Track list, search, filters. Replace each row with `ListRow`. |
| `components/TrackItem.tsx` | 114 | Direct map to `ListRow`. |
| `app/(tabs)/playlists/index.tsx` | 258 | List of playlists. |
| `app/(tabs)/playlists/[id].tsx` | 485 | Playlist detail + edit. |

### Tier C — Sheets and modals
| File | LOC | Notes |
| --- | ---: | --- |
| `components/QueueSheet.tsx` | 494 | Bottom sheet. Should use `Surface tone="raised" lift="sheet"`. |
| `components/PlaylistPickerSheet.tsx` | 290 | Bottom sheet. |
| `components/EditTrackModal.tsx` | 184 | Form modal — needs input primitive (see §6.1). |
| `components/DiscogsSheet.tsx` | 922 | Largest sheet. Multi-step flow; migrate per-step. |
| `components/DiscogsMatchBanner.tsx` | 115 | Toast-style banner. |

### Tier D — Tabs and utility screens
| File | LOC | Notes |
| --- | ---: | --- |
| `app/(tabs)/downloads.tsx` | 355 | Job list. |
| `components/DownloadJobItem.tsx` | 97 | Job row — variation on `ListRow`. |
| `app/(tabs)/settings.tsx` | 567 | Long settings list. |

### Tier E — Auth (lowest priority, lowest visibility)
| File | LOC | Notes |
| --- | ---: | --- |
| `app/(auth)/sign-in.tsx` | 178 | Form. |
| `app/(auth)/sign-up.tsx` | 242 | Form. |
| `app/(auth)/_layout.tsx` | 12 | Trivial. |

### Untouched
`app/index.tsx`, `app/player/_layout.tsx`, `app/(tabs)/playlists/_layout.tsx`
— each ≤12 lines, no styling. Touch only if `_layout`s set screen
options that conflict with the new palette.

---

## 3. Translation Rules

A canonical mapping from the old vocabulary to the new. Every line of
migrated code maps cleanly through this table; if you can't find a row
that fits, that's a signal the system is missing a token (see §8).

### 3.1 Color
Old palette was a near-monochrome dark ramp. The mapping is by **role**,
not by darkness:

| Old hex (and aliases) | Role | New token |
| --- | --- | --- |
| `#000`, `#0a0a0a`, `#111` | Page background (dark) | `palette.paper` *(was bg, now bg)* |
| `#1a1a1a`, `#161616` | Raised surface | `palette.paperRaised` |
| `#222`, `#2a2a2a` | Recessed/hover | `palette.paperSunken` |
| `#333`, `#444` | Border / divider | `palette.paperEdge` |
| `#fff`, `#f8f4ec` | Primary text | `palette.ink` |
| `#aaa`, `#888` | Secondary text | `palette.inkSoft` |
| `#666`, `#7a7368` | Muted text | `palette.inkMuted` |
| `#444`, `#555` | Faint text / disabled | `palette.inkFaint` |
| `#4cd964`, `#0f0`, green-ish | Positive | `palette.positive` |
| `#f5a623`, `#f80`, amber | Warning | `palette.warning` |
| `#ef4444`, `#ff4d6d` | Critical / error | `palette.critical` |
| any blue accent | Accent | `palette.cobalt` |

**Rule:** the migration *inverts* the surface/text relationship (dark→light)
but preserves semantic meaning. Anything that was "the warning color" stays
the warning color; the hex changes.

### 3.2 Spacing
Quantize every numeric `padding`/`margin`/`gap` to the closest
`space` key (snap up, never down — paper aesthetic favors more breath):

| Old px | Snap to |
| ---: | --- |
| 1 | `hair` (borders only) |
| 2–4 | `xs` |
| 5–8 | `sm` |
| 9–12 | `md` |
| 13–16 | `base` |
| 17–24 | `lg` |
| 25–32 | `xl` |
| 33–48 | `2xl` |
| 49–64 | `3xl` |
| 65+ | `4xl` |

If quantizing a value would visibly break the layout, the old layout was
off the rhythm — fix it, don't preserve the px.

### 3.3 Typography
Replace per-`<Text>` `fontSize`+`fontWeight`+`color` blocks with a
`<Text variant tone>` from `components/ui`:

| Old size | Old weight | New variant | Typical tone |
| ---: | --- | --- | --- |
| 9–11 | 600+ uppercase | `eyebrow` | `muted` |
| 11–13 | any | `caption` | `muted` |
| 14–15 | 400 | `body` | `primary` |
| 14–15 | 600+ | `bodyStrong` | `primary` |
| 16–17 | 400 | `bodyLg` | `primary` |
| 18–22 | 600+ | `title` | `primary` |
| 24–28 | 700 | `titleLg` | `primary` |
| 30+ | 700 | `display` | `primary` |

Tabular numerics (timestamps, BPM, percentages) → `numeric` prop.

### 3.4 Layout primitives
| Old pattern | New primitive |
| --- | --- |
| `<View style={{ flexDirection: "row", gap: N, alignItems: "center" }}>` | `<HStack gap={key} align="center">` |
| `<View style={{ flexDirection: "column", gap: N }}>` | `<VStack gap={key}>` |
| Row of chips with `flexWrap: "wrap"` | `<Cluster gap="sm">` |
| Settings-style label-on-left / value-on-right row | `<Inline>` |
| `<SafeAreaView>` + `<ScrollView>` + page padding | `<Screen>` |
| Bottom `<View>` with `borderTopWidth` | `<Screen footer={...}>` |
| Section with eyebrow + title + content | `<PageSection eyebrow="…" title="…">` |
| Centred hero (artwork + title + subtitle) | `<HeroSection>` |
| Eyebrow-headed list of rows with hairlines | `<ListSection>` |
| Generic vertical group inside a section | `<ContentBlock>` |
| `<Pressable>` with manual scale/opacity animation | `<Pressable>` from `components/ui` |
| `<Pressable>` for a list row | `<ListRow>` |
| Modal `<View>` with `position: absolute` + bg + radius | `<Surface tone="raised" lift="sheet">` |
| Inline 1px line | `<Divider>` |
| Custom progress `<View>` with width % | `<ProgressBar value={...} />` |

### 3.5 Icons
| Old | New |
| --- | --- |
| `<Ionicons name="x" size={N} color="#xxx" />` plus `<Pressable>` wrapper | `<IconButton icon="x" accessibilityLabel="…" />` |
| Decorative `<Ionicons>` (not tappable) | Keep `<Ionicons>` directly, but `color={palette.ink}` etc. |

### 3.6 What stays as `StyleSheet`
- Inside the primitives themselves (`components/ui/`).
- Inside primitive-adjacent visual code that the system can't model yet
  (vinyl rotation transforms, gesture-driven sheet drag offsets). These
  must still draw colors from `palette` and dimensions from `space`.

---

## 4. Phasing

Ten phases, each independently shippable. Land them in order — earlier
phases unblock later ones, and the per-phase visual diffs stay reviewable.

### Phase 0 — Infrastructure (no UI change)
- Confirm token sources of truth wired up: `design/raw.js` is required by
  both `tailwind.config.js` and `design/tokens.ts`. (Already in place.)
- Confirm `lib/cn.ts` exists. (Already in place.)
- Add ESLint rules (see §7).
- Set the root surface to `palette.paper` in `app/_layout.tsx`'s
  `GestureHandlerRootView` and the loading screen.
- Update the `expo-router` `Slot` parent to default `paper` so any
  un-migrated screen gets the new background, not raw white.
- Add a smoke screen in dev that renders every primitive, used as
  visual baseline for later phases.

**Done when:** lint passes, loading screen on cold launch shows `paper`.

### Phase 1 — Player screen + MiniPlayer
**Reference phase.** This is the screen the design was extracted from;
the rest of the app gets compared against it.
- Rewrite `app/player/[id].tsx` from scratch using primitives. Don't
  port the dark version — start blank, recreate the reference layout.
- Rebuild `components/MiniPlayer.tsx` on `Surface tone="raised"` with a
  `ProgressBar`, `IconButton` controls, ink type. Keep behavior identical.
- The tempo popover modal becomes `Surface tone="raised" lift="popover"`.

**Done when:** the player screen on a real device matches the reference
screenshot when scrolled past the AppBar; MiniPlayer appears as a paper
strip with a single cobalt accent on the BPM badge if rate ≠ 1.

### Phase 2 — Tabs shell
- `app/(tabs)/_layout.tsx`: tab bar uses `palette.paperRaised`,
  `palette.ink` for active, `palette.inkMuted` for inactive, hairline
  top border in `palette.paperEdge`.
- Tab icons: use Ionicons outlines for inactive, filled for active —
  this is the single in-system filled-icon exception to the
  one-filled-per-screen rule (because the active tab IS the primary action).

**Done when:** every tab transition shows the new shell; player MiniPlayer
sits flush above the tab bar with a single 1px hairline between them.

### Phase 3 — Library + TrackItem
- `components/TrackItem.tsx`: delete and re-implement as a thin wrapper
  around `<ListRow>` (or just inline `<ListRow>` at the call sites and
  delete the file).
- `app/(tabs)/library.tsx`: `<Screen>`, search field becomes the input
  primitive (see §6.1), section headers use `eyebrow`, rows use `<ListRow>`,
  separators use `<Divider indent={64}>`.

**Done when:** library list scrolls smoothly with hairlines between rows
that clear the artwork on the left.

### Phase 4 — Playlists
- `app/(tabs)/playlists/index.tsx` → `Screen` + `ListRow` per playlist.
- `app/(tabs)/playlists/[id].tsx` → reuse the library row pattern; the
  "edit" affordance becomes a single `IconButton` in the AppBar trailing slot.

**Done when:** creating, viewing, and editing a playlist all look like the
library, just with a different title.

### Phase 5 — Sheets and modals
Migrate one sheet at a time; visual review each.
- `components/QueueSheet.tsx` → `Surface tone="raised" lift="sheet"
  rounded="xl"` with a 40×4 paperEdge handle, `<ListRow>`s inside.
- `components/PlaylistPickerSheet.tsx` → same shell as QueueSheet.
- `components/EditTrackModal.tsx` → form using the input primitive (§6.1).

**Done when:** every sheet enter/exit uses `motion.duration.slow` with
`decelerate`/`accelerate`; drag-to-dismiss preserved.

### Phase 6 — Discogs flow
- `components/DiscogsSheet.tsx` (922 LOC): break into sub-views per step
  *as part of the migration*. The current monolith is hard to migrate as
  one piece. Each step lands as its own PR.
- `components/DiscogsMatchBanner.tsx` → `Surface tone="raised" lift="sheet"`
  pinned at the top, with a `cobalt` left border and a single `IconButton`
  to dismiss.

**Done when:** the full Discogs match flow can run end-to-end on the new
system; the banner uses the only-cobalt-accent rule cleanly.

### Phase 7 — Downloads
- `components/DownloadJobItem.tsx` → `ListRow` with progress in the
  trailing slot (use a small `ProgressBar` or numeric percent in `numeric`
  variant).
- `app/(tabs)/downloads.tsx` → `Screen` shell, eyebrow for "Active" vs
  "Completed" sections.

**Done when:** active downloads animate progress on the rail without
rerendering the row text.

### Phase 8 — Settings
- `app/(tabs)/settings.tsx`: 567 lines is a lot of toggles. Build a
  `SettingsRow` primitive (see §6.2) and use it throughout.

**Done when:** every settings row uses the same primitive; section
headers use `eyebrow`; destructive actions (sign out, clear cache)
use `Button variant="destructive"`.

### Phase 9 — Auth
- `app/(auth)/sign-in.tsx`, `sign-up.tsx`: `Screen surface="paper"` with
  the brand display title centered, the input primitive for fields,
  `Button variant="primary" block` for submit. No more dark-on-dark.

**Done when:** sign-in matches the rest of the app's voice; cold-launch
unauthenticated → sign-in shows no flash of the old dark loading screen.

### Phase 10 — Cleanup and enforcement
- Delete any `styles` objects no longer referenced.
- Remove unused color literals in `lib/` if they were UI-related.
- Tighten ESLint rules to **error** (not warn) for raw hex / raw spacing
  / `<Text>` from `react-native` outside `components/ui/`.
- Update `CLAUDE.md` "Conventions" with a one-liner pointing to UI_RULES.md.

**Done when:** `npm run check-types` is clean and the lint rules in §7
report 0 violations across `app/` and `components/`.

---

## 5. Per-Tier Migration Playbook

A concrete recipe for the most common shapes. Each playbook produces
a roughly identical-looking screen on the new system; visual differences
beyond color and weight are bugs.

### 5.1 Screen wrapper migration
**Before:**
```tsx
<SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
  <ScrollView contentContainerStyle={{ padding: 16 }}>
    {/* … */}
  </ScrollView>
</SafeAreaView>
```
**After:**
```tsx
<Screen>
  <VStack gap="xl">
    {/* … */}
  </VStack>
</Screen>
```
If the old screen had a sticky bottom bar, lift it into `<Screen footer>`.

### 5.2 List screen migration
**Before:** a `<FlatList>` with a custom `renderItem` that builds a row from `<View>`s and inline styles.

**After:** keep the `<FlatList>` (it owns recycling), but make every
`renderItem` return a `<ListRow>`. Hairlines between rows: pass
`ItemSeparatorComponent={() => <Divider indent={64} inset="none" />}`.
Don't switch FlatList → VStack — performance regresses on long lists.

### 5.3 Sheet migration
**Before:** `Modal` + `Pressable` backdrop + custom `View` styled like a sheet.

**After:**
```tsx
<Modal transparent animationType="fade" visible={open} onRequestClose={close}>
  <Pressable style={{ flex: 1, backgroundColor: "rgba(22,19,14,0.45)" }} onPress={close} />
  <Surface tone="raised" lift="sheet" rounded="xl" pad="lg" style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
    <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 999, backgroundColor: palette.paperEdge, marginBottom: space.md }} />
    {/* sheet content */}
  </Surface>
</Modal>
```
Backdrop tint: `rgba(22,19,14,0.45)` — `ink` at 45% alpha, *not* black.

### 5.4 Form input migration
Forms (auth, EditTrackModal) currently use bare `<TextInput>` with
inline styles. Phase 0 of the form migration is the input primitive
(§6.1). Without it, every form ends up reinventing focus rings.

### 5.5 Animated component migration
Components using `Animated`/`Reanimated` for non-decorative motion (vinyl
spin, progress fills, sheet drag) keep their `Animated.View`s but draw
all colors from `palette` and all extents from `space`/`layout`. The
animation logic itself doesn't change.

---

## 6. Primitives Still to Build

The current set ships ~80% of what the migration needs. Add these
**before the phases that depend on them**, not retroactively.

### 6.1 `<Input>` (blocks Phase 5, 8, 9)
- Single-line text field, paper-sunken background, `paperEdge` 1px border,
  `ink` cursor and text, `inkMuted` placeholder.
- Focus state: border thickens to `border.thick` in `cobalt`.
- Variants: default, password (with reveal `IconButton` in trailing slot),
  search (with leading magnifier + clear `IconButton`).
- Owns its own height (`layout.controlHeight = 48`) and rounded corners
  (`radius.md`).

### 6.2 `<SettingsRow>` (blocks Phase 8)
- Specialized `<ListRow>` for toggles, links, and disclosure rows.
- Trailing slot variants: `Switch`, chevron, value text, `IconButton`.
- Three styles: default, destructive (label in `critical` tone), informational
  (no press, no chevron).

### 6.3 `<Toast>` / `<Banner>` (blocks Phase 6)
- Pinned-top notification surface used by `DiscogsMatchBanner` and any
  future ephemeral message. `Surface tone="raised" lift="sheet"` with a
  4px left border in `cobalt` (info), `positive` (success), `warning`,
  or `critical`. Tap to dismiss; auto-dismiss timer optional.

### 6.4 `<Switch>` (blocks Phase 8)
- Wrap RN's `Switch` with our palette: track `paperEdge`/`cobalt`,
  thumb `ink-inverse`. Thin wrapper, no behavior change.

### 6.5 `<Field>` label/helper wrapper (blocks Phase 9)
- Label (`eyebrow`) above an `<Input>`, optional helper text (`caption tone="muted"`)
  below, error text (`caption tone="critical"`) replaces helper when set.

These are small components (≤80 LOC each). Land them as Phase 0.5 between
Phase 0 and Phase 1.

### 6.6 Already shipped — layout primitives

The following are in place and should be used from Phase 1 onward. Do not
re-introduce ad-hoc equivalents.

| Primitive | Replaces |
| --- | --- |
| `PageSection` | Hand-rolled section header + child stack. |
| `ContentBlock` | Generic `VStack gap="base"` wrappers that earned a name. |
| `HeroSection` | Centred artwork + title + subtitle blocks. |
| `ListSection` | Eyebrow + list of rows + interleaved dividers. |
| `Cluster` | `flexWrap: "wrap"` chip rows. |
| `Inline` | `flexDirection: "row", justifyContent: "space-between"` rows. |

---

## 7. Lint and Automation

### 7.1 ESLint rules
Add as warnings during the migration, errors after Phase 10.

```js
// .eslintrc.js — additions
{
  rules: {
    // Forbid bare RN Text outside the design system.
    "no-restricted-imports": ["warn", {
      paths: [{
        name: "react-native",
        importNames: ["Text", "Pressable"],
        message: "Import Text/Pressable from components/ui instead."
      }]
    }],
    // Forbid raw hex colors in screen/component files.
    "no-restricted-syntax": ["warn",
      {
        selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
        message: "Use palette.* from design/tokens instead of raw hex."
      }
    ],
  },
  overrides: [
    // Primitives are exempt — they own the literals.
    { files: ["components/ui/**", "design/**"], rules: { "no-restricted-imports": "off", "no-restricted-syntax": "off" } }
  ]
}
```

### 7.2 Codebase guards
Add a CI check:
```
# scripts/check-design-system.sh
#!/usr/bin/env bash
set -e
# No raw hex outside design system
violations=$(grep -rEon "#[0-9a-fA-F]{3,8}" apps/mobile/app apps/mobile/components \
  --include='*.tsx' --include='*.ts' \
  | grep -v 'apps/mobile/components/ui/' \
  | grep -v 'apps/mobile/design/' || true)
if [ -n "$violations" ]; then
  echo "Raw hex found in app/components — use palette.*:"
  echo "$violations"
  exit 1
fi
```

### 7.3 Tracker
Track migration progress in a checklist at the bottom of this file
(§10). Each PR ticks off rows; the spec is done when every row is checked.

---

## 8. When the System Is Missing Something

You will hit cases the system doesn't model. Resolution path:

1. **Stop and ask:** is this actually a new pattern, or am I reaching
   for an old habit? 80% of the time it's the latter.
2. **If genuinely new:** add a token (color, space, motion) **first**.
   Tokens are cheap; ad-hoc values are not.
3. **If the pattern repeats 3+ times across the codebase:** add a
   primitive. Until then, compose existing primitives.
4. **Update `UI_RULES.md`** with the new token/primitive in the same PR.
5. Never inline a hex literal "just for now" — there is no later.

This rule is the single most important enforcement mechanism the system
has. Drift starts with the first exception.

---

## 9. Risks & Rollback

| Risk | Mitigation |
| --- | --- |
| Phase 1 player rewrite ships a regression in playback | Keep changes view-layer only — store/hooks untouched. Manual smoke before merge: play, pause, scrub, rate-change, BPM, queue. |
| FlatList performance regresses after `<ListRow>` swap | Benchmark library scroll on a 500-track list before/after Phase 3; keep `getItemLayout` and `keyExtractor` unchanged. |
| New aesthetic feels too quiet on small phones | Reference is iPhone 15 Pro. Verify on a 5.5" Android (the user's actual device) at the end of Phase 1; adjust `space.lg` ↔ `space.xl` rhythm if needed — change in tokens only, not per-component. |
| Sheets jank during transition | Swap `Animated.timing` → Reanimated `withTiming(motion.duration.slow, { easing })` per sheet; measure with Flashlight or RN perf monitor. |
| The single user (you) hates the new look | This is the one risk we can't engineer around. Phase 1 is the bake-off — if the new player doesn't feel right after a week of daily use, we revisit `palette.cobalt` and the `paper` warmth before propagating. |

**Rollback per phase:** every phase is one PR or a small stack. Reverting
a phase reverts to the previous fully-shipped state. No phase modifies
state shape, persistence, or migrations — view layer only.

---

## 10. Tracker

Tick rows as PRs land. Migration is done when every row is checked **and**
the §7 lint script returns 0 violations.

- [x] Tokens / cn / layout primitives
  - [x] `design/raw.js` single source of truth
  - [x] `lib/cn.ts` utility
  - [x] `PageSection`, `ContentBlock`, `HeroSection`, `ListSection`, `Cluster`, `Inline` primitives
- [ ] Phase 0 — Infrastructure
  - [ ] ESLint rules added (warn level)
  - [ ] Root surface set to `paper`
  - [ ] Loading screen migrated
  - [ ] Smoke screen for primitives
- [ ] Phase 0.5 — Missing primitives (Input, SettingsRow, Toast, Switch, Field)
- [ ] Phase 1 — Player + MiniPlayer
  - [ ] `app/player/[id].tsx` rewritten
  - [ ] `components/MiniPlayer.tsx` rewritten
  - [ ] Tempo popover migrated
- [ ] Phase 2 — Tabs shell
  - [ ] `app/_layout.tsx`
  - [ ] `app/(tabs)/_layout.tsx`
- [ ] Phase 3 — Library + TrackItem
  - [ ] `components/TrackItem.tsx` → `ListRow`
  - [ ] `app/(tabs)/library.tsx`
- [ ] Phase 4 — Playlists
  - [ ] `app/(tabs)/playlists/index.tsx`
  - [ ] `app/(tabs)/playlists/[id].tsx`
- [ ] Phase 5 — Sheets
  - [ ] `components/QueueSheet.tsx`
  - [ ] `components/PlaylistPickerSheet.tsx`
  - [ ] `components/EditTrackModal.tsx`
- [ ] Phase 6 — Discogs
  - [ ] `components/DiscogsMatchBanner.tsx`
  - [ ] `components/DiscogsSheet.tsx` (per step)
- [ ] Phase 7 — Downloads
  - [ ] `components/DownloadJobItem.tsx`
  - [ ] `app/(tabs)/downloads.tsx`
- [ ] Phase 8 — Settings
  - [ ] `app/(tabs)/settings.tsx`
- [ ] Phase 9 — Auth
  - [ ] `app/(auth)/sign-in.tsx`
  - [ ] `app/(auth)/sign-up.tsx`
- [ ] Phase 10 — Cleanup and enforcement
  - [ ] Lint rules upgraded warn → error
  - [ ] `scripts/check-design-system.sh` in CI
  - [ ] `CLAUDE.md` references UI_RULES.md
  - [ ] All `StyleSheet.create` outside `components/ui/` and `design/` removed or justified
