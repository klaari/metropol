# Metropol Player — Spec

## Vision

Metropol Player on henkilökohtainen mobiilimusiikkisoitin DJ-käyttöön. Ydinidea:
selaat Discogsia, löydät biisin, lataat sen — kaikki yhdessä sovelluksessa. Kirjasto
synkronoituu pilveen ja soitin tukee tempo/pitch-säätöä live-BPM-näytöllä settisuunnittelua varten.

---

## Stack

- **Mobile:** Expo (SDK 52+) + Expo Router
- **Audio:** react-native-track-player
- **State:** Zustand
- **Auth:** Clerk (Expo SDK)
- **Database:** Neon (serverless Postgres) + Drizzle ORM
- **Storage:** Cloudflare R2
- **API:** Bun + Hono (Railway)
- **Downloader:** yt-dlp
- **Monorepo:** Turborepo
- **Language:** TypeScript everywhere, strict mode

---

## Screens & Routes

| Route | Screen | Auth |
|---|---|---|
| `/sign-in` | Sign In | No |
| `/sign-up` | Sign Up | No |
| `/(tabs)/library` | Track Library | Yes |
| `/(tabs)/playlists` | Playlists | Yes |
| `/(tabs)/playlists/[id]` | Playlist Detail | Yes |
| `/(tabs)/downloads` | Downloads | Yes |
| `/(tabs)/discogs` | Discogs Browser | Yes (Phase 3) |
| `/player/[id]` | Player | Yes |

---

## Phase 1 — Core Player ✅

Perussoitin toimii. Sisältää:

- Clerk-autentikointi
- Kirjasto (tiedostoimportti laitteelta)
- Soitin: transport controls, seek, playback rate, BPM-näyttö
- Playlists + järjestely
- Neon + Drizzle, Cloudflare R2

---

## Phase 2 — YouTube-lataus (rakennettu, viimeistellään)

### Toteutettu
- Bun + Hono API (Railway)
- yt-dlp lataa audion, uploadaa R2:een
- BullMQ-jono työnkäsittelyyn
- WebSocket-yhteys: reaaliaikainen tilan päivitys mobiiliin
- Downloads-välilehti: URL-syöttö, jono-lista, tilabadet

### Tehtävä: "+ nappi" pikalisäys

**Kuvaus:**
Korvaa Downloads-välilehden tekstikenttäpohjainen URL-syöttö + napilla,
joka tarkistaa leikepöydän vain kun käyttäjä itse painaa sitä.

**Työnkulku:**
1. Käyttäjä kopioi YouTube-urlin (esim. Discogsin kautta selaimessa)
2. Avaa Metropolin
3. Painaa "+" nappia (sijainti: tab bar tai library FAB)
4. App tarkistaa leikepöydän → YouTube-url esitäyttää kentän
5. Käyttäjä painaa "Download" → valmis, jatkaa muuta
6. Kappale ilmestyy kirjastoon kun lataus valmis

**UX-periaatteet:**
- Ei automaattisia popupeja — käyttäjä initioi aina
- Downloads-välilehti jää taustatoiminnoksi, ei päänavigaatioon
- Latauksen eteneminen ei ole kriittinen info — kirjasto päivittyy kun valmis

**Tekninen:**
- `expo-clipboard` → `Clipboard.getStringAsync()` napin painalluksella
- Validoi YouTube URL regex ennen esitäyttöä
- Sama `submitDownload` store-action kuin nykyisin

---

## Phase 3 — Web-sovellus (Next.js)

### Visio
Selainpohjainen companion-app joka käyttää samaa backendejä kuin mobiili.
Kun olet koneella, lisäät YouTube-urleja suoraan selaimesta — kappaleet
latautuvat ja ilmestyvät kirjastoon, joka synkronoituu automaattisesti
mobiiliin kun palaat puhelimelle.

### Stack
- **Framework:** Next.js (App Router)
- **Auth:** `@clerk/nextjs` — sama Clerk-sovellus kuin mobiilissa
- **DB:** `@metropol/db` suoraan server componenteista
- **Tyypitykset:** `@metropol/types` jaettu paketti

### Sijainti monoreposssa
```
apps/
├── mobile/     (Expo)
├── api/        (Bun + Hono)
└── web/        (Next.js) ← uusi
```

### Ominaisuudet

**YouTube-lisäys**
- URL-kenttä + lähetysnappi (sama API-endpoint kuin mobiilissa)
- Clipboard-tunnistus: sivulle navigoitaessa tai kentän fokuksessa
- Latauksen tila WebSocketin kautta reaaliajassa

**Kirjasto**
- Lista kaikista ladatuista kappaleista
- Sortaus: lisäyspäivä, nimi, artisti
- Metatietojen muokkaus (title, artist, BPM)

**Downloads-historia**
- Aktiiviset ja valmiit lataukset
- Virheiden näyttö

### Ei tarvita
- Audio-playback selaimessa (mobiili on soitin)
- Tiedostoimportti laitteelta (mobiili-feature)
- Playlist-hallinta (voi lisätä myöhemmin)

### Tekninen
- Sama `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- WebSocket yhteys samaan `NEXT_PUBLIC_WS_URL`:iin
- Deploy: Vercel (tai Railway jos haluaa pitää yhdessä paikassa)

---

## Phase 4 — Discogs-integraatio

### Visio
Räätälöity Discogs-selain suoraan appissa. Käyttäjä voi hakea julkaisuja,
nähdä tracklistan ja YouTube-linkit, ladata äänen suoraan — ilman että
poistuu sovelluksesta. Lisäksi oman collectionin ja wantlistin selaus.

### Ominaisuudet

**Haku & selaus**
- Haku artistin, julkaisun tai kappaleen nimellä
- Tulokset: kansi, artisti, levy, vuosi, formaatti
- Release-sivu: tracklist, notes, YouTube-linkit, versiot

**Lataus Discogsin kautta**
- YouTube-linkit näkyvät release-sivulla suoraan
- Yksi tap → lataus alkaa, metadata tulee automaattisesti Discogsilta
  (artisti, nimi, kansi, vuosi, label)
- Fallback: jos YouTube-linkkiä ei löydy → clipboard/manuaalinen URL

**Collection & Wantlist**
- Oman levy-kokoelman selaus ja haku
- Wantlist-selaus: näe mitä haluaisit, lataa previewt
- Merkintä: onko biisi jo ladattu Metropoliin

**Autentikointi**
- Discogs OAuth 1.0a
- Token-vaihto backendin kautta (lisätään API:lle)
- Mahdollistaa collection + wantlist + rating-toiminnot

### Tekninen
- Discogs REST API v2, ilmainen, 60 req/min autentikoituneena
- OAuth 1.0a token flow API:n kautta
- Kannet: `api.discogs.com/images/`
- YouTube-linkit: `release.videos[]` kenttä

### Vaiheistus
1. Haku + release-sivu + YouTube-lataus (ei Discogs-authia)
2. Discogs OAuth + collection-selaus
3. Wantlist + hallinta (lisää/poista/rate)

---

## Phase 5 — Tulevaisuus (ei aikataulua)

**Share Extension**
Native iOS/Android share extension: jaa YouTube-url suoraan selaimesta
Metropoliin ilman sovelluksen avaamista. Vaatii Expo bare workflow tai
custom native build target.

**Automaattinen BPM-tunnistus**
Audio-analyysi ingestissä, täyttää `originalBpm` automaattisesti.

**Aaltomuoto-visualisointi**
Seekbarin alla näkyy waveform.

---

## Data Models

### `tracks`
```
id            uuid PK
userId        text (Clerk user ID)
title         text NOT NULL
artist        text
duration      integer (seconds)
originalBpm   real (nullable)
fileKey       text (R2: {userId}/{trackId}.ext)
fileSize      integer (bytes)
format        text
importedAt    timestamp DEFAULT now()
lastPlayedAt  timestamp
discogsReleaseId  text (nullable, Phase 3)
coverUrl      text (nullable, Phase 3)
label         text (nullable, Phase 3)
year          integer (nullable, Phase 3)
```

### `playlists`
```
id         uuid PK
userId     text
name       text NOT NULL
createdAt  timestamp DEFAULT now()
updatedAt  timestamp DEFAULT now()
```

### `playlist_tracks`
```
id          uuid PK
playlistId  uuid FK → playlists.id
trackId     uuid FK → tracks.id
position    integer NOT NULL
```

### `playback_state`
```
id            uuid PK
userId        text
trackId       uuid FK → tracks.id
playbackRate  real DEFAULT 1.0
lastPosition  integer DEFAULT 0 (seconds)
updatedAt     timestamp DEFAULT now()
```

### `download_jobs`
```
id          uuid PK
userId      text
url         text NOT NULL
status      text (queued | downloading | uploading | completed | failed)
title       text
artist      text
duration    integer
trackId     uuid (FK → tracks.id, kun valmis)
error       text
createdAt   timestamp DEFAULT now()
completedAt timestamp
```

---

## Konventiot

- DB: Drizzle ORM, ei raw SQL
- Zustand stores: yksi per domain (`library`, `player`, `playlists`, `downloads`)
- Hooks: `use`-prefix, `hooks/`-kansiossa
- Ympäristömuuttujat: `EXPO_PUBLIC_` clientille, muut API:lla
- R2-access presigned URL:ien kautta, ei suoria credentials clientille
- Error handling: `{ data, error }` result pattern
- BPM: tallennetaan aina originaali, current = `originalBpm * playbackRate`
