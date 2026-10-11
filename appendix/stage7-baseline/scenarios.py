"""ステージ7のベースラインの変更シナリオと正解(人が判断した「見直しが要る要素」)。

正解は、変更の中身と段階の JSON を読んで Claude が付けた。理由は各シナリオの `reasons` に書く。
「見直しが要る」= 内容を直すか、直さなくてよいことを人が確かめる必要がある要素。
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Scenario:
    id: str
    title: str
    mode: str  # detailed / simple
    change: str  # 変更の中身
    changed: list[str]  # 変わった要素(グラフの節)
    bump_documents: tuple[str, ...] = ()  # 今の仕組みで版が上がる文書
    edit_stages: tuple[int, ...] = ()  # 今の仕組みで編集して承認し直す段階
    truth: dict[str, str] = field(default_factory=dict)  # 要素 → 見直しが要る理由
    # base = 試案の前に決めたシナリオ、holdout = 試案を作った後・ステージ7の実装の前に決めたシナリオ
    group: str = "base"


# 詳細設計モードの文書の再生成は、要件定義書と外部設計書を一度に作り直す(doc_generator_service.generate)
REGEN_DETAILED = ("requirements", "external_design")
REGEN_SIMPLE = ("requirements", "external_design", "internal_design", "implementation_plan")

SCENARIOS: list[Scenario] = [
    Scenario(
        id="S1",
        title="機能要件の変更(FR-011)",
        mode="detailed",
        change="AI 応答の失敗時、「再送を促す」から「自動で3回まで再試行し、だめなら再送を促す」に変える",
        changed=["FR-011"],
        bump_documents=REGEN_DETAILED,
        truth={
            "SCR-002": "再試行中の表示が要る",
            "F-02": "処理の概要に再試行が入るかを確かめる",
            "PROC F-02": "AI 呼び出しの失敗の分岐が変わる",
            "LOGIC services/chat.py:ChatService.send_message": "再試行の処理ロジック",
            "MOD clients/ai.py": "再試行をどの層に置くか(責務)",
            "UNIT M-02-T01": "確認方法(テスト観点)に再試行が入る",
        },
    ),
    Scenario(
        id="S2",
        title="非機能要件の変更(NFR-007)",
        mode="detailed",
        change="「本人以外が見られないようにする」を「ログイン必須、他人のプロジェクトは 404」に具体化する",
        changed=["NFR-007"],
        bump_documents=REGEN_DETAILED,
        truth={
            "CC 認証": "横断事項の認証の方針が NFR-007 の写し(要件ID を持たない)",
            "MOD app.py": "認証の DI を置くモジュール",
            "PROC F-02": "プロジェクトの持ち主の確かめが要る",
            "PROC F-03": "プロジェクトの持ち主の確かめが要る",
            "PROC F-04": "文書の持ち主の確かめと 404",
            "UNIT M-01-T01": "基盤の単位で認証を組む",
        },
    ),
    Scenario(
        id="S3",
        title="推測の要件を「採用にする」(CON-002)",
        mode="detailed",
        change="出どころを推測から採用にするだけ。中身は変えない(版は上がらない)",
        changed=["CON-002"],
        truth={},
    ),
    Scenario(
        id="S4",
        title="API の本文の変更(POST /api/v1/chats)",
        mode="detailed",
        change="本文に使うモデルの指定(model)を足す(外部設計書を再生成)",
        changed=["API POST /api/v1/chats"],
        bump_documents=REGEN_DETAILED,
        truth={
            "DFD F-02": "入力の項目が増える",
            "MOD api/routes/chats.py": "リクエストの検証",
            "MOD clients/ai.py": "モデルの指定を渡す",
            "PROC F-02": "引数の受け渡し",
            "LOGIC services/chat.py:ChatService.send_message": "引数とシグネチャ",
            "UNIT M-02-T01": "確認方法",
        },
    ),
    Scenario(
        id="S5",
        title="処理の変更(段階1の F-03)",
        mode="detailed",
        change="「4文書の一括生成」を「文書を1つずつ生成できる」に変える(段階1を編集して承認し直す)",
        changed=["F-03"],
        edit_stages=(1,),
        truth={
            "DFD F-03": "入力・出力が変わる",
            "CRUD F-03×projects": "読み書きを確かめる",
            "CRUD F-03×documents": "書き方が変わる",
            "MOD api/routes/documents.py": "入口の引数",
            "MOD services/document.py": "ユースケースの分け方",
            "MOD clients/ai.py": "1文書ずつの生成",
            "PROC F-03": "手順が変わる",
            "LOGIC services/document.py:DocumentService.generate_documents": "処理ロジックが変わる",
            "TASK M-03-T01": "単位の範囲を確かめる",
            "UNIT M-03-T01": "手順書が変わる",
        },
    ),
    Scenario(
        id="S6",
        title="テーブルの変更(段階3の documents)",
        mode="detailed",
        change="documents に文書の種類(doc_type)の列を足す(段階3を編集して承認し直す)",
        changed=["TABLE documents"],
        edit_stages=(3,),
        truth={
            "MOD repositories/document.py": "列の読み書き",
            "PROC F-03": "書き込む値",
            "LOGIC services/document.py:DocumentService.generate_documents": "doc_type を入れる",
            "UNIT M-03-T01": "確認方法",
        },
    ),
    Scenario(
        id="S7",
        title="モジュールの改名(段階4の services/chat.py)",
        mode="detailed",
        change="services/chat.py を services/chat_service.py に改名する(段階4を編集して承認し直す)",
        changed=["MOD services/chat.py"],
        edit_stages=(4,),
        truth={
            "MOD api/routes/chats.py": "依存先のパス",
            "PROC F-02": "呼び出し先のパス",
            "LOGIC services/chat.py:ChatService.send_message": "置き場のパス",
            "TASK M-02-T01": "単位のモジュールの一覧",
            "CC トランザクション": "横断事項のモジュールの一覧",
            "UNIT M-02-T01": "対象ファイル",
        },
    ),
    Scenario(
        id="S8",
        title="簡易モード: WBS のタスクの変更(M-04-T01)",
        mode="simple",
        change="M-04-T01 のモジュールを1つ足す(文書の再生成で4文書を作り直す)",
        changed=["TASK M-04-T01"],
        bump_documents=REGEN_SIMPLE,
        truth={"UNIT M-04-T01": "対象ファイルが変わる"},
    ),
    # ---- ここから holdout(41-2 の決定の後に足した。効果測定で試案を確かめるため)
    Scenario(
        id="N1",
        title="テーブルの変更(段階3の references)",
        mode="detailed",
        change="references にファイルの種類(file_type)の列を足す(段階3を編集して承認し直す)",
        changed=["TABLE references"],
        edit_stages=(3,),
        group="holdout",
        truth={
            "MOD repositories/reference.py": "列の読み書き",
            "PROC F-01": "書き込む値",
            "LOGIC services/project.py:ProjectService.create_project": "file_type を入れる",
            "UNIT M-01-T02": "確認方法",
        },
    ),
    Scenario(
        id="N2",
        title="機能要件の変更(FR-005)",
        mode="detailed",
        change="参考資料の上限を3件から5件にする(文書の再生成)",
        changed=["FR-005"],
        bump_documents=REGEN_DETAILED,
        group="holdout",
        truth={
            "SCR-001": "アップロードの上限の表示",
            "API POST /api/v1/projects": "files の上限",
            "F-01": "処理の概要を確かめる",
            "PROC F-01": "件数の検証の分岐",
            "LOGIC services/project.py:ProjectService.create_project": "件数の検証",
            "UNIT M-01-T02": "確認方法",
        },
    ),
    Scenario(
        id="N3",
        title="API の応答の変更(GET /api/v1/documents/{id}。キーはパスの変数を {} にそろえる)",
        mode="detailed",
        change="応答に版番号(version)を足す(外部設計書を再生成)",
        changed=["API GET /api/v1/documents/{}"],
        bump_documents=REGEN_DETAILED,
        group="holdout",
        truth={
            "DFD F-04": "出力の項目が増える",
            "MOD api/routes/documents.py": "応答のスキーマ",
            "PROC F-04": "返す値",
            "LOGIC services/document.py:DocumentService.get_document": "戻り値",
            "UNIT M-03-T02": "確認方法",
        },
    ),
    Scenario(
        id="N4",
        title="簡易モード: 機能要件の変更(FR-005)",
        mode="simple",
        change="参考資料の上限を3件から5件にする(文書の再生成で4文書を作り直す)",
        changed=["FR-005"],
        bump_documents=REGEN_SIMPLE,
        group="holdout",
        truth={
            "TASK M-02-T01": "WBS のタスクが FR-005 を持つ",
            "UNIT M-02-T01": "参考資料の検証の手順",
        },
    ),
]
