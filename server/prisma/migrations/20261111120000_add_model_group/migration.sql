-- 模型分组（选择器分区展示）：存量模型按名称/展示名自动归类
ALTER TABLE "ModelConfig" ADD COLUMN "group" TEXT NOT NULL DEFAULT '';

UPDATE "ModelConfig" SET "group" = CASE
  WHEN lower(name) LIKE '%gpt%' OR lower("displayName") LIKE '%gpt%' THEN 'GPT'
  WHEN lower(name) LIKE '%grok%' OR lower("displayName") LIKE '%grok%' THEN 'Grok'
  WHEN lower(name) LIKE '%seedream%' OR lower("displayName") LIKE '%seedream%' THEN 'Seedream'
  WHEN lower(name) LIKE '%gemini%' OR lower("displayName") LIKE '%gemini%'
    OR lower(name) LIKE '%banana%' OR lower("displayName") LIKE '%banana%' THEN 'Gemini'
  ELSE '其他'
END;
