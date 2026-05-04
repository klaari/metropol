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

## 🔜 Tehtävä: Discogs-rikastuksen jatko

**Prioriteetti:** Keskitaso
**Kuvaus:**
Manuaalinen Discogs-rikastus toimitettu (search → match → enrich +
collection/wantlist togglet + notes). Jäljellä:

- Automaattinen ehdotus uusille kappaleille ingestin yhteydessä
  (artist + title → Discogs search → jos selvä osuma niin auto-enrich,
  muuten merkitään "tarkista")
- Library-näkymässä badget collection/wantlist -tilasta (haku tracks-
  taulun JOIN discogs_user_items kautta)
- Library-haku huomioi Discogs-metadatan (label, catalog#, year, genre)
- Cover-art player-näkymässä jos `discogsMetadata.coverUrl` löytyy

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
