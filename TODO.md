# Metropol TODO

## 🔜 Tehtävä: "+ nappi" pikalisäys (clipboard-pohjainen)

**Prioriteetti:** Korkea  
**Kuvaus:**  
Korvaa nykyinen Downloads-välilehden URL-tekstikenttä + napilla, joka tarkistaa leikepöydän vain kun käyttäjä painaa sitä itse.

**Työnkulku:**
1. Käyttäjä kopioi YouTube-urlin (esim. Discogsin kautta)
2. Avaa Metropolin
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
Native share extension joka mahdollistaa YouTube-urlin jakamisen suoraan selaimesta tai YouTube-appista Metropoliin ilman sovelluksen avaamista.

**Työnkulku:**
1. Selaimessa tai YouTubessa → "Jaa" → valitse Metropol
2. Extension käynnistyy taustalla, lähettää urlin API:lle
3. Lataus alkaa taustalla, sovellusta ei tarvitse avata

**Tekniset huomiot:**
- iOS: App Extension (Share Extension) — vaatii Expo bare workflow tai custom native module
- Android: Intent filter + background task
- Vaatii todennäköisesti Expo managed workflowsta luopumista tai EAS custom build targetia
- Harkitse kun clipboard-flow on tehty ja testattu

---

## 🔜 Tehtävä: Web-sovellus (Next.js) — korkea prioriteetti

**Prioriteetti:** Korkea  
**Kuvaus:**  
Next.js companion-app Turborepo-monorepon sisällä. Mahdollistaa YouTube-urlien
lisäämisen tietokoneelta — kappaleet synkronoituvat automaattisesti mobiiliin.

**MVP-ominaisuudet:**
- Clerk-autentikointi (`@clerk/nextjs`)
- YouTube URL -syöttö → sama API kuin mobiilissa
- Latauksen tila WebSocketin kautta reaaliajassa
- Kirjasto: lista ladatuista kappaleista

**Vaiheet:**
1. `apps/web` Next.js -scaffoldi Turboreposeen
2. Clerk-auth + protected routes
3. Downloads-sivu: URL-kenttä + WebSocket-tila
4. Library-sivu: kappalelista

**Deploy:** Vercel tai Railway

---

## 🔮 Myöhemmin: Discogs-integraatio (räätälöity selain)

**Prioriteetti:** Korkea (myöhemmin)  
**Kuvaus:**  
Täysimittainen Discogs-selain appin sisällä. Muuttaa Metropolin luonteen download-työkalusta Discogs-integroiduksi musiikkikirjastoksi.

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
- Merkintä mitä on jo ladattu Metropoliin

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

## ✅ Tehty

_(lisää tänne kun asioita valmistuu)_
