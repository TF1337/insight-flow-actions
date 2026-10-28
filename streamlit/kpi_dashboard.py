"""Insight Flow KPI-dashboard — Streamlit in Snowflake.

Werkt op de standaard Streamlit-versie van Snowflake (1.22, Altair 4) en op nieuwere versies.
Leest alleen objecten uit INSIGHT_FLOW.DEMO die de notebook of sql/insight_flow_fallback.sql maakt.
Alle data en gebruikers zijn fictief.
"""
import json
import re
from datetime import date

import altair as alt
import pandas as pd
import streamlit as st
from snowflake.snowpark.context import get_active_session

session = get_active_session()
DB = "INSIGHT_FLOW.DEMO"
MODEL = "claude-haiku-4-5"

AFDELINGEN = ["Inbound", "Opslag", "Orderpick", "Pakstraat", "Outbound", "Retouren"]
ONDERWERPEN = ["Veiligheid", "Kwaliteit", "Productiviteit", "Personeel"]
AANPAKKEN = ["Just Do It", "PDCA / 6S", "Change"]
AANPAK_UITLEG = {
    "Just Do It": "klein en direct op te lossen, zonder uitgebreide analyse",
    "PDCA / 6S": "verbetercyclus (Plan-Do-Check-Act) of 6S op de werkplek, met meten of het werkt",
    "Change": "structurele wijziging die een besluit, budget of A3 vraagt",
}

# Kleuren: inkt en signalen uit de app (src/styles.css), blauw/aqua/magenta voor de aanpak
INK, INK_MUTED, GRID = "#141b24", "#5b6573", "#e6e2db"
ROOD, ORANJE, GROEN = "#df2225", "#fa7c20", "#2a904b"
AANPAK_KLEUR = ["#2a78d6", "#1baf7a", "#e87ba4"]
BLAUW = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"]
KPI_STATUS = {  # kleur, icoon, label — zoals de legenda in de app
    "gunstig": (GROEN, "▲", "gunstig"),
    "op norm": (GROEN, "▲", "op norm"),
    "aandacht": (ROOD, "▼", "aandacht"),
    "fictief": ("#b4570f", "→", "norm nog te bepalen"),
}

st.set_page_config(page_title="Insight Flow KPI-dashboard", layout="wide")
st.markdown(
    """
<style>
  .block-container {padding-top: 1.5rem;}
  [data-testid="stMetric"], [data-testid="metric-container"] {
    background:#fff; border:1px solid #e6e2db; border-radius:10px; padding:12px 16px;}
  .kaart {background:#fff; border:1px solid #e6e2db; border-radius:12px; padding:14px 16px; margin-bottom:12px;}
  .kaart .titel {font-weight:600; color:#141b24;}
  .kaart .waarde {font-size:30px; font-weight:700; line-height:1.2; margin-top:4px;}
  .kaart .norm {font-size:12px; color:#5b6573;}
  .kaart .status {font-size:12px; font-weight:600; margin-top:6px;}
  .kaart ul {margin:8px 0 0 0; padding:8px 0 0 16px; border-top:1px solid #e6e2db; color:#5b6573;}
  .kaart li {font-size:12px; line-height:1.5; margin:0; padding:0;}
  .kaart .acties {margin-top:8px; font-size:13px; font-weight:600; color:#141b24;}
  .vestiging {background:#121c26; color:#f3f1ec; border-radius:10px; padding:8px 12px; text-align:center;
              font-weight:700; margin-bottom:10px;}
  .gevonden {background:#fff; border:1px solid #e6e2db; border-left:4px solid #2a904b; border-radius:8px;
             padding:10px 14px; margin-bottom:8px; font-size:14px;}
</style>
""",
    unsafe_allow_html=True,
)


@st.cache_data(ttl=300)
def lees(query: str) -> pd.DataFrame:
    return session.sql(query).to_pandas()


def als_datum(reeks: pd.Series) -> pd.Series:
    return pd.to_datetime(reeks).dt.date


samenvatting = lees(f"SELECT * FROM {DB}.AFDELING_SAMENVATTING")
hm_onderwerp = lees(f"SELECT * FROM {DB}.HEATMAP_AFDELING_ONDERWERP")
hm_week = lees(f"SELECT * FROM {DB}.HEATMAP_AFDELING_WEEK")
acties = lees(
    f"""
    SELECT *,
           IFF(DEADLINE < CURRENT_DATE, 'Verlopen', 'In werking')  AS SIGNAAL,
           GREATEST(DATEDIFF(day, DEADLINE, CURRENT_DATE), 0)      AS DAGEN_TE_LAAT
    FROM {DB}.OPEN_ACTIES
    """
)
per_week = lees(f"SELECT * FROM {DB}.ACTIES_PER_WEEK")
kpis = lees(f"SELECT * FROM {DB}.KPI_NORMEN ORDER BY VOLGORDE")
medewerkers = lees(f"SELECT * FROM {DB}.MEDEWERKERS")

hm_week["WEEK_START"] = als_datum(hm_week["WEEK_START"])
per_week["WEEK_START"] = als_datum(per_week["WEEK_START"])
acties["DEADLINE"] = als_datum(acties["DEADLINE"])
WEKEN = sorted(hm_week["WEEK_START"].unique())                  # de 12 weken van de heatmap
WEEK_LABEL = {w: f"wk {w.isocalendar()[1]}" for w in WEKEN}
WEEK_VOLGORDE = [WEEK_LABEL[w] for w in WEKEN]
WEEK_NU = date.today().isocalendar()[1]

# ── Fictieve gebruiker ───────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("### Ingelogd als")
    personen = {"Geen persona (alles)": None}
    for r in medewerkers.itertuples():
        rol = f"{r.ROL} {r.AFDELING}" if r.ROL == "Teamleider" else f"{r.ROL}, {r.AFDELING.lower()}"
        personen[f"{r.NAAM} · {rol}"] = {"naam": r.NAAM, "rol": rol, "afdeling": r.AFDELING}
    persona = personen[st.selectbox("Fictieve gebruiker", list(personen))]
    if persona:
        bereik = st.radio("Toon acties", ["Mijn acties", "Mijn afdeling", "Alles"])
    else:
        bereik = "Alles"
    st.caption("Een fictieve gebruiker voor de demo, geen echte inlog. Bepaalt welke acties je ziet "
               "op de tabbladen KPI's en Actielijst, en voor wie de AI-samenvatting schrijft.")


def binnen_bereik(df: pd.DataFrame) -> pd.DataFrame:
    if not persona or bereik == "Alles":
        return df
    if bereik == "Mijn acties":
        return df[df["EIGENAAR"] == persona["naam"]]
    if persona["afdeling"] in AFDELINGEN:
        return df[df["AFDELING"] == persona["afdeling"]]
    return df  # supervisor: alle afdelingen


bereik_tekst = "alle acties" if bereik == "Alles" or not persona else (
    f"acties van {persona['naam']}" if bereik == "Mijn acties" else f"acties van afdeling {persona['afdeling']}")

st.title("KPI-dashboard logistieke operatie")
kop = f"Week {WEEK_NU} · meldingen en acties uit Insight Flow Actions · demodata, alle waarden fictief"
if persona:
    kop = f"Ingelogd als **{persona['naam']}** ({persona['rol']}, fictief) · " + kop
st.markdown(f"<span style='color:{INK_MUTED}'>{kop}</span>", unsafe_allow_html=True)


# ── Grafieken ────────────────────────────────────────────────────────────────
def heatmap(df: pd.DataFrame, x: str, y: str, waarde: str, titel: str, x_sort, tooltip) -> alt.LayerChart:
    """Raster met een blauwe reeks: lichter = minder, donkerder = meer. Getal in elke cel.

    Bij 'aandeel rood' krijgt een cel zonder meldingen een streepje: 0% en 'geen meldingen' zijn niet hetzelfde.
    """
    df = df.copy()
    if waarde == "PCT_ROOD":
        df.loc[df["MELDINGEN"] == 0, waarde] = None
    df["LABEL"] = df[waarde].map(lambda v: "–" if pd.isna(v) else f"{v:.0f}")
    maximum = max(float(df[waarde].max(skipna=True) if df[waarde].notna().any() else 0), 1.0)

    basis = alt.Chart(df).encode(
        x=alt.X(f"{x}:O", sort=x_sort, title=None,
                axis=alt.Axis(orient="top", labelAngle=0, labelColor=INK_MUTED, ticks=False, domain=False)),
        y=alt.Y(f"{y}:N", sort=AFDELINGEN, title=None, axis=alt.Axis(labelColor=INK, ticks=False, domain=False)),
        tooltip=tooltip,
    )
    leeg = basis.mark_rect(color="#f1eee9", stroke="#ffffff", strokeWidth=2, cornerRadius=3)
    cellen = basis.mark_rect(stroke="#ffffff", strokeWidth=2, cornerRadius=3).transform_filter(
        f"isValid(datum.{waarde})"
    ).encode(
        color=alt.Color(f"{waarde}:Q", title=titel, scale=alt.Scale(range=BLAUW, domain=[0, maximum]),
                        legend=alt.Legend(orient="right", gradientLength=160)),
    )
    getallen = basis.mark_text(fontSize=12).encode(
        text="LABEL:N",
        color=alt.condition(f"isValid(datum.{waarde}) && datum.{waarde} > {maximum * 0.55}",
                            alt.value("#ffffff"), alt.value(INK)),
    )
    return (leeg + cellen + getallen).properties(height=alt.Step(36))


def per_week_aanpak(df: pd.DataFrame) -> pd.DataFrame:
    """Acties per week en aanpak over de 12 weken, met nullen voor lege weken."""
    raster = pd.MultiIndex.from_product([WEKEN, AANPAKKEN], names=["WEEK_START", "AANPAK"]).to_frame(index=False)
    tel = df.groupby(["WEEK_START", "AANPAK"], as_index=False)["ACTIES"].sum()
    data = raster.merge(tel, how="left", on=["WEEK_START", "AANPAK"]).fillna({"ACTIES": 0})
    data["ACTIES"] = data["ACTIES"].astype(int)
    data["WEEK"] = data["WEEK_START"].map(WEEK_LABEL)
    data["VOLGORDE"] = data["AANPAK"].map({a: i for i, a in enumerate(AANPAKKEN)})
    return data


def week_grafiek(data: pd.DataFrame) -> alt.LayerChart:
    staaf = alt.Chart(data).mark_bar(stroke="#ffffff", strokeWidth=2).encode(
        x=alt.X("WEEK:O", sort=WEEK_VOLGORDE, title=None, axis=alt.Axis(labelAngle=0, labelColor=INK_MUTED)),
        y=alt.Y("ACTIES:Q", title="Acties aangemaakt", axis=alt.Axis(tickMinStep=1, gridColor=GRID, labelColor=INK_MUTED)),
        color=alt.Color("AANPAK:N", title=None, scale=alt.Scale(domain=AANPAKKEN, range=AANPAK_KLEUR),
                        legend=alt.Legend(orient="top")),
        order=alt.Order("VOLGORDE:Q"),
        tooltip=[alt.Tooltip("WEEK:N", title="Week"), alt.Tooltip("AANPAK:N", title="Aanpak"),
                 alt.Tooltip("ACTIES:Q", title="Acties")],
    )
    totaal = data.groupby("WEEK", as_index=False)["ACTIES"].sum()
    labels = alt.Chart(totaal).mark_text(dy=-7, fontSize=11, color=INK_MUTED).encode(
        x=alt.X("WEEK:O", sort=WEEK_VOLGORDE), y="ACTIES:Q", text="ACTIES:Q")
    return (staaf + labels).properties(height=260)


def week_tabel(data: pd.DataFrame) -> pd.DataFrame:
    tabel = data.pivot(index="AANPAK", columns="WEEK", values="ACTIES").reindex(index=AANPAKKEN, columns=WEEK_VOLGORDE)
    tabel["Totaal"] = tabel.sum(axis=1)
    tabel.index.name = "Aanpak"
    return tabel


def acties_tabel(df: pd.DataFrame) -> pd.DataFrame:
    df = df.sort_values(["DAGEN_TE_LAAT", "DEADLINE"], ascending=[False, True]).copy()
    df["SIGNAAL"] = df["SIGNAAL"].map({"Verlopen": "🔴 Verlopen", "In werking": "🟠 In werking"})
    df["WEEK"] = df["WEEKNR"].map(lambda n: f"wk {int(n)}")
    df["DEADLINE"] = pd.to_datetime(df["DEADLINE"]).dt.strftime("%d-%m-%Y")
    df = df[["SIGNAAL", "WEEK", "TITEL", "MELDING", "AFDELING", "AANPAK", "EIGENAAR", "STATUS", "DEADLINE", "DAGEN_TE_LAAT"]]
    return df.rename(columns={
        "SIGNAAL": "Signaal", "WEEK": "Week", "TITEL": "Actie", "MELDING": "Melding", "AFDELING": "Afdeling",
        "AANPAK": "Aanpak", "EIGENAAR": "Eigenaar", "STATUS": "Status", "DEADLINE": "Deadline",
        "DAGEN_TE_LAAT": "Dagen te laat",
    }).set_index("Signaal")


def kpi_kaart(r) -> str:
    kleur, icoon, label = KPI_STATUS.get(r.STATUS, (INK_MUTED, "", r.STATUS))
    regels = "".join(f"<li>{b.strip()}</li>" for b in str(r.TOELICHTING or "").split("|") if b.strip() and b.strip() != "nan")
    extra = f"<ul>{regels}</ul>" if regels else ""
    if isinstance(r.ACTIE_KPI, str) and r.ACTIE_KPI:
        onder = acties[acties["KPI"] == r.ACTIE_KPI]
        tekst = f"→ {len(onder)} open acties · {int((onder['SIGNAAL'] == 'Verlopen').sum())} verlopen"
        if persona:
            mijn = binnen_bereik(onder)
            tekst += f" · {len(mijn)} in jouw selectie"
        extra += f"<div class='acties'>{tekst}</div>"
    return (f"<div class='kaart'><div class='titel'>{r.KPI}</div>"
            f"<div class='waarde' style='color:{kleur}'>{r.WAARDE}</div>"
            f"<div class='norm'>{r.NORM}</div>"
            f"<div class='status' style='color:{kleur}'>{icoon} {label}</div>{extra}</div>")


def ketenregels(tekst: str) -> str:
    stappen = [s.strip() for s in re.split(r"\s*\d\.\s+", str(tekst or "")) if s.strip()]
    return "\n".join(f"{i}. {s}" for i, s in enumerate(stappen, start=1))


@st.cache_data(ttl=300)
def vergelijkbaar(vraag: str, aantal: int = 3) -> list:
    payload = json.dumps({
        "query": vraag,
        "columns": ["TITEL", "AFDELING", "DATUM", "ACTIE", "AANPAK", "OPLOSSING", "RESULTAAT"],
        "filter": {"@eq": {"OPGELOST": "ja"}},
        "limit": aantal,
    }, ensure_ascii=False).replace("$$", "")
    ruw = session.sql(
        f"SELECT SNOWFLAKE.CORTEX.SEARCH_PREVIEW('{DB}.MELDINGEN_SEARCH', $${payload}$$) AS RESULTAAT"
    ).to_pandas()["RESULTAAT"].iloc[0]
    return json.loads(ruw).get("results", [])


tab_kpi, tab_overzicht, tab_heatmap, tab_acties, tab_ai = st.tabs(
    ["KPI's", "Overzicht", "Heatmap", "Actielijst", "AI-samenvatting"])

# ── KPI's ────────────────────────────────────────────────────────────────────
with tab_kpi:
    if "onderwerp" not in st.session_state:
        st.session_state["onderwerp"] = "Veiligheid"

    def kies_onderwerp(onderwerp: str) -> None:
        st.session_state["onderwerp"] = onderwerp

    gekozen = st.session_state["onderwerp"]
    st.subheader(gekozen)
    for kolom, onderwerp in zip(st.columns(len(ONDERWERPEN)), ONDERWERPEN):
        kolom.button(onderwerp, key=f"knop_{onderwerp}", on_click=kies_onderwerp, args=(onderwerp,),
                     type="primary" if onderwerp == gekozen else "secondary", use_container_width=True)

    for kolom, vestiging in zip(st.columns(2), ["OFM", "LDC"]):
        with kolom:
            st.markdown(f"<div class='vestiging'>{vestiging}</div>", unsafe_allow_html=True)
            for r in kpis[(kpis["VESTIGING"] == vestiging) & (kpis["ONDERWERP"] == gekozen)].itertuples():
                st.markdown(kpi_kaart(r), unsafe_allow_html=True)
    st.caption("▲ gunstig / op norm · ▼ aandacht · → norm nog te bepalen. Alle KPI-waarden zijn fictief.")

    st.markdown(f"##### Acties per week en aanpak — {gekozen}")
    st.caption(f"Aangemaakte acties per weeknummer, {bereik_tekst}.")
    data = per_week_aanpak(binnen_bereik(per_week[per_week["ONDERWERP"] == gekozen]))
    st.altair_chart(week_grafiek(data), use_container_width=True)

    lijst = binnen_bereik(acties[acties["ONDERWERP"] == gekozen])
    st.markdown(f"##### Open acties — {gekozen} ({len(lijst)})")
    if lijst.empty:
        st.info("Geen open acties in deze selectie.")
    else:
        st.dataframe(acties_tabel(lijst), use_container_width=True)

# ── Overzicht ────────────────────────────────────────────────────────────────
with tab_overzicht:
    meldingen = int(samenvatting["MELDINGEN"].sum())
    rood = int(samenvatting["MELDINGEN_ROOD"].sum())
    verlopen = int((acties["SIGNAAL"] == "Verlopen").sum())

    k1, k2, k3, k4 = st.columns(4)
    k1.metric("Meldingen", f"{meldingen}")
    k2.metric("Aandeel rood", f"{(100 * rood / meldingen if meldingen else 0):.0f}%")
    k3.metric("Open acties", f"{len(acties)}")
    k4.metric("Verlopen acties", f"{verlopen}")
    if persona:
        mijn = acties[acties["EIGENAAR"] == persona["naam"]]
        m1, m2, m3, _ = st.columns(4)
        m1.metric(f"Open acties van {persona['naam'].split()[0]}", f"{len(mijn)}")
        m2.metric("Waarvan verlopen", f"{int((mijn['SIGNAAL'] == 'Verlopen').sum())}")
        if persona["afdeling"] in AFDELINGEN:
            m3.metric(f"Open in {persona['afdeling']}", f"{int((acties['AFDELING'] == persona['afdeling']).sum())}")

    st.markdown("##### Open acties per afdeling")
    per_afd = acties.groupby(["AFDELING", "SIGNAAL"]).size().reset_index(name="ACTIES")
    if per_afd.empty:
        st.info("Geen open acties.")
    else:
        volgorde = per_afd.groupby("AFDELING")["ACTIES"].sum().sort_values(ascending=False).index.tolist()
        balk = alt.Chart(per_afd).mark_bar(stroke="#ffffff", strokeWidth=2, size=22).encode(
            y=alt.Y("AFDELING:N", sort=volgorde, title=None, axis=alt.Axis(ticks=False, domain=False, labelColor=INK)),
            x=alt.X("ACTIES:Q", title="Open acties", axis=alt.Axis(tickMinStep=1, gridColor=GRID, labelColor=INK_MUTED)),
            color=alt.Color("SIGNAAL:N", title=None, scale=alt.Scale(domain=["Verlopen", "In werking"], range=[ROOD, ORANJE]),
                            legend=alt.Legend(orient="top")),
            order=alt.Order("SIGNAAL:N", sort="descending"),
            tooltip=[alt.Tooltip("AFDELING:N", title="Afdeling"), alt.Tooltip("SIGNAAL:N", title="Signaal"),
                     alt.Tooltip("ACTIES:Q", title="Acties")],
        ).properties(height=alt.Step(40))
        st.altair_chart(balk, use_container_width=True)

    st.markdown("##### Just Do It, PDCA / 6S en Change per week")
    alle_weken = per_week_aanpak(per_week)
    st.altair_chart(week_grafiek(alle_weken), use_container_width=True)
    st.caption(" · ".join(f"**{a}**: {u}" for a, u in AANPAK_UITLEG.items()))
    with st.expander("Tabel per weeknummer"):
        st.dataframe(week_tabel(alle_weken), use_container_width=True)

    tabel = samenvatting.sort_values(["VERLOPEN_ACTIES", "PCT_ROOD"], ascending=False).copy()
    tabel["PCT_ROOD"] = tabel["PCT_ROOD"].map(lambda v: "" if pd.isna(v) else f"{v:.0f}%")
    tabel = tabel.rename(columns={
        "AFDELING": "Afdeling", "MELDINGEN": "Meldingen", "MELDINGEN_ROOD": "Rood",
        "PCT_ROOD": "% rood", "OPEN_ACTIES": "Open acties", "VERLOPEN_ACTIES": "Verlopen",
    }).set_index("Afdeling")
    st.dataframe(tabel, use_container_width=True)

# ── Heatmap ──────────────────────────────────────────────────────────────────
with tab_heatmap:
    maat = st.radio("Kleur volgens", ["Aantal meldingen", "Aandeel rood (%)"], horizontal=True)
    kolom = "MELDINGEN" if maat == "Aantal meldingen" else "PCT_ROOD"

    st.markdown("##### Waar zitten de meldingen?")
    st.altair_chart(heatmap(
        hm_onderwerp, x="ONDERWERP", y="AFDELING", waarde=kolom, titel=maat, x_sort=ONDERWERPEN,
        tooltip=[alt.Tooltip("AFDELING:N", title="Afdeling"), alt.Tooltip("ONDERWERP:N", title="Onderwerp"),
                 alt.Tooltip("MELDINGEN:Q", title="Meldingen"), alt.Tooltip("MELDINGEN_ROOD:Q", title="Waarvan rood")],
    ), use_container_width=True)

    st.markdown("##### Wanneer liep het op?")
    keuze = st.selectbox("Onderwerp", ["Alle onderwerpen"] + ONDERWERPEN)
    weken = hm_week if keuze == "Alle onderwerpen" else hm_week[hm_week["ONDERWERP"] == keuze]
    weken = weken.groupby(["WEEK_START", "AFDELING"], as_index=False)[["MELDINGEN", "MELDINGEN_ROOD"]].sum()
    weken["PCT_ROOD"] = (100 * weken["MELDINGEN_ROOD"] / weken["MELDINGEN"].where(weken["MELDINGEN"] > 0)).round(0)
    weken["WEEK"] = weken["WEEK_START"].map(WEEK_LABEL)
    st.altair_chart(heatmap(
        weken, x="WEEK", y="AFDELING", waarde=kolom, titel=maat, x_sort=WEEK_VOLGORDE,
        tooltip=[alt.Tooltip("AFDELING:N", title="Afdeling"), alt.Tooltip("WEEK:N", title="Week"),
                 alt.Tooltip("MELDINGEN:Q", title="Meldingen"), alt.Tooltip("MELDINGEN_ROOD:Q", title="Waarvan rood")],
    ), use_container_width=True)
    st.caption("Donkerder = meer. Bij 'Aandeel rood' telt een cel met weinig meldingen even zwaar; kijk ook naar het aantal.")

# ── Actielijst ───────────────────────────────────────────────────────────────
with tab_acties:
    f1, f2, f3 = st.columns(3)
    afd = f1.multiselect("Afdeling (leeg = alle)", AFDELINGEN)
    ond = f2.multiselect("Onderwerp (leeg = alle)", ONDERWERPEN)
    sig = f3.radio("Signaal", ["Alle", "Verlopen", "In werking"], horizontal=True)

    lijst = binnen_bereik(acties)
    if afd:
        lijst = lijst[lijst["AFDELING"].isin(afd)]
    if ond:
        lijst = lijst[lijst["ONDERWERP"].isin(ond)]
    if sig != "Alle":
        lijst = lijst[lijst["SIGNAAL"] == sig]
    st.caption(f"{len(lijst)} open acties · {bereik_tekst}")
    if lijst.empty:
        st.info("Geen open acties in deze selectie.")
    else:
        st.dataframe(acties_tabel(lijst), use_container_width=True)

        st.markdown("##### Analyse en vergelijkbare meldingen")
        lijst = lijst.sort_values(["DAGEN_TE_LAAT", "DEADLINE"], ascending=[False, True])
        labels = {f"wk {int(r.WEEKNR)} · {r.AFDELING} · {r.MELDING} ({r.ACTIE_ID})": r for r in lijst.itertuples()}
        gekozen_actie = labels[st.selectbox("Kies een actie", list(labels))]
        oid = str(gekozen_actie.OBSERVATIE_ID).replace("'", "")
        melding = lees(f"SELECT * FROM {DB}.OBSERVATIES WHERE OBSERVATIE_ID = '{oid}'")
        if not melding.empty:
            m = melding.iloc[0]
            links, rechts = st.columns(2)
            with links:
                st.markdown("**5W1H**")
                st.table(pd.DataFrame({
                    "": ["Wie", "Wat", "Waar", "Wanneer", "Waarom", "Hoe"],
                    "Analyse": [m["WIE"], m["WAT"], m["WAAR"], m["WANNEER"], m["WAAROM"], m["HOE"]],
                }).set_index(""))
            with rechts:
                st.markdown("**5x Waarom**")
                st.markdown(ketenregels(m["WAAROM_KETEN"]) or "_Niet ingevuld._")

            if st.button("Zoek vergelijkbare opgeloste meldingen", key="zoek"):
                try:
                    gevonden = vergelijkbaar(f"{m['TITEL']}. {m['WAAROM']}")
                except Exception as fout:  # zoekservice (stap 7) nog niet aangemaakt, rechten, enz.
                    gevonden = None
                    st.warning(f"Zoeken lukt niet. Is stap 7 (Cortex Search) gedraaid? Melding: {fout}")
                if gevonden == []:
                    st.info("Geen vergelijkbare opgeloste meldingen gevonden.")
                for g in gevonden or []:
                    resultaat = f"<br>Resultaat: {g.get('RESULTAAT')}" if g.get("RESULTAAT") else ""
                    st.markdown(
                        f"<div class='gevonden'><b>{g.get('TITEL', '')}</b> · {g.get('AFDELING', '')} · {g.get('DATUM', '')}"
                        f"<br>Actie: {g.get('ACTIE', '')} ({g.get('AANPAK', '')})"
                        f"<br>Gedaan: {g.get('OPLOSSING', '') or '—'}{resultaat}</div>",
                        unsafe_allow_html=True,
                    )

# ── AI-samenvatting ──────────────────────────────────────────────────────────
with tab_ai:
    voor = f"voor {persona['naam']} ({persona['rol']})" if persona else "voor de dagstart"
    st.markdown(f"Een korte samenvatting {voor}, gemaakt met Snowflake Cortex op basis van de cijfers in dit dashboard.")
    vraag = st.text_input("Eigen vraag (optioneel)", placeholder="Bijvoorbeeld: welke actie moet ik deze week eerst oppakken?")

    if st.button("Maak samenvatting", type="primary"):
        regels = [
            "Je bent analist operational excellence in een logistiek distributiecentrum.",
            f"Het is nu week {WEEK_NU}. Antwoord in het Nederlands en gebruik alleen de cijfers hieronder.",
            "", "MELDINGEN PER AFDELING EN ONDERWERP:",
        ]
        regels += [f"- {r.AFDELING} / {r.ONDERWERP}: {int(r.MELDINGEN)} meldingen, {int(r.MELDINGEN_ROOD)} rood"
                   for r in hm_onderwerp[hm_onderwerp["MELDINGEN"] > 0].itertuples()]
        regels += ["", "OPEN ACTIES PER AFDELING:"]
        regels += [f"- {r.AFDELING}: {int(r.OPEN_ACTIES)} open, {int(r.VERLOPEN_ACTIES)} verlopen" for r in samenvatting.itertuples()]
        recent = per_week_aanpak(per_week)
        recent = recent[recent["WEEK"].isin(WEEK_VOLGORDE[-4:])]
        regels += ["", "AANGEMAAKTE ACTIES PER WEEK EN AANPAK (laatste 4 weken):"]
        regels += [f"- {r.WEEK}: {r.AANPAK} {r.ACTIES}" for r in recent.itertuples()]
        if persona:
            eigen = binnen_bereik(acties).sort_values("DAGEN_TE_LAAT", ascending=False).head(10)
            regels += ["", f"OPEN ACTIES IN DE SELECTIE VAN {persona['naam'].upper()} ({bereik_tekst}):"]
            regels += [f"- {r.TITEL} | melding: {r.MELDING} | {r.AFDELING} | {r.AANPAK} | deadline {r.DEADLINE} | {r.SIGNAAL}"
                       for r in eigen.itertuples()] or ["- geen"]
            regels += ["", f"Schrijf voor {persona['naam']}, {persona['rol']}. Spreek haar of hem aan met je."]
        opdracht = vraag.strip() or (
            "Schrijf een samenvatting van hoogstens 5 zinnen: waar zitten de hotspots, welke afdeling vraagt aandacht "
            "en welke actie moet eerst. Noem weeknummers als week 43.")
        regels += ["", f"OPDRACHT: {opdracht}"]
        prompt = "\n".join(regels).replace("$$", "")

        with st.spinner("Cortex denkt na..."):
            try:
                antwoord = session.sql(
                    f"SELECT AI_COMPLETE('{MODEL}', $${prompt}$$)::STRING AS ANTWOORD"
                ).to_pandas()["ANTWOORD"].iloc[0]
                st.write(antwoord or "Het model gaf geen antwoord. Probeer het opnieuw.")
            except Exception as fout:  # model niet beschikbaar in deze regio, rechten, enz.
                st.error(f"Cortex gaf een fout: {fout}")
