-- Демо-данные workspace-service для локальной разработки.
-- Идентификаторы фиксированы, чтобы демо-страницы из pages-service
-- ссылались на тот же workspace.
--
-- Владелец совпадает с created_by демо-страниц:
-- 00000000-0000-4000-8000-00000000000a.

DELETE FROM invitations;
DELETE FROM workspace_members;
DELETE FROM workspaces;

INSERT INTO workspaces (id, name, slug, icon, owner_id, archived_at, created_at, updated_at)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'notio', 'notio', '🗂️', '00000000-0000-4000-8000-00000000000a', NULL, '2026-10-18T12:00:00.000Z', '2026-10-18T12:00:00.000Z');

INSERT INTO workspace_members (workspace_id, user_id, role, created_at, updated_at)
VALUES
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 'owner', '2026-10-18T12:00:00.000Z', '2026-10-18T12:00:00.000Z');