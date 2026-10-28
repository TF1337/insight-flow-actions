-- =============================================================================
-- insight_flow_fallback.sql
-- Insight Flow Actions — dezelfde stappen als notebooks/insight_flow_dashboard.ipynb,
-- maar als SQL-bestand. Draait op een warehouse, dus zonder notebookservice of
-- compute pool. Gebruik dit als de notebook niet kan verbinden (net als
-- sql/fallback.sql in het flood-lab).
--
-- Draaien: kies rechtsboven een warehouse en voer alles uit (Ctrl + Shift + Enter),
-- of selecteer een blok en voer dat uit (Ctrl + Enter).
-- Alleen het matplotlib-voorproefje ontbreekt; de heatmap zie je in het dashboard.
-- =============================================================================

-- Insight Flow Actions in Snowflake — heatmap en dashboard
--
-- Dezelfde opbouw als het flood-lab van gisteren, nu met de meldingen en acties uit Insight Flow Actions.
--
--
-- Data: data/observaties.csv en data/acties.csv. Kolom BRON = app-voorbeeld (de 10 meldingen uit de app)
-- of synthetisch (12 weken fictieve historie, alleen om de heatmap te vullen). Alle waarden zijn fictief.
--
-- > Workspacenaam: de COPY FILES-cellen lezen uit "insight-flow-actions". Heet je workspace anders,
-- > pas dan die naam aan in stap 2 en 6.

-- Stap 1 — Omgeving
--
-- Een XSMALL-warehouse is genoeg: het gaat om een paar honderd rijen, niet om 2 miljoen gebouwen.

-- ---- Database, schema en warehouse -------------------------------
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
-- Precies het lab-patroon: stage maken, de CSV's uit je Git-workspace kopiëren, dan COPY INTO een tabel.
-- ON_ERROR = 'ABORT_STATEMENT' laat een fout zien in plaats van rijen stil over te slaan.

-- ---- Stage en bestandsformaat ------------------------------------
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

-- ---- Observaties en acties laden ---------------------------------
COPY FILES INTO @INSIGHT_DATA_STAGE/
FROM 'snow://workspace/USER$.PUBLIC."insight-flow-actions"/versions/live/'
FILES = ('data/observaties.csv', 'data/acties.csv');

CREATE OR REPLACE TABLE OBSERVATIES (
    OBSERVATIE_ID STRING, TITEL STRING, AFDELING STRING, ONDERWERP STRING,
    SIGNAAL STRING, MELDER STRING, DATUM DATE, BRON STRING
);
COPY INTO OBSERVATIES FROM @INSIGHT_DATA_STAGE/data/observaties.csv
FILE_FORMAT = CSV_FORMAT MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE ON_ERROR = 'ABORT_STATEMENT';

CREATE OR REPLACE TABLE ACTIES (
    ACTIE_ID STRING, TITEL STRING, OBSERVATIE_ID STRING, KPI STRING, ONDERWERP STRING,
    AFDELING STRING, EIGENAAR STRING, AANGEMAAKT DATE, DEADLINE DATE,
    PRIORITEIT STRING, STATUS STRING, BRON STRING
);
COPY INTO ACTIES FROM @INSIGHT_DATA_STAGE/data/acties.csv
FILE_FORMAT = CSV_FORMAT MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE ON_ERROR = 'ABORT_STATEMENT';

-- Verwacht: 178 observaties en 102 acties
SELECT 'OBSERVATIES' AS TABEL, COUNT(*) AS RIJEN FROM OBSERVATIES
UNION ALL
SELECT 'ACTIES', COUNT(*) FROM ACTIES;

-- Stap 3 — Samenvatting en heatmaps
--
-- In het lab waren dit PARISH_FLOOD_SUMMARY en H3_FLOOD_RISK_MAP. Hier zijn het views: bij een paar honderd rijen
-- rekent een view direct en is hij altijd actueel. Het dashboard leest alleen deze views, zodat de logica op één plek staat.
--
-- - Per afdeling: meldingen, aandeel rood, open en verlopen acties.
-- - Heatmap 1: afdeling × onderwerp — waar zitten de meldingen?
-- - Heatmap 2: afdeling × week — wanneer liep het op? De 12 weken tellen terug vanaf de laatste melding,
-- zodat de demo niet leegloopt naarmate de tijd verstrijkt.

-- ---- Samenvatting per afdeling -----------------------------------
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

-- ---- Heatmap afdeling × onderwerp --------------------------------
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

-- ---- Heatmap afdeling × week -------------------------------------
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

-- Stap 4 — Dynamic table: open acties
--
-- Het lab maakte FLOOD_RISK_ALERTS. Hier houdt OPEN_ACTIES de lopende acties bij, met de melding erbij.
-- Bewust zonder CURRENT_DATE in de definitie: dan kan Snowflake incrementeel verversen, wat goedkoper is.
-- Of een actie *verlopen* is, rekent het dashboard uit op het moment dat je kijkt.

-- ---- Dynamic table OPEN_ACTIES -----------------------------------
CREATE OR REPLACE DYNAMIC TABLE OPEN_ACTIES
  TARGET_LAG = '1 hour'
  WAREHOUSE  = INSIGHT_WH
AS
SELECT a.ACTIE_ID,
       a.TITEL,
       a.KPI,
       a.ONDERWERP,
       a.AFDELING,
       a.EIGENAAR,
       a.PRIORITEIT,
       a.STATUS,
       a.AANGEMAAKT,
       a.DEADLINE,
       o.TITEL   AS MELDING,
       o.SIGNAAL AS SIGNAAL_MELDING,
       a.BRON
FROM ACTIES a
LEFT JOIN OBSERVATIES o ON o.OBSERVATIE_ID = a.OBSERVATIE_ID
WHERE a.STATUS NOT IN ('Uitgevoerd', 'Resultaat gecontroleerd');

-- Kolom refresh_mode moet INCREMENTAL tonen
SHOW DYNAMIC TABLES LIKE 'OPEN_ACTIES';

-- ---- Proef: actie afronden en verversen --------------------------
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
-- Hetzelfde patroon als de executive summary in het lab: de cijfers uit de views gaan als tekst mee in de prompt.
-- Geeft het model een foutmelding over beschikbaarheid, kies dan een ander model uit de lijst van je regio.

-- ---- AI-samenvatting voor de dagstart ----------------------------
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
-- Weer het lab-patroon: stage → bestanden uit de workspace kopiëren → CREATE STREAMLIT.
-- Daarna staat het dashboard onder Projects → Streamlit als *Insight Flow KPI-dashboard*.

-- ---- Streamlit-dashboard deployen --------------------------------
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

-- Opruimen (optioneel)
--
-- Alleen draaien als je klaar bent.

-- ---- Opruimen ----------------------------------------------------
-- DROP DATABASE IF EXISTS INSIGHT_FLOW;
-- DROP WAREHOUSE IF EXISTS INSIGHT_WH;
SELECT 'Niets verwijderd. Haal de streepjes weg als je echt wilt opruimen.' AS STATUS;

