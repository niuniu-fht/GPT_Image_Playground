-- Remove legacy image payloads while preserving task metadata and non-data URL
-- delivery paths created by the current generation workflow. All affected JSON
-- columns are updated together because NOT VALID constraints still protect
-- every row changed after the constraints were created.
UPDATE "GenerationTask"
SET
  "outputImages" = CASE
    WHEN jsonb_typeof("outputImages") = 'array'
      AND jsonb_path_exists("outputImages", '$[*] ? (@.dataUrl like_regex "^data:")')
      THEN (
        SELECT COALESCE(
          jsonb_agg(
            CASE
              WHEN jsonb_typeof(image.value) = 'object'
                AND COALESCE(image.value ->> 'dataUrl', '') LIKE 'data:%'
                THEN image.value - 'dataUrl'
              ELSE image.value
            END
            ORDER BY image.ordinality
          ),
          '[]'::jsonb
        )
        FROM jsonb_array_elements("GenerationTask"."outputImages")
          WITH ORDINALITY AS image(value, ordinality)
      )
    ELSE "outputImages"
  END,
  "outputPreviews" = CASE
    WHEN jsonb_typeof("outputPreviews") = 'array'
      AND jsonb_path_exists("outputPreviews", '$[*] ? (@.previewDataUrl like_regex "^data:")')
      THEN (
        SELECT COALESCE(
          jsonb_agg(
            CASE
              WHEN jsonb_typeof(preview.value) = 'object'
                AND COALESCE(preview.value ->> 'previewDataUrl', '') LIKE 'data:%'
                THEN preview.value - 'previewDataUrl'
              ELSE preview.value
            END
            ORDER BY preview.ordinality
          ),
          '[]'::jsonb
        )
        FROM jsonb_array_elements("GenerationTask"."outputPreviews")
          WITH ORDINALITY AS preview(value, ordinality)
      )
    ELSE "outputPreviews"
  END,
  "params" = CASE
    WHEN jsonb_typeof("params" #> '{_admin,referenceImages}') = 'array'
      AND jsonb_path_exists("params", '$._admin.referenceImages[*] ? (@.previewDataUrl like_regex "^data:")')
      THEN jsonb_set(
        "params",
        '{_admin,referenceImages}',
        (
          SELECT COALESCE(
            jsonb_agg(
              CASE
                WHEN jsonb_typeof(reference.value) = 'object'
                  AND COALESCE(reference.value ->> 'previewDataUrl', '') LIKE 'data:%'
                  THEN reference.value - 'previewDataUrl'
                ELSE reference.value
              END
              ORDER BY reference.ordinality
            ),
            '[]'::jsonb
          )
          FROM jsonb_array_elements("GenerationTask"."params" #> '{_admin,referenceImages}')
            WITH ORDINALITY AS reference(value, ordinality)
        ),
        false
      )
    ELSE "params"
  END
WHERE
  (
    jsonb_typeof("outputImages") = 'array'
    AND jsonb_path_exists("outputImages", '$[*] ? (@.dataUrl like_regex "^data:")')
  )
  OR (
    jsonb_typeof("outputPreviews") = 'array'
    AND jsonb_path_exists("outputPreviews", '$[*] ? (@.previewDataUrl like_regex "^data:")')
  )
  OR (
    jsonb_typeof("params" #> '{_admin,referenceImages}') = 'array'
    AND jsonb_path_exists("params", '$._admin.referenceImages[*] ? (@.previewDataUrl like_regex "^data:")')
  );

-- The preceding migration added these constraints as NOT VALID so new writes
-- were protected immediately. The legacy rows are clean now, so validate the
-- complete table as well.
ALTER TABLE "GenerationTask"
  VALIDATE CONSTRAINT "GenerationTask_outputImages_no_data_url";

ALTER TABLE "GenerationTask"
  VALIDATE CONSTRAINT "GenerationTask_outputPreviews_no_data_url";

ALTER TABLE "GenerationTask"
  VALIDATE CONSTRAINT "GenerationTask_referencePreviews_no_data_url";
