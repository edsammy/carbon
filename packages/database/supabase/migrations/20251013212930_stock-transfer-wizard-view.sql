DROP FUNCTION IF EXISTS get_item_shelf_requirements_by_location;
CREATE OR REPLACE FUNCTION get_item_shelf_requirements_by_location(company_id TEXT, location_id TEXT)
  RETURNS TABLE (
    "itemId" TEXT,
    "itemReadableId" TEXT,
    "name" TEXT,
    "description" TEXT,
    "itemTrackingType" "itemTrackingType",
    "type" "itemType",
    "thumbnailPath" TEXT,
    "unitOfMeasureCode" TEXT,
    "quantityOnHandInShelf" NUMERIC,
    "quantityRequiredByShelf" NUMERIC,
    "shelfId" TEXT,
    "shelfName" TEXT,
    "isDefaultShelf" BOOLEAN
  ) AS $$
  BEGIN
    RETURN QUERY
    
WITH
  item_shelves AS (
    SELECT DISTINCT
      il."itemId",
      il."shelfId"
    FROM "itemLedger" il
    WHERE il."companyId" = company_id
      AND il."locationId" = location_id
  ),
  open_job_requirements_in_shelf AS (
    SELECT 
      jm."itemId",
      jm."shelfId",
      SUM(jm."quantityToIssue") AS "quantityOnProductionDemandInShelf"
    FROM "jobMaterial" jm
    INNER JOIN "job" j ON jm."jobId" = j."id"
    WHERE j."status" IN (
        'Planned',
        'Ready',
        'In Progress',
        'Paused'
      )
    AND jm."methodType" != 'Make'
    AND j."companyId" = company_id
    AND j."locationId" = location_id
    GROUP BY jm."itemId", jm."shelfId"
  ),
  item_ledgers_in_shelf AS (
    SELECT 
      il."itemId" AS "ledgerItemId",
      il."shelfId",
      SUM(il."quantity") AS "quantityOnHandInShelf"
    FROM "itemLedger" il
    WHERE il."companyId" = company_id
      AND il."locationId" = location_id
    GROUP BY il."itemId", il."shelfId"
  ),
  items_with_activity AS (
    SELECT DISTINCT active_items."itemId", active_items."shelfId"
    FROM (
      SELECT ils."ledgerItemId" AS "itemId", ils."shelfId"
      FROM item_ledgers_in_shelf ils
      WHERE ils."quantityOnHandInShelf" > 0

      UNION

      SELECT ojis."itemId", ojis."shelfId"
      FROM open_job_requirements_in_shelf ojis
      WHERE ojis."quantityOnProductionDemandInShelf" > 0
    ) active_items
  )
  
SELECT
  ish."itemId",
  i."readableId" AS "itemReadableId",
  i."name",
  i."name" AS "description",
  i."itemTrackingType",
  i."type",
  CASE
    WHEN i."thumbnailPath" IS NULL AND mu."thumbnailPath" IS NOT NULL THEN mu."thumbnailPath"
    ELSE i."thumbnailPath"
  END AS "thumbnailPath",
  i."unitOfMeasureCode",
  COALESCE(ils."quantityOnHandInShelf", 0) AS "quantityOnHandInShelf",
  COALESCE(ojis."quantityOnProductionDemandInShelf", 0) AS "quantityRequiredByShelf",
  ish."shelfId",
  s."name" AS "shelfName",
  COALESCE(pm."defaultShelfId" = ish."shelfId", false) AS "isDefaultShelf"
FROM
  items_with_activity ish
  INNER JOIN "item" i ON i."id" = ish."itemId"
  LEFT JOIN "shelf" s ON s."id" = ish."shelfId"
  LEFT JOIN item_ledgers_in_shelf ils ON i."id" = ils."ledgerItemId" AND ish."shelfId" IS NOT DISTINCT FROM ils."shelfId"
  LEFT JOIN open_job_requirements_in_shelf ojis ON i."id" = ojis."itemId" AND ish."shelfId" IS NOT DISTINCT FROM ojis."shelfId"
  LEFT JOIN "modelUpload" mu ON mu.id = i."modelUploadId"
  LEFT JOIN "pickMethod" pm ON pm."itemId" = i."id" AND pm."locationId" = location_id
ORDER BY (COALESCE(ils."quantityOnHandInShelf", 0) - COALESCE(ojis."quantityOnProductionDemandInShelf", 0)) ASC;
  END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


DROP FUNCTION IF EXISTS get_item_shelf_requirements_by_location_and_item;
CREATE OR REPLACE FUNCTION get_item_shelf_requirements_by_location_and_item(company_id TEXT, location_id TEXT, item_id TEXT DEFAULT NULL)
  RETURNS TABLE (
    "itemId" TEXT,
    "itemReadableId" TEXT,
    "name" TEXT,
    "description" TEXT,
    "itemTrackingType" "itemTrackingType",
    "type" "itemType",
    "thumbnailPath" TEXT,
    "unitOfMeasureCode" TEXT,
    "quantityOnHandInShelf" NUMERIC,
    "quantityRequiredByShelf" NUMERIC,
    "shelfId" TEXT,
    "shelfName" TEXT,
    "isDefaultShelf" BOOLEAN
  ) AS $$
  BEGIN
    RETURN QUERY
    
WITH
  item_shelves AS (
    SELECT DISTINCT
      il."itemId",
      il."shelfId"
    FROM "itemLedger" il
    WHERE il."companyId" = company_id
      AND il."locationId" = location_id
      AND (item_id IS NULL OR il."itemId" = item_id)
  ),
  open_job_requirements_in_shelf AS (
    SELECT 
      jm."itemId",
      jm."shelfId",
      SUM(jm."quantityToIssue") AS "quantityOnProductionDemandInShelf"
    FROM "jobMaterial" jm
    INNER JOIN "job" j ON jm."jobId" = j."id"
    WHERE j."status" IN (
        'Planned',
        'Ready',
        'In Progress',
        'Paused'
      )
    AND jm."methodType" != 'Make'
    AND j."companyId" = company_id
    AND j."locationId" = location_id
    AND (item_id IS NULL OR jm."itemId" = item_id)
    GROUP BY jm."itemId", jm."shelfId"
  ),
  item_ledgers_in_shelf AS (
    SELECT 
      il."itemId" AS "ledgerItemId",
      il."shelfId",
      SUM(il."quantity") AS "quantityOnHandInShelf"
    FROM "itemLedger" il
    WHERE il."companyId" = company_id
      AND il."locationId" = location_id
      AND (item_id IS NULL OR il."itemId" = item_id)
    GROUP BY il."itemId", il."shelfId"
  ),
  items_with_activity AS (
    SELECT DISTINCT active_items."itemId", active_items."shelfId"
    FROM (
      SELECT ils."ledgerItemId" AS "itemId", ils."shelfId"
      FROM item_ledgers_in_shelf ils
      WHERE ils."quantityOnHandInShelf" > 0

      UNION

      SELECT ojis."itemId", ojis."shelfId"
      FROM open_job_requirements_in_shelf ojis
      WHERE ojis."quantityOnProductionDemandInShelf" > 0
    ) active_items
  )
  
SELECT
  ish."itemId",
  i."readableId" AS "itemReadableId",
  i."name",
  i."name" AS "description",
  i."itemTrackingType",
  i."type",
  CASE
    WHEN i."thumbnailPath" IS NULL AND mu."thumbnailPath" IS NOT NULL THEN mu."thumbnailPath"
    ELSE i."thumbnailPath"
  END AS "thumbnailPath",
  i."unitOfMeasureCode",
  COALESCE(ils."quantityOnHandInShelf", 0) AS "quantityOnHandInShelf",
  COALESCE(ojis."quantityOnProductionDemandInShelf", 0) AS "quantityRequiredByShelf",
  ish."shelfId",
  s."name" AS "shelfName",
  COALESCE(pm."defaultShelfId" = ish."shelfId", false) AS "isDefaultShelf"
FROM
  items_with_activity ish
  INNER JOIN "item" i ON i."id" = ish."itemId"
  LEFT JOIN "shelf" s ON s."id" = ish."shelfId"
  LEFT JOIN item_ledgers_in_shelf ils ON i."id" = ils."ledgerItemId" AND ish."shelfId" IS NOT DISTINCT FROM ils."shelfId"
  LEFT JOIN open_job_requirements_in_shelf ojis ON i."id" = ojis."itemId" AND ish."shelfId" IS NOT DISTINCT FROM ojis."shelfId"
  LEFT JOIN "modelUpload" mu ON mu.id = i."modelUploadId"
  LEFT JOIN "pickMethod" pm ON pm."itemId" = i."id" AND pm."locationId" = location_id
ORDER BY (COALESCE(ils."quantityOnHandInShelf", 0) - COALESCE(ojis."quantityOnProductionDemandInShelf", 0)) DESC;
  END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
