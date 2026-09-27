# 作成：Phase-4-5
# 写経レベル: コア ── docs/implementation_plan.md 4.2節「パフォーマンス・セキュリティ確認」の
# 実施内容そのもの。個々の判定ロジック自体(所有者チェック・認証)はPhase 2の各単体テストで
# 検証済みのため、ここでは実際のHTTPレイヤーを通して「エラーハンドラまで含めた配線」と
# 「攻撃的な入力に対する既存防御の再確認」を目的にする。
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.integration


async def _register_and_login(client: AsyncClient, email: str) -> str:
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "s3cret-pass", "full_name": "Security Checker"},
    )
    login_response = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": "s3cret-pass"}
    )
    return login_response.json()["access_token"]


async def _create_project(client: AsyncClient, token: str, *, system_overview: str) -> str:
    response = await client.post(
        "/api/v1/projects",
        headers={"Authorization": f"Bearer {token}"},
        data={"system_overview": system_overview, "goals_raw": "テスト"},
        files=[],
    )
    assert response.status_code == 201
    return response.json()["id"]


async def test_accessing_another_users_project_returns_404_not_403(client: AsyncClient) -> None:
    """他ユーザーのプロジェクトIDへアクセスした場合、存在の有無を漏らさないため403ではなく
    一律404(RESOURCE_NOT_FOUND)になることをHTTPレイヤーで確認する
    (app/api/deps.py get_current_project、既存の単体テストtest_deps_current_project.pyは
    依存関数を直接呼ぶのみでHTTP層のエラーハンドラ変換までは検証していなかった)。"""
    owner_token = await _register_and_login(client, "owner@example.com")
    project_id = await _create_project(client, owner_token, system_overview="オーナー専用システム")

    other_token = await _register_and_login(client, "intruder@example.com")
    response = await client.get(
        f"/api/v1/projects/{project_id}", headers={"Authorization": f"Bearer {other_token}"}
    )

    assert response.status_code == 404
    assert response.json() == {"detail": f"Project {project_id} not found", "code": "RESOURCE_NOT_FOUND"}


async def test_unauthenticated_request_returns_401_without_code_field(client: AsyncClient) -> None:
    """認証境界(app/api/deps.py get_current_user)は意図的にAppErrorの仕組みを使わず生の
    HTTPExceptionで401を返す(devex-api/CLAUDE.md「エラーハンドリングの設計」の例外規定)。
    レスポンスに`code`フィールドが含まれないことまで確認し、この設計が壊れていないことを保証する。"""
    response = await client.get("/api/v1/projects/00000000-0000-0000-0000-000000000000")

    assert response.status_code == 401
    body = response.json()
    assert "code" not in body


async def test_malformed_project_id_is_rejected_before_reaching_the_database(
    client: AsyncClient,
) -> None:
    """SQLインジェクションの古典的な単純ペイロードをパスパラメータ(project_id: uuid.UUID)に
    与えても、FastAPI/Pydanticの型検証がDBへ到達する前に拒否することを確認する
    (ORM層がすべてパラメータ化クエリのため生のSQL文字列結合箇所はそもそも存在しないが、
    それ以前の入口である型検証の防御も併せて確認する)。"""
    token = await _register_and_login(client, "typecheck@example.com")
    response = await client.get(
        "/api/v1/projects/1;DROP-TABLE-users;--",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 422  # uuid.UUIDへの変換失敗(FastAPIの標準的なバリデーションエラー)


async def test_sql_injection_style_text_is_stored_and_returned_verbatim(
    client: AsyncClient,
) -> None:
    """自由記述欄(system_overview)にSQLメタ文字を含む文字列を入れても、ORM(SQLAlchemy)の
    パラメータ化クエリにより文字列としてそのまま安全に保存・取得できることを確認する。
    あわせて、他のテーブル(users)が意図せず操作されていないこと(自分のプロジェクト一覧が
    通常どおり1件のままであること)も確認し、「実害が無いこと」を明示的に検証する。"""
    payload = "'; DROP TABLE users; --"
    token = await _register_and_login(client, "injection-check@example.com")
    project_id = await _create_project(client, token, system_overview=payload)

    detail_response = await client.get(
        f"/api/v1/projects/{project_id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert detail_response.status_code == 200
    assert detail_response.json()["intake"]["system_overview"] == payload

    list_response = await client.get(
        "/api/v1/projects", headers={"Authorization": f"Bearer {token}"}
    )
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1  # usersテーブル等、他への実害が無いことの間接確認
