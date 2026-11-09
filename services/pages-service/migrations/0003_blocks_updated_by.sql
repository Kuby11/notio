ALTER TABLE `blocks` ADD `updated_by` text;

-- Existing blocks had no author column. Best effort: the page's creator is the
-- nearest known author, so the block menu is not empty for historical rows.
UPDATE `blocks`
SET `updated_by` = (SELECT `created_by` FROM `pages` WHERE `pages`.`id` = `blocks`.`page_id`)
WHERE `updated_by` IS NULL;
