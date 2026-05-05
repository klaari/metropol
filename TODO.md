# Aani TODO

## 🔮 Myöhemmin: Share Extension (iOS + Android)

**Prioriteetti:** Matala (tulevaisuus)  
**Kuvaus:**  
Native share extension joka mahdollistaa YouTube-urlin jakamisen suoraan selaimesta tai YouTube-appista Aaniin ilman sovelluksen avaamista.

**Työnkulku:**
1. Selaimessa tai YouTubessa → "Jaa" → valitse Aani
2. Extension käynnistyy taustalla, lähettää urlin API:lle
3. Lataus alkaa taustalla, sovellusta ei tarvitse avata

**Tekniset huomiot:**
- iOS: App Extension (Share Extension) — vaatii Expo bare workflow tai custom native module
- Android: Intent filter + background task
- Vaatii todennäköisesti Expo managed workflowsta luopumista tai EAS custom build targetia
- Harkitse kun clipboard-flow on tehty ja testattu

---

## 🔜 Tehtävä: Haun jatkokehitys

**Prioriteetti:** Keskitaso
**Kuvaus:**
Library-haku perusversio toimitettu. Jatkokehitys:
- Suodattimet: BPM-haarukka, key, genre, label, vuosi
- Lajittelu: viimeksi soitettu, lisätty, BPM
- Globaali haku (kirjasto + Discogs samalla kertaa)
- Etsi sopiva seuraava biisi nykyisestä BPM-haarukasta (mixin-pohja)

---

## 🔜 Tehtävä: Downbeat-tunnistus

**Prioriteetti:** Keskitaso
**Kuvaus:**
Tunnista kappaleen downbeatit (tahdin ykkösiskut) jotta voidaan myöhemmin
rakentaa mixin-ominaisuuksia: beatmatch, kahden raidan synkronointi,
auto-cue downbeatille, loop-pisteet, transition-efektit.

**Tulevat mixin-käyttötapaukset (motivaatio):**
- Beatmatch: kahden kappaleen tahti synkkaan automaattisesti
- Auto-cue: hyppy seuraavan downbeatin kohdalle
- Loop: 4/8/16 tahdin loopit downbeat-rajoilla
- Crossfade: vaihda kappaletta tahdin ykkösellä

**Tekniset huomiot:**
- Pelkkä BPM ei riitä — tarvitaan tahdin alkukohta (phase / first downbeat offset)
- Vaihtoehdot:
  1. Server-side analyysi ingestissä (esim. `essentia`, `madmom`, `librosa`)
     — tallenna `downbeats: number[]` (sekunteina) `tracks`-tauluun
  2. Client-side analyysi natiivilla moduulilla (raskasta mobiilissa)
  3. Käyttäjän manuaalinen tap-tempo + ensimmäisen downbeatin merkkaus
- Aloita serveripuolen analyysillä Phase 2:n yt-dlp-pipelinen yhteydessä
- Skeema: lisää `firstDownbeatMs` ja/tai `downbeats` JSONB `tracks`-tauluun

**Vaiheistus:**
1. Schema + tallennus (downbeat array per track)
2. Visualisointi player-näkymässä (esim. waveformin päällä merkit)
3. Auto-cue / loop -toiminnot
4. Beatmatch kahden raidan välillä (vaatii dual-deck UI:n)

---

## 🔜 Tehtävä: Discogs-mirror (paikallinen kokoelman + wantlistin synkka)

**Prioriteetti:** Korkea
**Kuvaus:**
Sync collection + wantlist Discogsista paikalliseen Postgres-tauluun
jotta voidaan tehdä nopeaa hakua, scope-pohjaista matchausta ja
selausta ilman jatkuvaa Discogs API:n kuormittamista.

**Miksi tämä ennen auto-matchausta tai selainta:**
- Discogsin `database/search?q=...` palauttaa max 25 osumaa per kysely
  ja perustuu sen omaan ranking-algoritmiin → "filter by `user_data`"
  ei ole exhaustive (jos oikeaa releasea ei tule top-25:een, scope-haku
  palauttaa tyhjän vaikka levy on collectionissa).
- Discogsin verkkosivun "Export to CSV" -nappi EI ole API-rajapinnan
  takana (lähettää sähköpostilinkin, ei triggeröitävissä).
- Sen sijaan API tarjoaa saman datan paginoituna:
  `GET /users/{u}/collection/folders/0/releases?per_page=100&page=N`
  ja `GET /users/{u}/wants?per_page=100&page=N`.
  `basic_information`-blokki sisältää valmiiksi artisti/title/label/
  catno/year/format/thumb → ei tarvita per-release follow-up callejä.
- Vrt. https://github.com/fscm/discogs2xlsx — sama lähestymistapa,
  paginoi API:n läpi ja kirjoittaa xlsx:ään.

**Aikamääre:** kair tilillä 6291 + 3055 = 9346 kohdetta → 94 requestiä
(100/page) → ~95 sekuntia 60 req/min limitin alla. Kerran-jobi, ei
request-handleri.

**Skeema:** korvaa nykyinen `discogs_user_items`-taulu rikkaammalla
versiolla (nykyinen on strict subset):

```sql
CREATE TABLE discogs_user_releases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  release_id      TEXT NOT NULL,
  type            TEXT NOT NULL,         -- 'collection' | 'wantlist'
  artist          TEXT,
  title           TEXT,
  label           TEXT,
  catalog_number  TEXT,
  year            INTEGER,
  format          TEXT,
  thumb_url       TEXT,
  cover_url       TEXT,
  folder_id       INTEGER,                -- collection only
  instance_id     INTEGER,                -- collection only
  notes           TEXT,                   -- wantlist note from Discogs
  search_text     TEXT,                   -- "artist title label catno year"
  raw             JSONB,                  -- koko Discogs-rivi tulevaa varten
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX ON discogs_user_releases (user_id, release_id, type);
CREATE INDEX ON discogs_user_releases (user_id, type);
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX ON discogs_user_releases USING gin (search_text gin_trgm_ops);
```

**API-pinta:**
- `POST /discogs/sync` — täysi sync API:n kautta, idempotentti.
  Palauttaa `{ collection: 6291, wantlist: 3055, durationMs }`.
- `GET /discogs/local-search?q=...&scope=collection|wantlist|any&limit=10`
  — trigram-rankattu paikallinen haku, sub-ms vasteaika.
- `POST /discogs/auto-match` body `{ trackId, scope }` — käyttää
  local-searchia; jos täsmälleen 1 osuma → enrich + palauta. Muutoin
  palauta candidate-lista pikkupickeriä varten.

**Lib-helperit** (`apps/api/src/lib/discogs.ts`):
- `paginateUserList(endpoint, username)` async generator
- `syncCollection(userId)` / `syncWantlist(userId)` consume the generator
- 429-handlauttaminen: nuku `X-Discogs-Ratelimit-Remaining`-headerin
  perusteella tai 60s 429:n jälkeen (ks. discogs2xlsx:n malli).

**Sync-triggerit** (kasvavalla aggressiivisuudella):
1. **App-foreground sync** — inkrementaali aina kun mobiili tulee
   foregroundiin. Discogs sortaa `added desc` → lopeta paging kun
   törmätään `date_added`-kenttään joka on jo paikallisesti → tyypillinen
   inkrementaali = 1–2 requestiä.
2. **Push-on-write** — kun appi itse mutatoi (POST/DELETE collection
   tai wantlist), upsert paikallisesti samassa handlerissä. Nykyinen
   `syncMembership` tekee tämän jo ohuesti — laajenna koko riville.
3. **Nightly background full sync** — Railway cron osuu
   `POST /discogs/sync` kerran päivässä. Kattaa muutokset jotka
   tehtiin suoraan discogs.com:issa.

**Vaiheistus:**
1. Skeema + migraatio + nykyisen `discogs_user_items`-taulun korvaaminen
2. `paginateUserList` + `syncCollection` + `syncWantlist`
3. `POST /discogs/sync` route + progress event WS-kanavalla
4. Sync-nappi Settings-näkymään (manuaalinen trigger + progress)
5. `local-search` route + paikallinen rikkaampi search UI
6. App-foreground inkrementaali
7. Auto-match endpoint + ingest-pohjainen "tämä on collectionissa /
   wantlistissa / muu" -pikkupromptti download-jälkeen

---

## 🔜 Tehtävä: Discogs-rikastuksen jatko

**Prioriteetti:** Keskitaso
**Riippuvuudet:** Discogs-mirror (yllä) parantaa auto-matchin
luotettavuutta merkittävästi.
**Kuvaus:**
Manuaalinen Discogs-rikastus toimitettu (search → match → enrich +
collection/wantlist togglet + notes). Jäljellä:

- Library-näkymässä badget collection/wantlist -tilasta (haku tracks-
  taulun JOIN discogs_user_releases kautta)
- Library-haku huomioi Discogs-metadatan (label, catalog#, year, genre)
- Cover-art player-näkymässä jos `discogsMetadata.coverUrl` löytyy
- Auto-match ingestin yhteydessä — siirtyy mirror-taskiin (tarvitsee
  paikallisen indeksin toimiakseen luotettavasti)

---

## 🔮 Myöhemmin: Discogs-integraatio (räätälöity selain)

**Prioriteetti:** Korkea (myöhemmin)  
**Kuvaus:**  
Täysimittainen Discogs-selain appin sisällä. Muuttaa Aanin luonteen download-työkalusta Discogs-integroiduksi musiikkikirjastoksi.

### Ominaisuudet

**Haku & selaus**
- Release-haku nimellä, artistilla, labelilla, kataloginumerolla
- Hakutuloksissa: kansi, artisti, levy, vuosi, formaatti
- Release-sivu: tracklist, YouTube-linkit, notes, versiot

**Lataus Discogsin kautta**
- YouTube-linkit näkyvät suoraan release-sivulla
- Yksi tap → lataus alkaa, metadata (artisti, nimi, kansi, vuosi) tulee automaattisesti Discogsilta
- Fallback clipboard/YouTube-haku jos linkkiä ei löydy

**Collection & Wantlist**
- Oma levy-kokoelma selattavissa ja hakettavissa
- Wantlist — selaa mitä haluat, lataa previewt tai täydet biisit
- Merkintä mitä on jo ladattu Aaniin

**Autentikointi**
- Discogs OAuth 1.0a — kirjautuminen omalla Discogs-tilillä
- Mahdollistaa collection + wantlist + rating-toiminnot

### Tekniset huomiot
- Discogs API: ilmainen, 60 req/min autentikoituneena
- OAuth 1.0a vaatii oman backendin token-vaihtoon (lisätään API:lle)
- Kannet CDN:stä (api.discogs.com/images/...)
- YouTube-linkit Discogs `videos`-kentässä per release

### Vaiheistus ehdotus
1. Haku + release-sivu + YouTube-lataus (ei authia)
2. Discogs OAuth + collection-selaus
3. Wantlist + hallinta (lisää/poista)

---

## 🔮 Myöhemmin: React Native New Architecture -migraatio

**Prioriteetti:** Matala (tulevaisuus)
**Kuvaus:**
Sovellus pyörii nyt Legacy Architecturella (`apps/mobile/app.json:
"newArchEnabled": false`). RN varoittaa että legacy poistuu tulevassa
versiossa, joten siirtyminen Fabric/TurboModules-arkkitehtuuriin pitää
tehdä joskus.

**Miksi nyt legacy:**
- `react-native-track-player` 4.1.2 laajentaa `ReactContextBaseJavaModule`
  -luokkaa (old-arch only) → uudessa arkkitehtuurissa moduuli ei
  rekisteröidy TurboModuleksi, ja player ilmoittaa "audio playback not
  available".
- Aiempia yrityksiä on revertoitu kolme kertaa (commits `75952a5`,
  `f7d02b5`, `fd09300` → revertit `7f12c47` ja kumppanit).

**Vaihtoehdot kun aika on:**
1. Odota RNTP v5 stabiilia uuden arkkitehtuurin tuella (siistein).
2. Kokeile RNTP v5-alphaa uudelleen — kehitys on edennyt edellisestä
   yrityksestä.
3. Korvaa RNTP `expo-audio` + custom service -yhdistelmällä. Uusi-arch
   natiivi mutta menettää lock-screen kontrollit, jonon ja
   notifikaatiointegraation → pitää rakentaa uudelleen.

**Trigger:**
- RNTP julkaisee v5 stable, TAI
- RN ilmoittaa konkreettisen poistoaikataulun legacylle.

---

## ✅ Tehty

- **Web-sovellus (Next.js)** — `apps/web/` Turboreposessa. Clerk-auth,
  library / playlists / downloads / settings -reitit, sama API kuin
  mobiilissa. Deploy: Vercel.
- **Library-haku** — TextInput Library-välilehden yläosassa, suodattaa
  title + artist mukaan. Tyhjän tilan ja ei-tulosten erottelu.
- **"+ nappi" pikalisäys** — Downloads-välilehden aina näkyvä URL-bar
  korvattu "+" napilla joka esitäyttää YouTube-urlin leikepöydältä
  validoiden. Cancel-napilla pois.
- **Discogs-rikastus (manuaalinen)** — Player-näkymästä disc-ikoni
  avaa sheetin: search → match → enrich. Genres/styles/year/label/cat#/
  cover tallennetaan jsonb-kenttänä `tracks.discogsMetadata`. Per-track
  collection/wantlist togglet kirjautuvat sekä Discogsiin että
  paikalliseen `discogs_user_items`-tauluun, jossa myös notes-kenttä.
  Header-piste signaloi tilan: vihreä = collection, punainen = wantlist.
