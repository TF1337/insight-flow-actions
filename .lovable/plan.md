# Opgeloste acties terugvinden en koppelen

## Wat je krijgt
1. **Tabbladen in de actielijst**: "Open" (zoals nu) en "Opgelost". Opgelost toont afgeronde acties (Uitgevoerd / Resultaat gecontroleerd) per aanpak: Just Do It, PDCA, Change. Op elke kaart: wat er gedaan is, het resultaat en de 5× waarom van toen.
2. **Kleurcode op elke actie** (klein bolletje/rand):
   - Groen: opgelost
   - Oranje: nog bezig, termijn binnen 7 of 14 dagen
   - Rood: termijn verlopen
3. **Koppelen aan een eerdere oplossing** in het actieformulier, blok "Eerder opgelost?":
   - **Handmatig**: kies zelf een opgeloste actie uit de lijst.
   - **AI-voorstel**: een knop laat AI de huidige 5W1H en 5× waarom vergelijken met opgeloste acties en geeft max. 3 voorstellen met korte reden. Je bevestigt of wijst af.
   - Bevestigde of afgewezen koppelingen tellen als fictief LoRA-leervoorbeeld (zelfde idee als de score): "niet opgeslagen · geen training".
4. In de actielijst zie je bij een gekoppelde actie een linkje "Eerder opgelost: ..." dat de oude oplossing openklapt.

## Antwoord op je vraag
AI is niet verplicht: handmatig koppelen werkt altijd. AI helpt zoeken op basis van 5W1H en 5× waarom, en uit handmatige keuzes kan later een LoRA-adapter leren. Voor nu blijft dat een fictief voorbeeld.

## Voorbeeldgegevens
Een paar fictieve opgeloste acties toevoegen (bijv. eerdere olielekkage, pallet in looppad, scanner), zodat het tabblad en de koppelingen meteen te proberen zijn. Niets wordt blijvend opgeslagen.

## Technische details
- `Action` krijgt optioneel `linkedActionId`; nieuwe helper `actionSignal(a)` → groen/oranje/rood (oranje = due binnen 14 dagen, rood = verlopen) met tests.
- Tab via zod search-param `tab: "open" | "opgelost"` naast `aanpak`.
- AI-match via bestaande `/api/analyse`-opzet: nieuwe server route met tekst-input (geen foto), structured output `{ matches: [{id, reden}] }`, alleen ids uit de meegegeven opgeloste lijst geaccepteerd.
- Feedback (bevestigd/afgewezen) als tijdelijke formstate, net als PI-weging.
