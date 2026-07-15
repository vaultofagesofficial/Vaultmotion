# VaultMotion — Operationeel handboek voor Claude Code

Dit is een besliskader, geen logboek. Elke regel hieronder is een geldende afspraak;
wijk er alleen van af als Kurt dat expliciet vraagt, en documenteer de afwijking hier.

## 0. Wat dit product is
AI-video-tool voor YouTube Shorts (9:16). Pipeline: Claude-scriptanalyse → Scène Editor
(pauze op status `editing`, hervat via POST /:jobId/continue) → universele credit-check →
ElevenLabs voice-over (Gemini-TTS fallback bij 402) → achtergronden (kie.ai óf gratis
stock) → Remotion-render. Aparte app naast VaultBoost; gekoppeld, nooit samengevoegd.

## 1. Architectuurprincipes (vastgelegd juli 2026)

### 1.1 Modus ≠ Bron (harde scheiding)
- `mode` (documentary/epic/story/gaming/...) bepaalt TOON: belichting, camera-taal,
  script-stijl. `render_style` bepaalt de BEELDBRON. Een mode mag NOOIT de render_style
  overschrijven of impliceren. Elke toon moet met elke bron combineerbaar zijn
  (epic + stock is een geldige, geteste combinatie met 0 kie-calls).
- QuickStart toont daarom twee aparte keuzerijen: Modus en Beeldbron.

### 1.2 Free-tier: stock is de enige gratis stijl
- `render_style='stock'` (Pexels + Pixabay, 50/50-rotatie met kruislingse fallback) is
  de ENIGE gratis (€0) gebruikerskeuze. '2d' en 'illustrated' bestaan alleen nog als
  interne mechaniek (fallback-templates, code-only scènes) — nooit als UI-optie.
- Waarom: één helder gratis pad is verkoopbaar ("echte stockvideo's, gratis") en
  voorkomt dat de goedkope 2D-look het merk definieert.
- Pixabay-voorwaarde: zoekresultaten 24u cachen (pixabay_search_cache.json) — verplicht.

### 1.3 Credit-logica (BUSINESS-KRITIEK — nooit versoepelen zonder test)
- Universele credit-check in `runAfterEditing` (renderService), VÓÓR TTS en VÓÓR elke
  kie-call: raming via `estimateJobCredits(scenes, renderStyle, hybridIntensity)`.
  Onvoldoende saldo → status `insufficient_credits` + `credit_choice {needed, balance,
  chosen_style}`. Er is op dat moment aantoonbaar niets verbruikt.
- De gebruiker kiest expliciet via POST /:jobId/credit-choice: 'stock' (gratis verder)
  of 'retry' (na bijvullen). Verkeerde status → 409.
- VERBODEN: stil terugvallen naar een goedkopere stijl. Het enige vangnet (credits
  raken op míddenin een lopende render, 402 op een scène) mag degraderen naar
  text_focus_2d maar MOET een zichtbare `credit_warning` op de job zetten.
- Regel bij elke nieuwe render_style: (a) case toevoegen aan estimateJobCredits,
  (b) entry in de UI-kostenmatrix, (c) premium-stijlen kosten logisch MEER dan de
  stijlen waarvan ze een superset zijn (Regisseur = Simpel + extra's → duurder dan
  Simpel; dit ging al eens fout), (d) e2e-test van de gate met een saldo dat nét
  te laag is, met bewijs dat het saldo onveranderd blijft.

### 1.4 Render-stijlen (huidige set)
ai-cinematic, ai-image, simple, hybrid (smart/low/medium/high), stock, director,
cinematic_noir, documentary, social_media_fast, luxury. `director` = premium:
character sheet (3 hoeken via grok-imagine, ~15cr) + regie-taal in visual_focus +
per scène T2I-startframe + Kling 2.6 i2v (70cr/scène). `DIRECTOR_TEST_CHEAP=1` =
testmodus (Seedance 480p) — nooit op productie zetten.

### 1.5 Stock-specifiek
- Zoekterm per scène = `scene.stock_query` (door Claude gegenereerd bij
  renderStyle='stock': 2-4 concrete, bestaanbare zoekwoorden). visual_focus is
  daarvoor ongeschikt (beschrijft het AI-personage) en is slechts fallback.
- Elke gedownloade clip wordt getrimd naar scèneduur+1s en herschaald naar 1080×1920
  via de meegeleverde @remotion-ffmpeg (optimizeStockVideo). Nooit overslaan: rauwe
  clips van 30-60s veroorzaakten Remotion-timeouts.

### 1.6 Railway/Remotion-runtime
- Render-assets ALTIJD via loopback (127.0.0.1) laden, nooit de publieke URL
  (toRenderUrl in renderService) — publieke URL geeft delayRender-timeouts.
- Op Railway (RAILWAY_ENVIRONMENT): renderMedia concurrency 1 (override:
  RENDER_CONCURRENCY), offthreadVideoCacheSizeInBytes 512MB, timeout 240s.
  Reden: 8 OffthreadVideo's × default concurrency overschrijdt container-RAM,
  óók met kleine clips. Chrome: chromeMode 'chrome-for-testing' op nix-chromium.
- jobs.json/outputs op /data-volume via paths.js (DATA_DIR). Productie-jobs.json is
  een ANDERE dataset dan lokaal — forensiek altijd op de juiste dataset doen.

### 1.7 VaultBoost-koppeling
- Richting VB→VM: server-side handoff. POST /api/script/handoff (1u TTL, in-memory)
  slaat {script, topic, title, thumbnail?} op; Studio leest ?handoff=<id>, prefilled,
  schoont de URL en start NOOIT automatisch een render. GET op de handoff is
  gewhitelist in de API-key-middleware (random UUID, eigen data).
- Meegebrachte thumbnail wordt na render-start automatisch aan de job gekoppeld via
  het bestaande POST /:jobId/thumbnail (multipart).
- Richting VM→VB: sidebar-link, productie-aware (localhost:3001 lokaal, anders
  vaultboost-production.up.railway.app). Nooit hardcoden naar localhost.
- /api/capabilities is het contract dat VaultBoost leest — nieuwe stijl = daar toevoegen.

## 2. Kwaliteitscriteria (afvinklijst, geen adjectieven)
- [ ] Geen horizontale overflow op 375/414/768/1440px, programmatisch gemeten
      (document.documentElement.scrollWidth ≤ innerWidth+1 per route).
- [ ] Geen element breder dan zijn kolom op 375px: knoppenrijen krijgen flex-wrap;
      "raakt de rand" = nieuwe rij, nooit overflow.
- [ ] Elke gebruikerstekst in het Nederlands, begrijpelijk zonder technische kennis;
      foutmeldingen zeggen wat de gebruiker KAN DOEN (zie credit-modal als voorbeeld).
- [ ] Geen rauwe i18n-sleutels zichtbaar: elke t()-aanroep heeft een fallback-tekst
      of een sleutel in nl.json ÉN en.json.
- [ ] Elke fix bewezen met een echte test (bestandsgrootte, HTTP-status, gemeten
      bounding box, saldo-delta) — nooit alleen "de code ziet er goed uit".
- [ ] Bij UI-tests: check de disabled-state van een knop VOOR je hem klikt en
      concludeert dat er "geen feedback" is (twee valse alarmen ontstonden zo).
- [ ] Mobile safe-zone in video's: 150px top, 170px bottom, 60px zijkanten;
      koppen ≥56px, ondertitels ≥36px, labels ≥28px.
- [ ] Kosten transparant: elke betaalde stijl toont credits vooraf; wat gratis is
      toont expliciet €0.

## 3. Bekende valkuilen (patronen, geen incidenten)
1. **Stille degradatie verbergt bugs én kost vertrouwen.** Rate limiter die zonder
   reden-tekst faalde, silent 2D-fallback, weggegooide err.message in toasts — regel:
   elke faal-tak toont de echte reden of een expliciete keuze, nooit niets.
2. **Prompt-branches: controleer wélke branch draait.** claudeAnalyzer heeft een
   ADAPTIVE (default) en LEGACY (adaptiveStrategy=false) pad; een prompt-fix in de
   verkeerde branch doet niets. Verifieer met een echte analyzeScript-aanroep.
3. **Hardcoded omgevingen sterven op prod.** localhost-links, publieke i.p.v.
   loopback-URLs. Regel: elke absolute URL gaat door een env-bewuste helper.
4. **"Werkt lokaal" ≠ "werkt op Railway".** Andere dataset, ander RAM/CPU, andere
   ffmpeg/Chromium. Elke render-pijplijn-wijziging krijgt één productie-test met
   een 0-credit-stijl (stock).
5. **Volledige node-herstart na structurele wijzigingen** (taskkill /F /IM node.exe +
   vers starten); check op meerdere node-processen voor je een bug aan code wijt.
   In-memory state (rate limiter, handoffs, multiRefSupport) reset daarbij.
6. **Externe API-limieten raken bulk-flows.** Alles wat per item een API-call doet
   moet 429 afvangen met wacht-en-retry en de limiet moet op bulk-gebruik berekend zijn.
7. **Grote media-assets zijn een runtime-risico.** Alles wat van buiten komt
   (stock, uploads) eerst normaliseren (trim/schaal/codec) vóór het de render raakt.
8. **Valideer je eigen meting.** Placeholder-tekst zit niet in textContent; tooltips
   zijn bewust 16px breed; een "dode knop" kan gewoon disabled zijn.

## 4. Business-beslissingen (te respecteren door alle code)
- **Prijsstructuur:** Starter €29 → Ultra €149 (abonnementstiers, uitwerking volgt
  bij het account-systeem). Credit-kosten per stijl moeten hierbinnen rendabel zijn.
- **Free tier:** enkel Stock Footage gratis; toekomstig proefaccount = 5 video's
  totaal, stock-only (zie auth-preview/README.md voor het volledige concept).
- **Owner-account:** Kurt betaalt nooit — elke toekomstige toegangs-/betaalcheck
  begint met `role === 'owner'` → volledige toegang, vóór elke Stripe/saldo-check.
- **Twee aparte producten, één merk:** VaultBoost en VaultMotion blijven zelfstandig
  bruikbaar; gedeelde features (humanisatie, tooltips) volgen exact hetzelfde patroon,
  vastgelegd in ../BRAND_KIT.md (kleuren, componenten, gedeelde feature-patronen).
- **Toegangsniveau:** VAULTMOTION_ACCESS_ENABLED (default true) tot het echte
  account-systeem er is; "geen toegang" oogt neutraal/grijs, "storing" oogt rood.

## 5. Werkwijze
- Taken in gegeven volgorde; enkel strikt nodige bestanden lezen; geen uitleg
  tussendoor, rapport na afloop met concreet bewijs per conclusie.
- Paden altijd via paths.js. Remotion-code volgens de remotion-best-practices-skill;
  spring() voor entrances, interpolate() voor doorlopend; composities simpel houden.
- Credits zijn echt geld: testrenders met 0-credit-stijlen tenzij de test juist het
  betaalde pad bewijst; rapporteer saldo vóór/na bij elke betaalde test.
