"""Insight Flow KPI-dashboard — Streamlit in Snowflake.

Leest alleen de objecten die de notebook maakt in INSIGHT_FLOW.DEMO:
AFDELING_SAMENVATTING, HEATMAP_AFDELING_ONDERWERP, HEATMAP_AFDELING_WEEK en de dynamic table OPEN_ACTIES.
"""
import altair as alt
import pandas as pd
import streamlit as st
from snowflake.snowpark.context import get_active_session

session = get_active_session()
DB = "INSIGHT_FLOW.DEMO"

AFDELINGEN = ["Inbound", "Opslag", "Orderpick", "Pakstraat", "Outbound", "Retouren"]
ONDERWERPEN = ["Veiligheid", "Kwaliteit", "Productiviteit", "Personeel"]

# Kleuren uit de app (src/styles.css) en een blauwe reeks voor hoeveelheid
INK, INK_MUTED, GRID = "#141b24", "#5b6573", "#e6e2db"
ROOD, ORANJE = "#df2225", "#fa7c20"
BLAUW = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"]

st.set_page_config(page_title="Insight Flow KPI-dashboard", layout="wide")
st.markdown(
    """
<style>
  .block-container {padding-top: 1.5rem;}
  [data-testid="stMetric"] {background:#fff; border:1px solid #e6e2db; border-radius:10px; padding:12px 16px;}
  [data-testid="stMetricLabel"] {color:#5b6573;}
</style>
""",
    unsafe_allow_html=True,
)

st.title("KPI-dashboard logistieke operatie")
st.caption("Meldingen en acties uit Insight Flow Actions · demodata, alle waarden fictief")


@st.cache_data(ttl=300)
def lees(query: str) -> pd.DataFrame:
    return session.sql(query).to_pandas()


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


def heatmap(df: pd.DataFrame, x: str, y: str, waarde: str, titel: str, x_sort, x_titel, tooltip) -> alt.LayerChart:
    """Raster met een blauwe reeks: lichter = minder, donkerder = meer. Getal in elke cel.

    Bij 'aandeel rood' krijgt een cel zonder meldingen een streepje: 0% en 'geen meldingen' zijn niet hetzelfde.
    """
    df = df.copy()
    if waarde == "PCT_ROOD":
        df.loc[df["MELDINGEN"] == 0, waarde] = None
    df["LABEL"] = df[waarde].map(lambda v: "–" if pd.isna(v) else f"{v:.0f}")
    maximum = max(float(df[waarde].max(skipna=True) if df[waarde].notna().any() else 0), 1.0)

    basis = alt.Chart(df).encode(
        x=alt.X(f"{x}:O", sort=x_sort, title=x_titel,
                axis=alt.Axis(orient="top", labelAngle=0, labelColor=INK_MUTED, ticks=False, domain=False)),
        y=alt.Y(f"{y}:N", sort=AFDELINGEN, title=None, axis=alt.Axis(labelColor=INK, ticks=False, domain=False)),
        tooltip=tooltip,
    )
    leeg = basis.mark_rect(color="#f1eee9", stroke="#ffffff", strokeWidth=2, cornerRadius=3)
    cellen = basis.mark_rect(stroke="#ffffff", strokeWidth=2, cornerRadius=3).transform_filter(
        f"isValid(datum.{waarde})"
    ).encode(
        color=alt.Color(
            f"{waarde}:Q",
            title=titel,
            scale=alt.Scale(range=BLAUW, domain=[0, maximum]),
            legend=alt.Legend(orient="right", gradientLength=160),
        ),
    )
    getallen = basis.mark_text(fontSize=12).encode(
        text="LABEL:N",
        color=alt.condition(f"isValid(datum.{waarde}) && datum.{waarde} > {maximum * 0.55}",
                            alt.value("#ffffff"), alt.value(INK)),
    )
    return (leeg + cellen + getallen).properties(height=alt.Step(36))


tab_overzicht, tab_heatmap, tab_acties, tab_ai = st.tabs(["Overzicht", "Heatmap", "Actielijst", "AI-samenvatting"])

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

    st.markdown("##### Open acties per afdeling")
    per_afd = acties.groupby(["AFDELING", "SIGNAAL"]).size().reset_index(name="ACTIES")
    if per_afd.empty:
        st.info("Geen open acties.")
    else:
        volgorde = (
            per_afd.groupby("AFDELING")["ACTIES"].sum().sort_values(ascending=False).index.tolist()
        )
        balk = alt.Chart(per_afd).mark_bar(stroke="#ffffff", strokeWidth=2, size=22).encode(
            y=alt.Y("AFDELING:N", sort=volgorde, title=None, axis=alt.Axis(ticks=False, domain=False, labelColor=INK)),
            x=alt.X("ACTIES:Q", title="Open acties", axis=alt.Axis(tickMinStep=1, gridColor=GRID, labelColor=INK_MUTED)),
            color=alt.Color(
                "SIGNAAL:N",
                title=None,
                scale=alt.Scale(domain=["Verlopen", "In werking"], range=[ROOD, ORANJE]),
                legend=alt.Legend(orient="top"),
            ),
            order=alt.Order("SIGNAAL:N", sort="descending"),
            tooltip=[alt.Tooltip("AFDELING:N", title="Afdeling"), alt.Tooltip("SIGNAAL:N", title="Signaal"),
                     alt.Tooltip("ACTIES:Q", title="Acties")],
        ).properties(height=alt.Step(40))
        st.altair_chart(balk, use_container_width=True)

    # Kolomnamen via pandas, zodat het ook werkt op de Streamlit-versie van Snowflake (zonder st.column_config)
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
    st.altair_chart(
        heatmap(
            hm_onderwerp,
            x="ONDERWERP", y="AFDELING", waarde=kolom, titel=maat, x_sort=ONDERWERPEN, x_titel=None,
            tooltip=[
                alt.Tooltip("AFDELING:N", title="Afdeling"),
                alt.Tooltip("ONDERWERP:N", title="Onderwerp"),
                alt.Tooltip("MELDINGEN:Q", title="Meldingen"),
                alt.Tooltip("MELDINGEN_ROOD:Q", title="Waarvan rood"),
            ],
        ),
        use_container_width=True,
    )

    st.markdown("##### Wanneer liep het op?")
    keuze = st.selectbox("Onderwerp", ["Alle onderwerpen"] + ONDERWERPEN)
    weken = hm_week if keuze == "Alle onderwerpen" else hm_week[hm_week["ONDERWERP"] == keuze]
    weken = weken.groupby(["WEEK_START", "WEEKNR", "AFDELING"], as_index=False)[["MELDINGEN", "MELDINGEN_ROOD"]].sum()
    weken["PCT_ROOD"] = (100 * weken["MELDINGEN_ROOD"] / weken["MELDINGEN"].where(weken["MELDINGEN"] > 0)).round(0)
    weken["WEEK"] = "wk " + weken["WEEKNR"].astype(int).astype(str)
    week_volgorde = weken.sort_values("WEEK_START")["WEEK"].unique().tolist()
    st.altair_chart(
        heatmap(
            weken, x="WEEK", y="AFDELING", waarde=kolom, titel=maat, x_sort=week_volgorde, x_titel=None,
            tooltip=[
                alt.Tooltip("AFDELING:N", title="Afdeling"),
                alt.Tooltip("WEEK:N", title="Week"),
                alt.Tooltip("MELDINGEN:Q", title="Meldingen"),
                alt.Tooltip("MELDINGEN_ROOD:Q", title="Waarvan rood"),
            ],
        ),
        use_container_width=True,
    )
    st.caption("Donkerder = meer. Bij 'Aandeel rood' telt een cel met weinig meldingen even zwaar; kijk ook naar het aantal.")

# ── Actielijst ───────────────────────────────────────────────────────────────
with tab_acties:
    f1, f2, f3 = st.columns(3)
    afd = f1.multiselect("Afdeling (leeg = alle)", AFDELINGEN)
    ond = f2.multiselect("Onderwerp (leeg = alle)", ONDERWERPEN)
    sig = f3.radio("Signaal", ["Alle", "Verlopen", "In werking"], horizontal=True)

    lijst = acties.copy()
    if afd:
        lijst = lijst[lijst["AFDELING"].isin(afd)]
    if ond:
        lijst = lijst[lijst["ONDERWERP"].isin(ond)]
    if sig != "Alle":
        lijst = lijst[lijst["SIGNAAL"] == sig]
    lijst = lijst.sort_values(["DAGEN_TE_LAAT", "DEADLINE"], ascending=[False, True])
    lijst["SIGNAAL"] = lijst["SIGNAAL"].map({"Verlopen": "🔴 Verlopen", "In werking": "🟠 In werking"})

    st.caption(f"{len(lijst)} open acties")
    lijst["DEADLINE"] = pd.to_datetime(lijst["DEADLINE"]).dt.strftime("%d-%m-%Y")
    lijst = lijst[["SIGNAAL", "TITEL", "MELDING", "AFDELING", "KPI", "EIGENAAR", "STATUS", "PRIORITEIT", "DEADLINE", "DAGEN_TE_LAAT"]]
    lijst = lijst.rename(columns={
        "SIGNAAL": "Signaal", "TITEL": "Actie", "MELDING": "Melding", "AFDELING": "Afdeling", "KPI": "KPI",
        "EIGENAAR": "Eigenaar", "STATUS": "Status", "PRIORITEIT": "Aanpak", "DEADLINE": "Deadline",
        "DAGEN_TE_LAAT": "Dagen te laat",
    }).set_index("Signaal")
    st.dataframe(lijst, use_container_width=True)
# ── AI-samenvatting ──────────────────────────────────────────────────────────
with tab_ai:
    st.markdown("Een korte samenvatting voor de dagstart, gemaakt met Snowflake Cortex op basis van de cijfers hierboven.")
    vraag = st.text_input("Eigen vraag (optioneel)", placeholder="Bijvoorbeeld: welke afdeling moet deze week eerst aandacht krijgen?")

    if st.button("Maak samenvatting", type="primary"):
        opdracht = vraag.strip() or (
            "Schrijf een samenvatting van hoogstens 5 zinnen voor de dagstart: waar zitten de hotspots, "
            "welke afdeling vraagt aandacht en welke actie moet eerst."
        )
        opdracht = opdracht.replace("\\", "").replace("'", "''")
        with st.spinner("Cortex denkt na..."):
            try:
                antwoord = session.sql(
                    f"""
                    SELECT AI_COMPLETE('claude-haiku-4-5', CONCAT(
                        'Je bent analist operational excellence in een logistiek distributiecentrum. ',
                        'Antwoord in het Nederlands en gebruik alleen de cijfers hieronder.\\n\\n',
                        'MELDINGEN PER AFDELING EN ONDERWERP:\\n',
                        (SELECT LISTAGG(AFDELING || ' / ' || ONDERWERP || ': ' || MELDINGEN || ' meldingen, '
                                        || MELDINGEN_ROOD || ' rood', '\\n')
                           FROM {DB}.HEATMAP_AFDELING_ONDERWERP WHERE MELDINGEN > 0),
                        '\\n\\nOPEN ACTIES PER AFDELING:\\n',
                        (SELECT LISTAGG(AFDELING || ': ' || OPEN_ACTIES || ' open, ' || VERLOPEN_ACTIES || ' verlopen', '\\n')
                           FROM {DB}.AFDELING_SAMENVATTING),
                        '\\n\\nOPDRACHT: {opdracht}'
                    ))::STRING AS ANTWOORD
                    """
                ).to_pandas()["ANTWOORD"].iloc[0]
                st.write(antwoord or "Het model gaf geen antwoord. Probeer het opnieuw.")
            except Exception as fout:  # model niet beschikbaar in deze regio, rechten, enz.
                st.error(f"Cortex gaf een fout: {fout}")
