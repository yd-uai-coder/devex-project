# 決定ダイジェスト

後の Phase に前向きに効く決定・知見だけを圧縮して記録する(#24)。詳細な経緯は [`q_a.md`](./q_a.md) を参照。**q_a.md と異なり、このファイルは進行中に能動的に参照する。**

追記は Phase 完了時にまとめて1回行う(#18・#24)。ステージ完了時にまとめて吟味してもよい(#10 の運用注記、ステージ4完了後に追加)。

## Phase 0

- [`CLAUDE.md`](../CLAUDE.md)「進行のルール」節に appendix原本の #1〜17 を転記し、本プロジェクト固有の #18〜27 を追加した。#1〜17 は今後も内容を変更しない(調整は #18 以降への追加で行う)。
- 納期モード(#21)を採用。ただしMVPコアループ(チャット↔4文書生成の中核)の章は常に学習モード固定。
- #26(md相互参照はリンクで明記)を追加。`textbook/`配下と`CLAUDE.md`からの`.md`参照は全てMarkdownリンクにする。
- #1の「Phase毎に教材フォルダ」は「Phase毎にフォルダを作成する」の意と解釈し直した(#6「各Phaseフォルダ直下」と整合)。教材ファイルは `textbook/Phase-<N>/` 配下に置く(`textbook/`直下にフラット配置しない)。Phase-0の教材を `textbook/Phase-0/` に移設済み。
- #27(Phase 0の役割定義、共通ルール候補)を追加。Phase 0の範囲を「ルール確定+ゴール策定」から「`README.md`/`docs/`配下を入力とした実装ロードマップの具体化」まで拡張した。Devex完成後は入力をDevex生成物に切り替える想定だが、詳細はDevex完成後の振り返りで具体化する(今は未確定)。
- 用語衝突を解消: [`docs/implementation_plan.md`](../docs/implementation_plan.md)の「フェーズ1/フェーズ2」を「ステージ1/ステージ2」にリネームした。以後「Phase」はCL開発の実装単位(`Phase-<N>`)専用の語。
- 実装ロードマップを確定([`docs/implementation_plan.md`](../docs/implementation_plan.md) 4.2 WBSの5区分に1:1対応): Phase 1=環境構築、Phase 2=バックエンド開発(2-1 DB移行〜2-5 エクスポート/エラーハンドリング)、Phase 3=フロントエンド開発(3-1〜3-3)、Phase 4=統合テスト・QA、Phase 5=デプロイ・運用準備。詳細は[`Phase-0/Phase-0-2.md`](./Phase-0/Phase-0-2.md)参照。旧決定「Phase 1=チャットヒアリングフロー設計」はPhase 2-3に位置づけ直した。

## Phase 0 ── 初期ヒアリング入力の設計(#27: 要件・設計の確認)

この作業は#27が定めるPhase 0の範囲(要件・設計の確認)内であり、Phase 1以降ではない。まだ「Phase 1を開始する」等の明示トリガーは行っていない(#5)。将来Phase 2-3(チャットヒアリングフロー)・Phase 3-2(チャットヒアリングUI)が読む [`docs/external_design.md`](../docs/external_design.md)・[`docs/internal_design.md`](../docs/internal_design.md) 自体を、Phase 0のうちに先行して更新した。詳細は[`Phase-0/Phase-0-3.md`](./Phase-0/Phase-0-3.md)参照。着手時に参照すること:

- 初期ヒアリング入力は「概要(必須・自由記述)」「実現したいこと(必須・自由記述、箇条書き強制なし)」「補足(任意・自由記述、旧サブ機能+その他を統合)」の3項目+折りたたみ式「環境設定(任意)」に簡略化した。理由: 初期入力段階で明確な設計・構想を求めすぎないため(ユーザー方針)。箇条書き化・機能提案はチャット側でAIが行う。
- 「言語→フレームワーク」の動的コンボボックスは devex-ui に前例がなくa11yリスクが高いため**採用しない**。フレームワークは言語ごとに `<fieldset><legend>` で静的グルーピングする静的チェックボックス群(`CheckboxGroupWithLabel`流用)にする。
- `projects` テーブルに `intake`(JSONB, NULL可)カラムを追加([`docs/internal_design.md`](../docs/internal_design.md) 3.2)。初期ヒアリング入力をそのまま保持する。
- AIが「十分な要件が揃った」と判断した後も即生成せず、構造化サマリを提示してユーザーの明示的な承認を得てから生成に進む([`docs/external_design.md`](../docs/external_design.md) 2.3、[`docs/internal_design.md`](../docs/internal_design.md) 3.3に明記)。
- devex-ui調査での既知ギャップ: `TokenInput`は非制御・aria-labelなし、`InputSuggest`は静的配列フィルタのみで非同期/AI連携なし、`aria-invalid`/`aria-describedby`/`role="alert"`/`aria-live`はリポジトリ全体で未使用。新規/改修コンポーネントでは必ず配線すること。

## Phase 0 ── ドキュメント構成の分割(README.md → docs/)

`README.md`に混在していた要件定義書・外部設計書・内部設計書・実装計画書を、Devex自身が生成する4ファイル構成([`docs/external_design.md`](../docs/external_design.md) 2.3節SCR-005参照)と揃えて`docs/requirements.md`/`docs/external_design.md`/`docs/internal_design.md`/`docs/implementation_plan.md`に分割した。`README.md`は概要+リンク表のみに縮小した。内部の節番号(1.1, 2.1, 3.1, 4.1…)は維持。詳細は[`Phase-0/Phase-0-4.md`](./Phase-0/Phase-0-4.md)参照。

## Phase 0 ── Phase 1着手前の仕様診断への対応(12項目)

Phase 1着手前にユーザーへ仕様診断を提示し、全12項目の決定を得た。詳細は[`Phase-0/Phase-0-5.md`](./Phase-0/Phase-0-5.md)参照。

1. **リポジトリ構成**: `devex-api`/`devex-ui`の独立2リポジトリ構成を正とする(モノレポ案は破棄)。[`docs/implementation_plan.md`](../docs/implementation_plan.md) 4.3.2に反映。
2. **ストリーミング方式**: SSE(Server-Sent Events)を採用(WebSocketは将来の双方向リアルタイム機能が必要になった場合に再検討)。
3. **初期ヒアリング入力の文字数上限**: システム概要=全角200文字、実現したいこと=全角80文字、補足=全角400文字。
4. **ヒアリング完了判定基準**: (1)目的・課題の明確化 (2)コア機能1つ以上を「誰が・何を・なぜ」で具体化 (3)想定ユーザー像の把握 (4)MVPスコープの認識合わせ (5)環境設定未入力時は技術的制約の確認、を満たしたら「十分」と判定。
5. **`generated_documents`バージョニング**: 再生成時は新バージョンを追加(上書きしない)。直近3バージョンまで保管し、4件目生成時に最古を削除。
6. **`chat_histories.sender`を4値に拡張**: `'user'`/`'ai'`/`'intake'`(初期ヒアリング入力の記録)/`'others'`(将来拡張用)。intakeは`sender='intake'`の行として明示的に永続化する。
7. **SCR-003↔SCR-004連携**: `prompt_templates`に`default_environment`(JSONB)を追加し、テンプレート選択時にSCR-004のintake環境設定へプリフィルする。
8. **LLMコスト超過リスク**: 使用モデルはGemini Flash-Lite(無料プラン)。トークン上限超過は`LLM_QUOTA_EXCEEDED`エラーコードでハンドリング。
9. **アクセシビリティの全画面適用**: SCR-004限定だった`aria-invalid`/`aria-describedby`/`role="alert"`等の方針を[`docs/requirements.md`](../docs/requirements.md) 1.5の非機能要件として全画面に一般化。
10. **JWT仕様**: アクセストークン30分・リフレッシュトークン14日・リフレッシュトークンはhttpOnly Secure Cookie・devex-ui既存`auth-store.ts`のサイレントリフレッシュパターンを流用。
11. **マイルストーン起算日**: 個人開発のため厳密には定めない(Week 3/5/7は目安のまま維持)。
12. **`doc_type`表記統一**: `'requirement'` → `'requirements'`に変更。

## Phase 0 ── 実装着手前の仕様診断を共通ルール化(#28)

上記の仕様診断(12項目)を一度限りのレビューで終わらせず、**Phase 0内で毎回行う共通ルール**として#28を新設した(ユーザー指示、#27と同様に将来のhandoff v2引き継ぎ候補)。Phase 1のトリガー前に、`docs/`配下4文書を対象に最重要/中程度/軽微の3段階で診断し、ユーザーが決定またはAIへの提案依頼を選べる運用とする。今回はルール新設のみで、追加の診断作業は行っていない。詳細は[`Phase-0/Phase-0-6.md`](./Phase-0/Phase-0-6.md)参照。

## Phase 0 ── 「生成ドキュメントの自己診断」をプロダクト要件化

#28(CL進行ルールとしての仕様診断)を、Devexというプロダクト自体の機能要件としても明示した(ユーザー指示、#25再帰検証ルールの直接的な適用例)。[`docs/requirements.md`](../docs/requirements.md) 1.4節Must haveに「ドキュメント自己診断機能」を追加: 4文書生成後、AIが不足・不明瞭な点を最重要/中程度/軽微の3段階で自己診断しチャットに提示する。診断結果は`chat_histories`の`sender='others'`行として記録する(既存の4値化で確保していた枠を具体的な用途に確定)。詳細は[`Phase-0/Phase-0-7.md`](./Phase-0/Phase-0-7.md)参照。

## Phase 2着手前 ── 文書アップロード要件の追加

「Phase 2を開始する」の実行中(教材ファイル生成前)にユーザーから新要件が提示され、一旦中断して`docs/*.md`を先行改訂した。Phase 1〜5のロードマップ区分自体は変更なし(Phase 2-1「DB移行」・Phase 2-3「チャットヒアリングフロー設計」・Phase 3-2「チャットヒアリングUI」の中に組み込む)。教材(`textbook/Phase-2/…`)の生成はこのセッションでは行っていない(次回「Phase 2を開始する」で着手)。

- **要件本体(Must have化)**: 初期ヒアリング入力(SCR-004)時に参考資料を最大3ファイルまでアップロードできる機能を[`docs/requirements.md`](../docs/requirements.md) 1.3/1.4節に追加した。
- **データモデル**: `projects.intake`(JSONB)を拡張するのではなく、`chat_histories`/`generated_documents`と同じ粒度の新規テーブル`intake_files`を新設した([`docs/internal_design.md`](../docs/internal_design.md) 3.2節)。理由: ファイル単位の状態(成功/失敗、エラー理由)を個別に持たせやすいため。
- **ファイル実体は保持しない**: 抽出したテキストのみをDBに永続化し、元ファイルのバイナリは処理後に破棄する。理由: 現行インフラはPostgreSQLのみで、S3等のオブジェクトストレージを持たない。バイナリ保持を選ぶとPhase 1(環境構築)への手戻りが発生するため見送った。
- **対応形式をtxt・Markdown・PDFの3種類に絞った経緯**: 当初案(txt/Markdown/Word/Excel/PowerPoint/PDF)に対し、「文書内の図はどう解釈されるか」という指摘があった。GeminiはPDF/画像にはネイティブなマルチモーダル理解(図・レイアウトの解釈を含む)があるが、Word/Excel/PowerPointはLLMに直接渡せない。これらも同水準で図を解釈するにはPDF変換(LibreOffice等)という新規インフラが必要になり、Phase 1への手戻りが生じる。そのためWord/Excel/PowerPointは対象外とし、図を含む資料はユーザー側でPDF化してもらう設計にした。
- **テキスト化方式**: `txt`/`md`はそのままUTF-8テキストとして読み込む(LLM呼び出し不要)。`pdf`は既存の`app/ai/llm/gemini.py`のGeminiクライアントにファイルをそのまま渡し、LLMのネイティブなファイル理解でテキスト化する(新規のPDF解析ライブラリは追加しない)。この方式により新規ライブラリ・新規インフラを一切追加せずに済んでいる。
- **初期値(ユーザー未指定、こちらの提案で確定)**: 1ファイル最大5MB、抽出テキストは1ファイルあたり最大20,000文字(超過分は切り詰め)、処理は`POST /api/v1/projects`実行時に同期、テキスト化失敗(`FILE_EXTRACTION_FAILED`)してもヒアリングはブロックしない。PDFのテキスト化はGemini Flash-Liteのクォータを1回消費する(既存の`LLM_QUOTA_EXCEEDED`リスクと同じプール、[`docs/implementation_plan.md`](../docs/implementation_plan.md) 4.4リスク5に追記)。
- 新規エラーコード`TOO_MANY_FILES`/`UNSUPPORTED_FILE_TYPE`/`FILE_TOO_LARGE`/`FILE_EXTRACTION_FAILED`を[`docs/internal_design.md`](../docs/internal_design.md) 3.4節に追加した。

## Phase 3着手前 ── Phase 2-2「JWTリフレッシュトークンのCookie化」やり直し(#12の例外)

「Phase 3を開始する」の調査中、`devex-api`の実コード(`app/api/routes/auth.py`・`app/schemas/auth.py`)を確認したところ、[`docs/internal_design.md`](../docs/internal_design.md) 3.1節が当初(Phase 0-5時点)から定めていた「リフレッシュトークンはhttpOnly Secure Cookieに保持」という設計がコードに未反映(`register`/`login`/`refresh`/`logout`が全てJSONボディでリフレッシュトークンをやり取りし、`Set-Cookie`が存在しない)という実装ギャップが見つかった。

- **原因**: [`Phase-2/Phase-2-2.md`](./Phase-2/Phase-2-2.md)が「既存のJWT認証(汎用テンプレート由来)は無変更で再利用する」と判断し、Phase 0-5で決定済みだったCookie方式との差分点検を行わなかったこと。設計書自体は当初から正しく、ドキュメントの誤りではなく実装側の見落とし。
- **検討した2方式**: (A) httpOnly Secure Cookieに修正 ── XSS耐性・ページリロードでもログアウトされない・設計書と整合・CORSは`allow_credentials=True`済みで追加対応不要。デメリットはroutes/schemas/depsの3ファイル変更とCookie属性(`path`/`samesite`)の設計が必要なこと。(B) 現状のJSONボディ方式のまま進める ── バックエンド変更は不要だが、リフレッシュトークンをlocalStorageかJSメモリに保持することになりXSS耐性が無い、または長時間セッション(チャットヒアリング)中のページリロードで即ログアウトするUX劣化がある。設計書と決定済み事項にも反する。→ **(A)を採用**。
- **`docs/*.md`への影響**: **変更不要**。`internal_design.md`(26行目)・`external_design.md`(SCR-001)・`implementation_plan.md`(WBS該当行・§4.4リスク表)のいずれも、今回の実装修正と矛盾しない記述だった(実装が設計に追いついていなかっただけ)。
- **rule #12の例外扱い**: 本来この種の手戻りは「後続Phase(今回はPhase 3)の教材に新しい内容を書き、変更元Phaseは書き換えない」という#12の前方参照方式で扱うが、ユーザー判断により今回は例外として[`Phase-2/Phase-2-2.md`](./Phase-2/Phase-2-2.md)自体を直接書き換えた。理由: Phase 3の教材・サンプルがまだ何にも依存していないタイミングであり、過去章を書き直しても整合性コストが無いため。**#12自体の運用方針(後続Phaseでの変更は前方参照で記録する)は今後も維持する**。
- **修正内容**: `app/api/deps.py`に`REFRESH_TOKEN_COOKIE_NAME`定数・`get_refresh_token_from_cookie`・`RefreshTokenCookieDep`を追加、`app/schemas/auth.py`から`TokenPair`/`RefreshRequest`を廃止し`AccessToken`に統一、`app/api/routes/auth.py`の`login`が`Set-Cookie`で発行し`refresh`/`logout`がCookie経由で受け取るよう変更。`AuthService`本体は無変更(トークン文字列の受け渡しのみを行う設計だったため)。検証は`devex-api/backend`に一時反映して`pytest`(unit 91件green、統合テスト2件を個別実行してgreen)・`pyright`(0エラー)で確認済み、検証後は実ファイルを元に戻した(Phase 2の既存運用と同じ)。
- **Phase 3への影響**: Phase 3-1(認証基盤刷新)は当初「バックエンドCookie化+フロントエンド`auth-store.ts`書き換え」を予定していたが、バックエンド側がPhase 2-2で完了したため**フロントエンドの`auth-store.ts`刷新のみ**に縮小した。

## Phase 3-5着手前 ── Phase 2-3「ヒアリング完了判定APIルートの配線漏れ」修正(#12の例外)

Phase 3-5(チャットヒアリングUI、SSE+完了承認)の設計中、フロントエンドが`ChatService.check_completion`(ヒアリング完了の5条件判定、`HearingCompletionCheck`構造化出力)の結果を取得する手段が無いことに気づいた。`app/services/chat_service.py`にサービスメソッドと単体テスト(`test_chat_service.py`)は存在していたが、`app/api/routes/projects.py`に対応するAPIルートが配線されていなかった(Phase 2-3の教材本文には「本章では判定結果を返すところまでを実装した」とだけ記載されており、ルート化を明記し忘れていた)。

- **原因**: Phase 2-3のスコープ確認不足。サービス層の実装とテストが揃っていたため見落とされやすかった。
- **修正内容**: `GET /api/v1/projects/{project_id}/hearing-completion`を新設し、`ChatService(session).check_completion(current_project)`へ委譲するだけの薄いルートとして追加。ルート自体は`llm`を注入できないため、ルートのテストは`app.services.chat_service.get_gemini_llm`を`monkeypatch`で`FakeLLM`に差し替える方式(`test_ai_graph_nodes.py`の既存手法を踏襲)。
- **rule #12の例外扱い**: Phase 2-2のCookie化と同じ理由(Phase 3の教材・サンプルがまだこのエンドポイントに依存していないタイミングであり、過去章を直接修正しても整合性コストが無い)により、[`Phase-2/Phase-2-3.md`](./Phase-2/Phase-2-3.md)を直接書き換えた。**#12自体の運用方針(後続Phaseでの変更は前方参照で記録する)は今後も維持する**。
- **検証**: `devex-api/backend`に一時反映して`pytest tests/unit`(92件green、既存91件+新規1件)・`pyright`(0エラー)で確認済み、検証後は実ファイルを元に戻した(Phase 2の既存運用と同じ)。
- **教訓**: サービスメソッド+単体テストが揃っていても、それを呼び出すAPIルートの配線漏れは見過ごされやすい。今後のPhaseでも「サービス層の実装が完了した時点でルート層への配線漏れが無いか」を実装前チェックリスト(#11)やテスト観点の突き合わせ(#13/#15)の一環として確認する。

## Phase 3完了後 ── devex-uiテストファイルの配置を`__tests__/`サブフォルダに変更

`*.test.ts(x)`をソースの隣にcolocateする既存方針から、テスト対象と同じディレクトリ直下の`__tests__/`サブフォルダへ移行する方針に変更した(ユーザー相談、Jest由来でJS界隅での認知度が高い規約)。

- **適用範囲**: devex-ui全体(既存のデモギャラリを含む)を一括移行した。Phase 3の全サンプル(`textbook/samples/frontend/`)も同様に移行済み。
- **影響**: 相対 import が1階層深くなる(`./Foo`→`../Foo`、`../../tamagui.config`→`../../../tamagui.config`)。`devex-ui/CLAUDE.md`のTesting節を更新済み。
- **検証**: devex-ui実リポジトリで15ファイルを移動し`tsc --noEmit`・`vitest run`で確認した(既知の`Menu.test.tsx`不具合以外の新規回帰なし)。この検証中に`auth-store.ts`が旧Body方式と新Cookie方式のロジックが混在した中途状態(ユーザー自身の写経作業中)であることを発見し、ユーザーに報告済み(修正は未実施、ユーザーの作業範囲のため)。
- **Phase 3教材への反映**: `textbook/Phase-3/Phase-3-1.md`〜`Phase-3-6.md`内の全テストファイルパスを`__tests__/`含みに更新した。この移行は特定の章の内容変更ではなく機械的なパス変更のため、サンプル側のファイルにはPhaseタグを新規付与していない(rule #29はコンテンツ変更の追跡用であり、単なるファイル移動には適用しないと判断)。

## Phase 3完了後 ── 登録画面(RegisterForm)のパスワードに強度ルールを追加

ユーザー相談(`src/components/ui/form/validation/`のバリデーションルールデモギャラリを参考に)により、`registerSchema`(`src/features/auth/schemas.ts`)のパスワードへ強度ルールを追加した。

- **追加したルール**: `uppercaseRequired`/`lowercaseRequired`/`digitRequired`/`symbolRequired`(いずれも`validation-rules.ts`の既存関数、大文字・小文字・数字・記号を各1文字以上要求する)。既存の`requiredText`+`lengthRange(8,128)`はそのまま維持。
- **`loginSchema`は対象外**: ログインのパスワード欄には課さない。新ルールは新規登録時のみ適用され、既存アカウントのパスワードが遡って新ルールを満たすとは限らないため。
- **テストへの反映**: 成功系テストのパスワード値を新ルールを満たす`"S3cret-Pass"`に変更し、強度不足(英小文字のみ)を検出する新規テストケースを追加した。
- **副次的な発見**: 検証中、ユーザーの`FormGeneral.tsx`の写経に`demoDelayMs`プロパティの分割代入漏れ(型定義にはあるが関数引数のデフォルト値指定が抜けていた)があり、`ReferenceError`でテストが落ちることを発見・修正した(rule #15が想定する「写経ミスの検知」がまさに機能した例)。
- **対象外**: `textbook/samples/frontend/`は同内容に更新済みだが、[`Phase-3-2.md`](./Phase-3/Phase-3-2.md)自体は書き換えず、後続の改訂として1行の参照のみ追記した(rule #12の通常運用。Phase 3教材は既に公開済みの内容であり、Cookie化・hearing-completionのような例外は適用しない)。

## Phase 3完了後 ── Server ComponentからTamaguiを直接importできない問題

`npm run dev`実機検証で`/login`→`/register`→`/projects/new`と3画面続けて`TypeError: createReactContext is not a function`に遭遇した(ユーザーがブラウザで各画面を開くたびに発覚、その都度ユーザー自身が該当ファイルに`"use client"`を追加して解決していた)。

- **原因**: これらの`page.tsx`はいずれも`"use client"`の無いServer Componentのまま`tamagui`パッケージを直接importしていた。Reactは`package.json`の`exports`に`"react-server"`条件専用のビルド(`react.react-server.js`)を持ち、Server Component(=`"use client"`が無いモジュール)からimportされた`react`はこのビルドに解決される。実際に`node_modules/react/cjs/react.react-server.development.js`を確認したところ`createContext`という文字列は1件もヒットせず、このビルドにはContext APIが存在しない(クライアント専用の概念でRSCには無関係なため意図的に除外されている)。`@tamagui/web`の`createStyledContext`はモジュール評価時に`React.createContext`を呼んでTheme/Text等の共有Contextを作るため、この解決では`undefined(...)`呼び出しになりTypeErrorになる。
- **影響範囲**: `tamagui`から直接importしつつ`"use client"`を持たない`page.tsx`は必ずこのエラーになる。Next.js 16 + React 19 + Tamagui 2.6の組み合わせ特有の制約(`devex-ui/AGENTS.md`が警告する「訓練データに無い破壊的変更」の一種)。動的ルート`chat`/`documents`([`Phase-3-5.md`](./Phase-3/Phase-3-5.md)/[`Phase-3-6.md`](./Phase-3/Phase-3-6.md))は`params`の非同期解決のためServer Componentのまま維持しているが、tamaguiを直接importせず`ChatPageContent`/`DocumentsPageContent`という別のClient Componentに描画を委譲しているため対象外。
- **対処**: 該当ページの先頭に`"use client";`を追加する。実ファイル(`devex-ui`)側は影響範囲の4ファイル([`Phase-3-2.md`](./Phase-3/Phase-3-2.md)のlogin/register、[`Phase-3-3.md`](./Phase-3/Phase-3-3.md)のdashboard、[`Phase-3-4.md`](./Phase-3/Phase-3-4.md)のprojects/new)すべてユーザー自身の対応により解決済みであることを確認した。`textbook/samples/frontend/`側の該当4ファイルにも同じ修正を反映済み。
- **教材の生成プロセスへの示唆**: このパターン(Server Componentからのライブラリ直接import禁止)はコード生成時のレビュー観点として一般化できる ── 以降のPhaseで新規ページを追加する際は、tamagui(または他のクライアント専用ライブラリ)を直接importするなら`"use client"`を付けるか、Client Componentに描画を委譲するかを都度確認する。

## Phase 3完了後 ── ファイルアップロードの汎用コンポーネント化

ユーザーから「ファイルアップロードは汎用コンポーネント化したい」との依頼。[`Phase-3-4.md`](./Phase-3/Phase-3-4.md)で実装した`FileUploadField.tsx`(ヒアリング機能専用、最大件数・拡張子・サイズ・ラベル文言が全てハードコード)を、`InputSimpleText`→`InputEmail`/`InputPassword`と同じ「汎用ベース+薄い特化ラッパー」構成に分解した。

- **判断根拠(CLAUDE.md #17)**: 現時点で他に具体的なファイルアップロード機能の予定は無い(`docs/external_design.md`にチャット画面フッターの「ファイル添付(将来拡張用としてUIのみ、または無効化)」という未実装のプレースホルダが1件あるのみ)。一方`devex-ui`は`devex-ui/CLAUDE.md`が明記する通りDevexの実装であると同時に「今後のアプリ開発の土台として使うテンプレート」でもあり、`src/app/(pages)/(sample)/form-parts/`のデモギャラリ(`menu-tree.ts`に登録)がその実消費者になる ── 既存の`InputPassword`等と同じ立ち位置で「今この共通化を駆動する消費者は何か」に具体名で答えられるため実施した。
- **設計**: `src/components/ui/form/FileUpload.tsx`(新規、デフォルトエクスポート)が汎用ベース。`value`/`onChange`に加え`label`/`accept`(拡張子リスト、判定用)/`acceptLabel`(エラー文言用の人が読める表記。`accept`をそのまま結合すると元の文言と一致しなくなるため判定用と表示用を分離)/`acceptAttr`(任意、未指定時は`accept.join(",")`)/`maxFiles`/`maxFileSizeBytes`をpropsに持つ。`validateFiles(files, options)`も同じ形でパラメータ化して名前付きエクスポート。
- **`FileUploadField.tsx`は薄いラッパーに変更**: ヒアリング固有の定数(3件・txt/md/pdf・5MB・日本語ラベル)を固定して`FileUpload`に渡すだけになった。`FileUploadField`/`validateFiles(files)`という既存の公開contractは完全に維持されるため、`IntakeForm.tsx`・既存テスト(`FileUploadField.test.tsx`)は無変更のまま green(CLAUDE.md #12-4が定める「リファクタの写経ミスの番人」としての統合スモークテストの役割を果たした)。
- **デモページ**: `src/app/(pages)/(sample)/form-parts/file-upload/page.tsx`を新設し`menu-tree.ts`の`Form Parts`グループに登録。汎用コンポーネントとしての実消費者を確保した。
- **テスト**: 新規`src/components/ui/form/__tests__/FileUpload.test.tsx`(9件)。拡張子ミスマッチのテストでは、`@testing-library/user-event`の`upload()`がinputの`accept`属性で選択自体をブロックする挙動があるため、判定用の`accept` propとは別に`acceptAttr`をテスト用に緩めている(実際のゲートは常にJS側の`validateFiles`であり、`accept`属性はOSのファイル選択ダイアログ上のヒントに過ぎないという既存の設計方針と整合)。
- **samplesへの反映**: `textbook/samples/frontend/`に`FileUpload.tsx`・書き換え後の`FileUploadField.tsx`・デモページ・新規テストを反映。`menu-tree.ts`は今回samplesに初めて追加したため、ヘッダーに過去に触れたPhaseを遡って列挙した(`# 更新：Phase-3-1,3-2,3-3,3-4`)。個別の`Phase-3-N:追記/更新`インラインタグは、パスワード強度ルール追加のときと同じ前例に倣い、`menu-tree.ts`の新規行以外には付けていない(内容変更点はこの節と[`Phase-3-4.md`](./Phase-3/Phase-3-4.md)に記録する運用のため)。

## Phase 2完了後 ── チャット応答のrepr化バグ修正とヒアリングプロンプト調整

実機検証で、ヒアリングチャットのAI返信が`[{'type': 'text', 'text': '...\n...', 'extras': {'signature': '...'}}]`のようなPythonのrepr文字列(波括弧・引用符・エスケープされた`\n`)としてそのまま表示される不具合が見つかった。

- **原因**: [`Phase-2-5.md`](./Phase-2/Phase-2-5.md)の`ChatService.stream_reply`(`app/services/chat_service.py`)が、Geminiのストリーミングチャンクの`content`に無条件で`str()`を適用していた。Geminiが応答パートに`thought_signature`(内部推論の継続性を保つためのメタデータ。`gemini-2.5-flash`等でも付与されうる)を付与すると、`langchain-google-genai`は`AIMessageChunk.content`を`str`ではなく`[{"type": "text", "text": "...", "extras": {"signature": "<base64>"}}]`という辞書のリストに変える。これに`str()`を適用するとPythonのrepr(波括弧・引用符・`\n`のエスケープ表示)がそのまま出力され、SSEストリーミングとして即座にフロントへ流れると同時に、`chat_histories.message`(`Text`カラム)へもそのまま永続化されていた。
- **対処**: `content`から`text`フィールドだけを安全に取り出す`_extract_text()`ヘルパーを追加し、`str(chunk.content)`を置き換えた。テキストを持たない(signatureのみの)チャンクは`yield`しない。
- **フロント側は変更不要と判断した理由**: `ChatHistoryEntry{sender, message}`(`devex-ui/src/features/hearing/api/hearingApi.ts`)は既に`sender`で発言者を区別しており、`MessageBubble.tsx`も`sender==="user"`なら生テキスト、それ以外(`ai`/`intake`)は`react-markdown`でMarkdownとして描画する設計になっている ── つまり「発言者ごとに表示方法を分ける」という構造は既に実装済みで、真因はバックエンドが応答構造を検査せず`str()`していたことだった。修正後は`text`フィールドの実際の改行文字がそのまま渡るため、`\n`のエスケープ表示問題も同時に解消される。
- **既存データへの言及**: `_build_messages`は対話履歴を毎回LLMへ渡す設計のため、修正前に保存された壊れたAI応答は、表示上の見た目だけでなく今後の対話コンテキスト(応答品質)にも影響し続ける。データ移行・既存プロジェクトの手動修復は今回のスコープ外とした。
- **ヒアリングプロンプトの調整**: `_HEARING_SYSTEM_PROMPT`に「ユーザーが確認を求めていない限り、既に提示された内容を要約・反復しない」「要件確定に必要な不足点を吟味した上で、シンプルな質問・選択肢の提示など簡潔な問いかけに絞って返信する」という指示を追記した。
- **テスト**: `tests/fixtures/fake_llm.py`の`_FakeChunk`/`stream_chunks`がGeminiのlist-of-dict形状も渡せるよう型を緩め、`tests/unit/test_chat_service.py`に「thought signature付きcontentからtextのみ抽出される」「textを持たないチャンクはyieldされない」の2ケースを追加した(`uv run pytest tests/unit`94件green、`uvx pyright`0エラーを確認済み)。

## 初回ヒアリング表示の整形 + AIの最初の発話の自動生成

プロジェクト作成直後、チャット画面に`{"system_overview": "...", "goals_raw": "...", "notes_raw": null, "environment": null}`という生JSONがそのまま表示される不具合が見つかった。原因は[`Phase-2-3.md`](./Phase-2/Phase-2-3.md)の`ProjectService.create`(`app/services/project.py`)が`json.dumps(intake, ensure_ascii=False)`を`chat_histories`(`sender='intake'`)にそのまま保存していたこと。`docs/external_design.md` SCR-004 §2.3は「チャット開始直後、AIの最初の発話は初期ヒアリング入力の内容を踏まえた理解の要約と確認質問から始まる」と定めているが、実装ではプロジェクト作成後ユーザーが最初のメッセージを送るまでAIが一切発話しない状態だったため、この生JSONだけが画面に残っていた。

このタスクはユーザーから「claude側でプロジェクトに反映」と明示指示があったため、[[feedback_direct_impl_scope]]の既定(samples-only)の例外として実プロジェクトへ直接反映した。

- **intake要約の整形**: `app/services/project.py`に`_format_intake_summary(intake)`を追加し、`システム概要：{system_overview}\n実現したい事：{goals_raw}\n(その他備考：{notes_raw}、値がある場合のみ)`という表示テキストに置き換えた。`environment`は表示から除外。
- **environmentの扱い**: ユーザー確認の結果、「表示からは外すがLLMコンテキストには渡す」を採用(ヒアリング完了判定5条件目「技術的な制約・希望の確認」の材料であるため)。`chat_service._build_messages`に`project: Project`引数を追加し、`project.intake["environment"]`があれば`HumanMessage`として注入する(`chat_histories`には保存しない ── 表示に一切影響させないため)。
- **AIの最初の発話**: ユーザー確認の結果、「プロジェクト作成時に同期生成」を採用。`ChatService.generate_opening_reply()`を新設し、`app/api/routes/projects.py`の`create_project`から`ProjectService.create`直後に1回呼び出す。専用プロンプト`_OPENING_TURN_PROMPT`で「以上を元に詳細のヒアリングを進めていきます。→【確認したい事】(3点の箇条書き)→まず、{最初の質問}」という形式を指示する。失敗時(`LLMQuotaExceededError`/`GenerationFailedError`)はプロジェクト作成自体は成功させ、ユーザーは通常通りチャット欄から発話を始められるようにした。
- **改行描画の修正(`remark-breaks`)**: `MessageBubble.tsx`は`remark-gfm`のみでCommonMark標準の「単一改行は段落内の空白扱い」のままだったため、intake要約の3行やAIの箇条書きが1行に潰れて表示される問題があった。`remark-breaks`を追加し解決した。**副次的な発見**: `devex-ui/package.json`に`react-markdown`/`remark-gfm`自体が実は宣言されておらず(`node_modules`に手動または過去の`--no-save`相当の操作で存在していただけの「extraneous」パッケージだった)、`npm install remark-breaks`実行時に誤って両方削除される事故が発生した。両方を正式に`package.json`へ追加して復旧した(今後`npm ci`/フレッシュcloneでも正しくインストールされるようになる、副次的な改善)。
- **既存データの整理**: 対象2プロジェクトの生JSON intake行を、一回限りのスクリプトで整形済みテキストに書き換えた(両プロジェクトとも既に後続のAI発話が複数回あるため、遡って「最初のAI発話」を合成・挿入することはしていない)。
- **samplesへの反映**: `textbook/samples/backend/`(`project.py`/`chat_service.py`/`routes/projects.py`/関連テスト)・`textbook/samples/frontend/src/features/hearing/components/MessageBubble.tsx`に同じ変更を反映した。samples/frontendは`package.json`を持たないため、写経時に`npm install remark-breaks`を別途実行する必要がある旨を申し送る。

## 添付ファイル抽出結果の表示非表示化 + repr化バグの横展開修正(3箇所目)

新規プロジェクト作成後のヒアリング画面で、2つ目のMessageBubbleに添付PDFの抽出結果がそのまま表示される不具合が見つかった。しかもその抽出結果自体が、前回修正した`chat_service.py`と全く同じ`str(response.content)`によるrepr化バグを含んでいた(`app/services/intake_file_processor.py:70`の`_extract_pdf_text`)。調査の過程で`app/services/doc_generator_service.py`の`_generate_one`・`_self_diagnose`にも同じバグが見つかり、**これで3箇所目**。CLAUDE.md #17に基づき、`_extract_text`を`chat_service.py`から`app/ai/llm/gemini.py`へ移し`extract_text_content`として3箇所で共有した。

- **当初案からの方針転換**: 当初は`chat_histories`から添付ファイルecho行を削除し、`intake_files`テーブルから`_build_messages`へ注入し直す設計を検討したが、ユーザーの指摘で調査した結果、`doc_generator_service.py`の`DocGeneratorService.generate`は`chat_histories`の全履歴だけをドキュメント生成の入力にしており、`intake_files`テーブルは一切読んでいないことが判明した。`chat_histories`echoを削除すると、ヒアリング対話のLLMコンテキストは復元できてもドキュメント生成には反映されなくなり、新しい欠落を生むだけだったため、**`chat_histories`への書き込み自体はそのまま維持し、表示層のみを変更する**方針に転換した。
- **表示除外の判定方法の再検討**: 当初`m.message.startsWith("[添付ファイル: ")`という文字列prefix一致でフロント側を実装しようとしたが、ユーザーから「バックエンドの書式が変わったら判定がすり抜ける」との指摘があった。この文字列自体はPython側のf-stringが機械的に生成する固定書式でLLM生成ではないため表記ゆれの心配は無いものの、フロントとバックエンドで別々に書かれた文字列リテラルが暗黙に一致しているという結合自体が壊れやすいという指摘は妥当と判断し、`sender`に新しい値`"attachment"`を追加して構造化された判定に変更した(`app/schemas/hearing.py`・`hearingApi.ts`の`ChatSender`)。DB側は`chat_histories.sender`が`String(20)`でCHECK制約が無いためマイグレーション不要。
- **`ProjectService._ingest_file`**: `chat_histories.add(...)`の`sender`を`"intake"`から`"attachment"`に変更(メッセージ本文自体は可読性のため維持)。`_format_intake_summary`にファイル名リストを渡せるようにし、1つ目のバブル(intake要約)に「添付ファイル：{ファイル名}」を追記するようにした。
- **`_build_messages`・`_render_transcript`**: `sender="attachment"`もHumanMessage/transcript行として扱うよう受け皿を広げた(ヒアリング対話・ドキュメント生成への実質的な影響は無い、従来`sender="intake"`だったものが`"attachment"`に変わっただけ)。
- **フロントエンド**: `ChatPanel.tsx`で`messages.filter((m) => m.sender !== "attachment")`により表示から除外(文字列内容は一切見ない)。
- **既存データの整理**: `intake_files.extracted_text`のrepr化(2件)・対応する`chat_histories`echo行のsender変更+本文復元(2件)・該当2プロジェクトのintake要約へのファイル名追記(2件)を一回限りのスクリプトで実施した。
- **samplesへの反映**: `textbook/samples/backend/`(`app/ai/llm/gemini.py`(新規)・`app/schemas/hearing.py`・`intake_file_processor.py`・`doc_generator_service.py`・`chat_service.py`・`project.py`・関連テスト)、`textbook/samples/frontend/src/features/hearing/components/ChatPanel.tsx`・`src/features/hearing/api/hearingApi.ts`に同じ変更を反映した。

## ドキュメント生成: 4文書専用プロンプト + 連鎖生成への置き換え

ユーザーから、参考にした外部のAIエージェントワークフロー(4段階のLLM処理チェーン: ユーザー入力→要件定義→外部設計→内部設計→実装計画。当プロジェクトの`docs/*.md`自体を実際に生成した実績がある)を提示され、これを`doc_generator_service.py`の設計に反映するよう依頼があった。

- **現状とのギャップ**: `docs/internal_design.md` 3.3節は元々「それぞれに特化したプロンプトを実行」と明記していたが、実装は4種共通の汎用テンプレート(`{label}`を差し替えるだけ)を使い回しており、出力フォーマット(見出し構成)の指定も無く、この仕様を完全には満たしていなかった。textbook各章(Phase-2-4/2-5)を確認したが、連鎖構成が検討された形跡は無く、単に検討されなかっただけで意図的な見送りではないと判断した。
- **採用した設計**: `_DOC_TYPE_PROMPTS`(doc_typeごとの特化プロンプト、出力フォーマット指定込み)+`_DOC_TYPE_INPUTS`(前段で確定済みの文書への参照関係)を新設し、`_generate_one`を「requirementsのみチャット全履歴を直接読み、それ以外(external_design/internal_design/implementation_plan)は前段で確定済みの文書だけを入力にする」連鎖構成に変更した。参照関係は提示されたワークフローの実プロンプトに忠実(external_designはrequirementsのみ、internal_designはrequirements+external_design、implementation_planはrequirements+internal_designで、external_designは直接には渡さない)。
- **追加検討: 当初のテンプレート仕様を超えて反映されていた書式の洗い出し**: ユーザーからの追加依頼を受け、当プロジェクト自身の`docs/requirements.md`〜`implementation_plan.md`を実際に作成した際、提示されたプロンプトの出力フォーマット指定を超えて一貫して採用されていた書式を確認した。ドメインに依存しない汎用的な指針は`_COMMON_FORMAT_GUIDANCE`(全doc_type共通の末尾指示)およびdoc_typeごとの出力フォーマットに反映し、Devex自身に固有の内容は反映しなかった:
  - 反映したもの(汎用的な書式): 一覧性の高い情報はMarkdownテーブルで整理する/複数観点を含む見出しは番号付きサブセクションに展開する/構造図はコードブロックのテキスト図で示す/画面一覧は表形式(画面ID・画面名・役割・優先度)/画面ごとに`### 画面ID: 画面名`の小見出し/テーブル定義はテーブルごとに見出し+Markdownテーブル/APIエンドポイント一覧・ディレクトリ構成の表現方法/各フェーズ見出しへのMoSCoW優先度明記/タスクのチェックボックス形式/リスクの「**リスクN**+*対策*」形式。
  - 反映しなかったもの(Devex固有): 実装計画書が「フェーズ」ではなく「ステージ」という語を使っている点 ── これはCL(Curriculum Loop)開発の教材単位「Phase」との混同を避けるための、Devexというこのプロジェクト固有のリネーム(`CLAUDE.md`「進行のルール」#27参照)であり、Devexが生成するエンドユーザーのプロジェクト向け文書には無関係のため、生成プロンプトには反映しなかった(生成対象のテンプレートは今後も「フェーズ」のまま)。同様に、具体的なテーブルスキーマ・技術スタック名・画面ID等の実データも、Devex自身のドメイン内容であり汎用テンプレートには含めていない。
- **影響範囲**: 変更ファイルは`app/services/doc_generator_service.py`1つのみ。DBスキーマ・ルート・フロントエンド変更なし。`docs/internal_design.md` 3.3節の記述も、連鎖構成であることが分かるよう更新した。
- **テスト**: `test_doc_generator_service.py`に、`FakeLLM.invoke_messages`を使って各doc_typeへ渡される`HumanMessage`の中身を検証する新規テストを追加した(external_designはrequirementsのみ、internal_designはrequirements+external_design、implementation_planはexternal_designを含まないことを確認)。
- **samplesへの反映**: `textbook/samples/backend/app/services/doc_generator_service.py`・`tests/unit/test_doc_generator_service.py`に同じ変更を反映した(既存のPhase-2-4/2-5由来のコメント履歴タグはそのまま維持し、新規のPhaseタグは付けていない ── パスワード強度ルール追加時と同じ前例)。

## HearingCompletionBannerが画面更新・再遷移で消える不具合の修正

`HearingCompletionBanner`は`useHearingStore`の`completion`/`generationTriggered`(どちらも`persist`未使用の非永続状態)が揃ったときのみ表示される。`completion`は`sendMessage`の返信完了時にのみ`getHearingCompletion`で更新されており、画面マウント時に呼ばれる`loadHistory`は`getChatHistory`しか呼んでいなかった。そのため、バナー表示後に画面を更新/再遷移するとストアが初期状態(`completion: null`)にリセットされ、ヒアリングが完了条件を満たしたままでもバナーが消えてしまっていた。

- **対応**: `loadHistory`で`getChatHistory`と`getProject`(`ProjectRead.status`)を並行取得し、`status !== "interviewing"`なら`generationTriggered`をtrueに復元、`status === "interviewing"`の場合のみ`getHearingCompletion`を再問い合わせして`completion`を復元するようにした。生成トリガー済み/完了済みの場合は無駄な`check_completion`(LLM呼び出し)を避ける。
- **副次的な効果**: `generationTriggered`も同様に非永続だったため、「生成トリガー済み/完了済みの状態で画面を更新するとバナーが誤って再表示される」という鏡合わせの潜在バグも同時に解消された。
- **反映範囲**: この依頼は直接指示が無かったため[[feedback_direct_impl_scope]]の既定どおり`textbook/samples/frontend/src/features/hearing/hearing-store.ts`・`__tests__/hearing-store.test.ts`のみに反映した(実devex-uiへの反映はユーザーの手写経に委ねる)。検証は実devex-uiへ一時的に反映して`tsc`/`vitest`を実行し、検証後に元の内容へ復元する形で行った(内容はsamplesと同一のため再掲しない)。

## プロジェクトステータス「修正中(revising)」の導入 + ドキュメントへの常設リンク + ドキュメントプレビュー画面の2件の修正

上記の修正には欠陥があった。`generationTriggered`の判定を単に`status !== "interviewing"`とすると、`generating`(生成進行中でポーリングすべき)と`completed`(過去に生成済み)を区別できず、`completed`のプロジェクトでチャット画面を開くと即座に`/documents`へ強制リダイレクトされ、チャットをやり直せなくなる不具合が新たに生じた。ユーザーからの指摘: (1) 判定を`status === "generating"`に直すだけでは、「チャットに戻って新規メッセージを送る」という行為がプロジェクトの状態に何も反映されず、ダッシュボードは相変わらず「完了」のままになる、(2) そもそも「チャットに戻る」は必ずしも「今の内容を修正したい」を意味しない(見るだけの場合もある)。この指摘を受け、単純な条件式の修正ではなく、`revising`という新しいステータスを導入する設計に改めた。

- **状態遷移**: `interviewing → generating → completed`(既存)に加え、`completed`の状態で**ユーザーが新規チャットメッセージを実際に送信した時点**(画面を開いただけでは発生させない)で`revising`(修正中)へ遷移する。`revising`からもヒアリングが十分になれば通常通り承認・再生成を経て`completed`へ戻る。`generate()`の失敗時の差し戻し先は、従来固定だった`interviewing`ではなく`generate()`開始時点のステータス(`interviewing`または`revising`)にした ── `revising`から再生成に失敗して`interviewing`に戻ってしまうと「生成済みだった」という文脈を失うため。
- **`generationTriggered`(ポーリング対象)は`generating`のときのみtrue**にした。`completed`/`revising`は共に`generationTriggered=false`とし、自動リダイレクトは発生させない。代わりに`ChatPageContent.tsx`に「生成済みのドキュメントを見る →」という常設リンク(`completed`/`revising`のとき表示)を配置し、遷移するかどうかはユーザーの操作に委ねる設計にした。
- **`hearing-store.ts`**: `loadHistory`が取得済みの`getProject`の結果を`projectStatus`としてストアに保持し(新規フェッチを増やさない)、`ChatPageContent.tsx`の常設リンク表示判定に使う。`getHearingCompletion`の再問い合わせ(HearingCompletionBanner復元)は`interviewing`/`revising`の両方で行う(`revising`中の再ヒアリングでもバナーが機能するようにするため)。
- **(B) ドキュメントプレビュー画面の2件の修正(ユーザー報告)**: ①ダウンロードファイル名が本プロジェクトリポジトリ`docs/`配下の実ファイル名(`requirements.md`等)と一致していなかったため、`{project_name}_{document_type}_{YYYYMMDD}.md`から`{document_type}.md`に変更した。②Markdownプレビューの見出し同士の行間が詰まって見える・テーブルに罫線が無く関連が把握しづらいという指摘を受け、`ReactMarkdown`に`components`propを追加し、見出し(`H1`〜`H4`)・段落は明示的なmarginを持つTamaguiコンポーネントへ、リスト・テーブルはTamaguiが`tag`上書きに対応していないため素のHTML要素+インラインstyle(`var(--borderColor)`でテーマ追従、既存の`filter`prop対応と同じパターン)へマッピングした。
- **反映範囲**: ユーザーから「提案内容でOK。claudeでプロジェクトに反映する。」と明示指示があったため、[[feedback_direct_impl_scope]]の既定(samples-only)の例外として実devex-api/実devex-uiへ直接反映した(バックエンド: `app/schemas/project.py`・`app/models/project.py`・`app/services/chat_service.py`・`app/services/doc_generator_service.py`・`app/api/routes/projects.py`・関連テスト。フロントエンド: `features/dashboard/api/projects.ts`・`ProjectListItem.tsx`・`hearing-store.ts`・`ChatPageContent.tsx`・`DocumentMarkdownView.tsx`・関連テスト)。`uv run pytest tests/unit`(113件)・`uvx pyright`(0エラー)・`npx tsc --noEmit`・`npx vitest run`(既知の無関係な事前失敗を除き green)で検証済み。`textbook/samples/{backend,frontend}/`の対応ファイルにも同じ変更を反映した(既存のPhaseタグ・ヘッダーコメントは変更せず、内容のみ上書き ── パスワード強度ルール追加時と同じ前例)。
- **副次的な発見**: samplesへの反映作業中、`textbook/samples/frontend/`の`hearing-store.ts`/`ProjectListItem.tsx`等は正しく最新化されていた一方、`hearingApi.ts`の`ChatSender`型と`ChatPanel.tsx`のフィルタリングには、以前の「添付ファイル抽出結果の表示非表示化」節(`sender='attachment'`追加)の反映漏れが見つかった(decision-digestには反映済みと記録されていたが実ファイルには適用されていなかった)。今回あわせて是正した。

## チャットに戻った際、自己診断結果(レビュー結果)が再表示される不具合の修正

ユーザー報告: 「チャットに戻る」でチャット画面に遷移すると、生成完了後の自己診断結果(`sender='others'`の`chat_histories`行)がチャットバブルとしてそのまま表示されてしまう。上記の`revising`導入とあわせて常設ドキュメントリンクを配置したことで、チャット履歴内に生の自己診断結果が並ぶ意味が薄れ、単に煩雑という指摘。

- **対応**: `ChatPanel.tsx`の表示フィルタを、既存の`sender !== "attachment"`に`sender !== "others"`を追加する形で拡張した(`sender='attachment'`除外時と全く同じ「センダーで判定し、文字列内容は見ない」パターン)。`chat_histories`への保存自体・ドキュメント生成/対話のLLMコンテキストとしての利用は変更していない(あくまで表示層のみの変更)。
- **`MessageBubble.tsx`の追従**: `ChatPanel`がsender='others'を渡さなくなったため、`isDiagnosis`(黄色背景)分岐が到達不能なデッドコードになった。分岐ごと削除し、コメントを「sender='others'/'attachment'はChatPanel側で除外済み」に更新した。
- **`docs/external_design.md`への反映は見送り**: SCR-004 §2.3「自己診断結果をチャットに提示する」という記述、SCR-005の「AIによる精査結果を見るボタン(チャット内の自己診断メッセージへスクロール)」は共に現状未実装(後者はボタン自体が存在しない)であり、以前の添付ファイル表示非表示化時と同じ前例(データ保存とLLMコンテキストは変えず表示層のみを変える変更はdocsへ反映しない)に倣い、今回もdocsは変更しなかった。
- **反映範囲**: ユーザーから「claudeでプロジェクトに反映」と明示指示があったため実devex-uiへ直接反映した(`ChatPanel.tsx`・`MessageBubble.tsx`・`ChatPanel.test.tsx`に`sender==='others'`のケースを追加)。`npx tsc --noEmit`(既知の無関係な`FileUpload.tsx`エラーのみ)・`npx vitest run src/features/hearing`(42件green)で検証済み。`textbook/samples/frontend/`の同ファイルにも反映した(このタイミングで上記の副次的発見(`attachment`の反映漏れ)も合わせて是正済みの状態に揃えた)。

## ドキュメントダウンロードのファイル名がUUIDになる不具合の修正(CORS `expose_headers`未設定)

ユーザー報告: 外部設計書をダウンロードすると、ファイル名が`fd6b2d9d-b6cc-4fa7-a168-9f3b1be1418c.md`(ドキュメントのUUID)になる。文字化けではなかった。

- **根本原因**: バックエンド(`download_generated_document`)は`Content-Disposition: attachment; filename="external_design.md"; filename*=UTF-8''external_design.md`を正しく返しており(本セッション内で先に修正・検証済み)、フロントエンド(`documentsApi.ts`の`downloadDocument`)もヘッダーを正しくパースするロジックを持っていた ── **両方とも実装は正しかった**。抜けていたのは`app/main.py`のCORSミドルウェア設定。`Content-Disposition`はブラウザのCORSセーフリスト対象ヘッダーではないため、サーバーが`Access-Control-Expose-Headers`で明示的に許可しない限り、クロスオリジンの`fetch()`(devex-ui `localhost:3000` → devex-api `localhost:8000`)からJSで`res.headers.get("Content-Disposition")`を読むことができず`null`になる。`downloadDocument`はこのケースに備えて`parseFilename(...) ?? \`${docId}.md\``という(意図的な)フォールバックを持っており、これが発火してユーザー報告の症状になっていた。
- **対処**: `app/main.py`の`CORSMiddleware`に`expose_headers=["Content-Disposition"]`を追加。
- **テスト**: `tests/unit/test_cors.py`(新規)。DB/Redis接続が必要な実エンドポイント経由のテストは重いため、`test_body_size_limit.py`と同様の軽量パターンで、`app.main.app`の実際のミドルウェア登録内容(`app.user_middleware`、Starletteの`Middleware.cls`/`Middleware.kwargs`)を直接検査する形にした(DB非依存・高速、かつ実際の設定を直接見るため設定ドリフトの心配もない)。
- **samplesへの反映は無し**: `app/main.py`はCL教材(curriculum)の対象外のスターターテンプレートファイルであり、`textbook/samples/backend/`に対応ファイル自体が存在しない([`Phase-1-1.md`](./Phase-1/Phase-1-1.md)が「CORSは変更不要だった」と記録している既存インフラのため)。今回も実`devex-api`のみを直接修正した。
- **反映範囲**: ユーザー報告への直接対応(実環境で再現するバグ修正)のため、[[feedback_direct_impl_scope]]の既定の例外として実devex-apiへ直接反映した。`uv run pytest tests/unit`(114件green)・`uvx pyright`(0エラー)で検証済み。

## Phase 4完了後 ── 統合テスト・QA(rule #24: Phase完了時にまとめて1回追記)

Phase 4の生成にあたり、事前にユーザーへE2Eテストの実装粒度(バックエンドAPI統合テストのみ/ブラウザE2E(Playwright)フル導入/両方の折衷案)を確認し、**ブラウザE2E(Playwright)をフル導入**する方針を選んだ(バックエンドAPI統合テストのみに絞る軽量案は不採用)。これが本Phaseの設計全体を左右する最大の決定である。

- **2種類のフェイクLLM機構が併存する設計**: pytestプロセス内で`monkeypatch`により`get_gemini_llm`を直接差し替える既存手法(Phase 2から継続)に加え、環境変数`E2E_FAKE_LLM`経由で有効化する`E2eFakeLLM`(`app/ai/llm/fake.py`、Phase 4-3新設)を追加した。前者はpytestと同一プロセス内のFastAPIアプリを対象にでき、後者はPlaywrightが`docker compose`で起動する別プロセスをHTTP越しに操作するだけのため必要になった、テスト実行形態の違いに起因する使い分け。詳細は[`Phase-4-3.md`](./Phase-4/Phase-4-3.md)参照。
- **`E2E_FAKE_LLM`の本番誤有効化への二重防御**: `app/core/config.py`の`Settings._reject_unsafe_production_settings`(Phase 1由来の既存バリデータ)に`ENVIRONMENT=production`かつ`E2E_FAKE_LLM=true`を拒否する分岐を追加。加えて`docker-compose.e2e.yml`は`docker-compose.prod.yml`と独立したオーバーレイとし、本番起動コマンドには一切登場しない構成にした。
- **`docker-compose.e2e.yml`はsamplesへミラーせず`devex-api`直下へ直接反映**: [`Phase-1-introduction.md`](./Phase-1/Phase-1-introduction.md)が確立した「リポジトリ直下のインフラ設定ファイルは写経対象にしない」という前例に倣った(rule #3の例外の再適用であり、新たな例外ではない)。
- **`get_gemini_llm`への`timeout`明示**: Phase 4-3の実装検証中に、`ChatGoogleGenerativeAI`へ`timeout`を渡していなかった(既定無制限)ことを発見。`invoke_with_retry`のリトライは例外発生時のみ機能しハングには無力なため、`settings.LLM_TIMEOUT_SECONDS`(既定60秒、実測に基づかない暫定値)を追加した。詳細は[`Phase-4-5.md`](./Phase-4/Phase-4-5.md)参照。
- **監査で発見・修正した実害2件**: ①`app/services/llm_retry.py`の`LLMQuotaExceededError`/`GenerationFailedError`メッセージが英語のまま日本語UIに漏れ出ていたバグ(バックエンド、[`Phase-4-1.md`](./Phase-4/Phase-4-1.md))。②`ChatPanel.tsx`の`handleApprove`が`try/catch`を持たず、生成トリガー失敗時にボタンが固まったまま復旧不能になるバグ(フロントエンド、[`Phase-4-2.md`](./Phase-4/Phase-4-2.md))。いずれもPhase 2-5・Phase 3-5が作成した箇所への改訂であり、当該章のintroduction相当部分(`Phase-2-3.md`・`Phase-2-5.md`・`Phase-3-5.md`)に1行の参照を追記済み。
- **統合テスト基盤の既知課題(Phase 1由来)を根本修正**: [`Phase-1-1.md`](./Phase-1/Phase-1-1.md)が発見し、Phase 2でも「個別実行」という回避策のまま持ち越されていた`tests/integration/`一括実行時のpytest-asyncioイベントループ後片付けエラーを、Phase 4-1で根本修正した。原因は`app/core/database.py`の`engine`・`app/infrastructure/redis.py`の`get_redis_pool()`がモジュールレベルのシングルトンで、内部コネクションプールが生成時のイベントループに紐づいたままになることだった。`tests/integration/conftest.py`の`client`フィクスチャのteardownで`engine.dispose()`・`get_redis_pool().disconnect()`+`cache_clear()`を行うよう修正し、`tests/integration`一括実行(最終的に9ファイル・9件)がgreenになることを確認した。詳細は[`Phase-4-1.md`](./Phase-4/Phase-4-1.md)参照。
- **`E2eFakeLLM`の設計を実機検証で2度修正**: 当初の設計(ヒアリング完了判定を「HumanMessageが2件以上」、doc_type判別を「ラベル文字列の部分一致」)には、実際にdocker composeで起動したdevex-apiへcurlでアクセスして検証したところ2件の不具合があった((1)完了判定プロンプト自身のHumanMessageを数えてしまい実発話0件でも完了扱いになる、(2)doc_type間の相互参照文言により外部設計書・内部設計書の生成内容が要件定義書と誤判定される)。両方を修正し、当初「Playwrightのみで検証する、追加の単体テストは不要」としていた判断を撤回して`tests/unit/test_fake_llm_e2e.py`を追加した。詳細は[`Phase-4-3.md`](./Phase-4/Phase-4-3.md)「実機検証で発見した2件の不具合」参照。
- **検討したが見送った項目**: `ApiError`(devex-ui `client.ts`)へのバックエンド`code`フィールド読み取り追加。rule #17の判定基準(「今この共通化を駆動している実在の消費者は何か」)に照らし、現状どの画面も`code`で挙動分岐しておらず、Phase 4-1のメッセージ日本語化で`message`のみでも十分ユーザーに伝わるため、追加しないことにした。詳細は[`Phase-4-2.md`](./Phase-4/Phase-4-2.md)参照。
- **`GOOGLE_API_KEY`に関する既往の記録の訂正**: Phase 2〜Phase 4-4まで一貫して「`GOOGLE_API_KEY`未設定のため実LLM未検証」と記録してきたが、本Phaseの実機検証中に`devex-api/.env`へ実際の値が既に設定されていることが判明した(設定時期は本Phaseの範囲では特定していない)。本Phase自体は意図的に`E2E_FAKE_LLM=true`で検証する方針のため、この鍵を使った実際の動作確認は行っていない。詳細は[`Phase-4-5.md`](./Phase-4/Phase-4-5.md)参照。
- **申し送り**: `textbook/appendix/*-retrospective.md`(rule #10)がPhase 0〜3のいずれについても未作成であることが本Phase準備中に判明した。rule #18のセッション分離に従い、振り返り・decision digestの整理(本entryが「Phase完了時にまとめて1回」の実施分)は本Phase生成と同一セッションで行い、**振り返り自体は別セッションで行う**方針にした。詳細は[`Phase-4-introduction.md`](./Phase-4/Phase-4-introduction.md)「申し送り」節参照。

## Phase 4完了後 ── 統合テスト用DBの分離

ユーザーが実際に`devex-ui`のPlaywright E2Eテストを実行する過程で、開発用DBのスキーマ(`users`等9テーブル)が2度消失する事故が発生した。原因は`tests/integration/conftest.py`の`client`フィクスチャが、開発用DBと**同じ`DATABASE_URL`**に対して毎回`Base.metadata.create_all`/`drop_all`を実行する設計だったこと([`Phase-4-3.md`](./Phase-4/Phase-4-3.md)が「既知の残課題」として記録済みだった)。1度目は`alembic upgrade head`で復旧したが、2度目が発生した際、`alembic upgrade head`を実行しても復旧しないという追加の問題が判明した ── `Base.metadata.drop_all`はAlembicの管理外の削除のため、`alembic_version`テーブルは「最新リビジョン適用済み」の記録のまま実テーブルだけが消えるという食い違いが起き、`alembic upgrade head`が「もう最新なので何もしない」と誤判断してしまう。復旧には`alembic_version`テーブル自体を削除してから`alembic upgrade head`をやり直す必要があった。

これを踏まえ、統合テスト専用のPostgres DB(`$POSTGRES_TEST_DB`、既定値`devex-app-db-test`)を開発用DB(`$POSTGRES_DB`)とは別に用意する根本対策を行った。

- `devex-api/docker-compose.test.yml`(新規、`docker-compose.e2e.yml`と同じオーバーレイ構成) ── `backend`コンテナの`DATABASE_URL`だけをテスト専用DBへ差し替える。
- `devex-api/postgres-init/01-create-test-db.sh`(新規) ── Postgresボリューム初回初期化時にテストDBを自動作成する(公式postgresイメージの`docker-entrypoint-initdb.d`仕組み。既存ボリュームには遡って適用されないため、今回は手動で`CREATE DATABASE`した)。
- `devex-api/.env`・`.env.example`に`POSTGRES_TEST_DB`を追加、`docker-compose.yml`のpostgresサービスに`POSTGRES_TEST_DB`環境変数と`postgres-init/`のマウントを追加。
- 統合テストの正しい実行コマンドは以降 `docker compose -f docker-compose.yml -f docker-compose.test.yml run --rm --no-deps backend uv run pytest -m integration tests/integration` に統一する(`devex-api/CLAUDE.md`「テストの分離」節、`tests/integration/conftest.py`のdocstringに明記)。
- 動作確認: この新しいコマンドで統合テスト5件(当時`devex-ui`実リポジトリに存在した分)を実行し、テストDB側にはテーブルが残らず(想定どおりdrop_all済み)、開発用DB側の9テーブルは無傷であることを確認した。
- `docker-compose.test.yml`・`postgres-init/`はrule #3の例外(リポジトリ直下のインフラ設定ファイルは写経対象にしない、[`Phase-1-introduction.md`](./Phase-1/Phase-1-introduction.md)の前例)としてsamplesへミラーせず`devex-api`へ直接反映した。`tests/integration/conftest.py`のdocstring更新のみsamplesにも反映済み。

## Phase 4完了後 ── E2Eスペックの実行時不具合修正

ユーザーが実際に`devex-ui`で`npm run test:e2e`(Playwright)を実行したところ、[`Phase-4-4.md`](./Phase-4/Phase-4-4.md)の2シナリオとも失敗した。`error-context.md`(失敗時点のページスナップショット)とdevex-apiのログを突き合わせて診断し、E2Eスペック(`e2e/devex-flow.spec.ts`)自体の不備2件を発見・修正した(DB分離とは無関係)。

1. **テストパスワードが登録画面の強度ルールを満たしていなかった**: `"s3cret-pass"`は大文字を含まず、`registerSchema`(Phase 3完了後に追加された強度ルール)のクライアント側バリデーションで弾かれ、登録APIが一度も呼ばれないまま`/register`に留まっていた。`"S3cret-pass"`に修正。
2. **2本目のシナリオに登録後の`/login`遷移待ちが無かった**: 1本目のシナリオには`await expect(page).toHaveURL(/\/login/)`という明示的な遷移待ちがあったが、2本目には無かった。そのため、`/register`に留まっている間に後続の`fill()`がそのページ自身のフォームへ入力され、その後`/login`へ遷移した瞬間に`LoginForm`がまっさらな状態で再マウントされて入力が失われ、空欄のまま「ログイン」ボタンが押されてバリデーションエラーになっていた。1本目と同じ待ちを追加して解消した。
3. **`getByText("E2E Fake")`がPlaywrightのstrict mode違反(複数要素にマッチ)になっていた**: `E2eFakeLLM._reply_for()`はオープニング発話と通常のチャット返信を同じ固定文字列で返す設計のため、1回目のユーザー発話後には同一文言のAI発話が2つ存在する。テスト側のロケータに`.first()`を追加して解消した(フェイクLLM側の設計変更ではない)。

`devex-ui/e2e/devex-flow.spec.ts`(実リポジトリ)・`textbook/samples/frontend/e2e/devex-flow.spec.ts`(教材サンプル)の両方に反映済み。詳細は[`Phase-4-4.md`](./Phase-4/Phase-4-4.md)「実機検証で発見した不具合」節参照。

## Phase 5完了後 ── README整備・GitHub Actions自動デプロイ(Phase 5-4、rule #24: Phase完了時にまとめて1回追記)

Phase 5(5-1〜5-3)完了後、ユーザーから2件の追加依頼(README群がテンプレート説明のままであること、GitHub Actionsでの自動デプロイ)があり、Phase 5に4番目の章として追加した。詳細は[`Phase-5-4.md`](./Phase-5/Phase-5-4.md)参照。

- **README整備の範囲**: root `README.md`にdevex-api/devex-uiへのリンク表を追加。`devex-api/README.md`・`devex-ui/README.md`はいずれも冒頭を「Devexとしての主な機能」の説明に書き換え、既存のテンプレート説明(汎用FastAPIバックエンド/next-tamagui-templates)は「本リポジトリの位置づけ(テンプレートとしての出自)」節として保持した(削除しない ── どちらのリポジトリも実際に汎用テンプレートとして再利用可能な基盤を持つため)。
- **`devex-api/CLAUDE.md`・`devex-ui/CLAUDE.md`はいずれも削除しなかった**: ユーザーから当初「両方ともテンプレート作成時のままなので削除」という依頼があったが、実際に内容を精査したところ、`devex-api/CLAUDE.md`は現在のアーキテクチャ(レイヤー構成・エラーハンドリング・LangGraph構成・レート制限・テスト分離・Docker構成)を正確に記述した現役のドキュメントであり、`devex-ui/CLAUDE.md`もTesting節(`__tests__/`配置規約)・バックエンド連携節(`apiFetch`/TTLキャッシュパターン)がPhase 3完了後の相談を通じて実際に更新され続けていた(decision-digest内の「Phase 3完了後」の複数エントリ参照)。この事実をユーザーに提示した上で、最終的に両方とも削除しない方針で確定した。**教訓**: 「テンプレート作成時のまま」という前提は、AI(私)自身の最初の一読による評価だったが、実際には過去のPhaseで参照・更新されていた形跡(他ドキュメントからの引用)を横断的に確認するまで正確性を判断できなかった。同種の削除判断を今後行う際は、対象ファイルへの相互参照を`grep`で洗い出してから判断することを推奨する。
- **GitHub Actions自動デプロイ方式**: `devex-api`(ConoHa VPS)は`.github/workflows/deploy.yml`でtest→SSHデプロイ(`git pull`+`docker compose up -d --build`、レジストリ経由のpush/pull方式は個人開発規模には過剰と判断し不採用)。`devex-ui`(Vercel)はVercelのネイティブGitHub連携がデプロイを担うため、Actions側は`ci.yml`でlint/test/buildのみ(デプロイジョブなし)。
- **CI導入を機に既存lintエラー(devex-api: 49件のE501等、devex-ui: lint 6件+vitest設定漏れ)を是正**: `uv run ruff check .`・`npm run lint`・`npm run test`をCIのゲートに含める以上、既存の未修正debtを放置するとCIが恒久的に赤くなるため、今回のCI導入作業の一環として修正した(CLAUDE.md #17: 「今この作業を駆動している実在の消費者」= 新設したCIワークフロー自身)。`devex-api`側の修正はコメント・docstringの折り返しのみでロジック変更は無く、`textbook/samples/backend/`側のミラーへは反映していない(rule #9が対象とする「クラス名・シグネチャ・型」の変更ではないため)。`devex-ui`側では`vitest.config.mts`が`e2e/`(Playwright仕様)を誤って収集していた設定漏れ(テスト実行のたびに無関係な1件が必ず失敗する原因)と、`HearingCompletionBanner.tsx`の実際のReact Hooksルール違反(早期returnの後にhookを呼んでいた)という、単なる整形を超えた実質的な修正が見つかった。詳細は[`Phase-5-4.md`](./Phase-5/Phase-5-4.md)参照。

## Phase 5完了後 ── 共有Traefikへの移行(Phase 5-5)

実際にConoHa VPSへ`docker-compose.prod.yml`をデプロイしたところ、同じVPSに同居する別プロジェクトが既にポート80/443を専有しており、devex-api自身の`nginx`が起動できなかった。ユーザーは今後も複数プロジェクトをこのVPSに同居させる方針であり、標準的な構成を求めたため、devex-api固有の`nginx`+`certbot`を廃止し、**VPS共有のTraefik**(devex-apiのリポジトリに属さない、VPS共通のリバースプロキシ)へ移行した。詳細は[`Phase-5-5.md`](./Phase-5/Phase-5-5.md)参照。

- **既に80/443を握っていた別プロジェクトも移行が必要**: 2つのコンテナが同じホストポートを同時に持つことはできないため、Traefik導入には既存の他プロジェクトを直接ポート公開からTraefik配下(labelベースのルーティング)へ移す設定変更(短時間の再起動を伴う)が必須になる。これは事前にユーザーへ確認し、了承を得た上で進めた。
- **検討した代替案(不採用)**: VPSに追加IPv4を取得しdevex-apiだけ別IPの80/443を使う案は、既存の他プロジェクトに一切触れずに済む利点があったが、「今後も複数プロジェクトを同居させる」という方針の下ではプロジェクトが増えるたびにIPを追加購入することになりスケールしないと判断し、不採用とした。
- **Traefikを選んだ理由**: Docker Provider(コンテナlabelから動的にルーティングを生成)+ACME(Let's Encrypt HTTP-01)の自動証明書取得を1コンテナで完結でき、新規プロジェクト追加のたびに共有nginxの設定ファイルを手で書き足す必要がない。`OPERATIONS.md`に「新規プロジェクトをTraefik配下に追加する手順」を汎用テンプレートとして記載し、devex-apiの移行はその最初の適用例、既存の他プロジェクトの移行は2番目の適用例という位置づけにした。
- **リクエストボディサイズの防御は失われない**: nginxの`client_max_body_size`が無くなるが、`app/api/middleware.py`の`BodySizeLimitMiddleware`(nginxを経由しない経路でも効くよう元々アプリ層に重ねて実装済み)がそのまま機能するため、防御に穴は開かない。
- **`docker-compose.prod.yml`から`nginx`・`certbot`サービスと関連ボリュームを削除、`backend`にTraefik label+外部ネットワーク`edge`参加を追加**。TLS証明書の取得・更新はTraefikのACME機能に完全に委譲し、certbotの手動cron運用は不要になった。

## Phase 5完了後 ── 実VPSデプロイで発覚したTraefik関連の2件の不具合(Phase 5-5追補)

ユーザーが実際にConoHa VPS上でPhase 5-5の手順を実行したところ、2件の実害ある不具合が見つかり、対話的なデバッグの末に解決した。両方とも`OPERATIONS.md`・[`Phase-5-5.md`](./Phase-5/Phase-5-5.md)に反映済み。`docker-compose.prod.yml`自体の修正(`traefik.docker.network=edge`label追加)はユーザー自身が直接反映した。

1. **`traefik:v3.3`がDocker Engine 29+と非互換**: Docker 29がAPI最小サポートバージョンを1.44に引き上げたため、`v3.3`が使う古いDockerクライアント(APIバージョン1.24固定)がデーモンとの通信に失敗し、Traefikがコンテナを一切検出できなかった(`client version 1.24 is too old`エラーで無限リトライ)。`DOCKER_API_VERSION`環境変数での回避は効果が無かった(Traefikの内部Dockerクライアントはこの環境変数を参照しない)。`traefik:v3.6`(Docker API自動ネゴシエーション対応)へのイメージタグ変更で解決した。
2. **複数ネットワーク参加時は`traefik.docker.network`の明示が必須**: `backend`が`internal`(DB/Redis用)と`edge`(Traefik用)の2つのネットワークに参加している状態で、Traefikにどちらを使うか明示しないと誤ったネットワーク側のIPで接続を試み`504 Gateway Timeout`になった。`traefik.docker.network=edge`labelの追加で解決した。

**教訓**: どちらもローカル環境では再現できない類の不具合(Docker Engineの実際のバージョン差異、Traefikの複数ネットワーク解決の実際の挙動)であり、「実VPSデプロイはユーザー自身が行う」というPhase 5の一貫した方針の妥当性を裏付ける実例になった。`OPERATIONS.md`の該当箇所には「既知の注意点」として両方とも明記し、今後quaiz-api等を追加する際に同じ問題を踏まないようにした。

## Phase 5完了後 ── デプロイ・運用準備(rule #24: Phase完了時にまとめて1回追記)

Phase 5の生成にあたり、事前にユーザーへスコープ(WBS区分5の3項目+Phase4申し送り2点のみ/コード整理も含めて広げるか)・デプロイ先(devex-ui→Vercel、devex-api→契約済みのConoHa VPS)・実施深度(ローカル本番相当検証+手順書整備までか、実ライブデプロイまで行うか)を確認し、**最小スコープ・ローカル検証まで**の方針を選んだ。

- **スコープを意図的に狭めた**: `prompt_templates`テーブルの放置(model+migrationのみ、repository/service/route/UI無し)、レガシーな汎用`conversations`/`messages`/`chat.py`の残存、ドキュメント生成がLangGraphを使わず手続き的な`llm.ainvoke()`呼び出しである点の3件は、いずれも本Phaseでは着手せず将来課題として記録するに留めた。詳細は[`Phase-5-introduction.md`](./Phase-5/Phase-5-introduction.md)「対象外にした既知の課題」参照。ステージ2のShould have要件(バージョン管理・プロンプトテンプレート選択等)を含め、次のPhaseを立てるかどうかは未定。
- **既存インフラの監査が中心だった**: `devex-api`には既にPhase 1が発見済みの本番用Docker一式(`backend/Dockerfile`の3段構成、`docker-compose.prod.yml`、`nginx/nginx.prod.conf`)がスターターテンプレート由来で存在したため、WBS区分5の「Dockerイメージ最適化」「デプロイ検証」は新規構築ではなく監査+不足補完(`HEALTHCHECK`命令の追加、`nginx`の`depends_on`を`condition: service_healthy`化)が中心になった。詳細は[`Phase-5-1.md`](./Phase-5/Phase-5-1.md)・[`Phase-5-2.md`](./Phase-5/Phase-5-2.md)参照。
- **`GEMINI_MODEL`の遡及的訂正**: 実`GOOGLE_API_KEY`で初めて実際にGemini APIを呼び出したところ、[`Phase-1-2.md`](./Phase-1/Phase-1-2.md)がspec確定値として設定した`gemini-2.5-flash-lite`が新規利用不可(404 NOT_FOUND)になっており、後継の`gemini-3.5-flash-lite`へ変更する必要があった(CLAUDE.md #12の遡及訂正、[`Phase-1-introduction.md`](./Phase-1/Phase-1-introduction.md)に1行の参照を追記済み)。あわせて`app/core/config.py`のクラス既定値が`.env.example`修正時(Phase 1)に見落とされたまま`gemini-2.5-flash`(`-lite`すら無い旧テンプレート値)だったことも発見・修正した。詳細は[`Phase-5-2.md`](./Phase-5/Phase-5-2.md)参照。
- **`LLM_TIMEOUT_SECONDS`を実測に基づき60秒→30秒に変更**: 実`GEMINI_MODEL`に対し800字/3,000字/6,000字相当の出力を要求する3パターンを実行し、最大11.25秒という実測値を得た。実測最大値の約2.7倍のマージンを見て30秒とした(旧値60秒は[`Phase-4-5.md`](./Phase-4/Phase-4-5.md)が記録した通り実測に基づかない暫定値だった)。詳細は[`Phase-5-2.md`](./Phase-5/Phase-5-2.md)参照。
- **証明書取得(certbot)は「手順設計まで」に意図的に留めた**: 実ドメインが無いローカル環境では実際のLet's Encrypt発行を検証できないため、`docker-compose.prod.yml`に`profiles: ["certbot"]`のワンショットサービスを追加して手順を実行可能な形にしつつ、実行自体(証明書の実発行)はユーザーが実VPS上で行う運用とした。ローカル検証は一時的な自己署名証明書で代用した。手順は[`devex-api/OPERATIONS.md`](../devex-api/OPERATIONS.md)にまとめた。
- **`devex-api`直下のインフラ設定ファイルは引き続きsamplesへミラーせず直接反映**: [`Phase-1-introduction.md`](./Phase-1/Phase-1-introduction.md)が確立した前例をそのまま踏襲(`docker-compose.prod.yml`・`nginx/*.conf`・`backend/Dockerfile`・`OPERATIONS.md`・`devex-api/README.md`・`devex-ui/README.md`・`.env`/`.env.example`)。samplesへ反映したのは`app/core/config.py`(Phase 4-3以降既にsamples対象)の値変更のみ。
- **`devex-ui/CLAUDE.md`の陳腐化は対象外のまま**: `src/features/{dashboard,hearing,documents}`等のDevex機能層を反映していない既知の課題([[feedback_direct_impl_scope]]と同種の「実プロジェクトへの直接反映」の話ではなく、単純な文書債務)だが、運用マニュアル整備とは別の作業としてスコープ確定時に対象外と合意した。次にこのファイルへ手を入れる機会があれば解消を検討する。
- **申し送り**: [`Phase-4-introduction.md`](./Phase-4/Phase-4-introduction.md)が申し送った「`textbook/appendix/*-retrospective.md`(rule #10)がPhase 0〜4のいずれについても未作成」という既知の負債は、本Phase完了時点でも解消していない。rule #18に従い本Phaseでも着手せず、**別セッションでPhase 0〜5の振り返り・decision digestの整理・`q_a.md`の追記をまとめて行う**ことを推奨する。詳細は[`Phase-5-introduction.md`](./Phase-5/Phase-5-introduction.md)「申し送り」節参照。

## Phase 6着手 ── ステージ2の仕様診断(#28)

Phase 5(実VPSデプロイまで)完了後、ステージ2(Should have要件: バージョン管理・履歴保持/プロンプトテンプレート選択/エラーハンドリング堅牢化・ログ構造化・監視強化)の着手にあたり、rule #28に沿って4ドキュメント+実コードへの影響調査を行った。詳細は[`Phase-6-introduction.md`](./Phase-6/Phase-6-introduction.md)参照。

- **セッション境界(#18)に従い、Phase 6の着手そのものは別セッションへ持ち越した**: Phase 5完了と同一セッション内でCLAUDE.md「進行のルール」の改訂(rule #34追加)を行っていたため、そのセッションでは新規Phase生成を開始せず、新しいセッションでPhase 6に着手した。
- **最重要5点を確定**: (1)バージョン履歴の保持件数は現状の3件キャップを維持、UIのみ新設。(2)復元は新バージョン追加(上書きしない)。(3)`projects.template_id`をサーバー側に永続化し、合流先は`doc_generator_service.py`ではなく`chat_service.py`(ヒアリングのシステムプロンプト)。(4)内部設計書の「DEBUGログにプロンプト内容を含める」記述を撤回し、メタデータのみ記録するプライバシー配慮を追加。(5)監視強化は`structlog`+`SENTRY_DSN`設定時のみ有効化するSentry+既存`/health`への外部アップタイム監視、という個人開発規模に見合う具体案を採用。
- **ドキュメントの記述不整合を是正**: 4ドキュメントが「MVPで既に実装済みの機構」(バージョン増分+3件保持、共通エラーレスポンス形式)を未着手のShould have機能であるかのように記述していた点を修正し、Should have分は「その上に被せるUI/監視/ログ強化」であることを明確化した。
- **章立て(5章、ユーザー確認待ち)**: 6-1バージョン履歴API/6-2バージョン履歴UI/6-3テンプレートAPI/6-4テンプレート選択UI/6-5エラー・ログ・監視、という機能×レイヤーの分割案を提示した。

## Phase 7完了 ── ステージ3(UML設計図パイプライン)着手: 設計フェーズ

Phase 5完了後の要件整理([`appendix/stage3-requirements-organization.md`](../appendix/stage3-requirements-organization.md)、決定事項D1〜D8)を受け、Phase 7として設計フェーズ(仕様診断・D5確定・スパイク・`docs/`反映)を実施した。詳細は[`Phase-7-introduction.md`](./Phase-7/Phase-7-introduction.md)参照。

- **本Stage固有の進行特例**: ユーザー指示により、Stage 3に限りコードを`devex-api`/`devex-ui`本体へ直接反映する(通常のsamples-onlyから変更)。ただし教材・samplesは通常どおり作成し、samples側の#29 Phaseタグは本体コードには一切書かない。ユーザーはPhaseごとにテストを実行し確認後、次Phaseへ進む指示を出す。
- **ブランチ運用の確定**: `devex-api`は`stage2-phase6`をmainへマージ済み(PR#1)・`stage3`ブランチで以降のPhaseを進行する。`devex-ui`とこのリポジトリ(`devex`本体)はいずれもブランチを切らず`main`直下で継続する(Phase 0〜6と同じ運用。事前の検討メモにあった「3リポジトリ共通でブランチを切る」という想定は、ユーザー確認の結果このプロジェクトでは不採用になった)。
- **D5(図↔文書対応表)を確定**: コンポーネント図・ER図・処理別DFDはすべて`internal_design.md`(3.2節・3.3節)に寄せ、アクティビティ図のみ`external_design.md`(2.2節)に残した。`internal_design.md`が既にモジュール構造・データモデルを扱っており、`external_design.md`は利用者向け仕様のみという実際の文書構成を根拠にした。対応表は[`docs/internal_design.md`](../docs/internal_design.md) 3.3節「3. UML設計図パイプラインの図↔文書対応」に反映済み。
- **`docs/*.md`への反映**: `requirements.md`(1.4節Could haveに1項目)、`external_design.md`(SCR-007・2.6節新設)、`internal_design.md`(`uml_diagrams`テーブル・データ辞書・D5対応表・UML APIエンドポイント)、`implementation_plan.md`(ステージ3節、Phase 7〜14のロードマップ、「2ステージ」→「3ステージ」)に反映した。Stage3全体は`docs/requirements.md`上ではCould have階層とした(Stage1=Must、Stage2=Shouldという既存の「Stage番号=優先度階層」の慣例を踏襲。Stage3内部のMust M1〜M9aとは別軸)。
- **React Flow×Tamaguiスパイク(使い捨て)**: `@xyflow/react@^12.12.0`を`devex-ui`へ追加し、`app/.../projects/[id]/uml/page.tsx` + `src/features/uml/components/UmlPageContent.tsx`(Phase 11で使う予定の実配置)でダミーノードを描画する検証を行った。`npx tsc --noEmit`・`npm run lint`・`npm run test`(既存220件+新規1件)・`npm run build`すべて成功。jsdomの`ResizeObserver`未実装によるReact Flowのテスト失敗を懸念したが、Tamagui `Select`用に既存の`vitest.setup.ts`ポリフィルがそのまま効き、追加対応は不要だった。
- **レイアウトエンジン移植の見通し(文書化のみ)**: 標準ライブラリのみ・約950行・自己完結・同一ユーザー所有(ライセンス障壁なし)と判定し、Phase 9移植時の申し送り事項5点(assertの例外化、O(n²〜n!)の計算量対策、未使用import等の整理、日本語文字幅推定の流用、既存テスト不在への対応)を[`Phase-7-4.md`](./Phase-7/Phase-7-4.md)に記録した。コードのコピーは行っていない。

## Phase 7完了後 ── `devex-ui`のルートグループ名リネーム(`(proteced)`→`(protected)`)にまつわる後始末

Phase 7完了報告後、ユーザーが個別テストを実行しようとしたところ2段階のトラブルが発生し、最終的にすべて解消した。

1. **`devex-ui`側で`(proteced)`typoが独立に修正されていた**: ユーザーがセッション外(自身のエディタ等)で、`src/app/(pages)/(proteced)/`配下(dashboard/chat/documents/projects new/uml)全体を正しい綴り`(protected)/`へリネーム済みだった(中身は無変更、`git diff`で内容一致を確認)。Phase 7完了報告後・本セッションの外で行われたため、報告時点のgit statusには現れていなかった。
2. **自分の後始末ミス**: 上記に気づかないまま、不足していた`uml`のページテストを追加した際、古い綴り`(proteced)`側に作成してしまい、`../page`のimportが解決できず1件だけ失敗する状態になった。原因判明後、この誤配置ファイルを削除し、既にユーザー側で用意されていた`(protected)`側の同等テスト(1件、正常動作を確認済み)に一本化した。
3. **`.next`型検証ファイルの古いパス参照**: リネーム前に実行した`npm run build`の生成物(`.next/types/validator.ts`等、Next.js自動生成・手動編集不可)が`(proteced)`パスを指したまま残っており、`npx tsc --noEmit`が10件のエラーを出した。`devex-ui`の実ソース(`src/**`)を検索した結果、`(proteced)`/`(protected)`を直書きした相対パス・importは存在しないことを確認(ユーザーにも提示し合意済み)。`.next`削除+`npm run build`による再生成のみで解消し、ソースコードの変更は行っていない。
4. **最終確認**: `.next`再生成後、`npm run lint`(既存警告1件のみ、Phase 6由来で無関係)・`npx tsc --noEmit`(エラー無し)・`npm run test`(44ファイル・221件全成功)・`npm run build`(全ルート正常生成)を確認した。

**教訓**: 複数リポジトリを横断する長時間セッションでは、ユーザー自身がセッション外で行った変更(エディタでのリネーム等)がgit statusのスナップショットに反映されるまでタイムラグがあり得る。パスに依存する新規ファイルを追加する際は、直前に確認した構成を過信せず、都度`git status`/実ディレクトリ構成を再確認するのが安全。

## Phase 8完了 ── 意味モデル・データ辞書・CRUD/validate API

[`Phase-7-introduction.md`](./Phase-7/Phase-7-introduction.md)「次のフェーズ」を受け、Phase 8として`app/uml/domain/`(意味モデル)・`app/uml/validation/`(M4構造検証+DFD規則)・`data_items`/`uml_diagrams`(永続化)・CRUD/validate APIを実装した。詳細は[`Phase-8-introduction.md`](./Phase-8/Phase-8-introduction.md)参照。

- **着手前の設計判断3点を確定**(`docs/internal_design.md`の未決事項・未記載事項の解消): (1) `DataItem`の永続化は専用テーブル`data_items`(project_id FK + name一意制約 + fields)に確定。プロジェクト単位のJSONBは、項目単位のCRUD・一意性制約・未参照検証のしやすさで見送った。(2) `DataItem`用の最小限CRUD APIを`/projects/{id}/uml/data-items`系として新規公開(`docs/internal_design.md`3.3節②のエンドポイント表は元々diagrams系4本のみだった)。(3) DFD検証規則「上位図と下位図の境界フローが一致する」(診断8)はPhase 8では実装せず、`uml_diagrams`に`parent_diagram_id`/`level`等の階層列も追加しないことを確定。Phase 10のAI生成設計は診断8本文が示す「APIエンドポイント/バッチごとに1枚」というフラットな複数図構成を前提に行う(列を先に追加すると、実際の検証にはノード単位の対応情報が別途必要になり、Phase 10で結局作り直す手戻りの方が大きいと判断)。
- **既存コードベースに前例の無い新規パターンを2つ導入**: (1) `semantic_model`をAPIスキーマ(`app/schemas/uml_diagram.py`)で生`dict`ではなく`app.uml.domain.SemanticModel`(discriminated union)としてそのまま公開する(既存の`project.intake`等は生dict)。(2) `UmlDiagram.version`による楽観ロック(PUT時にリクエストのversionとDB上の値が不一致なら`UmlDiagramVersionConflictError`/409)。`generated_documents.version`は「再生成のたびに増える版数」であり別物であることを明記した。
- **`POST /diagrams`はPhase 8時点ではプレースホルダー**: M1(AI生成トリガー)の実装はPhase 10。Phase 8では指定notationの要素・関係が空のdraftを作るだけの`UmlDiagramService.create`として実装し、その旨をコード・教材双方に明記した。
- **動作確認で2件のバグを発見・その場で修正**: (1) テストヘルパー`_create_project`が固定メールアドレスを使っていたため、同一テスト内で2プロジェクト作成すると`users.email`一意制約違反になっていた(呼び出しごとに一意化して解消)。(2) `UmlDiagramService.update`/`DataItemService.update`が、`onupdate=func.now()`のサーバー計算列(`updated_at`)を`commit`直後に同期アクセスして`MissingGreenlet`になっていた(`await self._session.refresh(...)`を追加して解消)。詳細は[`Phase-8-2.md`](./Phase-8/Phase-8-2.md)・[`Phase-8-3.md`](./Phase-8/Phase-8-3.md)「動作確認で見つかった落とし穴」参照。
- **検証結果**: Phase 8分52件・全体222件のユニットテストが成功、`ruff check .`全通過、`uvx pyright`はPhase 8由来の新規エラー0件(既存の既知1件のみ残存)、`alembic history`でリビジョンチェーンの連結を確認。**Postgres実DBへの`alembic upgrade head`/`downgrade`往復確認は本セッションの環境制約(Docker不可・Postgres未起動)により未実施**。次回`docker compose`が使える環境での実行を推奨する(詳細は[`Phase-8-4.md`](./Phase-8/Phase-8-4.md)「動作確認」参照)。
- **申し送り**: Phase 9着手時は[`Phase-7-4.md`](./Phase-7/Phase-7-4.md)「Phase 9への申し送り」節(レイアウトエンジン移植時の対応点5点)を必ず参照すること(ユーザーからの明示的な指示)。DFD境界フロー一致検証の申し送りは本エントリ・[`Phase-8-introduction.md`](./Phase-8/Phase-8-introduction.md)を参照。

## Phase 8完了後 ── ルーター層の設計統一(Repository直接参照の禁止)

Phase 8完了報告後、「routeから直接Repositoryを呼び出す場合とServiceを経由する場合の設計判断」についてユーザーと相談した。詳細は[`Phase-8-5.md`](./Phase-8/Phase-8-5.md)参照。

- **既存の暗黙の基準を確認**: `devex-api`は「単純な読み取りはRepository直呼び、書き込み・複数Repo調整・外部LLM呼び出しはService経由」というCQRS的な基準に暗黙に従っていた(`projects.py`の`list_projects`/`get_project`/`get_hearing_history`/`list_generated_documents`/`download_generated_document`、`prompt_templates.py`の`list_prompt_templates`の計6箇所がRepository直呼び)。Phase 8の`app/uml/routes/uml.py`だけは全操作をService経由に統一しており、2つの流儀が混在していた。
- **業界動向の調査**: 前者はArdalis等が支持するCQRS的な立場、後者はArchUnit等で強制する実務現場やFastAPI公式`full-stack-fastapi-template`("The API layer contains only route handlers with no business logic")に見られる立場であることを確認した。
- **ユーザー決定**: 「常にService経由、Repository直参照は層違反として禁止」で統一する。理由: (1) 将来の処理追加時にServiceを新設する手戻りを避けられる拡張性、(2) ルートごとに経路を判断する余地を減らしたい。
- **対応**: `app/services/{project,chat_service,doc_generator_service}.py`に薄いラッパーメソッド(`list_for_user`/`get_detail`/`list_history`/`list_current_documents`/`get_document`)を追加し、`app/services/prompt_template.py`(`PromptTemplateService`)を新設。`projects.py`/`prompt_templates.py`からRepositoryの直接importを全て除去した。
- **対象外とした境界**: `app/api/deps.py`の`get_current_project`(内部で`ProjectRepository.get_by_id`を直接呼ぶ)は対象外とした。ルートハンドラ本体ではなく、既存の`get_current_user`と同じ「認証・所有権解決を担う共有依存関数」という既存の例外カテゴリに属すると判断したため。
- **検証結果**: 全体231件のユニットテストが成功(新規追加分含む)、`ruff check .`全通過、`uvx pyright`は本改訂由来の新規エラー0件。動作確認中に、新規テストの`_create_project`ヘルパーが固定メールアドレスを使っていたための`users.email`一意制約違反(Phase 8-2で見つけたものと同種のバグ)を発見・その場で修正した。
- **記録**: 変更元Phase(Phase 2・Phase 6)のintroductionにも1行の参照を追記済み([`Phase-2-introduction.md`](./Phase-2/Phase-2-introduction.md)・[`Phase-6-introduction.md`](./Phase-6/Phase-6-introduction.md)「後続Phaseでの改訂」節)。

## Phase 9完了 ── レイアウトエンジン移植・レーン/行割り当て・`/layout` API

Phase 8完了後の指示「Phase 9を開始する。過去のPhaseからの申し送り事項を見落とさない様注意」を受け、着手前に[`Phase-7-4.md`](./Phase-7/Phase-7-4.md)「Phase 9への申し送り」5点・`appendix/stage3-requirements-organization.md`診断3・移植元エンジン(950行)全文を2エージェントで横断調査してから実装した。詳細は[`Phase-9-introduction.md`](./Phase-9/Phase-9-introduction.md)参照。

- **申し送り5点への対応を確定**: (1) assertのうちnode()/edge()由来3点はM4構造検証との統合(実行前ゲート)で到達し得ない状態にし、実行時に本当に起こりうる2点(幅超過・経路探索失敗)のみ専用例外化。(2) ノード数上限(`MAX_ELEMENTS`共有)+`asyncio.to_thread`。(3) 未使用`import math`は移植せず、`_cost()`の重み定数は用途コメント付き定数に分解。(4) 日本語文字幅推定(`wrap`/`tw`/`cw`)は逐語移植。(5) 各章でゴールデンテストを新規作成。
- **移植元に無い新規アルゴリズムを追加**: lane/rowの自動割り当て(`ranking.py`)。laneは要素の`layer`属性(初出順+フォールバックレーン)、rowはDFSによるback edge除去+最長経路法によるレイヤリング。移植元は人手指定前提のため、devex独自の設計判断として新規実装した。
- **移植元との対比で2点を簡略化**: (1) `allow_swap`の手動選別を廃止し、行が全て自動算出であることを理由に**全要素を交差削減の対象**にする(`crossing_reduction.py`)。(2) `lane_weights`/`lane_w_hint`を持たず、全レーンを均等幅として扱う(`geometry.py`)。
- **このセッションで確定した設計判断**: ER図のlane割り当ては`layer`を持たないため、`lane=0`固定+意味モデル内の定義順indexという機械的なフォールバックにする(ユーザーへ2案を提示し選択を得た。将来ER専用のレイアウト改善は別Phaseの余地として残す)。
- **`layout_model`の設計**: 移植元で座標算出とSVG/drawio出力が同一コードだった点を踏まえ、Phase 9では`to_svg`/`to_drawio`(`app/uml/export/`、Phase 12)を含めず、ノード座標・辺の折れ点・lane/row・交差/重なり/衝突数のみを`LayoutModel`として永続化する設計にした。
- **Phase 9完了後の相談で確定(依存ライブラリの方針)**: レイアウト処理へのライブラリ適用を検討し、採用したのは標準ライブラリ`graphlib.TopologicalSorter`(`ranking.py`の最長経路レイヤリング)だけ。networkxは`import`だけで約17.8MBかかり、置き換えられる量が`graphlib`と同じなので不採用。経路探索・仕上げ処理・線分判定は、レーン×行の格子という前提に合うライブラリが無いので自作のまま。以後も「標準ライブラリで足りるなら第三者ライブラリを入れない」を基準にする。評価の表は[`Phase-9-1.md`](./Phase-9/Phase-9-1.md)「ライブラリ適用の検討」節。
- **Phase 9完了後の相談で確定(出自表記)**: 移植元の別プロジェクト名は全ファイルで使わない。出自は「別プロジェクトの自作図生成エンジンから移植」の一般名1行だけにする(appendix D3を更新)。
- **検証結果**: Phase 9分23件・全体261件のユニットテストが成功、`ruff check .`全通過、`uvx pyright`はPhase 9由来の新規エラー0件、`alembic history`で既存チェーンに変更が無いことを確認(Phase 9は新規マイグレーション不要、Phase 8で確保済みの列・テーブルを使用)。
- **申し送り**: Phase 10(AI生成)は要素への`layer`設定の責務を持つ。DFD境界フロー一致検証(Phase 8からの申し送り)は診断8本文どおりフラットな複数図構成を前提に設計すること。Phase 12(export)は`LayoutModel`がexportに必要な情報を過不足なく持つか確認すること。

## Phase 10完了 ── AI生成(構造化出力)・内部設計書プロンプトへの「処理別データフロー」節追加

[`Phase-9-introduction.md`](./Phase-9/Phase-9-introduction.md)「次のフェーズ」を受け、M1(設計図のAI生成)を実装した。Phase 8のプレースホルダー`POST /diagrams`を置き換えた。詳細は[`Phase-10-introduction.md`](./Phase-10/Phase-10-introduction.md)参照。

- **着手前にユーザーが確定した事項**:
  1. 実行方式はBackgroundTasks(202+ポーリング)。
  2. 再生成は`(project, notation, subject)`単位で上書きする。
  3. DFDはフラット構成(処理ごとに1枚)で確定し、境界フロー一致規則を撤回する。未参照データ項目は全DFD横断で判定する。
  4. DFDの対象は、内部設計書の固定形式の見出し(`#### DF-<n>: <処理名>`)を正規表現で決定的に列挙する(LLMを呼ばない)。
  5. 生成単位は個別と一括の両方。一括は1回5件まで。
  6. 図の「数」の上限は設けない。止まった理由は生成履歴(`uml_generation_runs`)に残す。伝えるのは「理由」と「再度の生成指示が必要なこと」。
  7. 入力の節の抽出を全図に適用する。ERは30件を超えるとき部分図にする。
- **撤回した推奨値**: 計画の初版に「DFDは1プロジェクト10件まで」を置いたが、既存文書に根拠の無いClaude自身の推奨値だった。ユーザーの指摘で撤回した。件数を縛っているのはトークンではなくクォータ(呼び出し回数)であり、図によって消費も違うため、数の上限ではなく生成履歴で扱う形に改めた。
- **LLM出力専用スキーマを分離**: ドメインモデルは`DfdFlow.data_item_id`(UUID)とdiscriminated unionを持つため、構造化出力に向かない。記法ごとにフラットで全項目必須のスキーマにし、`layer`を必須にした(Phase 9の申し送り)。データ項目は名前で参照させ、サービス層が名前→UUIDに解決する。既存の項目は上書きしない。
- **既存コードに前例の無い新規パターン**: `with_structured_output(schema, include_raw=True)`で`finish_reason`を読み、`MAX_TOKENS`(トークン上限。再試行しない)と解釈失敗(再試行する)を区別する。`llm_retry`は`LLMTokenLimitError`と入力トークン超過(Gemini 400)をリトライしないよう改訂した(#12、Phase-2-5の遡及)。
- **生成状態は別の軸**: `generation_status`/`generation_error`をレビューの`status`と分けた。生成中の図のPUT・レイアウトは409で拒否する。同時実行はプロジェクトごとに1本。
- **写経順序の配慮**: `UmlDiagramService.create`の削除はルート差し替えと同じ10-6に置いた。前方importの考え方を削除にも当てはめ、どの章の時点でもテストが通るようにした。
- **検証結果**:
  - 全体325件のユニットテストが成功(Phase 9時点は261件)。
  - `ruff check .`は全通過。`uvx pyright`はPhase 10由来の新規エラー0件。
  - 開発用Postgresで`alembic upgrade head`→`downgrade -1`→`upgrade head`の往復を確認。Phase 8で未実施だった実DBでのマイグレーションを、ここで初めて確認できた。
  - 実Gemini(`gemini-3.5-flash-lite`)でcomponent・DFDの構造化出力が`finish_reason=STOP`で返り、M4検証を通過した。
  - samplesのオーバーレイでも325件が成功した。
- **申し送り**:
  - Phase 11(FE)は、`GET /diagrams`の`generation_status`をポーリングし、`GET /candidates`・`GET /generation-runs`で選択UIと履歴を作る。
  - Phase 13は、`source_doc_versions`(`{"internal_design": <version>}`)で陳腐化を検知する。
  - プロセスが落ちて`generating`のまま残る問題は、既知の制約のまま残っている。

## Phase 10完了後 ── フォルダ構成の再整理(検討課題として記録)

Phase 10完了後、ユーザーから2つの質問を受けた。1つは「`app/uml/generation/schemas.py`を`app/schemas`に置かなかった理由」。もう1つは「md生成とUMLでフォルダ分けのルールが違うので、(md | uml | 共通)で再整理すべきか。すべきなら今かStage 3終了時か」。ユーザーの判断は「ファイル配置は現状維持。後の検討課題として記録する」。

- **現状のルール(明文化)**:
  - 層フォルダ(routes・services・repositories・models・schemas)はI/Oの境界であり、md側・uml側の両方のファイルが同居している(`uml.py`・`uml_diagram_service.py`・`uml_diagram.py`等)。
  - `app/uml/`は、I/Oを持たないUMLの純粋ロジック(domain・layout・validation・generation)である。外への依存は末端モジュールの`app.services.errors`だけ。
  - md側の純粋ロジック(プロンプト定数・`_render_transcript`)は量が少ないので`doc_generator_service.py`の中にある。これが「ルールが違う」ように見える原因である。
- **`schemas.py`の配置理由**: 理由は2つ。(1) 依存を「外側 → `app/uml`」の一方向に保つため。(2) UMLの出力スキーマはAPIに出ないLLM境界の型だから。一方、`app/schemas/generation.py`の`HearingCompletionCheck`はAPIのレスポンスも兼ねる。詳細は[`Phase-10-2.md`](./Phase-10/Phase-10-2.md)。
- **今は再整理しない理由**:
  - CLAUDE.md #17(b)(駆動する消費者がいない遡及クリーンアップは行わない)。
  - Phase 2〜10の教材・samples(パス・#29タグ・import)への影響が大きい。
  - `devex-api`はテンプレートでもあり、層を先に分ける構成がその前提である。
- **検討課題(再判定のタイミング)**:
  - (1) **Phase 13着手時**: 内部設計書のMarkdownを読み書きする純粋ロジック(`app/uml/sync`・アンカー・要素表の差し込み・陳腐化の検知)が増える。「内部設計書の形式の取り決め」(`doc_generator_service.py`のプロンプトの見出し形式+`app/uml/generation/sections.py`のパーサ+アンカー)をmd側・uml側で共有する必要が出たら、「共通」の純粋パッケージとして切り出すかを判定する。
  - (2) **Stage 3終了時の振り返り**: 上記以外の観点も含めて要否を判定する。
  - 実施する場合は、#18に従いPhase生成とは別のセッションで行う。
  - **[T2 で確定 ── 再整理しない]** 再判定のタイミングを過ぎたまま未判定だったため、T2 で判定した。駆動する消費者がいない(#17(b))ため、見送りを確定した。詳細は下の「T2(ステージ4完了後)」。

## Phase 11完了 ── フロントエンド(Adapter・React Flowのプレビュー/編集)と生成の受け付け・ポーリング・履歴

[`Phase-10-introduction.md`](./Phase-10/Phase-10-introduction.md)「後続Phaseへの申し送り」を受け、M5(レビューUI)とM6(自動レイアウトの初回・再実行)を実装した。Phase 7のスパイクを本実装に置き換えた。詳細は[`Phase-11-introduction.md`](./Phase-11/Phase-11-introduction.md)参照。

- **着手前にユーザーが確定した事項**:
  1. 手動座標はPUTに含め、意味モデルと同じversionで保存する(座標専用のPATCHは作らない)。
  2. 編集は3記法とも要素・関係の追加・削除と属性。ERはカラム表を含む。DFDのフローは既存のデータ項目から選ぶだけ。データ辞書の管理UIとundo/redoは後続。
  3. 画面は生成・一覧(`/uml`)とレビュー・編集(`/uml/[diagramId]`)の2つ。
- **BE(11-1)**: `UmlDiagramUpdate.layout_model`(任意)を追加した。保存の直前に`reconcile_layout`で、意味モデルに無い要素・関係のジオメトリを落とす。追加した要素の座標は補わない(自動レイアウトは明示的な再実行のときだけ。M6)。幅・高さは広げるだけで、`metrics`は計算し直さない。`points=[]`を「折れ点なし」(D2)の意味として明記した。
- **正本は意味モデル、React Flowは表示**: Adapterの変換を非対称にした。表示は毎回`toReactFlow`で作り直し、React Flowから戻すのはドラッグで確定した位置だけ(`applyMovedPositions`)。要素・関係の追加・削除・属性の編集は、純粋関数`editOps`で意味モデルに対して行う。appendix 2.7の`fromReactFlow`は、この形に読み替えた。
- **「先に保存してから」の順序**: `POST /layout`と`POST /validate`はDBに保存済みのモデルを入力にする。そのため、未保存の変更があれば先にPUTし、失敗したら中止する。
- **初回の自動レイアウト**: `layout_model`がnullの図を開いたら1回だけ実行する。30件超や検証エラーで配置できないときは、格子配置(`placeMissingNodes`)で表示を続け、理由を見せる。
- **`ApiError.code`**: 409の「競合(`VERSION_CONFLICT`)」と「生成中(`UML_GENERATION_IN_PROGRESS`)」を見分けるため、FEの`ApiError`に共通エラー形式の`code`を載せた。
- **ポーリング**: 生成中かどうかは図の一覧の`generation_status`から導く(`isGenerating`)。打ち切りは4文書生成の3分を再利用した。UML生成向けに実測した値ではない(推奨値)。打ち切った後は「再読み込み」で再開する。
- **モード**: 11-2(APIクライアント)だけ納期モード。他は学習モード。
- **検証結果**:
  - BE: 全体331件が成功(Phase 10時点は325件)。`ruff check .`は全通過。`uvx pyright`は既知の1件のみ。
  - FE: UML機能のテスト89件、`tsc --noEmit`・`lint`(既存の警告1件のみ)・`build`が成功した。全体テストでは既存の8ファイル・9件が並列実行の負荷でタイムアウトした。単独で再実行すると全件成功した(Phase 6-2と同じ既知の現象)。
  - samplesのTS/TSX(47ファイル)は構文チェックを通過した。本体とは、#29のタグとコメント以外で一致することを確認した。
  - **ブラウザでの確認**: Dockerが使えずバックエンドを起動できなかったため、固定データで動くデモページ`/uml-demo`(devex-uiのみ。教材・samplesの対象外)を追加し、ヘッドレスブラウザで表示・ドラッグ・記法の切り替え・属性パネルを確かめた。配置は実エンジンの出力を埋め込んだ。ここで表示の不具合3点(矢印が接続点に隠れる・ERの最後のカラムが切れる・DFDの説明がはみ出す)を見つけて直した。実バックエンドとつないだ確認(保存→再読み込み・自動レイアウトの再実行・409)は未実施。
  - **Phase 9のエンジンの不具合を発見・修正(11-7)**: `ranking.py`の行の割り当てが最長経路の深さだけで決まるため、同じレーンで深さが同じ要素が同じ`(lane, row)`になり、ノードが重なっていた。`metrics.overlaps`は線の重なりの指標なので0のままだった。ユーザーの選択で「同じレーンで衝突したら次の空き行へ下げる」方式(レーンごとに1行1ノードの最長経路法、同じ層の中は定義順)に改めた。既存テストが不具合を期待値として固定していた点も改めた。指標は増やさず、docstringで意味を明記した。BE全体335件が成功。デモの`collisions`も3→0・2→0に減った。
- **申し送り**:
  - Phase 12: `points=[]`の辺はdraw.ioで`orthogonalEdgeStyle`にする。M7(approved後の編集でreviewingに戻す)は未実装。格子配置の要素は`lane=0, row=0`で保存される。
  - 後続: データ辞書の管理UI、undo/redo、レビュー画面のレーン帯。

## Phase 12完了 ── 承認フロー(M7)・draw.io/SVG出力(M8)・ダウンロード

[`Phase-11-introduction.md`](./Phase-11/Phase-11-introduction.md)「後続Phaseへの申し送り」を受け、M7(状態遷移)とM8(決定的な出力とダウンロード)を実装した。詳細は[`Phase-12-introduction.md`](./Phase-12/Phase-12-introduction.md)参照。

- **着手前にユーザーが確定した事項**:
  1. 状態遷移の規則。
     - 保存(座標だけの保存を含む)・自動レイアウトで、どの状態からでも`reviewing`になる。
     - 承認は`draft`/`reviewing`から行え、`{version}`を受け取る。
     - 出力のGETで`exported`になる。
     - 状態が変わってもversionは増やさない。
  2. 辺ラベル(ERの多重度・DFDのデータ項目名)は、レイアウトエンジン(移植済みの`place_labels`)で配置し、`label_pos`に保存する。
  3. SVGでの`points=[]`の辺は、出力の時点で簡易な直交経路にする。
  4. レーン帯は描かない。
- **状態遷移は純粋関数に集める(12-1)**:
  - `app/uml/domain/status.py`に、状態の型・承認/出力の可否・遷移先の定数を置き、サービスはそれを呼ぶだけにした。
  - 承認は次の5つを順に確かめる: 生成中でない、version一致、状態、全要素の配置、検証エラー無し。
  - 検証エラーは件数だけ返し、一覧はFEが`validate`で取り直す。
- **version は内容の楽観ロック専用**: 承認では、見ていた版かを確かめるが、増やさない。増やすと、承認の直後に同じ画面で保存したときに409になる。
- **辺ラベルの文言はレビュー画面と揃える(12-2)**:
  - BEの`labels.edge_labels`とFEの`reactFlowAdapter.ts`に、同じ文言を置いた(言語の境界による必然の重複)。
  - 手で動かした辺は、経路と一緒に`label_pos`も`reconcile_layout`で捨てる。
- **出力は中間表現を挟む(12-3)**:
  - `build_render`(何を描くか: 行の折り返し直し・色・簡易経路・ラベル)と、`to_svg`/`to_drawio`(どう書くか。移植元のコピー、D3)に分けた。
  - draw.ioの変更点は3つ。セルidを`n-<要素id>`/`e-<関係id>`にした。ラベルは中点からのオフセットで書く。`html=1`のセルの値は2重にエスケープする。
  - レイアウトのパッケージは`export`に依存しない。
- **共有の抽出(#17)**: 2つ目の実在の利用者(UMLの出力)が現れたので、共通部分を切り出した。
  - BE: `_content_disposition` → `app/api/responses.py`。
  - FE: `parseFilename`/`saveFile` → `src/lib/api/download.ts`。
  - 失敗の扱いが違う「生のfetch」部分は、共通化しなかった。
- **モード**: 12-4(出力API)だけ納期モード。他は学習モード。
- **検証結果**:
  - BE: 全体382件が成功(Phase 11時点は335件)。`ruff check`は全通過。`uvx pyright`は既知の1件のみ。
  - FE: 全体333件中332件が成功。既存の`IntakeForm.test.tsx`の1件は並列実行の負荷でタイムアウトしたが、単独で再実行すると成功した(Phase 6-2以来の既知の現象)。`tsc --noEmit`は成功、`eslint`は既存の警告1件のみ。
  - samplesは、本体と#29のタグ・コメント以外で一致することを確認した。
  - 出力の目視: DFDとERのSVGを、ヘッドレスChromiumでPNGにして確かめた。
    - 自動レイアウトの図: ラベルは重ならなかった。
    - 手で動かした図: 簡易経路でラベルがノードに重なる場合があった(既知の制約)。
  - 未実施: `.drawio`をdraw.ioで開く確認と、実バックエンドでのブラウザ確認(Dockerが使えないため)。
  - デモページ`/uml-demo`(devex-uiのみ)を Phase 12 に広げた。承認・出力はバックエンド無しで試せる(出力は実エンジンで書き出したファイル`demoExports.ts`を埋め込み)。ヘッドレスブラウザで「承認 → draw.io出力 → 出力済み」とプレビューの表示を確かめた。
- **申し送り**:
  - Phase 13: プレビューへのSVGの差し込みは`build_render`→`to_svg`をそのまま使う。zipのファイル名は`_export_filename`を共有する。文書の出力で図の状態を`exported`にするかは未定。
  - 後続: レーン帯(レビュー画面と出力の両方)、承認の取り消し。

## Phase 13完了 ── 内部設計書への図の反映(M9a)・アンカー・陳腐化の検知・zip

[`Phase-12-introduction.md`](./Phase-12/Phase-12-introduction.md)「後続Phaseへの申し送り」を受け、M9a(図による詳細設計の補完)を実装した。ステージ3の最後の Phase になった(下の「Phase 13完了後」)。詳細は[`Phase-13-introduction.md`](./Phase-13/Phase-13-introduction.md)参照。

> 本 Phase の反映・アンカー・陳腐化・zip は、Phase 24 完了後に簡易モードの設計図ごと削除した(下の「Phase 24完了後」)。ここでの判断のうち、詳細設計モードへ引き継いだのは「等しくないで比べる陳腐化」「図を差し込む zip の規則」「zip に入れた図は`exported`」の3つ。

- **着手前にユーザーが確定した事項**:
  1. 反映は承認と同じトランザクションで自動で行う。文書の再生成・復元でアンカーが消えるので、「図を再反映」(一括)ボタンも置く。書き込みは`is_current`の行の in-place 更新で、版は増やさない(D1 案A。Phase 6 の「既存版は書き換えない」の唯一の例外)。
  2. アンカーはバックエンドが見出しを基準に挿入する。図は文書の後で作られるので、文書を生成する LLM には図の ID を書けない。
  3. 陳腐化は、図と内部設計書の間の双方向だけを見る。文書チェーンに沿った伝播は扱わない。
  4. zip は内部設計書の md と`diagrams/`の SVG・draw.io。zip に入れた図は`exported`にする。
- **Claude の判断**: アンカーに図の版を埋める(DB の列を足すより、復元しても整合が崩れにくい)。プレビューの SVG は`<img src="data:...">`で出し、`rehype-raw`は入れない(スクリプトを実行させない)。md/uml 共通の純粋パッケージは今回も切り出さない(#17。Phase 10完了後の検討課題(1)の判定)。
- **モード**: on(旧ルールでは 13-4・13-5 が納期モード)。
- **検証結果**: BE 428件(Phase 12 は 382件)・FE 363件が成功。zip は展開して中身を確かめた。実バックエンドとつないだブラウザでの確認は未実施(Docker が使えないため)。

## Phase 13完了後 ── コンポーネント図の粒度から、詳細設計モードの構想へ

Phase 13 の完了後、ユーザーが「コンポーネント図の粒度が粗い(`api-service-model`程度)。ファイル単位の責務を知りたい」と指摘した。詳細は[`q_a.md`](./q_a.md)「Phase 13完了後」、構想は[`appendix/detailed-design-mode-organization.md`](../appendix/detailed-design-mode-organization.md)。

- **原因は入力の側**: 内部設計書のプロンプトがファイル単位の責務を求めておらず、図の生成はディレクトリ構成を拾っていた。
- **実務に照らして再検討した**: いったん「機能ごとのコンポーネント部分図」などを選んだが、ユーザーが保留にした。公開資料(C4・arc42・日本の詳細設計)を調べ、構造は「図+責務表(ファイル単位は表)」、振る舞いは実行時のビュー、CRUD 図は定番、重要な部分だけ書く、が分かった。**機能ごとの部分図は撤回した**(実務の裏付けが無いまま勧めていた)。
- **ユーザーの方針**(以後の設計の前提):
  - できるだけ実務に準拠する。
  - 「図から自動コーディングしても設計者のイメージから外れない」は理想形で、要件ではない。まず人がコーディングするのに十分な資料を作る。
  - 4文書の一括生成は残し、要件定義・外部設計の後に段階的に組み立てる「詳細設計モード」を増設する。
  - シーケンス図に当たるものは、まず番号付きの手順から始める。

## Phase 14完了 ── ステージ4(詳細設計モード)着手: 要件定義フェーズ

詳細設計モードを**ステージ4**として切り出し、実装に入る前の要件定義を行った(実装なし)。詳細は[`Phase-14-introduction.md`](./Phase-14/Phase-14-introduction.md)参照。

- **ステージ3の終了**: ステージ3は Phase 13 で終了とし、Phase 13b(M9b: 図の手直しを散文へ戻す AI 修正案)と旧 Phase 14(アクティビティ図・統合/E2E/デプロイ確認)を撤回した。「Phase 14」の番号はステージ4の要件定義に充てた(ユーザーの決定)。13b を撤回した理由: 詳細設計モードでは文書を承認済みの意味モデルから組み立て、散文を正本にしないため。
- **仕様診断(#28)の主な決定**([`Phase-14-1.md`](./Phase-14/Phase-14-1.md)):
  - 段階の状態は`design_stages`(project × stage、状態・承認した版・入力の指紋)に持つ。前段を承認し直したら後段は「古い」と表示するだけで、作り直しは人がボタンで指示する(自動で作り直すと人の手直しが黙って消える)。
  - 機能グループは API のリソース名から決定的に初期値を作り、人が確定する。CRUD 図の R/W は DFD の線の向きから決め、C/U/D と DFD に無い処理の分は AI が下書きして人が確定する。
  - 05 の手順の列は見本どおり。シーケンス図は当面作らない。
- **05・06章の見せ方と出力形式**([`Phase-14-2.md`](./Phase-14/Phase-14-2.md)): 索引・「処理 × モジュール」の関与表・処理ごとのタブ、手順ID(`F-01#4`)と双方向のバッジ、逆引き表。出力は **HTML+md の zip**。HTML は自己完結の単一ファイル(タブ・リンク・SVG 入り)で読む用、md はリンクも生の HTML も持たず ID を本文に書くだけ(差分・AI 入力用)。md の`<a id>`アンカーは多くのビューワーで消えるため。
- **出力見本へのフィードバック**([`Phase-14-5.md`](./Phase-14/Phase-14-5.md)):
  - モードはプロジェクトの作成時に選び、後から変えない(`projects.mode`)。「概要モード」を「簡易ドキュメントモード」に改称した。
  - 詳細設計モードはヒアリングの後に要件定義・外部設計だけを生成し、段階1〜7を「下書き → レビュー・編集 → 承認」で進める。
  - 出力見本(Devex 自身が題材。[`appendix/detailed-design-devex/`](../appendix/detailed-design-devex/README.md))で見つかった気づき10件は、すべて Phase 15 で直す。
  - コードは本体へ直接反映し、samples も並行して作る。
- **ロードマップ**: Phase 15〜20 は暫定とし、各 Phase の着手時に見直す([`Phase-14-4.md`](./Phase-14/Phase-14-4.md))。実際には Phase 16・20・22 で分割し、ステージ4は Phase 14〜24 になった。

## Phase 15完了 ── モードと段階の土台+既存機能の修正

Phase 14 の決定を受け、モードの選択・段階の土台・気づき10件の修正を実装した。詳細は[`Phase-15-introduction.md`](./Phase-15/Phase-15-introduction.md)参照。

- **着手前にユーザーが確定した事項**:
  1. 古い「生成中」を回収するしきい値は15分(UML 図の生成は最大5対象を直列に処理し、1対象1〜2分かかる)。
  2. 回収は文書生成の`projects.status='generating'`にも適用する(生成中を 409 にすると、再起動で止まったプロジェクトが二度と生成できなくなるため)。
  3. `generated_documents`に UNIQUE(project_id, doc_type, version) を足す。既存の重複は自動で消さず、マイグレーションを止める。
  4. devex-api は`stage3`から`stage4`を切る。
- **段階の状態**: DB に保存するのは`draft`/`reviewing`/`approved`だけで、「未着手」「古い」は純粋関数で導く。段階の範囲は docs の「1〜6」を **1〜7** に改めた(段階7も同じ承認の流れに乗せるため)。承認しても version は増やさない(Phase 12 と同じ形)。
- **段階ごとの検証の登録の仕組みは作らない**(#17。実在の消費者がいない)。→ Phase 16 で段階1を最初の消費者として作った。
- **気づきの修正**: 文書生成の失敗時に rollback する。SSE の途中の失敗を`event: error {code, detail}`で画面に出す。Tavily の利用上限も共通のクォータ判定に寄せた。`REFRESH_TOKEN_EXPIRE_DAYS=14`から Cookie の寿命を導く。本体の写経漏れ(`template_id`をサービスへ渡す・`GenerationFailedError.code`)も直した。
- **自動レイアウトの高速化**([`Phase-15-5.md`](./Phase-15/Phase-15-5.md)): 中心を結ぶ線分で評価して並べ、最後に簡易な実経路の評価で約15秒まで仕上げる。9要素・18本で65〜106秒 → 約17秒。交差は見本の DFD で2〜3本増える。
- **モード作成の画面**: ダッシュボードのボタンでダイアログを開き、`/projects/new?mode=`で渡す(作成画面はダイアログでなく独立したページのため)。
- **モード**: on(旧ルールでは 15-4・15-6 が納期モード)。
- **検証結果**: BE 476件・FE 428件が成功。マイグレーションは使い捨ての Postgres 17 で upgrade/downgrade を確かめた。FE は既定の並列数だとフォームのテストが時間切れになることがあり、以後`--maxWorkers=4`で流す。

## Phase 16完了 ── 段階1 機能(処理)一覧

詳細設計モードの段階1を、下書き → 編集 → 承認まで通した。詳細は[`Phase-16-introduction.md`](./Phase-16/Phase-16-introduction.md)参照。

- **着手時にユーザーが確定した事項**:
  1. **Phase 16 は段階1だけ**にし、段階2以降の Phase の番号を1つずつ送った。以後、**1段階 = 1 Phase** が粒度の目安になった。
  2. 外部設計書に「2.6 API一覧」を足し、**両方のモードで出す**(機能グループの初期値の材料が外部設計書に無かったため)。簡易モードの内部設計書 3.3 とはメソッド・パスをそろえる。
- **処理IDの安定**: AI には ID を書かせない。前の版の行とトリガー(メソッド+正規化したパス)で突き合わせ、一致した行は ID と人が確定した機能グループを引き継ぐ。消えた番号は再利用しない。
- **検証は「保存は通し、承認で止める」**: 段階ごとの検証`STAGE_VALIDATORS`をここで作り、承認の条件に「検証のエラーが無い」を足した。生成の対応表は`STAGE_GENERATORS`。
- **下書きの生成**: BackgroundTasks+ポーリング(UML 図の生成と同じ形)。`design_stages`に生成の状態の列を3つ足した。生成中はその段階の生成・保存・承認を 409 にし、15分で回収する。
- **画面確認後に足したもの**: 下書きの完了時にも入力の版を記録する(作り直しても「古い」が消えなかったため)。状態「再生成済(未承認)」(`regenerated`)。種別「画面」(サーバーを呼ばない非自明な処理も機能一覧に載せる)。
- **検証結果**: BE 504件・FE 447件が成功。

## Phase 17完了 ── 段階2 データフロー

詳細設計モードの段階2(機能グループごとの DFD・処理概要表・データ辞書)を通した。詳細は[`Phase-17-introduction.md`](./Phase-17/Phase-17-introduction.md)参照。

- **着手時にユーザーが確定した事項**(4つとも推奨どおり):
  1. DFD は`uml_diagrams`の行(subject=機能グループ名)。SCR-007 のエディタを SCR-008 に埋め込む。段階2の承認は、選んだグループの DFD がすべて承認済みであることが条件。
  2. 生成は「選んでから一括」: グループを選んで保存 → 1回の生成で処理概要表と DFD を作る(1トランザクション、5グループまで)。
  3. データ辞書は`data_items`を再利用し、段階2の画面に表を作る。
  4. 段階2をまるごと1 Phase。
- **段階の model は段階の固有の情報だけ**: 段階2は`{dfd_groups, summaries}`。DFD 本体とデータ辞書は既存のテーブルに置き、model に複製しない(以後の段階3〜4の ER・構成図も同じ)。
- **DFD の処理の箱は処理ID**: AI には`function_id`だけを書かせ、ステージ3の出力スキーマに組み替えて写像を再利用する。
- **段階の差し戻し**: 段階に属する図・データ辞書を直したら、承認済みの段階を`reviewing`に戻す。配置だけの保存・自動レイアウトでも図の承認はやり直しになる(M7)ので、それらでも差し戻す。
- **共有の抽出(#17)**: 生成の関数の引数を`StageGenerationContext`にまとめた。データ項目の名前の解決を`DataItemService.resolve_by_name`で共有した。段階1の表の見た目と検証の結果の一覧を部品に切り出した。
- **自動レイアウト**: グループの DFD(9要素・18本で約16秒)は処理別の DFD と同じ規模なので、上限15秒は据え置き、案C(レーン分離)は実施しないと決めた。
- **検証結果**: BE 526件・FE 479件が成功。

## Phase 18完了 ── 段階3 データモデル

詳細設計モードの段階3(ER・テーブル定義・CRUD 図)を通した。詳細は[`Phase-18-introduction.md`](./Phase-18/Phase-18-introduction.md)参照。

- **着手時にユーザーが確定した事項**:
  1. ER は全体1枚(subject='')。30要素を超えても既存の警告だけ。
  2. **テーブル定義は ER が正本**。`ErColumn`に`constraints`・`description`、`ErElement`に`description`を足し、表は ER からの表示にする。
  3. **CRUD の確定は承認で一括**。AI の下書きのセルは色で区別して警告に出し、人が書き換えたセルと承認で印を外す。DFD の線から決まる R/W は固定。
  4. 段階3をまるごと1 Phase(一度「BE と FE で分ける」と答えた後、章の数を見て決め直した)。
- **DFD のデータストアと ER のテーブルは名前で突き合わせる**(前後の空白を除いて小文字に)。揃わないと警告`STORE_NOT_IN_ER`。改名の追従はしない。
- **再生成は置き換える**(前の版の人の確定は引き継がない)。ER は同じ行を上書きし、承認はやり直し。段階2の`_save_group_dfd`を`_save_diagram`に共通化した(#17)。
- **導いた値はバックエンドが返す**: DFD の R/W は`DesignStageRead.dfd_accesses`で返し、画面で導き直さない。
- **章の順の入れ替え(#15)**: 作業領域を先に作ると後の章の部品を前方 import するため、部品を先に作り作業領域を最後の章で組み立てる順にした。以後の段階の FE も同じ順にした。
- **画面確認後の修正**: 4点を直し、段階の承認の後に完了のダイアログと「次の段階へ進む」を足した([`Phase-18-9.md`](./Phase-18/Phase-18-9.md))。
- **検証結果**: BE 546件・FE 507件(修正後)が成功。

## Phase 19完了 ── 段階4 ソフトウェア構造

詳細設計モードの段階4(構成図・モジュール一覧)を通した。詳細は[`Phase-19-introduction.md`](./Phase-19/Phase-19-introduction.md)参照。

- **着手時にユーザーが確定した事項**:
  1. 構成図は component 図1枚。箱はパッケージ単位で、層をレーンにする。モジュール一覧から自動で描く案は採らなかった(ファイル単位の箱が20個を超えやすく、俯瞰図にならない)。
  2. 「関わる処理」「主な依存先」は AI が下書きし、コードで検証する。CRUD 図から決定的に作る案は採らなかった(テーブルとモジュールの対応が名前の推測になり、外れると固定部分が壊れる)。
  3. 段階4をまるごと1 Phase。
- **model**: `{modules: [{path, layer, responsibility, depends_on, functions, all_functions}]}`。`all_functions`は全処理が通る横断のモジュールの印で、処理のカバーの判定には数えない。
- **再利用**: 構成図の出力スキーマと写像はステージ3の`ComponentGenerationOutput`・`to_component`を使い、プロンプトだけ段階4専用にした。FE の図の埋め込みは`ErEditorSection`を`StageDiagramSection`に共通化した(#17)。
- **画面確認後の修正(以後の段階に効く)**:
  - パスの照合は区切り単位の部分一致(`module_ref_matches`)。依存先にディレクトリを書いても警告にしない。
  - **下書きの表記の規則`NAMING_RULES`**(`app/detailed_design/prompt_rules.py`): 下書きが英語になる問題への対策。詳細設計モードの全段階のプロンプトの末尾に足す(ユーザーの決定)。
- **検証結果**: BE 580件(修正後)・FE 532件が成功。

## Phase 20完了 ── 段階5 主要処理の手順

詳細設計モードの段階5(番号付きの手順・索引・関与表)を通した。詳細は[`Phase-20-introduction.md`](./Phase-20/Phase-20-introduction.md)参照。

- **着手時にユーザーが確定した事項**:
  1. Phase 19 を先にコミットする。
  2. **Phase 20 は段階5だけ**にし、番号を1つ送った(Phase 21 = 段階6)。段階5・6をまとめると12〜14章になり、1段階 = 1 Phase の粒度から外れるため。
  3. **05↔06 の紐づけは (呼び出し先, 関数) から導く**。手順の行は`callee`と`call`だけを持ち、06 の L-ID は持たない。Phase 14 の「正本は手順の行の`logic`」のままだと、段階6で関数を選ぶたびに承認済みの段階5を書き換え、段階5の差し戻し → 段階6が「古い」の循環が起きるため。docs は撤回の blockquote で改めた。
  4. **生成は処理ごと**。手順の無い処理をまとめて生成し、作り直しはタブごとに1処理だけ(他の処理の手直しを残すため。段階2〜4の「全部置き換え」にしなかった)。
- **番号は保存せず、並び順から導く**(`number_steps`)。行の追加・削除で番号の付け直しを人や AI に任せずに済む。紐づけは番号でなく (callee, call) なので、振り直しても切れない。以後の L-ID(Phase 21)・M-ID(Phase 23)も同じ考え方。
- **呼び出し先はモジュール一覧のパスにそろえる**(`resolve_callee`)。そろわないパスはエラー(関与表の列の鍵のため)。外部の役者は「/」を含まない名前で書く。
- **画面で導くものと BE で導くもの**: 索引と関与表は、編集中の内容にすぐ反映させるため FE で導く(段階3の`dfd_accesses`は BE)。
- 列名は`from`が Python の予約語のため`caller`/`callee`にした。
- **検証結果**: BE 618件・FE 556件が成功。

## Phase 21完了 ── 段階6 処理ロジックの詳細

詳細設計モードの段階6(関数ごとの仕様と擬似フロー、05↔06 の紐づけ)を通した。詳細は[`Phase-21-introduction.md`](./Phase-21/Phase-21-introduction.md)参照。

- **着手時にユーザーが確定した事項**:
  1. **段階6を飛ばす = 0件で承認**。段階7の入力に段階6の承認が要るため。専用の skip API(API と型が増える)や、段階7の入力から段階6を外す案(陳腐化の伝わる道筋が切れる)は採らなかった。組み立てでは06章を「省略」と出す。
  2. **05↔06 のバッジは段階をまたいで移動する**(推奨は「段階6の中だけ」だったが、ユーザーが段階またぎを選んだ)。移動先はストアの`focus`に置き、移動先のパネルが一度だけ読んで消す。
- **L-ID は保存せず並び順から導く**(`logic_id`)。項目は (モジュール, 関数) を持ち、「呼ばれる手順」は段階5との一致から導く。どの手順からも呼ばれない項目はエラー`UNCALLED_LOGIC`。
- **入力を段階5だけに保つ**: 要件定義(技術スタック)は渡さず、シグネチャの言語はパスから判断させる。要件定義の変更で段階6が「古い」にならないようにするため。
- **画面確認後の修正(3回)**: 保存バー`StageSaveBar`を段階1〜6のパネルの上下に置いた。段階6を「処理 → 関数」の二重のタブにした(候補が多いときの手間と進み具合の見えにくさへの対策。model・BE は変えない)。タブの選択をストアに覚えた。2回目は、ユーザーが手で直した分(段階全体の生成ボタンの削除・逆引き表の移動)を取り込んだ。
- **検証結果**: BE 646件・FE 605件(修正後)が成功。

## Phase 22完了 ── 詳細設計書の組み立てと出力(マイルストーン5)

承認した段階1〜6から詳細設計書(01〜06章)を組み立て、HTML・md・図の zip でダウンロードできるようにした。マイルストーン5を達成した。詳細は[`Phase-22-introduction.md`](./Phase-22/Phase-22-introduction.md)参照。

- **着手時にユーザーが確定した事項**(3つとも推奨どおり):
  1. **当初の Phase 22 を3つに分けた**: 22 = 組み立てと出力、23 = 段階7、24 = 統合/E2E・デプロイ。
  2. 07 横断事項は Phase 22 では出さない(元になる段階のデータが無い)。
  3. **ダウンロードはいつでもできる**。本文に組み立てるのは承認済みの段階だけで、他は「未承認」とだけ書く。段階6が0件で承認済みなら06章は「省略」。
- **文書として保存しない**: 正本は段階の意味モデルで、組み立ては毎回決定的に行う。組み立ては純粋関数のパッケージ`app/detailed_design/document/`(`source`・`views`・`markdown`・`html`)に置き、DB の読み取り・図の描画・zip はサービスに置く。
- **HTML は文字をすべてエスケープし、図の SVG だけそのまま埋め込む**。自己完結の単一ファイルで、05↔06・01 → 05・関与表 → 手順のリンクを持つ。
- **持ち越しの決着**: CRUD 図の記号は「DFD から決まる R / 書き込みは DFD から決まり区別は人が確定 / DFD に無い分で人が確定」の3つに分けた(Phase 18)。「関わる処理」の処理ID は圧縮しない(Phase 19)。
- **共有の抽出(#17)**: 図の描画と zip の名前の重複除けを`app/uml/export/files.py`へ、FE の`fetchAttachment`を`src/lib/api/download.ts`へ移した。zip に入れた図は`exported`にする(出力済みも承認済みとみなすので、段階は差し戻されない)。
- **検証結果**: BE 679件・FE 612件が成功。zip の HTML をブラウザで開き、タブとリンクを確かめた。

## Phase 23完了 ── 段階7 横断事項と実装計画

詳細設計モードの最後の段階(07 横断事項と実装計画)を通した。詳細は[`Phase-23-introduction.md`](./Phase-23/Phase-23-introduction.md)参照。

- **着手時にユーザーが確定した事項**(4つとも推奨どおり):
  1. 段階7の model は構造化する(Markdown 1本にしない)。処理ID を検証で突き合わせ、md・HTML を model から組み立てるため。
  2. **07 横断事項は段階7で一緒に作る**。段階は 1〜7 のまま(マイグレーションもステッパーの改修も要らない)。段階7の名前を「横断事項と実装計画」に改めた。
  3. **生成の入力は組み立てた md(01〜06章)**。簡易モードの「要件定義+内部設計書」に当たるもの。
  4. **実装計画は同じ zip に別ファイル**(`implementation_plan.{html,md}`)で入れる。簡易モードでも実装計画書は別の文書なので、それとそろえた。
- **model**: タスクはマイルストーンの中に入れ子で持つ(名前で参照すると改名で切れる。WBS も階層)。M-ID は保存せず並び順から導く。
- **検証**: 無い処理ID はエラー。どのマイルストーンにも入らない処理は「計画の漏れ」として**警告**(わざと次のリリースに回す処理もあるため)。
- **画面確認後の撤回**: ファイルの欄をモジュール一覧と突き合わせる検証(`UNKNOWN_MODULE`)を撤回した。`Dockerfile`などの環境・設定のファイルがエラーになったため。欄は「作成・変更するファイルの例」とし、表示だけする(ユーザーの決定)。
- **共有の抽出(#17)**: 出力サービスの入力の集め方を`collect(project, render=...)`に切り出した(消費者は段階7の生成)。`to_markdown`・`to_html`に`chapters`引数を足した。`ListInput`を段階4の表から切り出した。
- **申し送り**: 段階7の入力は詳細設計書の md を丸ごと渡すので、大きなプロジェクトではトークンの上限に近づくおそれがある(超えたら`TOKEN_LIMIT`で知らせる)。
- **検証結果**: BE 714件・FE 630件が成功。

## Phase 24完了 ── 統合/E2E・デプロイでの確認

ステージ4の最後の Phase。新しい機能は作らず、段階1〜7と出力を通しで確かめ、本番に出した。詳細は[`Phase-24-introduction.md`](./Phase-24/Phase-24-introduction.md)参照。

- **着手時にユーザーが確定した事項**(3つとも推奨どおり):
  1. 本番デプロイの手順は Claude が用意し、PR・マージ・push と VPS での確認はユーザーが行う。
  2. E2E は段階1〜7の承認と zip まで通す。壊れていた簡易モードの E2E も直す。
  3. CI のデプロイ順を「build → 使い捨てのコンテナでマイグレーション → 入れ替え」にする(expand → migrate → switch の最小形)。
- **偽 LLM の契約テスト**: `E2eFakeLLM`の段階1〜7の出力を、本物の生成・検証・承認・出力の経路に通す BE の単体テストを足した。E2E が落ちたとき、原因が画面と偽 LLM のどちらかを切り分けるため。
- **E2E の共通の操作**を`e2e/helpers.ts`に切り出した(#17。消費者は簡易・詳細の2つの spec)。段階6は「飛ばす」でなく関数を1つ選んで生成し、05↔06 と 06章まで通す。
- **簡易モードの E2E は Phase 15 から壊れていた**(作成がモード選択のダイアログに、生成の前に確認のダイアログが入ったため)。E2E を手元でしか流しておらず、Phase 24 まで気づかなかった。→ #36(E2E は必要な Phase で既存分も含めて全部流す)の発端。
- **検証結果**: BE 715件・FE 630件、E2E 3本(合計約1.5分)が成功。本番相当の compose で、新しい順序のマイグレーションと downgrade/upgrade を確かめた。本番での確認は、ユーザーが行いすべて問題なしだった([`Phase-24-4.md`](./Phase-24/Phase-24-4.md))。
- **持ち越し**(未消化): 段階6が開いていないときの05の詳細バッジ、`call`と`function`の書き方の揺れ、ER の主キーの NULL の表示、段階7の入力の大きさ。E2E を CI で流すかは[`retrospective-memo.md`](./retrospective-memo.md)に候補として記録した。

## Phase 24完了後 ── 簡易モードの設計図の削除・UI の調整・本体コメントの方針

新しい Phase・章を作らず、本体と samples に直接反映した。詳細は[`q_a.md`](./q_a.md)「Phase 24 完了後」の2件。

- **簡易モードの設計図を削除した**(ユーザーの決定。範囲は FE と BE。DB のテーブル・列は残す):
  - 削除: 設計図の画面・生成・履歴・反映・埋め込み・zip(Phase 10〜13 の簡易モード側)、`update_content_in_place`、Phase 14 のデモページ。
  - 残した: 図のエディタ・編集・検証・自動レイアウト・承認・出力の API、データ辞書(詳細設計モードが使う)。`uml_generation_runs`テーブルと`uml_diagrams.scope`列、その ORM も残した。
  - 以前に図を反映した内部設計書のアンカー(HTML コメント)が文字で出ないよう、文書のプレビューを`skipHtml`にした。
- **ストアのキャッシュはプロジェクトを見て判定する**: `documents-store`が20秒のキャッシュでプロジェクトを見ずに取得を飛ばし、前のプロジェクトのタブが残っていた。ストアに`projectId`を持たせ、別のプロジェクトでは捨てて取り直す(`detailed-design-store`と同じ形。`hearing-store`も直した)。
- **UI の調整**: ダッシュボードのプロジェクト一覧にモードのバッジ(「簡易」「詳細」)。段階のステッパーを`$md`以上で`position: sticky`にした。チャットのリストのマーカーが吹き出しの外に出る問題は、`globals.css`のリセットが原因で、ReactMarkdown の`ul`・`ol`に左余白を渡して直した。
- **本体のコメントに Phase の経緯を書かない**(ユーザーの決定): コメントは機能と意図だけにする。本体から Phase・ステージ・決定・ルールの番号や教材への参照を一括で外した(samples は変えない)。経緯は samples のタグと教材だけに書く。→ #21 の on の記述に明文化した。

## ステージ4完了後 ── 進行ルールの改訂(自動実装モード ほか)

ステージ4のデプロイ後の振り返りで、進行上の課題(T1〜T9)を整理し、進行ルールを改訂した。詳細は [`appendix/overall-retrospective.md`](./appendix/overall-retrospective.md) を参照。Phase 13〜24 の digest は、別のセッションでこの節の前に追記した。

- **#21 を自動実装モード(on/off)に改定**:
  - 旧「学習モード / 納期モード」は廃止した。モードは Phase 単位で introduction に宣言する。
  - 教材の中身はどちらのモードでも同じで、#14 のテスト観点は省かない。off: ユーザーが手で実装する。on: AI が本体に実装し、samples も並行して作る。
  - 旧ルールとの対応: Phase 1〜6 = off、Phase 7〜24 = on。この digest の Phase 12 以前の「モード」の記述は、旧ルールでの記録である。
  - 理由: 手で実装しても設計の理解は思ったほど実感できず、完成品から仕様を追う方針を重視した。また、納期モードでは工程をあまり省けず、テスト観点が省かれた。
- **#19(写経レベル)を廃止**した。
- **新設したルール**:
  - #35: コミット・プッシュはユーザーが行う。
  - #36: E2E は、必要な Phase で既存分も含めて全部流す。
  - #37: 各 introduction に「未消化の申し送り」節を置く。
  - #38: AI の提案に対する最終決定はユーザーが行う。画面確認後の修正や計画の変動は通常の工程として扱う。
- **次のステージの前提**: 次のステージでは、Devex に実装計画から実装手順書まで作る機能を足す。進行で生まれる教材を、その実装手順書のサンプルにする。

## T2(ステージ4完了後)── 本体・samples・教材の三重管理

[`appendix/overall-retrospective.md`](./appendix/overall-retrospective.md) で保留にした T2 を、別のセッションで決めた。進め方は「実測 → 案の比較 → ユーザーの決定 → 反映」。

- **実測(samples 426 ファイル ↔ devex-api `stage4`・devex-ui `main`)**:
  - コードが一致 367、並び順だけの差 6、コードの差 37、samples のみ 13。
  - コードの差の多くは、本体だけに入った lint 対応・Phase 完了後の調整・テスト名からの Phase 番号の除去だった。
  - 一方で、off の Phase 2〜6 で本体に写経されなかった分もあった(samples の側が先)。
  - 教材のリンク切れは 82 件。うち 70 件は、Phase 24 完了後に削除した samples へのリンクだった。
  - 本体のコメントに残った Phase の経緯は 0 件。
- **決定**:
  - **on の Phase では、新規ファイルを samples に作らない。** 教材は本体のパス(コード表記)と、本体の git タグ `phase-<N>` を示す。理由: on では本体の Phase ごとのコミットが変更履歴そのものなので、#29 の前提(「samples の履歴が実装の変更履歴にならない」)が成り立たない。
  - **既存の samples は本体に合わせ続ける。** 既存の samples にあるファイルを本体で変えたら、毎回 samples も #29 の形式で更新する。本体で削除したら samples も削除する。
  - **samples の側が先だった分は本体に足す**(`invoke_with_retry` に messages を渡す・`get_gemini_llm` の戻り値の型・`UnsupportedFileTypeError` の code・テスト3件)。
  - **削除した samples へのリンクは外すだけ。** ファイル名はコード表記で残す。
  - **フォルダ再整理は見送りを確定した**(下記)。
- **道具**: [`tools/`](./tools/README.md) に3本を置いた。
  - `samples_check.py`: 既存 samples と本体の一致を検査する。
  - `link_check.py`: リンク切れを検査する。
  - `tagmerge.py`: 本体の差分をタグつきで samples に当てる。
  - Phase 完了時に `samples_check.py` と `link_check.py` を流し、どちらも 0 件にする(#21)。
- **ルール**:
  - #21 の on の記述と、#29 に on での扱いを足した。
  - #3・#9・#12 は handoff からの転記なので、本文を変えず運用注記を足した。
  - 整形だけの変更(並び順・引用符・テスト名の Phase 番号)は、タグなしで上書きしてよいとした。
- **フォルダ再整理(Phase 10 完了後の検討課題)**: 見送りを確定した。理由は #17(b)(駆動する消費者がいない遡及の整理はしない)。次のステージで実在の消費者が現れたら、そのときに判定する。

## ステージ4完了後 ── samples の作成を自動実装モードで変えない(T2 の改訂)

T2 の決定のうち「on の Phase では新規ファイルを samples に作らない」を、ユーザーの判断で改めた。経緯は [`appendix/overall-retrospective.md`](./appendix/overall-retrospective.md)「T2 の改訂」。

- **決定**: samples は自動実装モードの on/off で内容を変えない。on の Phase でも、AI が本体と並行して samples を作成・追記する(新規ファイルも作る。#29 の形式)。教材の抜粋・「作成・更新したファイル」表は、off と同じく samples へのリンクで示す。
- **理由**: 教材の中身は on/off で変えない(#21)。samples はその教材のコードであり、教材を実装手順書のサンプルにする構想にも合う。
- **そのまま残すもの**: 本体の git タグ `phase-<N>`、整形だけの変更はタグなしで上書きしてよいこと、Phase 完了時の `samples_check.py`・`link_check.py`。
- **道具**: `samples_check.py --api-since <前の Phase のタグ> --ui-since <同>` で、作り忘れ(本体で追加・変更したのに samples に無いファイル)も検査する。インフラ・設定ファイルは対象外(#21)。テンプレート由来で samples に無いファイルは、触らない限り出ない。
- **遡及**: 不要。Phase 7〜24 の on の成果物はすべて samples にある。
- **ルール**: #3・#9 の運用注記、#21 の on、#29 の on の扱いを改めた。[`tools/README.md`](./tools/README.md) の手順も改めた。

## ステージ4完了後 ── ゴール3と、生成で見つかった不具合の修正

ゴール3(Devex の生成文書と introduction の突き合わせ)を行った。記録は [`appendix/goal3-comparison.md`](./appendix/goal3-comparison.md)、生成物は [`appendix/goal3-generated/`](../appendix/goal3-generated/README.md)。新しい Phase・章は作らず、本体と samples に直接反映した(Phase 24 完了後の調整と同じ扱い。samples のヘッダーは `24(ゴール3後の調整)`)。経緯は [`q_a.md`](./q_a.md)「ゴール3」の2件。

- **共通化できる要素**: 「作業単位の表」(作業単位・対象の処理ID・作成・変更するファイル(依存順)・役割1行・確認方法)。実装前チェックリストと段階7のタスク表を同じ形にそろえられる。次のステージの実装手順書のひな形の候補。
- **足りない列への判断**(ユーザー): 生成側の確認方法(テスト観点)は、テスト設計の生成として今後の機能追加で検討する。教材側の処理ID は今のままでよい。マイルストーンの依存は取り下げた(並び順で足りる)。
- **ヒアリングは、判定してから返信する**: 完了判定と AI の返信がずれ、AI がまだ質問しているのにボタンが出た(ユーザーの再検証)。発言のたびに先に判定し、十分なら判定のサマリを返信にしてボタンと同時に出す。足りなければ不足点を AI に渡して聞かせる。判定は `projects.hearing_check`(マイグレーション `a5b6c7d8e9f0`)に保存し、`GET /hearing-completion` は保存値を返す(LLM を呼ばない)。判定に失敗したら NULL にして通常の返信を作る。AI には確定の確認・サマリ・設計書の本文をチャットに書かせない。
- **プロジェクト名**(ユーザーの決定): 作成フォームに必須の「プロジェクト名」(前後の空白を除いて1〜40文字。`INVALID_PROJECT_NAME`)。title をシステム概要から作るのをやめた。以前の title はそのまま。
- **簡易モードの WBS**: タスクに番号を付けさせない(LLM が振った番号が重複した)。
- **DFD と ER の検証**: 段階2で DFD を描くグループが無ければ警告 `NO_DFD_GROUPS`(人が選ぶ原則は変えない)。段階3で ER にテーブルが無ければエラー `ER_EMPTY`(DFD が無いと ER の下書きが空になる)。
- **検証**: BE 単体642件・結合7件、FE 538件、E2E 3本(既存を全部。#36)が成功。実際の LLM で、サマリの返信と判定の「十分」が同時に出ることを確かめた。

## Phase 25完了 ── ステージ5(実装手順書)の要件定義フェーズ

ステージ5の要件定義フェーズ。仕様診断(#28)・見本・docs への反映・Phase の区切りを行った。詳細は[`Phase-25-introduction.md`](./Phase-25/Phase-25-introduction.md)参照。

- **作業単位は段階7(実装計画)で作る**(最重要1。ユーザーは理由の説明を求めてから選んだ): 段階7のタスクを縦割りの単位(機能/基盤)に改修し、手順書はその単位をそのまま使う。単位の区切り・順番・依存は実装計画の役割であり、手順書の生成時に作り直すと誰も承認していない単位になるため。ゴール3の「確認方法が無い」は横割り(BE/FE/テスト)から生まれていた。
- **単位の ID**(`M-01-T01`)は並び順から導く。ファイルは「モジュール(段階4のパスで検証)」と「環境・設定(例)」に分ける(Phase 23 の「ファイルは例」の決定を改訂)。
- **手順書は段階8**(design_stages)。未定義は「決定的な検証+AI の指摘」の2層・重要度3段階で示し、決定は設計の側(対象の段階)で直す。生成は選んだ単位を上限5。AI 向けは参照を展開した md を zip と画面のコピーの両方で渡す。テストは単位ごとの観点まで(体系はステージ8)。
- **シーケンス図**(ユーザーの提案から): 段階5の手順の行から決定的に導く読み取り専用のビュー。LLM で別に生成・画面で編集しない(二重管理になるため)。段階5の行に種別(同期/非同期/戻り)を足す。コミュニケーション図は後回し([25-5](./Phase-25/Phase-25-5.md))。
- **見本**: [`appendix/implementation-procedure-sample/`](../appendix/implementation-procedure-sample/README.md) と devex-ui のデモ。見本を書く中で、題材の設計の穴(テーブル0件、チャット履歴の保存が手順に無い、スタブが手順に無い)が見つかった ── 手順書を作ると設計の穴が見える、という機能の狙いの実例。
- **区切り**: 26 段階7の改修 / 27 段階8の土台 / 28 生成 / 29 シーケンス図 / 30 出力 / 31 簡易モード / 32 統合/E2E・デプロイ。各 Phase の「未確定事項」を [25-4](./Phase-25/Phase-25-4.md) に先に挙げた(分割・番号送りは最後まで起きなかった)。

## Phase 26完了 ── 段階7の改修(作業単位)

詳細は[`Phase-26-introduction.md`](./Phase-26/Phase-26-introduction.md)参照。

- `PlanTask` = `kind`(feature/base)・`function_ids`・`depends_on`・`modules`(段階4で検証)・`config_files`(例)。ID は保存せず `task_id` で導く。
- `Milestone.function_ids` は削除し、`milestone_functions` でタスクから導く(二重管理をやめる)。
- **依存は前の単位だけ**を指せる(`FORWARD_DEPENDENCY` はエラー)。依存の順 = 並び順になり、循環の検査が要らない。並べ替え・削除では画面(`planOps.relinkDependencies`)が依存先を付け替える。1単位は原則1処理、4つ以上で警告。
- 既存データは Alembic `b8c9d0e1f2a3` で変換し、承認済みはレビュー中へ戻す(読み込み時の互換は持たない)。

## Phase 27完了 ── 段階8の土台と決定的な実装可能性チェック

詳細は[`Phase-27-introduction.md`](./Phase-27/Phase-27-introduction.md)参照。

- 段階は 1〜8(Alembic `c9d0e1f2a3b4`)。段階8の入力は段階1〜7+要件定義。
- **鍵は単位の ID+作ったときのタスク名**。段階7と合わなくなった手順書は `UNIT_MISMATCH` のエラーにして作り直させる(自動で付け替えない)。
- **承認を止めるのは手順書そのものの不正だけ**(形・重複・UNIT_MISMATCH)。設計の不足は `StageIssue` の `level`・`fix_stage`・`unit` 付きの警告。`NO_PROCEDURE` は「中程度」(段階5は主要処理だけを選ぶため)。
- 画面確認で、`UNRESOLVED_CALL` を「段階6の関数と書き方だけが違う呼び出し」に絞り、直す先を段階5と文言でも示した(指摘の主語と直す先をそろえる)。

## Phase 28完了 ── 手順書の生成

詳細は[`Phase-28-introduction.md`](./Phase-28/Phase-28-introduction.md)参照。

- **参照の展開はバックエンドだけ**(`procedure_doc_refs.unit_context`)。生成の入力・画面・AI 向けの出力が同じ中身を持つ(#17)。05・06 の表は詳細設計書の md と共有(`procedure_table`・`logic_spec`)。
- 生成の対象は段階7の単位から決め、上限5。merge は段階7に無い単位を消さず後ろに残す。`fix_stage` は 1〜7、外は 8。
- 最重要が残るときの承認は、FE の確認ダイアログだけ(BE は止めない)。単位の詳細は全欄を編集できる。
- 「AI に提案を求める」は作らない(ステージ8との境界)。

## Phase 29完了 ── シーケンス図

詳細は[`Phase-29-introduction.md`](./Phase-29/Phase-29-introduction.md)参照。

- 段階5の行に `kind`(call/async/return、既定 call。マイグレーション無し)。戻りの行の判定は `calls_function` の1か所。
- 導出はバックエンドだけ(`sequence.py`・`sequence_svg.py`)。md は Mermaid、HTML と画面は SVG。単位の参照の展開にも図を入れる。
- 図にするときの指摘は段階5の警告。スタブの候補との突き合わせは段階8の軽微な警告 `STUB_OUTSIDE_SEQUENCE`。単位の図の色付けは撤回。
- 自己呼び出しはスタックに積まない(実際に描いて見つけた)。

## Phase 30完了 ── 手順書の出力

詳細は[`Phase-30-introduction.md`](./Phase-30/Phase-30-introduction.md)参照。

- 組み立ては別パッケージ `procedure_output/`(`document/` に置くと参照の展開と循環する)。
- zip は段階8が承認済みのときだけ組み立て、他は index と HTML に「未承認」。HTML は単位を縦に並べる。AI 向けは `ai/<ID>.md`。画面の「AI 向けにコピー」は保存済みから作り、未承認・未定義を警告する(止めない)。
- **完了後の調整(30-7、ユーザーの決定)**: ダウンロードを「詳細設計書・実装計画」(段階1〜7の承認で)と「実装手順書」(段階8の承認で)の2つの zip に分けた。未承認ではボタンを透過・非活性にし、サーバーも 409 `DESIGN_DOCUMENT_NOT_READY` で断る。

## Phase 31完了 ── 簡易モードの手順書

詳細は[`Phase-31-introduction.md`](./Phase-31/Phase-31-introduction.md)参照。

- 入口は SCR-005 の「実装手順書へ進む →」で、同じ SCR-008 を段階8だけで開く。
- **作業単位は実装計画書の WBS を決まった書式で書かせ、純粋関数で決定的に解析する**(`simple_procedure/wbs.parse_wbs`。構造化出力・AI での抽出はしない)。ID は並び順から導き、書かれた ID は突き合わせるだけ。0件なら `WBS_MISSING` だけ。
- 段階8の部品がモードによらず使う土台 `ProcedureBasis`(plan・refs・context・labels・environment・rules)に、段階7を直接読んでいた箇所を寄せた。直す先は `fix_document`(`fix_stage` は 8)。
- **完了後の調整(31-7)**: 簡易モードは文書の粒度が粗いので、参照の粒度も合わせる。DF の本文に名前の出るテーブルを拾い、DF の無い単位には 3.2 全体(`datamodel`)を添える。モジュールは層(`module_layer`)まで照合し、層に無いファイルは警告も参照もしない。詳細設計モードは変えない。ステッパーに段階1〜7の押せない行を足した。→ **2モードで同じ検証を使うときは、入力の粒度の差を先に表にして確かめる**(着手時の相談では詳細設計モードの粒度だけを前提にしていた)。

## Phase 32完了 ── 統合/E2E・デプロイでの確認

ステージ5の最後の Phase。詳細は[`Phase-32-introduction.md`](./Phase-32/Phase-32-introduction.md)参照。

- 偽 LLM に段階8(両モード)を登録。承認と zip は BE の契約テスト(段階1〜8 → 両 zip、簡易モードの段階8)で通し、E2E は段階8の生成まで(ユーザーの決定)。
- 全 E2E(#36)で、Phase 27 から壊れていた「段階7の後の次の段階へ進む」と、Phase 31 の見出しの重複の期待を見つけて直した。
- 本番反映は手順書だけ作り(`OPERATIONS.md` 10.2)、反映と確認は Phase の外でユーザーが行った。Phase 27〜31 の画面確認もその表にまとめた。**結果はすべて問題なし**(2026-10-08。[32-3](./Phase-32/Phase-32-3.md))。

## ステージ5完了後 ── 振り返り

ステージ5の振り返り(#10)。詳細は [`appendix/overall-retrospective.md`](./appendix/overall-retrospective.md) 9節。

- **画面確認は溜めてよい**: Phase ごとに済ませず、#37 の申し送りに積んで、統合/E2E・本番確認の Phase でまとめて行ってよい(#37 の運用注記)。ステージ5では Phase 27〜31 の分を本番で一度に確かめ、問題は無かった。
- **E2E は #36 のまま**: 壊れは統合の Phase で拾えた。CI で流すかは [`retrospective-memo.md`](./retrospective-memo.md) の候補のまま。
- **#18 の区切りの記録は続ける**: ステージ5は Phase 25〜32 がすべて1セッションだった。
- **未確定事項の先出しが効いた**: 25-4 で Phase ごとの未確定事項を先に挙げたので、着手時の相談はほぼ推奨どおりで決まり、分割・番号送りも起きなかった。
