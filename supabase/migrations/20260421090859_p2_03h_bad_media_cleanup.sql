WITH fact_topics AS (
  SELECT
    id,
    COALESCE(source_label, '') AS source_label,
    COALESCE(category, '') AS category,
    lower(
      translate(
        COALESCE(title, '') || ' ' || COALESCE(content, '') || ' ' || COALESCE(array_to_string(tags, ' '), ''),
        'ÇĞİIÖŞÜçğıiöşü',
        'CGIIOSUcgiiosu'
      )
    ) AS topic_text,
    COALESCE(media_url, '') AS media_url
  FROM public.facts
),
visual_backfill AS (
  SELECT
    id,
    CASE
      WHEN source_label ILIKE '%NASA%' THEN 'space-observatory'
      WHEN source_label ILIKE '%Stanford Encyclopedia%' AND topic_text ~ '(ethic|moral|justice|duty|responsibility|kant|rawls)' THEN 'philosophy-ethics'
      WHEN source_label ILIKE '%Stanford Encyclopedia%' AND topic_text ~ '(metaphys|ontology|epistem|mind|consciousness|identity|exist|religion)' THEN 'philosophy-metaphysics'
      WHEN source_label ILIKE '%Stanford Encyclopedia%' THEN 'philosophy-library'
      WHEN source_label ILIKE '%MedlinePlus%' AND topic_text ~ '(mental|stress|sleep|anxiety|depression|mood)' THEN 'health-mind'
      WHEN source_label ILIKE '%MedlinePlus%' AND topic_text ~ '(diagnos|test|patient|safety|rehabilitation|medical|clinic|treatment|screening|therapy)' THEN 'health-clinical'
      WHEN source_label ILIKE '%MedlinePlus%' AND topic_text ~ '(heart|liver|kidney|lung|respiratory|digest|bone|muscle|blood|brain|pain|arthritis|metabolism|nutrition)' THEN 'health-body'
      WHEN source_label ILIKE '%MedlinePlus%' THEN 'health-brief'
      WHEN category ILIKE '%BİLİM%' OR category ILIKE '%BILIM%' THEN
        CASE
          WHEN topic_text ~ '(space|galaxy|planet|orbit|moon|mars|asteroid|comet|nebula|telescope|cosmic|star)' THEN 'science-cosmos'
          WHEN topic_text ~ '(cell|dna|gene|genetic|organism|brain|evolution|immune|virus|bacteria|biology|animal)' THEN 'science-biology'
          WHEN topic_text ~ '(earth|geology|ocean|climate|fossil|volcano|mineral|glacier|weather|atmosphere|tectonic)' THEN 'science-earth'
          ELSE 'science-focus'
        END
      WHEN category ILIKE '%TARİH%' OR category ILIKE '%TARIH%' THEN
        CASE
          WHEN topic_text ~ '(ancient|antik|rome|roman|greek|egypt|archae|temple|ruins|medieval|dynasty|empire|cathedral)' THEN 'history-antiquity'
          WHEN topic_text ~ '(war|battle|revolution|treaty|election|council|congress|senate|occupation|conflict|military)' THEN 'history-conflict'
          ELSE 'history-archive'
        END
      WHEN category ILIKE '%FELSEFE%' THEN
        CASE
          WHEN topic_text ~ '(ethic|moral|justice|duty|responsibility|utilitarian|kant|rawls)' THEN 'philosophy-ethics'
          WHEN topic_text ~ '(metaphys|ontology|epistem|mind|consciousness|identity|exist|reality|knowledge|religion)' THEN 'philosophy-metaphysics'
          ELSE 'philosophy-marble'
        END
      WHEN category ILIKE '%TEKNOLOJİ%' OR category ILIKE '%TEKNOLOJI%' THEN
        CASE
          WHEN topic_text ~ '(computer|software|program|compiler|database|algorithm|encrypt|cryptograph|cloud|search|network|internet|distributed|open source|digital|signal)' THEN 'technology-computing'
          WHEN topic_text ~ '(engine|aircraft|rocket|satellite|device|hardware|vehicle|power|robot|machine|electric)' THEN 'technology-systems'
          ELSE 'technology-grid'
        END
      WHEN category ILIKE '%SAĞLIK%' OR category ILIKE '%SAGLIK%' THEN
        CASE
          WHEN topic_text ~ '(mental|stress|sleep|anxiety|depression|mood)' THEN 'health-mind'
          WHEN topic_text ~ '(diagnos|test|patient|safety|rehabilitation|medical|clinic|treatment|screening|therapy)' THEN 'health-clinical'
          WHEN topic_text ~ '(heart|liver|kidney|lung|respiratory|digest|bone|muscle|blood|brain|pain|arthritis|metabolism|nutrition)' THEN 'health-body'
          ELSE 'health-brief'
        END
      ELSE 'editorial-deep'
    END AS next_visual_key,
    CASE
      WHEN media_url = '' THEN false
      WHEN source_label ILIKE '%Wikipedia%' AND media_url ILIKE '%upload.wikimedia.org/wikipedia/en/%' THEN true
      WHEN media_url ~* '(logo|seal|crest|coat[_-]?of[_-]?arms|wordmark|icon|symbol|emblem|flag|cover|album|poster|boxart|gamecover)' THEN true
      WHEN media_url ~* '\.svg(\.png)?($|\?)' AND media_url ~* '(flag|seal|crest|coat[_-]?of[_-]?arms|wordmark|icon|symbol|emblem|logo)' THEN true
      ELSE false
    END AS should_null_media
  FROM fact_topics
)
UPDATE public.facts AS facts
SET
  visual_key = visual_backfill.next_visual_key,
  media_url = CASE WHEN visual_backfill.should_null_media THEN NULL ELSE facts.media_url END
FROM visual_backfill
WHERE facts.id = visual_backfill.id;
