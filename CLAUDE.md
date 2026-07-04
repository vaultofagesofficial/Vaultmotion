# VaultMotion — Werkwijze voor Claude Code

## Communicatiestijl
- Werk taken altijd in de gegeven volgorde af
- Lees enkel de bestanden die strikt nodig zijn voor de 
  huidige taak, niet de hele codebase
- Geen uitleg vooraf of tussendoor — voer uit en rapporteer 
  pas een samenvatting na afronding
- Bij twijfel over een bestandspad: vraag niet, zoek het 
  zelf op via search/grep voor je verdergaat

## Verificatie-regel (kritiek)
- Een fix is NOOIT "opgelost" enkel omdat de code er logisch 
  uitziet of geen foutmelding toont
- Bevestig elke render/build-fix met een ECHTE test: 
  daadwerkelijke bestandsgrootte via fs.statSync, een 
  succesvolle API-call met zichtbare response, of een 
  vergelijkbaar hard bewijs
- Rapporteer expliciet het concrete bewijs (bestandsgrootte, 
  timestamp, response-code) bij elke conclusie dat iets werkt

## Server- en cache-regels (kritiek)
- Na elke structurele wijziging (package-versies, nieuwe 
  imports, pad-berekeningen, bundler-config): waarschuw dat 
  een VOLLEDIGE herstart nodig is, niet enkel 'rs' in nodemon
- Volledige herstart betekent: taskkill /F /IM node.exe 
  gevolgd door een verse npm run dev
- Controleer bij twijfel of er meerdere node-processen 
  actief zijn (tasklist | findstr node) voor je een bug aan 
  de code zelf toeschrijft

## Pad-consistentie
- Gebruik ALTIJD het centrale paths.js bestand voor 
  OUTPUTS_DIR en JOBS_FILE — nooit een eigen 
  path.resolve(__dirname, ...) berekening in een ander 
  bestand
- Bij het toevoegen van een nieuw bestand dat een pad nodig 
  heeft: importeer vanuit paths.js, breid dat bestand uit 
  indien een nieuw pad nodig is

## Remotion-specifiek
- Gebruik de geïnstalleerde remotion-best-practices skill 
  (.agents/skills/remotion-best-practices/) voor ALLE 
  Remotion-gerelateerde code: timing, transitions, 
  animaties, audio, subtitles
- Gebruik spring() voor het in beeld komen van elementen, 
  interpolate() voor doorlopende effecten (zoom/pan)
- Houd composities simpel — veel overlappende animaties en 
  complexe transities verhogen het risico op render-fouten 
  en hapering aanzienlijk meer dan ze visuele winst opleveren

## Mobile safe-zone (altijd toepassen op nieuwe tekst-overlays)
- Minimaal 150px vanaf de top, 170px vanaf de bottom, 
  60px zijmarges
- Minimum lettergroottes: koppen 56px+, ondertitels 36px+, 
  labels nooit onder 28px

## Project-structuur
- backend/src/services/ — render-, kie.ai- en 
  ElevenLabs-logica
- backend/src/routes/ — API endpoints
- frontend/src/pages/ — Studio, JobsPage, JobDetailPage, 
  SceneEditorPage
- remotion/src/templates/ — de 6 scène-templates
- Render-pipeline volgorde: Claude analyse → Scène Editor 
  → voice-over → achtergronden (kie.ai) → Remotion render → 
  klaar.
