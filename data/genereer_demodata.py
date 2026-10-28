"""Maakt de demodata voor het Snowflake-dashboard van Insight Flow Actions.

Twee bronnen, herkenbaar aan de kolom BRON:
- app-voorbeeld: de 10 meldingen en acties uit src/data/mock.ts (datums van 28-10-2026)
- synthetisch:   fictieve historie van 12 weken, alleen bedoeld om de heatmap te vullen

Net als de CSV's in het flood-lab zijn alle waarden fictief.
Opnieuw draaien:  python3 data/genereer_demodata.py   (schrijft naast dit script)
"""
import csv
import random
from datetime import date, timedelta
from pathlib import Path

PEIL = date(2026, 10, 28)   # dag waarop de app-voorbeelden zijn geëxporteerd
WEKEN = 12
rng = random.Random(1337)

AFDELINGEN = ["Inbound", "Opslag", "Orderpick", "Pakstraat", "Outbound", "Retouren"]
ONDERWERPEN = ["Veiligheid", "Kwaliteit", "Productiviteit", "Personeel"]
MENSEN = ["Sanne de Vries", "Mark Jansen", "Fatima El Amrani", "Peter Bakker", "Lotte Visser", "Jeroen Smit"]
# KPI zoals de actielijst hem per onderwerp toont (TOPIC_KPI in src/routes/acties.tsx)
KPI = {"Veiligheid": "Veiligheid", "Kwaliteit": "SLA Healthcare", "Productiviteit": "WPL Index", "Personeel": "Ziekteverzuim"}
AFGEROND = {"Uitgevoerd", "Resultaat gecontroleerd"}

# Verwacht aantal meldingen per week (afdeling x onderwerp). Bewust ongelijk verdeeld,
# zodat de heatmap iets laat zien: veiligheid bij docks en heftrucks, personeel in outbound.
BASIS = {
    "Inbound":   {"Veiligheid": 1.3, "Kwaliteit": 0.4, "Productiviteit": 0.5, "Personeel": 0.3},
    "Opslag":    {"Veiligheid": 1.1, "Kwaliteit": 0.3, "Productiviteit": 0.6, "Personeel": 0.2},
    "Orderpick": {"Veiligheid": 0.5, "Kwaliteit": 0.5, "Productiviteit": 1.2, "Personeel": 0.6},
    "Pakstraat": {"Veiligheid": 0.6, "Kwaliteit": 0.9, "Productiviteit": 0.5, "Personeel": 0.3},
    "Outbound":  {"Veiligheid": 0.4, "Kwaliteit": 0.4, "Productiviteit": 0.5, "Personeel": 1.0},
    "Retouren":  {"Veiligheid": 0.2, "Kwaliteit": 0.8, "Productiviteit": 0.3, "Personeel": 0.2},
}
P_ROOD = {"Veiligheid": 0.35, "Kwaliteit": 0.20, "Productiviteit": 0.15, "Personeel": 0.30}

TITELS = {
    "Veiligheid": ["Looproute geblokkeerd door pallets", "Heftruck rijdt te hard in gang", "Stellingbeschermer beschadigd",
                   "Gladde vloer bij dockdeur", "Geen veiligheidsschoenen gedragen", "Lading hangt over palletrand",
                   "Brandblusser niet bereikbaar", "Snijmes zonder bescherming in gebruik"],
    "Kwaliteit": ["Verkeerd artikel gepickt", "Label onleesbaar op doos", "Zending zonder pakbon",
                  "Retour te laat verwerkt", "Beschadigde verpakking bij ontvangst", "Telverschil bij inslag"],
    "Productiviteit": ["Wachttijd op heftruck", "Scanner valt uit tijdens picken", "Picklocatie leeg, aanvulling te laat",
                       "Inpaktafel niet op werkhoogte", "Storing transportband", "Dubbele handeling bij herpakken"],
    "Personeel": ["Onderbezetting late dienst", "Nieuwe medewerker zonder inwerkmaatje", "Klachten over tilbelasting",
                  "Overuren structureel boven planning", "Instructie niet begrepen door taalbarrière"],
}
ACTIE_TITELS = {
    "rood": ["Direct afzetten en oorzaak onderzoeken", "Werkinstructie aanpassen en toetsen", "A3 opstellen voor structurele oplossing"],
    "oranje": ["Afspraak maken met teamleider", "Toolbox houden met ploeg", "Controle per dienst invoeren"],
    "groen": ["Bespreken in dagstart", "Meenemen in 6S-ronde"],
}

DEMO_OBS = [
    ("obs-pallet", "Beschadigde pallet bij dock 4", "Inbound", "Veiligheid", "rood", "Sanne de Vries", "2026-10-22"),
    ("obs-scanner", "Handscanners vaak leeg halverwege dienst", "Orderpick", "Productiviteit", "oranje", "Mark Jansen", "2026-10-19"),
    ("obs-bezetting", "Onderbezetting outbound op vrijdag", "Outbound", "Personeel", "rood", "Peter Bakker", "2026-10-24"),
    ("obs-olie", "Olielekkage heftruck in gang C", "Opslag", "Veiligheid", "rood", "Lotte Visser", "2026-10-17"),
    ("obs-afval", "Afvalcontainers overvol, karton en folie gemengd", "Pakstraat", "Veiligheid", "oranje", "Fatima El Amrani", "2026-10-12"),
    ("obs-tillen", "Zwaar tillen vanaf lage pallets", "Orderpick", "Personeel", "rood", "Peter Bakker", "2026-10-04"),
    ("obs-nooduitgang", "Nooduitgang geblokkeerd door dozen", "Inbound", "Veiligheid", "groen", "Sanne de Vries", "2026-09-25"),
    ("obs-licht", "Verlichting gang F defect", "Opslag", "Productiviteit", "oranje", "Mark Jansen", "2026-10-20"),
    ("obs-olie-oud", "Olielekkage heftruck 2 in gang B", "Opslag", "Veiligheid", "groen", "Lotte Visser", "2026-08-23"),
    ("obs-scanner-oud", "Lege scanners door onhandig geplaatst laadstation", "Orderpick", "Productiviteit", "groen", "Peter Bakker", "2026-09-08"),
]
DEMO_ACT = [
    ("act-pallet", "Pallet verwijderen en looproute dock 4 vrijhouden", "obs-pallet", "Veiligheid", "Inbound", "Mark Jansen", "2026-10-22", "2026-10-27", "Change", "In uitvoering"),
    ("act-scanner-1", "Defecte scanners retour naar ICT en reservepool inrichten", "obs-scanner", "Productiviteit", "Orderpick", "Peter Bakker", "2026-10-06", "2026-10-31", "Actie / Just Do It", "Wacht op besluit"),
    ("act-bezetting", "Flexpool inzetten op vrijdag outbound", "obs-bezetting", "Personeel", "Outbound", "Jeroen Smit", "2026-10-24", "2026-10-26", "PDCA / 6S", "Wacht op besluit"),
    ("act-olie", "Lekbak plaatsen en hydrauliekslang heftruck 3 vervangen", "obs-olie", "Veiligheid", "Opslag", "Lotte Visser", "2026-10-17", "2026-10-25", "Actie / Just Do It", "In uitvoering"),
    ("act-afval", "Afvalscheiding pakstraat inrichten met 6S-markering", "obs-afval", "Veiligheid", "Pakstraat", "Fatima El Amrani", "2026-10-12", "2026-11-01", "PDCA / 6S", "Open"),
    ("act-tillen", "A3: tilbelasting zone zwaar structureel verlagen", "obs-tillen", "Personeel", "Orderpick", "Peter Bakker", "2026-10-04", "2026-11-11", "Change", "Wacht op besluit"),
    ("act-nooduitgang", "Nooduitgang vrijmaken en bufferplek markeren", "obs-nooduitgang", "Veiligheid", "Inbound", "Sanne de Vries", "2026-09-25", "2026-09-28", "Actie / Just Do It", "Resultaat gecontroleerd"),
    ("act-licht", "Verlichting gang F herstellen en lichtmeting doen", "obs-licht", "Productiviteit", "Opslag", "Mark Jansen", "2026-10-20", "2026-10-27", "PDCA / 6S", "Uitgevoerd"),
    ("act-olie-oud", "Olielekkage heftruck 2: slang vervangen en lekbak standaard", "obs-olie-oud", "Veiligheid", "Opslag", "Lotte Visser", "2026-08-23", "2026-08-29", "Actie / Just Do It", "Resultaat gecontroleerd"),
    ("act-scanner-oud", "Laadstation scanners verplaatst naar begin pickroute", "obs-scanner-oud", "Productiviteit", "Orderpick", "Peter Bakker", "2026-09-08", "2026-09-13", "PDCA / 6S", "Resultaat gecontroleerd"),
]


def poisson(lam: float) -> int:
    # Knuth; prima voor kleine lambda
    import math
    l, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= rng.random()
        if p <= l:
            return k
        k += 1


def signaal(onderwerp: str) -> str:
    r = rng.random()
    if r < P_ROOD[onderwerp]:
        return "rood"
    return "oranje" if r < P_ROOD[onderwerp] + 0.40 else "groen"


def status_voor(deadline: date, aangemaakt: date) -> str:
    leeftijd = (PEIL - aangemaakt).days
    if deadline < PEIL - timedelta(days=7):
        # oude acties: meestal afgerond, een paar blijven hangen (verlopen)
        return rng.choices(["Resultaat gecontroleerd", "Uitgevoerd", "In uitvoering", "Wacht op besluit"], [70, 15, 10, 5])[0]
    if leeftijd < 4:
        return rng.choice(["Open", "Open", "In uitvoering"])
    return rng.choices(["Open", "In uitvoering", "Wacht op besluit", "Uitgevoerd"], [25, 40, 15, 20])[0]


obs_rows, act_rows = [], []
for o in DEMO_OBS:
    obs_rows.append(dict(zip(["OBSERVATIE_ID", "TITEL", "AFDELING", "ONDERWERP", "SIGNAAL", "MELDER", "DATUM"], o), BRON="app-voorbeeld"))
for a in DEMO_ACT:
    r = dict(zip(["ACTIE_ID", "TITEL", "OBSERVATIE_ID", "ONDERWERP", "AFDELING", "EIGENAAR", "AANGEMAAKT", "DEADLINE", "PRIORITEIT", "STATUS"], a))
    r["KPI"] = KPI[r["ONDERWERP"]]
    r["BRON"] = "app-voorbeeld"
    act_rows.append(r)

n_obs = n_act = 0
start = PEIL - timedelta(weeks=WEKEN)
for w in range(WEKEN):
    week_start = start + timedelta(weeks=w)
    for afd in AFDELINGEN:
        for ond in ONDERWERPEN:
            lam = BASIS[afd][ond]
            if afd == "Opslag" and ond == "Veiligheid" and w >= WEKEN - 4:
                lam *= 2.2  # hotspot: heftruckmeldingen in opslag lopen de laatste weken op
            for _ in range(poisson(lam)):
                dag = week_start + timedelta(days=rng.randint(0, 6))
                if dag > PEIL:
                    continue
                n_obs += 1
                oid = f"obs-s{n_obs:04d}"
                sig = signaal(ond)
                obs_rows.append(dict(OBSERVATIE_ID=oid, TITEL=rng.choice(TITELS[ond]), AFDELING=afd, ONDERWERP=ond,
                                     SIGNAAL=sig, MELDER=rng.choice(MENSEN), DATUM=dag.isoformat(), BRON="synthetisch"))
                if rng.random() < {"rood": 0.9, "oranje": 0.6, "groen": 0.2}[sig]:
                    n_act += 1
                    aangemaakt = min(dag + timedelta(days=rng.randint(0, 2)), PEIL)
                    deadline = aangemaakt + timedelta(days=rng.randint(5, 21))
                    prio = {"rood": ["Actie / Just Do It", "Change"], "oranje": ["Actie / Just Do It", "PDCA / 6S"], "groen": ["PDCA / 6S"]}[sig]
                    act_rows.append(dict(ACTIE_ID=f"act-s{n_act:04d}", TITEL=rng.choice(ACTIE_TITELS[sig]), OBSERVATIE_ID=oid,
                                         KPI=KPI[ond], ONDERWERP=ond, AFDELING=afd, EIGENAAR=rng.choice(MENSEN),
                                         AANGEMAAKT=aangemaakt.isoformat(), DEADLINE=deadline.isoformat(),
                                         PRIORITEIT=rng.choice(prio), STATUS=status_voor(deadline, aangemaakt), BRON="synthetisch"))

uit = Path(__file__).resolve().parent
OBS_KOL = ["OBSERVATIE_ID", "TITEL", "AFDELING", "ONDERWERP", "SIGNAAL", "MELDER", "DATUM", "BRON"]
ACT_KOL = ["ACTIE_ID", "TITEL", "OBSERVATIE_ID", "KPI", "ONDERWERP", "AFDELING", "EIGENAAR", "AANGEMAAKT", "DEADLINE", "PRIORITEIT", "STATUS", "BRON"]
for naam, kol, rows in [("observaties.csv", OBS_KOL, obs_rows), ("acties.csv", ACT_KOL, act_rows)]:
    with open(uit / naam, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=kol, quoting=csv.QUOTE_MINIMAL)
        w.writeheader()
        w.writerows(rows)
print(f"{len(obs_rows)} observaties, {len(act_rows)} acties")
