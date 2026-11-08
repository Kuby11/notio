-- Demo data for pages-service for local development.
-- Identifiers are fixed so the demo pages are predictable.
-- The workspace arrives with Stage 3 (workspace-service); for now it is just an id.

DELETE FROM blocks;
DELETE FROM pages;

INSERT INTO pages (id, workspace_id, parent_id, title, icon, cover_file_id, position, is_favorite, is_trashed, created_by, created_at, updated_at)
VALUES
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-000000000001', NULL, 'Roadmap', '🗺️', NULL, 'a0', 1, 0, '00000000-0000-4000-8000-00000000000a', '2026-10-18T12:00:00.000Z', '2026-10-18T12:00:00.000Z'),
  ('11111111-1111-4111-8111-111111111112', '00000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Stage 0. Foundation', '🧱', NULL, 'a0', 0, 0, '00000000-0000-4000-8000-00000000000a', '2026-10-18T12:00:00.000Z', '2026-10-18T12:00:00.000Z'),
  ('11111111-1111-4111-8111-111111111113', '00000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Ideas', '💡', NULL, 'a1', 0, 0, '00000000-0000-4000-8000-00000000000a', '2026-10-18T12:00:00.000Z', '2026-10-18T12:00:00.000Z');

INSERT INTO blocks (id, page_id, type, position, content, created_at, updated_at)
VALUES
  ('22222222-2222-4222-8222-222222222221', '11111111-1111-4111-8111-111111111112', 'heading', 'a0', '{"type":"heading","level":2,"content":"Monorepo foundation"}', '2026-10-18T12:00:00.000Z', '2026-10-18T12:00:00.000Z'),
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111112', 'paragraph', 'a0', '{"type":"paragraph","content":"pnpm workspaces, Turborepo, oxlint and oxfmt."}', '2026-10-18T12:00:00.000Z', '2026-10-18T12:00:00.000Z'),
  ('22222222-2222-4222-8222-222222222223', '11111111-1111-4111-8111-111111111112', 'toDo', 'a0', '{"type":"toDo","checked":true,"content":"Gateway responds on /api/health"}', '2026-10-18T12:00:00.000Z', '2026-10-18T12:00:00.000Z'),
  ('22222222-2222-4222-8222-222222222224', '11111111-1111-4111-8111-111111111112', 'toDo', 'a1', '{"type":"toDo","checked":false,"content":"Zod contracts in packages/contracts"}', '2026-10-18T12:00:00.000Z', '2026-10-18T12:00:00.000Z');