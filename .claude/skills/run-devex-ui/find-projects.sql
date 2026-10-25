-- 画面確認に使える、E2E が残したプロジェクト(利用者のパスワードは E2E の固定値 S3cret-pass)と CR の状態。
-- トレンド追跡アプリ(example-user@example.com)は効果測定の題材なので、確認に使わない。
select p.id, p.title, p.mode, u.email,
  coalesce(string_agg(c.number || ':' || c.status || (case when c.options is not null then '(案)' else '' end), ',' order by c.number), '') as crs
from projects p
join users u on u.id = p.user_id
left join change_requests c on c.project_id = p.id
where p.deleted_at is null and u.email like 'e2e-%'
group by p.id, u.email
order by p.created_at desc
limit 15;
