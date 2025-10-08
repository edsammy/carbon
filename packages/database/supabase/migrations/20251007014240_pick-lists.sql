-- Add shelfId to methodMaterial table for pick-from location
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'methodMaterial' AND column_name = 'shelfId'
  ) THEN
    ALTER TABLE "methodMaterial" ADD COLUMN "shelfIds" JSONB NOT NULL DEFAULT '{}';
    
  END IF;
END $$;

-- Add shelfId to jobMaterial table for pick-from location
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobMaterial' AND column_name = 'shelfId'
  ) THEN
    ALTER TABLE "jobMaterial" ADD COLUMN "shelfId" TEXT;
    ALTER TABLE "jobMaterial" ADD CONSTRAINT "jobMaterial_shelfId_fkey"
      FOREIGN KEY ("shelfId") REFERENCES "shelf" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Add shelfId to quoteMaterial table for pick-from location
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quoteMaterial' AND column_name = 'shelfId'
  ) THEN
    ALTER TABLE "quoteMaterial" ADD COLUMN "shelfId" TEXT;
    ALTER TABLE "quoteMaterial" ADD CONSTRAINT "quoteMaterial_shelfId_fkey"
      FOREIGN KEY ("shelfId") REFERENCES "shelf" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Update jobMaterialWithMakeMethodId view to include shelfId
DROP VIEW IF EXISTS "jobMaterialWithMakeMethodId";
CREATE OR REPLACE VIEW "jobMaterialWithMakeMethodId" WITH(SECURITY_INVOKER=true) AS
  SELECT
    jm.*,
    jmm."id" AS "jobMaterialMakeMethodId",
    jmm.version AS "version",
    i."readableIdWithRevision" as "itemReadableId",
    i."readableId" as "itemReadableIdWithoutRevision"
  FROM "jobMaterial" jm
  LEFT JOIN "jobMakeMethod" jmm
    ON jmm."parentMaterialId" = jm."id"
  INNER JOIN "item" i ON i.id = jm."itemId";


DROP VIEW IF EXISTS "quoteMaterialWithMakeMethodId";
CREATE OR REPLACE VIEW "quoteMaterialWithMakeMethodId" WITH(SECURITY_INVOKER=true) AS
  SELECT 
    qm.*, 
    qmm."id" AS "quoteMaterialMakeMethodId",
    qmm.version AS "version"
  FROM "quoteMaterial" qm 
  LEFT JOIN "quoteMakeMethod" qmm 
    ON qmm."parentMaterialId" = qm."id";

-- Create pick list status enum
CREATE TYPE "pickListStatus" AS ENUM (
  'Draft',
  'Released',
  'In Progress',
  'Completed'
);


CREATE TABLE "pickList" (
  "id" TEXT NOT NULL DEFAULT xid(),
  "pickListId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "status" "pickListStatus" NOT NULL DEFAULT 'Draft',
  "createdDate" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "completedDate" TIMESTAMP WITH TIME ZONE,
  "companyId" TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "createdBy" TEXT NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE,
  "updatedBy" TEXT,
  "customFields" JSONB,
  "tags" TEXT[],

  CONSTRAINT "pickList_pkey" PRIMARY KEY ("id", "companyId"),
  CONSTRAINT "pickList_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pickList_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "pickList_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pickList_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "pickList_locationId_idx" ON "pickList" ("locationId");
CREATE INDEX "pickList_status_idx" ON "pickList" ("status");


CREATE POLICY "SELECT" ON "public"."pickList"
FOR SELECT USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_role()
    )::text[]
  )
);

CREATE POLICY "INSERT" ON "public"."pickList"
FOR INSERT WITH CHECK (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission ('inventory_create')
    )::text[]
  )
);

CREATE POLICY "UPDATE" ON "public"."pickList"
FOR UPDATE USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission ('inventory_update')
    )::text[]
  )
);

CREATE POLICY "DELETE" ON "public"."pickList"
FOR DELETE USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission ('inventory_delete')
    )::text[]
  )
);


CREATE TABLE "pickListLine" (
  "id" TEXT NOT NULL DEFAULT xid(),
  "pickListId" TEXT NOT NULL,
  "jobId" TEXT,
  "jobMaterialId" TEXT,
  "itemId" TEXT NOT NULL,
  "fromShelfId" TEXT,
  "toShelfId" TEXT,
  "quantity" NUMERIC(10, 4) NOT NULL DEFAULT 0,
  "pickedQuantity" NUMERIC(10, 4) NOT NULL DEFAULT 0,
  "companyId" TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "createdBy" TEXT NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE,
  "updatedBy" TEXT,

  CONSTRAINT "pickListLine_pkey" PRIMARY KEY ("id", "companyId"),
  CONSTRAINT "pickListLine_pickListId_fkey" FOREIGN KEY ("pickListId", "companyId") REFERENCES "pickList" ("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "pickListLine_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "job" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "pickListLine_jobMaterialId_fkey" FOREIGN KEY ("jobMaterialId") REFERENCES "jobMaterial" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "pickListLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pickListLine_fromShelfId_fkey" FOREIGN KEY ("fromShelfId") REFERENCES "shelf" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "pickListLine_toShelfId_fkey" FOREIGN KEY ("toShelfId") REFERENCES "shelf" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "pickListLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "pickListLine_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pickListLine_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "pickListLine_pickListId_idx" ON "pickListLine" ("pickListId");
CREATE INDEX "pickListLine_jobId_idx" ON "pickListLine" ("jobId");
CREATE INDEX "pickListLine_itemId_idx" ON "pickListLine" ("itemId");




CREATE POLICY "SELECT" ON "public"."pickListLine"
FOR SELECT USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_role()
    )::text[]
  )
);

CREATE POLICY "INSERT" ON "public"."pickListLine"
FOR INSERT WITH CHECK (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission ('inventory_create')
    )::text[]
  )
);

CREATE POLICY "UPDATE" ON "public"."pickListLine"
FOR UPDATE USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission ('inventory_update')
    )::text[]
  )
);

CREATE POLICY "DELETE" ON "public"."pickListLine"
FOR DELETE USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission ('inventory_delete')
    )::text[]
  )
);

