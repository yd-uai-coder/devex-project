# 作成：Phase-56-1｜更新：Phase-59-4,59-5,70-2
# Phase-59-5：更新(docstring: 表に本文の …_id・画面の操作・要件ごとの中身・失敗の要件を足し、理由を書いた)
"""必要なテストの一覧(純粋関数)。生成の入力に「必要なテスト」の表として渡し、AI が埋める。

どのテストを作るかを AI に任せると、安いモデルではテストの数が縮む(Phase 51 の測定)。そこで、
要件定義書・外部設計書の model から、技法ごとに作るべきテストをコードが決める:

| 観点 | 技法 | 元 |
|---|---|---|
| 正常 | 同値分割(有効なクラスの代表) | API ごとに1件 |
| 異常 | エラーの一覧の網羅 | API の「エラー」欄の HTTP ステータスごと(欄に無ければ1件) |
| 異常 | 認証 | パスに`{…}`を持ち、エラー欄に 401 が無い API(設計のどこかの API に 401 があるとき) |
| 境界 | 境界値分析 | 本文を持つ API(`BODY_METHODS`で、本文が「なし」でない) |
| セキュリティ | 認可 | パスに`{…}`か本文に`…_id`の項目(ほかの利用者のリソースを指す)を持つ API |
| セキュリティ | 認証 | 本文に`token`・`…_token`の項目(本文のトークンで本人を決める)を持つ API |
| 非機能 | ― | 非機能要件ごとに総合テスト1件(上限・回数を書く要件は、超えたときの表示も) |
| 異常 | 外部サービス | 外部サービスの上限・無料枠・料金を書く制約(CON)ごとに総合テスト1件 |
| 正常 | 状態遷移(主な経路) | Must の画面を通す流れの総合テスト1件 |
| 異常 | 画面の操作 | Must の画面ごとに総合テスト1件(入力の検証・空の送信・エラーの表示) |
| 正常 | 要件ベース | Must の機能要件ごとに総合テスト1件(API に結ばれていても、文の中身を確かめる) |
| 異常 | 要件ベース | 上のうち、文が失敗・中断を書く要件(失敗の後に保存されない・やり直せるか) |

API の形(パス・エラー欄)だけから決めると、要件の中身(コピー・ダウンロード・版の切り替えなど、
API に結ばれていても API の応答だけでは確かめられないもの)と、画面の操作のテストが落ちる。

一覧は生成の誘導だけに使う。決定的な検証(`validation.py`)は一覧と照らさない。
"""

# Phase-59-4:追記 ── app.detailed_design.api_list.error_statuses
import re
from collections.abc import Sequence
from dataclasses import dataclass

from app.detailed_design.api_list import error_statuses
from app.documents.external_design.model import BODY_METHODS, NO_BODY, ExternalDesignModel
from app.documents.requirements.model import RequirementsModel
from app.documents.test_spec.model import CaseLevel, Viewpoint

# Phase-59-4：削除(app/detailed_design/api_list.py へ移した)
# # エラー欄の HTTP ステータス(4xx・5xx)
# _STATUS = re.compile(r"(?<!\d)([45]\d\d)(?!\d)")
# Phase-59-5:追記
# 本文の項目のうち、ほかのリソースを ID で指すもの(`session_id`・`projectId`)
_BODY_ID = re.compile(r"(?<![A-Za-z0-9_])([a-z][A-Za-z0-9]*(?:_id|Id))(?![A-Za-z0-9_])")
# Phase-70-2:追記
# 本文の項目のうち、トークンで本人を決めるもの(`token`・`access_token`)
_BODY_TOKEN = re.compile(r"(?<![A-Za-z0-9_])((?:[a-z][A-Za-z0-9]*_)?token)(?![A-Za-z0-9_])")
# 上限・回数を書いた非機能要件の文(超えたときの応答と画面の表示もテストにする)
_LIMIT = re.compile(r"上限|回数|制限|レート|回/|回まで")
_LIMIT_NOTE = "上限を超えたときの応答と、画面での伝え方を確かめる"
# 外部サービスの上限を書いた制約の文
_EXTERNAL_LIMIT = re.compile(r"無料枠|上限|クォータ|料金|課金|レート|回数")
_EXTERNAL_LIMIT_NOTE = "外部サービスの上限超過・失敗のときの応答と画面の表示を確かめる"
# 失敗・中断の振る舞いを書いた要件の文
_FAILURE = re.compile(r"失敗|エラー|中断|タイムアウト|やり直|再試行|リトライ")
_FAILURE_NOTE = "失敗の後の状態(保存されない・やり直せる)を確かめる"
_SCREEN_OPERATION = "画面の操作: 入力の検証・空の送信・エラーの表示"


@dataclass(frozen=True)
class Obligation:
    """必要なテスト1件。`target`は API(`POST /api/v1/x`)か総合テストの対象。"""

    level: CaseLevel
    target: str
    viewpoint: Viewpoint
    reason: str
    req_ids: tuple[str, ...] = ()
    screens: tuple[str, ...] = ()
# Phase-59-4：削除(app/detailed_design/api_list.py へ移した)
#
#
# def error_statuses(errors: str) -> list[str]:
#     """API の「エラー」欄から HTTP ステータス(4xx・5xx)を、出てきた順・重複なしで取り出す。"""
#     return list(dict.fromkeys(_STATUS.findall(errors)))


def _api_obligations(external: ExternalDesignModel) -> list[Obligation]:
    result: list[Obligation] = []
    # Phase-70-2:追記
    # 設計のどこかで 401 を返すなら、ログインの要る API がある(`{…}`の API の未認証を確かめる)
    uses_auth = any("401" in error_statuses(api.errors) for api in external.apis)
    for api in external.apis:
        checks: list[tuple[Viewpoint, str]] = [("正常", "正しい入力で成功する")]
        statuses = error_statuses(api.errors)
        for status in statuses:
            checks.append(("異常", f"エラー欄の {status} を起こす"))
        if not statuses:
            checks.append(("異常", "エラー欄に HTTP ステータスが無い。失敗の扱いを確かめる"))
        # Phase-70-2:追記
        if uses_auth and "{" in api.path and "401" not in statuses:
            checks.append(("異常", "認証なしで呼ぶ(401)"))
        if api.method.upper() in BODY_METHODS and api.body.strip() != NO_BODY:
            checks.append(("境界", "本文の項目の下限・上限・空"))
        if "{" in api.path:
            checks.append(("セキュリティ", "ほかの利用者のリソースを指す"))
        # Phase-59-5:追記
        for name in body_ids(api.body):
            checks.append(("セキュリティ", f"本文の {name} でほかの利用者のリソースを指す"))
        # Phase-70-2:追記
        for name in body_tokens(api.body):
            checks.append(("セキュリティ", f"本文の {name} をほかの利用者のもの・無効なものにする"))
        reqs, screens = tuple(api.req_ids), tuple(api.screens)
        result += [
            Obligation("integration", api.label, viewpoint, reason, reqs, screens)
            for viewpoint, reason in checks
        ]
    return result


# Phase-59-5:追記
def body_ids(body: str) -> list[str]:
    """API の本文から、ほかのリソースを ID で指す項目の名前を、出てきた順・重複なしで取り出す。"""
    return list(dict.fromkeys(_BODY_ID.findall(body)))


# Phase-70-2:追記
def body_tokens(body: str) -> list[str]:
    """API の本文から、トークンで本人を決める項目の名前を、出てきた順・重複なしで取り出す。"""
    return list(dict.fromkeys(_BODY_TOKEN.findall(body)))


def _system_obligations(
    requirements: RequirementsModel | None, external: ExternalDesignModel
) -> list[Obligation]:
    result: list[Obligation] = []
    must_screens = [s for s in external.screens if s.priority == "Must"]
    if must_screens:
        result.append(
            Obligation(
                "system",
                " → ".join(s.id for s in must_screens),
                "正常",
                "Must の画面を通す主な流れ",
                tuple(dict.fromkeys(r for s in must_screens for r in s.req_ids)),
                tuple(s.id for s in must_screens),
            )
        )
    # Phase-59-5:追記
    for screen in must_screens:
        result.append(
            Obligation(
                "system",
                screen.id,
                "異常",
                _SCREEN_OPERATION,
                tuple(screen.req_ids),
                (screen.id,),
            )
        )
    if requirements is None:
        return result
    for row in requirements.rows:
        if row.kind == "NFR":
            # Phase-70-2:追記
            reason = f"{row.text}。{_LIMIT_NOTE}" if _LIMIT.search(row.text) else row.text
            result.append(
                # Phase-70-2：更新
                # Obligation("system", row.category or "非機能", "非機能", row.text, (row.id,))
                # ↓↓
                Obligation("system", row.category or "非機能", "非機能", reason, (row.id,))
            )
    # Phase-59-5：削除
    # linked = {r for a in external.apis for r in a.req_ids} | {
    #     r for s in external.screens for r in s.req_ids
    # }
    # Phase-70-2:追記
    for row in requirements.rows:
        if row.kind == "CON" and _EXTERNAL_LIMIT.search(row.text):
            reason = f"{row.text}。{_EXTERNAL_LIMIT_NOTE}"
            result.append(Obligation("system", row.id, "異常", reason, (row.id,)))
    for row in requirements.rows:
        # Phase-59-5：更新
        # if row.kind == "FR" and row.priority == "Must" and row.id not in linked:
        #     reason = f"API・画面に無い Must の要件: {row.text}"
        #     result.append(Obligation("system", row.id, "正常", reason, (row.id,)))
        # ↓↓
        if row.kind == "FR" and row.priority == "Must":
            result.append(_requirement_obligation(row.id, row.text, external))
    return result


# Phase-59-5:追記
def _requirement_obligation(req_id: str, text: str, external: ExternalDesignModel) -> Obligation:
    """Must の機能要件1つの中身のテスト。失敗・中断を書く要件は、失敗の後の状態を確かめる。"""
    screens = tuple(s.id for s in external.screens if req_id in s.req_ids)
    linked = screens or any(req_id in a.req_ids for a in external.apis)
    reason = f"要件の中身: {text}" if linked else f"API・画面に無い Must の要件: {text}"
    if _FAILURE.search(text):
        reason = f"{reason}。{_FAILURE_NOTE}"
        return Obligation("system", req_id, "異常", reason, (req_id,), screens)
    return Obligation("system", req_id, "正常", reason, (req_id,), screens)


def required_tests(
    requirements: RequirementsModel | None, external: ExternalDesignModel
) -> list[Obligation]:
    """必要なテストの一覧(結合 → 総合の順)。"""
    return [*_api_obligations(external), *_system_obligations(requirements, external)]


def obligation_rows(obligations: Sequence[Obligation]) -> list[str]:
    """生成の入力に渡す表の行(`種類|対象|観点|理由|要件|画面`)。"""
    labels = {"integration": "結合", "system": "総合"}
    return [
        "|".join(
            (
                labels[o.level],
                o.target,
                o.viewpoint,
                o.reason,
                "・".join(o.req_ids) or "—",
                "・".join(o.screens) or "—",
            )
        )
        for o in obligations
    ]
