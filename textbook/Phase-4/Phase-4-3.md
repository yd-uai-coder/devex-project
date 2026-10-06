# Phase-4-3: E2Eテスト基盤構築(Playwright導入 + Fake LLMモード)

## この章の目的

`docs/implementation_plan.md` 4.2節が定義するE2Eテスト(「ログイン→プロジェクト作成→チャットヒアリング→設計書生成→ダウンロード」)を、実ブラウザで検証できる基盤を作る。devex-uiにPlaywrightを導入し、devex-apiに「実際のGemini APIを一切呼ばず、決定論的な応答を返すFake LLMモード」を新設する。この章はテストシナリオ自体([`Phase-4-4.md`](./Phase-4-4.md))を書くための土台であり、本章では基盤(設定・スタブ・安全策)のみを扱う。

自動実装モード: off([introduction](./Phase-4-introduction.md) 参照)。

サンプルは [`textbook/samples/backend/`](../samples/backend/)・[`textbook/samples/frontend/`](../samples/frontend/) に追加・更新した。写経前提として[`Phase-4-1.md`](./Phase-4-1.md)・[`Phase-4-2.md`](./Phase-4-2.md)の写経が完了していること。

## この章で作成・更新したファイル

写経順序は依存順(CLAUDE.md #30)。バックエンド→フロントエンドの順(バックエンドのFake LLMモードが無いとフロントエンドのE2Eテストは動かせないため)。テストはまとめて表の末尾に置いている。

| ファイル | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`devex-api/backend/app/core/config.py`](../samples/backend/app/core/config.py) | 更新(初のsamples反映、CLAUDE.md #29) | コア | `E2E_FAKE_LLM`・`LLM_TIMEOUT_SECONDS`を追加。`E2E_FAKE_LLM=true`かつ`ENVIRONMENT=production`の組み合わせを起動時に拒否するバリデーションを追加 |
| [`devex-api/backend/app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | 新規 | コア | `E2eFakeLLM`(ブラウザE2E専用の決定論的LLMスタブ) |
| [`devex-api/backend/app/ai/llm/gemini.py`](../samples/backend/app/ai/llm/gemini.py) | 更新 | コア | `get_gemini_llm`に`E2E_FAKE_LLM`分岐+実クライアントへの`timeout`明示を追加 |
| [`devex-api/docker-compose.e2e.yml`](../../devex-api/docker-compose.e2e.yml) | 新規(直接反映、下記「samplesに含めない理由」参照) | 定型 | `docker-compose.yml`に重ねて`E2E_FAKE_LLM=true`だけを上書きするオーバーレイ |
| [`devex-ui/playwright.config.ts`](../samples/frontend/playwright.config.ts) | 新規 | コア | devex-api(docker compose)・devex-ui(`next dev`)の2つを`webServer`として起動し、Chromiumで実行する設定 |
| [`devex-ui/package.json`](../samples/frontend/package.json) | 更新(初のsamples反映) | 定型 | `@playwright/test`devDependency・`test:e2e`スクリプトを追加 |
| ── ここからテスト(まとめて末尾) ── | | | |
| `tests/unit/test_gemini.py` | 更新 | 定型 | `E2E_FAKE_LLM`分岐・`timeout`配線の単体テストを追加 |
| `tests/unit/test_fake_llm_e2e.py` | 新規 | コア | `E2eFakeLLM`のメッセージ判別ロジックの単体テスト(下記「実機検証で発見した2件の不具合」参照。当初は追加しない判断だったが撤回した) |

## samplesに含めない理由: `docker-compose.e2e.yml`

CLAUDE.md #3の原則(AIはsamples+教材のみ作成し、実リポジトリのファイルには触れない)には例外が1つ既にある。[`Phase-1-introduction.md`](../Phase-1/Phase-1-introduction.md)が定めたとおり、`docker-compose.yml`・`.env.example`のようなリポジトリ直下(`backend/`の外)のインフラ設定ファイルは、写経(ドメインロジックをユーザーが手で書き写す)の対象にならないため、samplesへミラーせず直接`devex-api`へ反映する運用としている。本章の`docker-compose.e2e.yml`も同じ性質(インフラ設定・ドメインロジック無し)のため、この前例に倣い直接`devex-api/`直下へ作成した(実ファイルは[`../../devex-api/docker-compose.e2e.yml`](../../devex-api/docker-compose.e2e.yml))。`app/`配下のPythonコード(`config.py`・`fake.py`・`gemini.py`)は通常どおりsamples経由の写経対象である。

## 主要な設計判断

### なぜ2つの「フェイクLLM」が併存するのか

[`Phase-4-1.md`](./Phase-4-1.md)の`test_projects_flow.py`は`pytest`の`monkeypatch`で`get_gemini_llm`をpytestプロセス内で直接差し替えている。一方、本章の`E2eFakeLLM`は環境変数`E2E_FAKE_LLM`経由でしか有効化できない。

この違いはテストの実行形態から来る。pytestの統合テストは`httpx.AsyncClient`+`ASGITransport`でFastAPIアプリを**同一プロセス内**で直接呼び出すため、Pythonの関数オブジェクトをその場で差し替えられる。対してPlaywrightは、`docker compose`で起動した**別プロセス**のdevex-apiを実際のHTTP経由で操作するだけであり、Pythonの関数を外部から差し替える経路が無い。そのため、プロセス起動時に固定される設定(環境変数)でしか制御できない。「テストがSUTと同じプロセスで動くか、外部から叩くだけか」によって、必要なテストダブルの注入手段が変わる、という点がこの章の核心的な設計判断である。

### `E2eFakeLLM`の応答生成方針: ステートレス・messages内容からの判別

`E2eFakeLLM`はテストコードから台本を注入されない(前述の理由)。そのため、`chat_service.py`/`doc_generator_service.py`が渡す`messages`引数(システムプロンプトの文言・`HumanMessage`の件数)だけを手がかりに、外部から一切設定されなくても意味のある応答を決定論的に組み立てる設計にした。

- ヒアリング完了判定(`with_structured_output(HearingCompletionCheck)`)は、末尾の1件(`check_completion`が追記する判定プロンプト自身)を除いた`HumanMessage`の件数が3件以上(初期ヒアリング入力1件+実際のチャット発話2件)になった時点で`is_sufficient=True`にする固定ロジック。実際の5条件判定(`chat_service.py`の`_COMPLETION_CHECK_PROMPT`)を模倣するものではなく、E2Eテストがハッピーパスを高速・決定論的に進められることを優先した値である。
- ドキュメント生成(`_generate_one`)は、システムプロンプトに含まれる「# N. ラベル」という見出し(doc_type固有の出力フォーマット指定)で、どのdoc_typeを要求されたかを判別し、それぞれ異なる固定Markdownを返す。これにより[`Phase-4-4.md`](./Phase-4-4.md)のE2Eテストは4つのタブそれぞれに異なる内容が表示されることまで確認できる。

### 実機検証で発見した2件の不具合(設計を1度撤回・修正した経緯)

当初、`_TURNS_UNTIL_SUFFICIENT`は「`HumanMessage`が2件以上」、doc_type判別は「システムプロンプトに`_DOC_TYPE_LABELS`の裸のラベル文字列(「要件定義書」等)が含まれるか」という単純な設計にしていた。CLAUDE.md #9(反映後は実プロジェクトの環境で実行確認する)に従い、`docker-compose.e2e.yml`を実際に適用したdevex-apiコンテナに対して`curl`でプロジェクト作成→チャット→完了判定→生成→ダウンロードまでの一連を実行したところ、2件の不具合が見つかった。

1. **完了判定が実際のチャット発話0件でも`is_sufficient=true`になっていた**: `chat_service.check_completion`は`messages`の末尾に`_COMPLETION_CHECK_PROMPT`自身のHumanMessageを追記する。初期ヒアリング入力(1件)+この末尾の1件=2件で、実際のユーザー発話が1つも無い時点で閾値(2件)に達してしまっていた。末尾の1件を除外し、閾値を3件(初期ヒアリング入力1件+実際のチャット発話2件)に修正した。
2. **外部設計書・内部設計書の生成内容が両方とも「要件定義書」になっていた**: `doc_generator_service.py`の各doc_type専用プロンプトは、他doc_typeへの入力参照を「以下の【要件定義書】および【外部設計書】に基づき...」のような角括弧表記で行う。裸のラベル文字列でマッチさせると、internal_design向けのプロンプト(要件定義書・外部設計書の両方のラベルを本文に含む)が最初に登録された`requirements`のラベルに誤ってマッチしてしまっていた。各プロンプトが自分自身の出力フォーマットとして持つ「# N. ラベル」という見出し(cross-reference表記には現れない、doc_type固有の文字列)へマッチ対象を変更した。

この2件はいずれも「Playwrightの実行でしか検知できない」性質のバグではなく、`messages`の組み立てさえ再現できればpytestレベルで安価に検知できるロジックだった。当初「Playwrightのテスト自体が唯一かつ最も現実に近い検証手段であり、追加の単体テストは同じロジックを2つの方法で検証するだけ」という判断で単体テストを見送っていたが、この発見を受けて判断を撤回し、`tests/unit/test_fake_llm_e2e.py`を追加した(CLAUDE.md #12の「撤回」記録に相当する)。

### `get_gemini_llm`の戻り値の型を`Any`に緩めた判断

`E2eFakeLLM`はLangChainの`Runnable`を継承しない軽量スタブ(`astream`/`ainvoke`/`with_structured_output().ainvoke`の3メソッドのみ実装)であり、`ChatGoogleGenerativeAI`と共通の基底型を持たない。`chat_service.py`/`doc_generator_service.py`側は元々`llm=None`のダックタイピングで受け取っており、この変更による実質的な型安全性の後退は無いと判断し、`get_gemini_llm`の戻り値型を`ChatGoogleGenerativeAI`固定から`Any`へ緩めた。

### 本番誤有効化に対する二重の防御

`E2E_FAKE_LLM=true`が本番環境で有効化されると、AIが実際には応答していないのに応答しているかのように振る舞う(利用者に実害のある種類の事故)。これを防ぐため2段構えにした。

1. `app/core/config.py`の`Settings._reject_unsafe_production_settings`(Phase 1由来の既存バリデータ)に、`ENVIRONMENT=production`かつ`E2E_FAKE_LLM=true`の組み合わせを拒否する分岐を追加した(既存の`DEBUG`・`JWT_SECRET_KEY`チェックと同じ仕組み)。起動時に落ちるため、気づかれないまま本番運用され続けるリスクが無い。
2. `docker-compose.e2e.yml`は`docker-compose.prod.yml`とは独立したオーバーレイであり、本番運用の起動コマンドには一切登場しない。

### `get_gemini_llm`への`timeout`明示(パフォーマンス確認との関連)

本章の実機検証の過程で、`ChatGoogleGenerativeAI`に`timeout`(langchain-google-genaiの`timeout`パラメータ、既定`None`=無制限)を渡していなかったことに気づいた。`invoke_with_retry`(Phase 2-5)のリトライは**例外が発生した場合のみ**働く仕組みであり、応答がハングして例外すら発生しない場合には無力である。`settings.LLM_TIMEOUT_SECONDS`(既定60秒)を実クライアント構築時に渡すよう修正した。この発見と対応の詳細な検証(実際にタイムアウトさせた場合の挙動確認)は[`Phase-4-5.md`](./Phase-4-5.md)で扱う。

## テスト観点

SUT(テスト対象)/ドライバ(テストコード)/スタブ(テストダブル)の用語は[`Phase-2-3.md`](../Phase-2/Phase-2-3.md)で既出のためここでは関係の明記のみ行う。

### `get_gemini_llm`のE2E_FAKE_LLM分岐

- SUT: `app.ai.llm.gemini.get_gemini_llm`
- ドライバ: `tests/unit/test_gemini.py`
- スタブ: 不要(`monkeypatch`で`settings.E2E_FAKE_LLM`/`settings.LLM_TIMEOUT_SECONDS`の値そのものを差し替えるのみで、外部依存の呼び出しは発生しない。`ChatGoogleGenerativeAI`の構築はネットワーク呼び出しを伴わないコンストラクタ呼び出しのみのため、モックせずそのまま検証する)。

### `E2eFakeLLM`のメッセージ判別ロジック

- SUT: `app.ai.llm.fake.E2eFakeLLM`・`_FakeStructuredE2e`
- ドライバ: `tests/unit/test_fake_llm_e2e.py`
- スタブ: 不要(`E2eFakeLLM`自体が外部依存を持たない純粋なロジックであり、`doc_generator_service.py`の実際の`_DOC_TYPE_PROMPTS`を直接importして本物のプロンプト文字列でテストしている ── 上記の不具合(2)がまさに「テストコード側で単純化したダミーのプロンプト文字列を使っていたら検知できなかった」種類のバグだったため、本物のプロンプトでテストすることを意識した)。

## 動作確認(このセッション内で実施)

- `uv run pytest tests/unit/test_gemini.py tests/unit/test_fake_llm_e2e.py`で12件green(`test_gemini.py`5件[既存3件+本章追加2件]+`test_fake_llm_e2e.py`7件)、`uv run pytest tests/unit`で125件green(Phase 4完了時点の最終件数)、`uvx pyright`で0エラー。
- `docker-compose.e2e.yml`は`devex-api`側の運用ファイル(#3の例外)であるため既にリポジトリへ直接反映済み。`docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d backend`でbackendコンテナを起動し、`docker compose exec backend env | grep E2E_FAKE_LLM`で`E2E_FAKE_LLM=true`が実際にコンテナ内へ渡っていること、`curl http://localhost:8000/health`が`{"status":"ok",...}`を返すことを確認した。
- **バックエンド側のFake LLMモードは、Playwright(ブラウザ)を介さず`curl`で実際にHTTP経由の一連のフロー(登録→ログイン→プロジェクト作成→チャット2往復→完了判定→生成トリガー→ドキュメント一覧→ダウンロード)を通し、実際にE2eFakeLLMが応答していること・4種の文書が正しく判別されていることを直接確認した**(上記「実機検証で発見した2件の不具合」はこの過程で見つかったもの)。ブラウザ(Playwright)からの実行そのものは[`Phase-4-4.md`](./Phase-4-4.md)で扱う。
- 検証中、統合テスト(`tests/integration/conftest.py`、[`Phase-4-1.md`](./Phase-4-1.md)参照)と実行時のdocker composeが同じPostgresデータベース(`DATABASE_URL`)を共有しているため、pytestの`Base.metadata.drop_all`が開発用DBのスキーマも一緒に破棄してしまう場面があった。`uv run alembic upgrade head`で復元し、検証後は`devex-api/backend`のコード・`docker compose`の起動設定(`E2E_FAKE_LLM`無し)ともに元の状態に戻してある(`docker-compose.e2e.yml`ファイル自体は#3の例外として残る)。

## Phase 4-3全体としての既知の残課題

- `playwright.config.ts`の`webServer`は`workers: 1`(直列実行)固定にしている。docker composeバックエンド(1プロセス・1つのPostgres)を複数テストが同時に叩くと、ユーザー登録のメール重複等で干渉する恐れがあるための保守的な既定であり、テストの並列化はスコープ外とした。
- `docker compose ... up`(フォアグラウンド)は初回イメージビルドで数分かかることがある。`timeout: 180 * 1000`で対応しているが、環境によってはこれでも不足する可能性があり、その場合は各自`playwright.config.ts`の値を調整すること。
- ~~テスト用DBと開発用DBが同じ`DATABASE_URL`を指している(Phase 1由来の環境設計)ため、統合テストの実行が開発環境のスキーマに影響しうる点は、本Phaseでは是正せず既知の制約として申し送る(テスト用DBの分離はPhase 1の環境設計に踏み込む変更であり、本Phaseのスコープを超えるため)。~~
  **Phase 4完了後に対応済み**: 実際にこの制約が原因で開発用DBのスキーマが2度消失する事故が発生したため、`docker-compose.test.yml`(テスト専用DBへ`DATABASE_URL`を差し替えるオーバーレイ)・`postgres-init/01-create-test-db.sh`(テストDB自動作成)を追加して分離した。詳細は[`decision-digest.md`](../decision-digest.md)「Phase 4完了後 ── 統合テスト用DBの分離」節、`devex-api/CLAUDE.md`「テストの分離」節参照。
