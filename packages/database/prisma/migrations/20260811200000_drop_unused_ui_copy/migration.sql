-- Drops the original Phase 0 `UiCopy` model. It was superseded by
-- `UiCopyOverride` (the copy editor actually shipped against, Phase 8)
-- before anything ever wrote to it -- grep confirms zero references
-- anywhere outside this table's own definition and creation migration.
-- Safe to drop outright: nothing in the app has ever read or written a
-- row here.

DROP TABLE "UiCopy";
