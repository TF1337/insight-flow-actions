"""Maakt de demodata voor het Snowflake-dashboard van Insight Flow Actions.

Twee bronnen, herkenbaar aan de kolom BRON:
- app-voorbeeld: de 10 meldingen en acties uit src/data/mock.ts (datums van 28-10-2026)
- synthetisch:   fictieve historie van 12 weken, alleen bedoeld om de heatmap te vullen

Daarnaast: medewerkers.csv (fictieve gebruikers voor de persona in het dashboard) en
kpi_normen.csv (de KPI-kaarten uit src/routes/index.tsx). De analyseteksten (5W1H,
5x Waarom, gedaan/resultaat) komen uit app_voorbeelden_teksten.json en teksten_synthetisch.py.

Net als de CSV's in het flood-lab zijn alle waarden fictief.
Opnieuw draaien:  python3 data/genereer_demodata.py   (schrijft naast dit script)
"""
import csv
import json
import random
import sys
from datetime import date, timedelta
from pathlib import Path

PEIL = date(2026, 10, 28)   # dag waarop de app-voorbeelden zijn geëxporteerd
WEKEN = 12
rng = random.Random(1337)    # bepaalt meldingen en acties (178 / 102)
rng2 = random.Random(2026)   # alleen teksten en eigenaren, zodat de aantallen gelijk blijven

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
sys.path.insert(0, str(uit))  # teksten_synthetisch.py staat naast dit script
from teksten_synthetisch import TEKSTEN, PLEKKEN, DIENSTEN  # noqa: E402

# ── Fictieve medewerkers (persona in het dashboard) ──────────────────────────
MEDEWERKERS = [
    dict(NAAM="Peter Bakker", ROL="Supervisor", AFDELING="Alle afdelingen", VESTIGING="OFM"),
    dict(NAAM="Sanne de Vries", ROL="Teamleider", AFDELING="Inbound", VESTIGING="OFM"),
    dict(NAAM="Lotte Visser", ROL="Teamleider", AFDELING="Opslag", VESTIGING="OFM"),
    dict(NAAM="Mark Jansen", ROL="Teamleider", AFDELING="Orderpick", VESTIGING="OFM"),
    dict(NAAM="Fatima El Amrani", ROL="Teamleider", AFDELING="Pakstraat", VESTIGING="OFM"),
    dict(NAAM="Jeroen Smit", ROL="Teamleider", AFDELING="Outbound", VESTIGING="OFM"),
]
TEAMLEIDER = {m["AFDELING"]: m["NAAM"] for m in MEDEWERKERS if m["ROL"] == "Teamleider"}

# ── Analyseteksten ───────────────────────────────────────────────────────────
demo = json.load(open(uit / "app_voorbeelden_teksten.json", encoding="utf-8"))
for o in obs_rows:
    if o["BRON"] == "app-voorbeeld":
        o.update(demo["obs"][o["OBSERVATIE_ID"]])
        continue
    t = TEKSTEN[o["TITEL"]]
    dienst = rng2.choice(DIENSTEN)
    if "late dienst" in o["TITEL"].lower():
        dienst = "late dienst"
    weeknr = date.fromisoformat(o["DATUM"]).isocalendar()[1]
    o.update(
        WIE=f"Ploeg {o['AFDELING'].lower()}, {dienst}",
        WAT=o["TITEL"],
        WAAR=f"{o['AFDELING']}, {rng2.choice(PLEKKEN[o['AFDELING']])}",
        WANNEER=f"{dienst.capitalize()}, week {weeknr}",
        WAAROM=t["waarom"],
        HOE=t["hoe"],
        WAAROM_KETEN=" ".join(f"{i + 1}. {x}" for i, x in enumerate(t["keten"])),
    )

titel_van = {o["OBSERVATIE_ID"]: o["TITEL"] for o in obs_rows}
for a in act_rows:
    if a["BRON"] == "app-voorbeeld":
        a.update(demo["acts"][a["ACTIE_ID"]])
        continue
    if rng2.random() < 0.75:  # meestal is de teamleider van de afdeling eigenaar
        a["EIGENAAR"] = TEAMLEIDER.get(a["AFDELING"], "Peter Bakker")
    t = TEKSTEN[titel_van[a["OBSERVATIE_ID"]]]
    a["TITEL"] = t["hoe"].split(";")[0].split(". ")[0].rstrip(".")  # actie volgt uit de maatregel
    a["GEDAAN"] = t["gedaan"] if a["STATUS"] in AFGEROND else ""
    a["RESULTAAT"] = t["resultaat"] if a["STATUS"] == "Resultaat gecontroleerd" else ""

# ── KPI-kaarten zoals in src/routes/index.tsx (fictieve waarden) ─────────────
# ACTIE_KPI: kaart waaronder de acties van dat onderwerp vallen (kolom KPI in acties.csv)
KPI_RIJEN = [
    ("OFM", "Veiligheid", "Gedragsregels", "4,3", "Norm 5,75", "aandacht", "", "Veiligheid"),
    ("OFM", "Veiligheid", "Aantal incidenten per maand", "0,3", "Norm 0,4", "gunstig", "Near misses: 30 dagen", ""),
    ("OFM", "Kwaliteit", "Retouren", "6,4 d", "Norm 7 dagen", "gunstig", "Retouren binnen SLA · leeftijd retouren", ""),
    ("OFM", "Kwaliteit", "Inbound doorlooptijd", "19 u", "Norm <24 uur", "gunstig", "Leveringen na ontvangst IG binnen 24 uur op voorraad", ""),
    ("OFM", "Kwaliteit", "HBV doorlooptijd", "8,6 u", "Norm nog te bepalen", "fictief", "Vrijgave tot dock · INCD / PRN-KIL", ""),
    ("OFM", "Kwaliteit", "Klantorders", "98,7%", "Norm nog te bepalen", "fictief", "On time: 98,7% | In full: 99,2%", ""),
    ("OFM", "Productiviteit", "Retouren Index", "97%", "Norm <100%", "gunstig", "", ""),
    ("OFM", "Productiviteit", "OFM Index", "97%", "Norm <100%", "gunstig", "Directe uren index: 96%", ""),
    ("OFM", "Personeel", "Ziekteverzuim", "3,8%", "Norm 4,0%", "gunstig", "Lang verzuim: fictief 2,6%", "Ziekteverzuim"),
    ("OFM", "Personeel", "Verhouding vast / flex", "94%", "Norm 95%", "aandacht", "Aandeel flex · fictieve actuele waarde", ""),
    ("LDC", "Veiligheid", "Gedragsregels", "5,9", "Norm 5,75", "op norm", "", ""),
    ("LDC", "Veiligheid", "Aantal incidenten", "0,2", "Norm 0,3", "gunstig", "Near misses: 30 dagen", ""),
    ("LDC", "Kwaliteit", "SLA Healthcare", "98,4%", "Norm 98%", "op norm",
     "Outbound vóór 18u: 98,5% | Inbound na 12u: 98,1% | Orders in Full: 99,1% · norm 99%", "SLA Healthcare"),
    ("LDC", "Kwaliteit", "SLA Printlogistiek", "95,6%", "Norm 95%", "op norm",
     "Stock zelfde dag: 95,8% | Print dag na laatste PF-scan: 95,4% | Orders in Full: 99,0% · norm 99%", ""),
    ("LDC", "Productiviteit", "WPL Index", "97%", "Norm <100%", "gunstig", "WPI direct: 97%", "WPL Index"),
    ("LDC", "Productiviteit", "Healthcare Index", "97%", "Norm <100%", "gunstig", "", ""),
    ("LDC", "Personeel", "Ziekteverzuim", "4,2%", "Norm 4,0%", "aandacht", "", ""),
    ("LDC", "Personeel", "Verhouding vast / flex", "96%", "Norm 95%", "op norm", "Aandeel flex · fictieve actuele waarde", ""),
]
KPI_KOL = ["VESTIGING", "ONDERWERP", "KPI", "WAARDE", "NORM", "STATUS", "TOELICHTING", "ACTIE_KPI", "VOLGORDE"]
kpi_rows = [dict(zip(KPI_KOL, r + (i + 1,))) for i, r in enumerate(KPI_RIJEN)]

OBS_KOL = ["OBSERVATIE_ID", "TITEL", "AFDELING", "ONDERWERP", "SIGNAAL", "MELDER", "DATUM", "BRON",
           "WIE", "WAT", "WAAR", "WANNEER", "WAAROM", "HOE", "WAAROM_KETEN"]
ACT_KOL = ["ACTIE_ID", "TITEL", "OBSERVATIE_ID", "KPI", "ONDERWERP", "AFDELING", "EIGENAAR", "AANGEMAAKT", "DEADLINE",
           "PRIORITEIT", "STATUS", "BRON", "GEDAAN", "RESULTAAT"]
MW_KOL = ["NAAM", "ROL", "AFDELING", "VESTIGING"]
for naam, kol, rows in [("observaties.csv", OBS_KOL, obs_rows), ("acties.csv", ACT_KOL, act_rows),
                        ("medewerkers.csv", MW_KOL, MEDEWERKERS), ("kpi_normen.csv", KPI_KOL, kpi_rows)]:
    with open(uit / naam, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=kol, quoting=csv.QUOTE_MINIMAL)
        w.writeheader()
        w.writerows(rows)
print(f"{len(obs_rows)} observaties, {len(act_rows)} acties, {len(MEDEWERKERS)} medewerkers, {len(kpi_rows)} KPI's")
