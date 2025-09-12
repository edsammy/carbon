CREATE TABLE "kanban" (
  "id" TEXT NOT NULL DEFAULT id('kb'),
  "itemId" TEXT NOT NULL,
  "replenishmentSystem" "itemReplenishmentSystem" NOT NULL DEFAULT 'Buy',
  "quantity" INTEGER NOT NULL,
  "locationId" TEXT NOT NULL,
  "shelfId" TEXT,
  "companyId" TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "createdBy" TEXT NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE,
  "updatedBy" TEXT,
  
  CONSTRAINT "kanban_pkey" PRIMARY KEY ("id", "companyId"),
  CONSTRAINT "kanban_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE CASCADE,
  CONSTRAINT "kanban_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "location"("id") ON DELETE CASCADE,
  CONSTRAINT "kanban_shelfId_fkey" FOREIGN KEY ("shelfId") REFERENCES "shelf"("id") ON DELETE CASCADE,
  CONSTRAINT "kanban_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE,
  CONSTRAINT "kanban_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE CASCADE,
  CONSTRAINT "kanban_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE INDEX "kanban_itemId_idx" ON "kanban" ("itemId");
CREATE INDEX "kanban_locationId_idx" ON "kanban" ("companyId", "locationId");
CREATE INDEX "kanban_companyId_idx" ON "kanban" ("companyId");

ALTER TABLE "kanban" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SELECT" ON "public"."kanban"
FOR SELECT USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_role()
    )::text[]
  )
);

CREATE POLICY "INSERT" ON "public"."kanban"
FOR INSERT WITH CHECK (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission ('inventory_create')
    )::text[]
  )
);

CREATE POLICY "UPDATE" ON "public"."kanban"
FOR UPDATE USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission ('inventory_update')
    )::text[]
  )
);

CREATE POLICY "DELETE" ON "public"."kanban"
FOR DELETE USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission ('inventory_delete')
    )::text[]
  )
);

DROP VIEW IF EXISTS "kanbans";
CREATE VIEW "kanbans" WITH(SECURITY_INVOKER=true) AS
SELECT
  k.*,
  i.name,
  i."readableIdWithRevision",
  l.name as "locationName"
FROM "kanban" k
JOIN "item" i ON k."itemId" = i."id"
JOIN "location" l ON k."locationId" = l."id";