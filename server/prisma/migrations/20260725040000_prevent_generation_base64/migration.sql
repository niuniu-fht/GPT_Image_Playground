-- Keep historical rows readable while preventing new image payloads from being
-- persisted in PostgreSQL. The constraints can be validated after legacy data
-- has been removed during a separate maintenance window.
ALTER TABLE "GenerationTask"
  ADD CONSTRAINT "GenerationTask_outputImages_no_data_url"
  CHECK (
    "outputImages" IS NULL
    OR NOT jsonb_path_exists("outputImages", '$[*] ? (@.dataUrl like_regex "^data:")')
  ) NOT VALID;

ALTER TABLE "GenerationTask"
  ADD CONSTRAINT "GenerationTask_outputPreviews_no_data_url"
  CHECK (
    "outputPreviews" IS NULL
    OR NOT jsonb_path_exists("outputPreviews", '$[*] ? (@.previewDataUrl like_regex "^data:")')
  ) NOT VALID;

ALTER TABLE "GenerationTask"
  ADD CONSTRAINT "GenerationTask_referencePreviews_no_data_url"
  CHECK (
    NOT jsonb_path_exists("params", '$._admin.referenceImages[*] ? (@.previewDataUrl like_regex "^data:")')
  ) NOT VALID;
