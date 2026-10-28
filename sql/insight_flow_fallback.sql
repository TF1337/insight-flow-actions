-- =============================================================================
-- insight_flow_fallback.sql
-- Insight Flow Actions — dezelfde stappen als notebooks/insight_flow_dashboard.ipynb,
-- maar als SQL-bestand. Draait op een warehouse, dus zonder notebookservice of
-- compute pool (net als sql/fallback.sql in het flood-lab).
--
-- Alles draaien: kies rechtsboven een warehouse en druk Ctrl + Shift + Enter.
-- Eén blok draaien: selecteer het en druk Ctrl + Enter.
-- Alleen het matplotlib-voorproefje ontbreekt; de heatmap zie je in het dashboard.
-- =============================================================================

-- Insight Flow Actions in Snowflake — heatmap, dashboard en semantische laag
--
-- Dezelfde opbouw als het flood-lab, nu met de meldingen en acties uit Insight Flow Actions.
--
--
-- De volgorde is bewust: eerst alles wat het dashboard nodig heeft, daarna de semantische laag.
-- Loopt stap 7–10 vast, dan staat het dashboard er al.
--
-- Data (allemaal fictief): observaties.csv (178 meldingen met 5W1H en 5x Waarom), acties.csv (102 acties
-- met aanpak en uitkomst), medewerkers.csv (6 fictieve gebruikers) en kpi_normen.csv (de KPI-kaarten uit de app).
--
-- Workspacenaam: de COPY FILES-stappen lezen uit "insight-flow-actions". Heet je workspace anders,
-- pas dan die naam aan in stap 2 en 6.

-- Stap 1 — Omgeving

-- ---- Database, schema en warehouse -------------------------------------
USE ROLE ACCOUNTADMIN;

CREATE DATABASE  IF NOT EXISTS INSIGHT_FLOW;
CREATE SCHEMA    IF NOT EXISTS INSIGHT_FLOW.DEMO;

CREATE WAREHOUSE IF NOT EXISTS INSIGHT_WH
  WAREHOUSE_SIZE = 'XSMALL'
  AUTO_SUSPEND   = 60
  AUTO_RESUME    = TRUE
  COMMENT        = 'Insight Flow Actions demo';

USE DATABASE  INSIGHT_FLOW;
USE SCHEMA    DEMO;
USE WAREHOUSE INSIGHT_WH;

SELECT CURRENT_DATABASE(), CURRENT_SCHEMA(), CURRENT_WAREHOUSE();

-- Stap 2 — Data laden uit de workspace
--
-- Stage maken, de CSV's uit je Git-workspace kopiëren en met COPY INTO in tabellen zetten.

-- ---- Stage en bestandsformaat ------------------------------------------
CREATE OR REPLACE STAGE INSIGHT_DATA_STAGE
  DIRECTORY  = (ENABLE = TRUE)
  ENCRYPTION = (TYPE = 'SNOWFLAKE_SSE')
  COMMENT    = 'CSV-bestanden uit de Insight Flow Actions-workspace';

CREATE OR REPLACE FILE FORMAT CSV_FORMAT
  TYPE                           = 'CSV'
  FIELD_OPTIONALLY_ENCLOSED_BY   = '"'
  PARSE_HEADER                   = TRUE
  ERROR_ON_COLUMN_COUNT_MISMATCH = FALSE
  NULL_IF                        = ('', 'NULL')
  EMPTY_FIELD_AS_NULL            = TRUE;

SHOW STAGES LIKE 'INSIGHT_DATA_STAGE';

-- ---- Meldingen, acties, medewerkers en KPI-normen laden ----------------
COPY FILES INTO @INSIGHT_DATA_STAGE/
FROM 'snow://workspace/USER$.PUBLIC."insight-flow-actions"/versions/live/'
FILES = ('data/observaties.csv', 'data/acties.csv', 'data/medewerkers.csv', 'data/kpi_normen.csv');

CREATE OR REPLACE TABLE OBSERVATIES (
    OBSERVATIE_ID STRING, TITEL STRING, AFDELING STRING, ONDERWERP STRING,
    SIGNAAL STRING, MELDER STRING, DATUM DATE, BRON STRING,
    WIE STRING, WAT STRING, WAAR STRING, WANNEER STRING, WAAROM STRING, HOE STRING, WAAROM_KETEN STRING
);
COPY INTO OBSERVATIES FROM @INSIGHT_DATA_STAGE/data/observaties.csv
FILE_FORMAT = CSV_FORMAT MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE ON_ERROR = 'ABORT_STATEMENT';

CREATE OR REPLACE TABLE ACTIES (
    ACTIE_ID STRING, TITEL STRING, OBSERVATIE_ID STRING, KPI STRING, ONDERWERP STRING,
    AFDELING STRING, EIGENAAR STRING, AANGEMAAKT DATE, DEADLINE DATE,
    PRIORITEIT STRING, STATUS STRING, BRON STRING, GEDAAN STRING, RESULTAAT STRING
);
COPY INTO ACTIES FROM @INSIGHT_DATA_STAGE/data/acties.csv
FILE_FORMAT = CSV_FORMAT MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE ON_ERROR = 'ABORT_STATEMENT';

CREATE OR REPLACE TABLE MEDEWERKERS (
    NAAM STRING, ROL STRING, AFDELING STRING, VESTIGING STRING
);
COPY INTO MEDEWERKERS FROM @INSIGHT_DATA_STAGE/data/medewerkers.csv
FILE_FORMAT = CSV_FORMAT MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE ON_ERROR = 'ABORT_STATEMENT';

CREATE OR REPLACE TABLE KPI_NORMEN (
    VESTIGING STRING, ONDERWERP STRING, KPI STRING, WAARDE STRING, NORM STRING,
    STATUS STRING, TOELICHTING STRING, ACTIE_KPI STRING, VOLGORDE NUMBER
);
COPY INTO KPI_NORMEN FROM @INSIGHT_DATA_STAGE/data/kpi_normen.csv
FILE_FORMAT = CSV_FORMAT MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE ON_ERROR = 'ABORT_STATEMENT';

-- Verwacht: 178 observaties, 102 acties, 6 medewerkers, 18 KPI's
SELECT 'OBSERVATIES' AS TABEL, COUNT(*) AS RIJEN FROM OBSERVATIES
UNION ALL SELECT 'ACTIES', COUNT(*) FROM ACTIES
UNION ALL SELECT 'MEDEWERKERS', COUNT(*) FROM MEDEWERKERS
UNION ALL SELECT 'KPI_NORMEN', COUNT(*) FROM KPI_NORMEN;

-- Stap 3 — Views
--
-- - Per afdeling: meldingen, aandeel rood, open en verlopen acties.
-- - Heatmaps: afdeling × onderwerp en afdeling × week.
-- - V_MELDINGEN en V_ACTIES: de tabellen plus weeknummer (ISO), aanpak (Just Do It, PDCA / 6S of Change)
-- en vlaggen voor open, verlopen en afgerond. De semantic view in stap 8 bouwt hierop.
-- - ACTIES_PER_WEEK: hoeveel acties per week zijn aangemaakt, per aanpak.

-- ---- Samenvatting per afdeling -----------------------------------------
CREATE OR REPLACE VIEW AFDELING_SAMENVATTING AS
WITH obs AS (
    SELECT AFDELING,
           COUNT(*)                     AS MELDINGEN,
           COUNT_IF(SIGNAAL = 'rood')   AS MELDINGEN_ROOD
    FROM OBSERVATIES
    GROUP BY AFDELING
),
act AS (
    SELECT AFDELING,
           COUNT_IF(STATUS NOT IN ('Uitgevoerd', 'Resultaat gecontroleerd'))                            AS OPEN_ACTIES,
           COUNT_IF(STATUS NOT IN ('Uitgevoerd', 'Resultaat gecontroleerd') AND DEADLINE < CURRENT_DATE) AS VERLOPEN_ACTIES
    FROM ACTIES
    GROUP BY AFDELING
)
SELECT obs.AFDELING,
       obs.MELDINGEN,
       obs.MELDINGEN_ROOD,
       ROUND(100 * obs.MELDINGEN_ROOD / obs.MELDINGEN, 0) AS PCT_ROOD,
       COALESCE(act.OPEN_ACTIES, 0)     AS OPEN_ACTIES,
       COALESCE(act.VERLOPEN_ACTIES, 0) AS VERLOPEN_ACTIES
FROM obs
LEFT JOIN act ON act.AFDELING = obs.AFDELING;

SELECT * FROM AFDELING_SAMENVATTING ORDER BY VERLOPEN_ACTIES DESC, PCT_ROOD DESC;

-- ---- Heatmap afdeling × onderwerp --------------------------------------
CREATE OR REPLACE VIEW HEATMAP_AFDELING_ONDERWERP AS
WITH raster AS (   -- elke combinatie, ook als er 0 meldingen zijn
    SELECT a.AFDELING, o.ONDERWERP
    FROM (SELECT DISTINCT AFDELING FROM OBSERVATIES) a
    CROSS JOIN (SELECT DISTINCT ONDERWERP FROM OBSERVATIES) o
),
tel AS (
    SELECT AFDELING, ONDERWERP,
           COUNT(*)                   AS MELDINGEN,
           COUNT_IF(SIGNAAL = 'rood') AS MELDINGEN_ROOD
    FROM OBSERVATIES
    GROUP BY AFDELING, ONDERWERP
)
SELECT r.AFDELING,
       r.ONDERWERP,
       COALESCE(t.MELDINGEN, 0)      AS MELDINGEN,
       COALESCE(t.MELDINGEN_ROOD, 0) AS MELDINGEN_ROOD,
       IFF(t.MELDINGEN IS NULL, NULL, ROUND(100 * t.MELDINGEN_ROOD / t.MELDINGEN, 0)) AS PCT_ROOD
FROM raster r
LEFT JOIN tel t ON t.AFDELING = r.AFDELING AND t.ONDERWERP = r.ONDERWERP;

SELECT * FROM HEATMAP_AFDELING_ONDERWERP ORDER BY MELDINGEN DESC LIMIT 10;

-- ---- Heatmap afdeling × week -------------------------------------------
CREATE OR REPLACE VIEW HEATMAP_AFDELING_WEEK AS
WITH laatste AS (
    SELECT DATE_TRUNC('week', MAX(DATUM)) AS LAATSTE_WEEK FROM OBSERVATIES
),
weken AS (         -- 12 weken, terugtellend vanaf de week van de laatste melding
    SELECT DATEADD(week, -(ROW_NUMBER() OVER (ORDER BY SEQ4()) - 1), l.LAATSTE_WEEK) AS WEEK_START
    FROM TABLE(GENERATOR(ROWCOUNT => 12)) g
    CROSS JOIN laatste l
),
raster AS (
    SELECT w.WEEK_START, a.AFDELING, o.ONDERWERP
    FROM weken w
    CROSS JOIN (SELECT DISTINCT AFDELING FROM OBSERVATIES) a
    CROSS JOIN (SELECT DISTINCT ONDERWERP FROM OBSERVATIES) o
),
tel AS (
    SELECT DATE_TRUNC('week', DATUM) AS WEEK_START, AFDELING, ONDERWERP,
           COUNT(*)                   AS MELDINGEN,
           COUNT_IF(SIGNAAL = 'rood') AS MELDINGEN_ROOD
    FROM OBSERVATIES
    GROUP BY 1, 2, 3
)
SELECT r.WEEK_START,
       WEEKISO(r.WEEK_START)         AS WEEKNR,
       r.AFDELING,
       r.ONDERWERP,
       COALESCE(t.MELDINGEN, 0)      AS MELDINGEN,
       COALESCE(t.MELDINGEN_ROOD, 0) AS MELDINGEN_ROOD
FROM raster r
LEFT JOIN tel t
  ON t.WEEK_START = r.WEEK_START AND t.AFDELING = r.AFDELING AND t.ONDERWERP = r.ONDERWERP;

SELECT WEEKNR, SUM(MELDINGEN) AS MELDINGEN
FROM HEATMAP_AFDELING_WEEK
GROUP BY WEEKNR, WEEK_START
ORDER BY WEEK_START;

-- ---- Weeknummers en aanpak: V_MELDINGEN, V_ACTIES, ACTIES_PER_WEEK -----
CREATE OR REPLACE VIEW V_MELDINGEN AS
SELECT o.*,
       DATE_TRUNC('week', o.DATUM)    AS WEEK_START,
       WEEKISO(o.DATUM)               AS WEEKNR,
       IFF(o.SIGNAAL = 'rood', 1, 0)  AS IS_ROOD
FROM OBSERVATIES o;

CREATE OR REPLACE VIEW V_ACTIES AS
SELECT a.*,
       DATE_TRUNC('week', a.AANGEMAAKT) AS WEEK_START,
       WEEKISO(a.AANGEMAAKT)            AS WEEKNR,
       CASE a.PRIORITEIT
            WHEN 'Actie / Just Do It' THEN 'Just Do It'
            WHEN 'PDCA / 6S'          THEN 'PDCA / 6S'
            ELSE 'Change'
       END                                                              AS AANPAK,
       IFF(a.STATUS IN ('Uitgevoerd', 'Resultaat gecontroleerd'), 1, 0)                                AS IS_AFGEROND,
       IFF(a.STATUS NOT IN ('Uitgevoerd', 'Resultaat gecontroleerd'), 1, 0)                            AS IS_OPEN,
       IFF(a.STATUS NOT IN ('Uitgevoerd', 'Resultaat gecontroleerd') AND a.DEADLINE < CURRENT_DATE, 1, 0) AS IS_VERLOPEN,
       IFF(a.STATUS NOT IN ('Uitgevoerd', 'Resultaat gecontroleerd'),
           GREATEST(DATEDIFF(day, a.DEADLINE, CURRENT_DATE), 0), 0)     AS DAGEN_TE_LAAT,
       CASE WHEN a.STATUS IN ('Uitgevoerd', 'Resultaat gecontroleerd')   THEN 'Opgelost'
            WHEN a.DEADLINE < CURRENT_DATE THEN 'Verlopen'
            ELSE 'In werking'
       END                                                              AS SIGNAAL_ACTIE
FROM ACTIES a;

CREATE OR REPLACE VIEW ACTIES_PER_WEEK AS
SELECT WEEK_START, WEEKNR, AANPAK, ONDERWERP, AFDELING, EIGENAAR,
       COUNT(*)         AS ACTIES,
       SUM(IS_OPEN)     AS OPEN,
       SUM(IS_VERLOPEN) AS VERLOPEN
FROM V_ACTIES
GROUP BY WEEK_START, WEEKNR, AANPAK, ONDERWERP, AFDELING, EIGENAAR;

-- Just Do It, PDCA / 6S en Change per weeknummer
SELECT WEEKNR,
       SUM(IFF(AANPAK = 'Just Do It', ACTIES, 0)) AS JUST_DO_IT,
       SUM(IFF(AANPAK = 'PDCA / 6S', ACTIES, 0))  AS PDCA_6S,
       SUM(IFF(AANPAK = 'Change', ACTIES, 0))     AS CHANGE
FROM ACTIES_PER_WEEK
GROUP BY WEEKNR, WEEK_START
ORDER BY WEEK_START;

-- Stap 4 — Dynamic table: open acties
--
-- Houdt de lopende acties bij, met de melding, het weeknummer en de aanpak erbij. Zonder CURRENT_DATE in de
-- definitie, zodat Snowflake incrementeel kan verversen. Of een actie verlopen is, rekent het dashboard uit.

-- ---- Dynamic table OPEN_ACTIES -----------------------------------------
CREATE OR REPLACE DYNAMIC TABLE OPEN_ACTIES
  TARGET_LAG = '1 hour'
  WAREHOUSE  = INSIGHT_WH
AS
SELECT a.ACTIE_ID,
       a.OBSERVATIE_ID,
       a.TITEL,
       a.KPI,
       a.ONDERWERP,
       a.AFDELING,
       a.EIGENAAR,
       a.PRIORITEIT,
       CASE a.PRIORITEIT
            WHEN 'Actie / Just Do It' THEN 'Just Do It'
            WHEN 'PDCA / 6S'          THEN 'PDCA / 6S'
            ELSE 'Change'
       END                    AS AANPAK,
       a.STATUS,
       a.AANGEMAAKT,
       WEEKISO(a.AANGEMAAKT)  AS WEEKNR,
       a.DEADLINE,
       o.TITEL   AS MELDING,
       o.SIGNAAL AS SIGNAAL_MELDING,
       a.BRON
FROM ACTIES a
LEFT JOIN OBSERVATIES o ON o.OBSERVATIE_ID = a.OBSERVATIE_ID
WHERE a.STATUS NOT IN ('Uitgevoerd', 'Resultaat gecontroleerd');

-- Kolom refresh_mode moet INCREMENTAL tonen
SHOW DYNAMIC TABLES LIKE 'OPEN_ACTIES';

-- ---- Proef: actie afronden en verversen --------------------------------
-- Rond de palletactie af en ververs meteen, in plaats van op de TARGET_LAG van een uur te wachten.
SET OPEN_VOOR = (SELECT COUNT(*) FROM OPEN_ACTIES);

UPDATE ACTIES SET STATUS = 'Uitgevoerd' WHERE ACTIE_ID = 'act-pallet';
ALTER DYNAMIC TABLE OPEN_ACTIES REFRESH;

-- Verwacht: OPEN_NA is één lager dan OPEN_VOOR
SELECT $OPEN_VOOR AS OPEN_VOOR, COUNT(*) AS OPEN_NA FROM OPEN_ACTIES;

-- Terugzetten:
-- UPDATE ACTIES SET STATUS = 'In uitvoering' WHERE ACTIE_ID = 'act-pallet';
-- ALTER DYNAMIC TABLE OPEN_ACTIES REFRESH;

-- Stap 5 — Dagstart-samenvatting met Cortex
--
-- De cijfers uit de views gaan als tekst mee in de prompt, net als de executive summary in het lab.

-- ---- AI-samenvatting voor de dagstart ----------------------------------
SELECT AI_COMPLETE('claude-haiku-4-5', CONCAT(
    'Je bent analist operational excellence in een logistiek distributiecentrum. ',
    'Schrijf in het Nederlands een samenvatting van hoogstens 5 zinnen voor de dagstart: ',
    'waar zitten de hotspots, welke afdeling vraagt aandacht en welke actie moet eerst. ',
    'Gebruik alleen de cijfers hieronder.\n\nMELDINGEN PER AFDELING EN ONDERWERP:\n',
    (SELECT LISTAGG(AFDELING || ' / ' || ONDERWERP || ': ' || MELDINGEN || ' meldingen, ' || MELDINGEN_ROOD || ' rood', '\n')
       FROM HEATMAP_AFDELING_ONDERWERP WHERE MELDINGEN > 0),
    '\n\nOPEN ACTIES PER AFDELING:\n',
    (SELECT LISTAGG(AFDELING || ': ' || OPEN_ACTIES || ' open, ' || VERLOPEN_ACTIES || ' verlopen', '\n')
       FROM AFDELING_SAMENVATTING)
))::STRING AS DAGSTART;

-- Stap 6 — Streamlit-dashboard
--
-- Stage → bestanden uit de workspace kopiëren → CREATE STREAMLIT. Daarna staat het dashboard onder
-- Projects → Streamlit als *Insight Flow KPI-dashboard*.

-- ---- Streamlit-dashboard deployen --------------------------------------
CREATE OR REPLACE STAGE INSIGHT_FLOW.DEMO.STREAMLIT_STAGE
  DIRECTORY  = (ENABLE = TRUE)
  ENCRYPTION = (TYPE = 'SNOWFLAKE_SSE');

COPY FILES INTO @INSIGHT_FLOW.DEMO.STREAMLIT_STAGE/
FROM 'snow://workspace/USER$.PUBLIC."insight-flow-actions"/versions/live/'
FILES = ('streamlit/kpi_dashboard.py', 'streamlit/environment.yml', 'streamlit/.streamlit/config.toml');

CREATE OR REPLACE STREAMLIT INSIGHT_FLOW.DEMO.KPI_DASHBOARD
  ROOT_LOCATION   = '@INSIGHT_FLOW.DEMO.STREAMLIT_STAGE/streamlit'
  MAIN_FILE       = 'kpi_dashboard.py'
  QUERY_WAREHOUSE = INSIGHT_WH
  TITLE           = 'Insight Flow KPI-dashboard';

-- Stap 7 — Vergelijkbare meldingen met Cortex Search
--
-- Eén tekst per melding: titel, 5W1H, 5x Waarom en de maatregel. Met het attribuut OPGELOST zoek je alleen
-- in meldingen waarvan de actie is afgerond, zodat je de eerdere oplossing terugziet. Het dashboard gebruikt dit
-- op de Actielijst; de agent in stap 9 ook.
--
-- Het standaard embeddingmodel is Engelstalig; het trefwoorddeel van de hybride zoekfunctie werkt gewoon op
-- Nederlandse tekst. Wil je betere betekenisherkenning in het Nederlands, voeg dan
-- EMBEDDING_MODEL = 'snowflake-arctic-embed-l-v2.0' toe (meertalig, niet in elke regio beschikbaar).

-- ---- Cortex Search-service MELDINGEN_SEARCH ----------------------------
CREATE OR REPLACE CORTEX SEARCH SERVICE MELDINGEN_SEARCH
  ON ANALYSE
  ATTRIBUTES OPGELOST, AFDELING, ONDERWERP
  WAREHOUSE  = INSIGHT_WH
  TARGET_LAG = '1 day'
AS (
  SELECT o.OBSERVATIE_ID,
         o.TITEL,
         o.AFDELING,
         o.ONDERWERP,
         o.SIGNAAL,
         TO_VARCHAR(o.DATUM)               AS DATUM,
         IFF(a.STATUS IN ('Uitgevoerd', 'Resultaat gecontroleerd'), 'ja', 'nee') AS OPGELOST,
         COALESCE(a.TITEL, '')             AS ACTIE,
         COALESCE(a.PRIORITEIT, '')        AS AANPAK,
         COALESCE(a.GEDAAN, '')            AS OPLOSSING,
         COALESCE(a.RESULTAAT, '')         AS RESULTAAT,
         o.TITEL || '. Wat: ' || COALESCE(o.WAT, '') || '. Waar: ' || COALESCE(o.WAAR, '')
           || '. Waarom: ' || COALESCE(o.WAAROM, '') || ' Oorzaakketen: ' || COALESCE(o.WAAROM_KETEN, '')
           || ' Maatregel: ' || COALESCE(o.HOE, '') AS ANALYSE
  FROM OBSERVATIES o
  LEFT JOIN ACTIES a ON a.OBSERVATIE_ID = o.OBSERVATIE_ID
);

-- Proef: drie opgeloste meldingen die lijken op een heftruck die olie lekt
SELECT PARSE_JSON(SNOWFLAKE.CORTEX.SEARCH_PREVIEW(
  'INSIGHT_FLOW.DEMO.MELDINGEN_SEARCH',
  '{"query": "heftruck lekt olie in de gang", "columns": ["TITEL", "AFDELING", "OPLOSSING", "RESULTAAT"], "filter": {"@eq": {"OPGELOST": "ja"}}, "limit": 3}'
)):results AS VERGELIJKBARE_MELDINGEN;

-- Stap 8 — Semantic view
--
-- Eén plek waar staat wat *een melding*, *een open actie*, *verlopen*, *aanpak* en *weeknummer* betekenen.
-- Cortex Analyst en de agent gebruiken deze definities; via Ossie (stap 10) kunnen andere tools ze overnemen.
-- De view bouwt op V_MELDINGEN, V_ACTIES, MEDEWERKERS en KPI_NORMEN uit stap 2 en 3.

-- ---- Semantic view INSIGHT_FLOW_MODEL ----------------------------------
CREATE OR REPLACE SEMANTIC VIEW INSIGHT_FLOW_MODEL
  TABLES (
    meldingen AS INSIGHT_FLOW.DEMO.V_MELDINGEN
      PRIMARY KEY (OBSERVATIE_ID)
      WITH SYNONYMS ('observaties', 'waarnemingen')
      COMMENT = 'Eén rij per melding op de werkvloer, met 5W1H-analyse.',
    acties AS INSIGHT_FLOW.DEMO.V_ACTIES
      PRIMARY KEY (ACTIE_ID)
      WITH SYNONYMS ('verbeteracties', 'actielijst')
      COMMENT = 'Eén rij per actie die uit een melding volgt.',
    medewerkers AS INSIGHT_FLOW.DEMO.MEDEWERKERS
      PRIMARY KEY (NAAM)
      WITH SYNONYMS ('gebruikers', 'teamleiders')
      COMMENT = 'Fictieve medewerkers met rol en afdeling.',
    kpis AS INSIGHT_FLOW.DEMO.KPI_NORMEN
      PRIMARY KEY (VESTIGING, KPI)
      WITH SYNONYMS ('KPI-kaarten', 'normen')
      COMMENT = 'KPI per vestiging met actuele waarde, norm en status (fictief).'
  )
  RELATIONSHIPS (
    actie_melding  AS acties (OBSERVATIE_ID) REFERENCES meldingen,
    actie_eigenaar AS acties (EIGENAAR) REFERENCES medewerkers
  )
  DIMENSIONS (
    meldingen.afdeling AS meldingen.AFDELING
      WITH SYNONYMS ('team', 'zone')
      COMMENT = 'Afdeling van de melding: Inbound, Opslag, Orderpick, Pakstraat, Outbound of Retouren.',
    meldingen.onderwerp AS meldingen.ONDERWERP
      WITH SYNONYMS ('thema', 'KPI-categorie')
      COMMENT = 'Veiligheid, Kwaliteit, Productiviteit of Personeel.',
    meldingen.signaal AS meldingen.SIGNAAL
      COMMENT = 'Ernst van de melding: rood, oranje of groen.',
    meldingen.titel AS meldingen.TITEL
      COMMENT = 'Korte omschrijving van de melding.',
    meldingen.melder AS meldingen.MELDER
      COMMENT = 'Naam van wie de melding deed.',
    meldingen.datum AS meldingen.DATUM
      COMMENT = 'Datum van de melding.',
    meldingen.week_start AS meldingen.WEEK_START
      COMMENT = 'Maandag van de week van de melding.',
    meldingen.weeknr AS meldingen.WEEKNR
      WITH SYNONYMS ('week', 'weeknummer')
      COMMENT = 'ISO-weeknummer van de melding.',
    meldingen.bron AS meldingen.BRON
      COMMENT = 'app-voorbeeld of synthetisch (fictieve historie).',
    acties.actie AS acties.TITEL
      COMMENT = 'Omschrijving van de actie.',
    acties.kpi AS acties.KPI
      COMMENT = 'KPI waaronder de actie valt.',
    acties.aanpak AS acties.AANPAK
      WITH SYNONYMS ('prioriteit', 'type actie', 'actietype')
      COMMENT = 'Just Do It (direct oplossen), PDCA / 6S (verbetercyclus of 6S op de werkplek) of Change (structurele wijziging, vraagt een besluit).',
    acties.status AS acties.STATUS
      COMMENT = 'Open, In uitvoering, Wacht op besluit, Uitgevoerd of Resultaat gecontroleerd.',
    acties.signaal_actie AS acties.SIGNAAL_ACTIE
      COMMENT = 'Opgelost, Verlopen (deadline voorbij en niet afgerond) of In werking.',
    acties.eigenaar AS acties.EIGENAAR
      WITH SYNONYMS ('actiehouder', 'verantwoordelijke')
      COMMENT = 'Naam van de eigenaar van de actie.',
    acties.aangemaakt AS acties.AANGEMAAKT
      COMMENT = 'Datum waarop de actie is aangemaakt.',
    acties.deadline AS acties.DEADLINE
      COMMENT = 'Deadline van de actie.',
    acties.actie_week_start AS acties.WEEK_START
      COMMENT = 'Maandag van de week waarin de actie is aangemaakt.',
    acties.actie_weeknr AS acties.WEEKNR
      WITH SYNONYMS ('actieweek')
      COMMENT = 'ISO-weeknummer waarin de actie is aangemaakt.',
    medewerkers.naam AS medewerkers.NAAM
      COMMENT = 'Naam van de fictieve medewerker.',
    medewerkers.rol AS medewerkers.ROL
      COMMENT = 'Teamleider of Supervisor.',
    medewerkers.team AS medewerkers.AFDELING
      COMMENT = 'Afdeling waarvan de medewerker teamleider is, of Alle afdelingen.',
    kpis.vestiging AS kpis.VESTIGING
      COMMENT = 'OFM of LDC.',
    kpis.kpi_onderwerp AS kpis.ONDERWERP
      COMMENT = 'Onderwerp waaronder de KPI valt.',
    kpis.kpi_naam AS kpis.KPI
      COMMENT = 'Naam van de KPI, bijvoorbeeld Gedragsregels of SLA Healthcare.',
    kpis.kpi_waarde AS kpis.WAARDE
      COMMENT = 'Actuele waarde als tekst.',
    kpis.kpi_norm AS kpis.NORM
      COMMENT = 'Norm als tekst.',
    kpis.kpi_status AS kpis.STATUS
      COMMENT = 'gunstig, op norm, aandacht of fictief (norm nog te bepalen).'
  )
  METRICS (
    meldingen.aantal_meldingen AS COUNT(meldingen.OBSERVATIE_ID)
      WITH SYNONYMS ('aantal observaties')
      COMMENT = 'Aantal meldingen.',
    meldingen.meldingen_rood AS SUM(meldingen.IS_ROOD)
      COMMENT = 'Aantal meldingen met signaal rood.',
    meldingen.aandeel_rood_pct AS ROUND(100 * SUM(meldingen.IS_ROOD) / NULLIF(COUNT(meldingen.OBSERVATIE_ID), 0), 1)
      COMMENT = 'Percentage meldingen met signaal rood.',
    acties.aantal_acties AS COUNT(acties.ACTIE_ID)
      COMMENT = 'Aantal acties.',
    acties.open_acties AS SUM(acties.IS_OPEN)
      COMMENT = 'Acties die nog niet zijn uitgevoerd of gecontroleerd.',
    acties.verlopen_acties AS SUM(acties.IS_VERLOPEN)
      COMMENT = 'Open acties met een deadline in het verleden.',
    acties.afgeronde_acties AS SUM(acties.IS_AFGEROND)
      COMMENT = 'Acties met status Uitgevoerd of Resultaat gecontroleerd.',
    acties.max_dagen_te_laat AS MAX(acties.DAGEN_TE_LAAT)
      COMMENT = 'Grootste aantal dagen dat een open actie over de deadline is.'
  )
  COMMENT = 'Insight Flow Actions: meldingen, acties, medewerkers en KPI-normen (demodata, fictief).'
  AI_SQL_GENERATION 'Antwoord in het Nederlands. Weeknummers zijn ISO-weken. Een actie is open als de status niet Uitgevoerd of Resultaat gecontroleerd is; verlopen betekent open met een deadline voor vandaag. Gebruik voor afdeling en onderwerp de dimensies van meldingen.';

-- Proef: open en verlopen acties per afdeling via de semantic view
SELECT * FROM SEMANTIC_VIEW(
  INSIGHT_FLOW_MODEL
  DIMENSIONS meldingen.afdeling
  METRICS acties.open_acties, acties.verlopen_acties
)
ORDER BY verlopen_acties DESC;

-- Stap 9 — Agent
--
-- Twee tools, net als in het lab: Cortex Analyst op de semantic view voor cijfers, en Cortex Search voor
-- vergelijkbare meldingen en eerdere oplossingen. Daarna te vinden onder AI & ML → Agents (Agent Studio),
-- kies *INSIGHT_FLOW_AGENT* en dan Preview.

-- ---- Agent INSIGHT_FLOW_AGENT ------------------------------------------
CREATE OR REPLACE AGENT INSIGHT_FLOW.DEMO.INSIGHT_FLOW_AGENT
FROM SPECIFICATION $$
{
  "models": {"orchestration": "auto"},
  "orchestration": {"budget": {"seconds": 300, "tokens": 100000}},
  "instructions": {
    "orchestration": "Je bent analist operational excellence voor een logistiek distributiecentrum met de afdelingen Inbound, Opslag, Orderpick, Pakstraat, Outbound en Retouren. Gebruik query_data voor aantallen, trends, weeknummers, de aanpak van acties (Just Do It, PDCA / 6S, Change), eigenaren, open en verlopen acties en KPI-normen. Gebruik zoek_meldingen om vergelijkbare meldingen en eerdere oplossingen te vinden. Combineer beide als iemand vraagt wat er aan een probleem gedaan kan worden.",
    "response": "Antwoord in het Nederlands, kort en concreet. Noem weeknummers als week 43. Noem bij zoekresultaten de titel en afdeling van de melding en wat er toen is gedaan. Vermeld dat de data fictief is als iemand naar echte cijfers vraagt.",
    "sample_questions": [
      {"question": "Hoeveel verlopen veiligheidsacties heeft Opslag?"},
      {"question": "Hoeveel Just Do It-, PDCA- en Change-acties zijn er per week aangemaakt?"},
      {"question": "Welke open acties heeft Sanne de Vries?"},
      {"question": "Is er eerder een oplossing gevonden voor olielekkage bij een heftruck?"}
    ]
  },
  "tools": [
    {"tool_spec": {"type": "cortex_analyst_text_to_sql", "name": "query_data",
      "description": "Cijfers over meldingen (afdeling, onderwerp, signaal, weeknummer), acties (aanpak Just Do It / PDCA / 6S / Change, status, eigenaar, deadline, open en verlopen), fictieve medewerkers en KPI-normen per vestiging (OFM en LDC)."}},
    {"tool_spec": {"type": "cortex_search", "name": "zoek_meldingen",
      "description": "Zoekt in de analyses van meldingen (5W1H, 5x Waarom, maatregel) en geeft de actie, oplossing en het resultaat terug. Filter OPGELOST = ja voor eerdere oplossingen."}}
  ],
  "tool_resources": {
    "query_data": {
      "semantic_view": "INSIGHT_FLOW.DEMO.INSIGHT_FLOW_MODEL",
      "execution_environment": {"type": "warehouse", "warehouse": "INSIGHT_WH", "query_timeout": 120}
    },
    "zoek_meldingen": {
      "search_service": "INSIGHT_FLOW.DEMO.MELDINGEN_SEARCH",
      "max_results": 5,
      "title_column": "TITEL",
      "id_column": "OBSERVATIE_ID"
    }
  }
}
$$;

SHOW AGENTS IN SCHEMA INSIGHT_FLOW.DEMO;

-- Stap 10 — Export naar Apache Ossie
--
-- Dezelfde definities als open YAML op de stage, zodat een andere tool ze kan overnemen zonder alles opnieuw te
-- definiëren. De tweede query laat de YAML direct zien.

-- ---- Semantic view naar Ossie ------------------------------------------
COPY INTO @INSIGHT_DATA_STAGE/ossie/insight_flow_ossie.yaml
FROM (
  SELECT SYSTEM$READ_OSSIE_YAML_FROM_SEMANTIC_VIEW('INSIGHT_FLOW.DEMO.INSIGHT_FLOW_MODEL')
)
FILE_FORMAT = (TYPE = CSV FIELD_OPTIONALLY_ENCLOSED_BY = NONE COMPRESSION = NONE)
SINGLE    = TRUE
OVERWRITE = TRUE;

SELECT SYSTEM$READ_OSSIE_YAML_FROM_SEMANTIC_VIEW('INSIGHT_FLOW.DEMO.INSIGHT_FLOW_MODEL') AS OSSIE_YAML;

-- Opruimen (optioneel)
--
-- Alleen draaien als je klaar bent. De zoekservice kost een klein bedrag zolang hij bestaat; de rest kost alleen
-- iets als je hem gebruikt.

-- ---- Opruimen ----------------------------------------------------------
-- DROP CORTEX SEARCH SERVICE IF EXISTS INSIGHT_FLOW.DEMO.MELDINGEN_SEARCH;
-- DROP DATABASE IF EXISTS INSIGHT_FLOW;
-- DROP WAREHOUSE IF EXISTS INSIGHT_WH;
SELECT 'Niets verwijderd. Haal de streepjes weg als je echt wilt opruimen.' AS STATUS;

