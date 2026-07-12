# Higgsfield API-onderzoek (juli 2026) — beslissing: NIET geïmplementeerd

## Bevindingen

**1. Programmatische API?** Ja — cloud.higgsfield.ai biedt een REST API (Bearer-token auth) met Python/Node SDK's (github.com/higgsfield-ai/higgsfield-client): text-to-video jobs starten, status pollen, output downloaden. Technisch bruikbaar vanuit VaultMotion's backend. Kanttekening uit reviews: documentatie is mager, webhook-support slecht uitgelegd.

**2. Kosten per generatie** (Higgsfield-credits):
- Kling 3.0: ~7-10 cr per 720p-video
- Seedance 2.0: ~22,5-25 cr per 5s-clip
- Premium (Sora 2/Veo 3.1): 40-70 cr

**3. Abonnementsvrije route?** **NEE.** API-toegang is gated achter de hogere plans (Creator/Plus $39 – Ultra $99 per maand, jaarlijks gefactureerd). Credits zijn maandelijkse allocaties die **verlopen** — geen pure pay-per-credit zonder subscription.

## Advies (eerlijk)

**Blijf bij kie.ai.** Redenen voor Kurts gebruikspatroon:
- kie.ai is pay-as-you-go zonder vaste maandkost; Higgsfield kost minimaal ~€39/mnd (~€470/jaar) óók in maanden zonder renders.
- Higgsfield-credits verlopen maandelijks — ongebruikte waarde verdampt; kie.ai-credits niet.
- Break-even grofweg: pas bij consistent 15-20+ premium-video's per maand wordt Higgsfields lagere per-generatie-prijs (Kling 3.0 ~7cr vs kie.ai Kling 2.6 ~70 kie-cr) interessant — dat is niet het huidige patroon.
- VaultMotion heeft al een Higgsfield-MCP-pad (`waitForMcp` + PATCH-injectie) voor handmatig gebruik via het bestaande chat-abonnement, dus incidentele Kling 3.0-shots kunnen al zonder API.

**Toekomstige trigger om te heroverwegen:** structureel >15 premium-renders/maand, of Higgsfield introduceert pay-as-you-go API-pricing. De Regisseur-modus is bewust model-agnostisch opgezet (i2v met startframe) zodat de video-backend later per env-var te wisselen is.
