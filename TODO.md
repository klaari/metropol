# Aani TODO

## 🔜 Tehtävä: "+ nappi" pikalisäys (clipboard-pohjainen)

**Prioriteetti:** Korkea  
**Kuvaus:**  
Korvaa nykyinen Downloads-välilehden URL-tekstikenttä + napilla, joka tarkistaa leikepöydän vain kun käyttäjä painaa sitä itse.

**Työnkulku:**
1. Käyttäjä kopioi YouTube-urlin (esim. Discogsin kautta)
2. Avaa Aanin
3. Painaa "+" nappia (esim. Library- tai Player-näkymässä, tai tab barin yhteydessä)
4. Sovellus tarkistaa leikepöydän → jos YouTube-url löytyy, se on valmiina kentässä
5. Käyttäjä painaa "Download" → valmis, jatkaa muuta
6. Kappale ilmestyy kirjastoon kun lataus valmis — ei tarvetta seurata edistymistä

**UX-periaatteet:**
- Ei automaattisia popupeja tai keskeytyksiä
- Käyttäjä itse initioi aina (opt-in)
- Downloads-välilehden voi yksinkertaistaa tai poistaa kokonaan myöhemmin

**Tekniset huomiot:**
- `Clipboard.getStringAsync()` (expo-clipboard) kun nappia painetaan
- Validoi YouTube URL ennen esitäyttöä
- Nappi voi olla floating action button tai tab barin "+" ikoni

---

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

## 🔜 Tehtävä: Haku (search)

**Prioriteetti:** Korkea
**Kuvaus:**
Hakutoiminto kirjastoon — kappaleen, artistin, levyn nimellä. Pohjustaa
myös tulevaa Discogs-selausta ja mixin-ominaisuuksia (esim. "etsi sopiva
seuraava biisi tästä BPM-haarukasta").

**MVP:**
- Hakukenttä Library-välilehden yläosassa
- Live-suodatus kirjoittaessa (artist / title / album)
- Tyhjä tila + ei-tuloksia tila

**Myöhemmin:**
- Suodattimet: BPM-haarukka, key, genre
- Lajittelu: viimeksi soitettu, lisätty, BPM
- Globaali haku (kirjasto + Discogs samalla kertaa)

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

## 🔜 Tehtävä: Discogs-rikastus (track-tiedot + collection/wantlist)

**Prioriteetti:** Korkea
**Kuvaus:**
Rikasta olemassa olevien kappaleiden metadata Discogsin avulla ja anna
käyttäjän hallita omaa kokoelmaansa / wantlistia suoraan Aanista. Tämä on
kevyempi ensiaskel ennen täysimittaista Discogs-selainta.

**Track-rikastus:**
- Hae release Discogs-API:lla (artist + title) tai käyttäjän valitsemana matchina
- Tallenna kappaleelle: `genres[]`, `styles[]`, `releaseYear`, `label`,
  `catalogNumber`, `discogsReleaseId`, `coverUrl`
- Näytä rikastettu data player- ja library-näkymässä
- "Re-match" -toiminto jos automaattinen osuma on väärä

**Collection / Wantlist -tila:**
- Näytä per kappale: onko Discogs-collectionissa tai wantlistissä (badge)
- Lataa user-collection + wantlist taustalla, cachetä paikallisesti
- Päivitys pull-to-refreshillä tai manuaalisella sync-napilla

**Toiminnot:**
- "Lisää collectioniin" / "Lisää wantlistiin" -napit kappalenäkymässä
- Notes-kenttä: vapaa muistiinpano (esim. "ostettu Helsingistä 2024", "haluan 12\"-version")
- Poisto kummastakin

**Tekniset huomiot:**
- Discogs OAuth 1.0a — token-vaihto vaatii backend-endpointin (`apps/api`)
- API-rajat: 60 req/min autentikoituna → batch-rikastus ingestissä, ei
  ad-hoc client-puolelta
- Schema: lisää `tracks`-tauluun discogs-kentät, uusi taulu
  `discogs_user_items` (releaseId, type: collection|wantlist, note, syncedAt)
- Mätsäystrategia: Discogs search → top N → automaattinen jos selvä osuma
  (artist + title + duration), muuten käyttäjälle valittavaksi

**Vaiheistus:**
1. Discogs OAuth + token-tallennus
2. Track-rikastus (manuaalinen "Etsi Discogsista" -nappi yhdellä kappaleella)
3. Batch-rikastus uusille kappaleille ingestissä
4. Collection/wantlist -synkka + badget
5. Lisää/poista collection/wantlist + notes

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
