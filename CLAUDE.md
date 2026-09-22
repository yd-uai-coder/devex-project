# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository structure

This directory is a container for two **independent git repositories**, not a monorepo with shared tooling and not git submodules (they're currently untracked in the outer repo's `git status`):

- `devex-api/` — its own git repo. FastAPI + LangChain + LangGraph backend template (Python 3.13, `uv`, PostgreSQL, Redis). See `devex-api/CLAUDE.md` and `devex-api/README.md`.
- `devex-ui/` — its own git repo. Next.js (App Router) + Tamagui frontend template/demo collection (`next-tamagui-templates`). See `devex-ui/CLAUDE.md`, `devex-ui/AGENTS.md`, and `devex-ui/README.md`.

There is no root-level `package.json`, build script, or CI config tying the two together. All commands (dev server, lint, test, migrations) must be run from inside the respective subdirectory — always `cd devex-api` or `cd devex-ui` first, and consult that subrepo's own `CLAUDE.md` for the authoritative command list and architecture notes rather than duplicating them here.

## Important: spec vs. current implementation

The root `README.md` is a short overview of an aspirational product called "Devex" — an AI-driven chat interface that interviews users and auto-generates 要件定義/外部設計/内部設計/実装計画 Markdown documents, backed by `projects`, `chat_histories`, `generated_documents`, and `prompt_templates` tables. The detailed Japanese 要件定義書/設計書 (requirements + design doc) is split across four files under `docs/`: `docs/requirements.md`, `docs/external_design.md`, `docs/internal_design.md`, `docs/implementation_plan.md` — mirroring the four document types Devex itself is meant to generate.

**Neither subrepo currently implements this domain.** As of now:

- `devex-api` only has generic `auth`, `users`, and `chat` routes (JWT auth + a single LangGraph `User → Gemini → Tavily → 評価 → Gemini → 最終回答` chat workflow). There are no `projects`/`documents`/`generate` endpoints or the tables the spec describes — it's a reusable backend starter template, not the Devex product.
- `devex-ui` (`next-tamagui-templates`) is a UI component/demo gallery meant to be cloned as a starting point for future FastAPI-backed apps; it has no Devex-specific screens (dashboard, chat hearing screen, document preview, etc.).

When asked to build "Devex" features, treat `README.md` + `docs/*.md` as the target spec and both subrepos as the generic starting scaffolding — don't assume the domain models, routes, or screens it describes already exist anywhere in the code.

## Working across the two repos

- Each subrepo has its own git history and its own `CLAUDE.md` with detailed "why" notes (error handling, rate limiting, layering, Tamagui gotchas, etc.) — read that file before making non-trivial changes inside it.
- `devex-ui/src/lib/api/client.ts` expects a FastAPI backend at `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`); `devex-api`'s `docker compose up` serves exactly that contract on that port, so the two are designed to be run side by side during local development even though they're not wired together by any shared tooling.
- `devex-ui/AGENTS.md` flags that the Next.js version in that repo has breaking changes vs. training data — check `devex-ui/node_modules/next/dist/docs/` before writing Next.js-specific code there.

## 進行のルール

このプロジェクトは、`appendix/cl-development-handoff.md` にまとめられた「CL(Curriculum Loop)開発」手法(AI が Phase 単位で学習教材・サンプルコードを著述し、人間が手で実装コードを書き、実装で当たった摩擦を教材に還流する開発・学習手法)を土台に開発を進める。教材は `textbook/` に置く。

以下の #1〜#17 は `appendix/cl-development-handoff.md` からの転記(番号・内容とも変更なし)。#18 以降がこのプロジェクト固有の追加ルールである。ドメイン・アーキテクチャの決定(採用する言語・フレームワーク・レイヤー構成など)はこの節ではなく、このファイルの「Repository structure」節や各サブリポジトリの `CLAUDE.md` に書く。

**用語注記(解消済み)**: 当初「Phase」は CL 教材の単位と README.md の製品マイルストーン(旧称「フェーズ1/フェーズ2」)の両方で使われる別軸の概念だった。#27 の実装ロードマップ具体化にあたり混同リスクが無視できないと判断し、README.md 側を「ステージ1/ステージ2」にリネームした(経緯は `textbook/decision-digest.md` 参照)。以後「Phase」は CL 開発の実装単位(`Phase-<N>`)専用の語である。

### A. 教材の生成 ── いつ・何を

**#1.** 学習教材を Phase 毎に教材フォルダ(`textbook/`)に `.md` 形式で作成する。

> **運用注記(#1)**: 「Phase 毎に教材フォルダ」は「Phase 毎にフォルダを作成する」の意(`textbook/Phase-<N>/` 配下に `Phase-<N>-introduction.md` 等を置く)。全 Phase を `textbook/` 直下にフラットに置くのではない。これは #6 の「各 Phase フォルダ直下に作成する」という記述とも整合する読み方であり、#1 の文言自体は変更していない。

**#5.** ユーザーの「Phase#を開始する」というプロンプトで、その Phase の教材・サンプルを生成する。

### B. Phase 教材の構成 ── ファイルと章立て

**#2.** 学習教材は各 Phase の中で章立てする。構成は `Phase-<N>-introduction.md`(導入)+ `Phase-<N>-1.md` 以降(作業単位ごと。章番号 = 作業単位番号)。別建ての概観章やインデックスは作らず、導入ファイル 1 本に集約する(内容は #6、実装前チェックリストは #11)。設計フェーズ(実装を伴わない Phase)は作業単位を持たないので `Phase-0-introduction.md` + `Phase-0-1.md` 以降(設計トピックの逐次解説)とする。

**#6.** Phase 毎に導入ファイル `Phase-<N>-introduction.md` を各 Phase フォルダ直下に作成する。内容: フェーズの目的 / パイプライン上の位置づけ・作業章を始める前に理解すべき前提(概観)/ 章一覧(各章のトピック・依存関係・リンク)/ サンプルコード一覧 / 実装前チェックリスト(#11)/ 次のフェーズ。`Phase-<N>-1.md` 以降を読み始める前に、この 1 本で前提を説明しきる。章を追加・変更したらここも更新する。

**#11.** 各 `Phase-<N>-introduction.md` に「実装前チェックリスト」を置く。内容: その Phase で作成するファイル一覧 / 各クラス・関数の責務 1 行 / テスト観点。Phase 教材の生成後・実装着手前に、ユーザーがこれで疑問を出し切ってから実装に入る。行キーは作業単位番号(章番号と一致)。設計フェーズ(実装が無い Phase)は省略可。

### C. 教材内のコード提示 ── 抜粋 / samples / パッケージ

**#3.** 教材で提示するコードは、長いコードブロックを Markdown に直書きせず「要点の抜粋 + 共有サンプルフォルダ(`textbook/samples/`)のファイル参照」とする。samples は 1 フォルダを全 Phase で共有し(直近 Phase の end 状態)、ユーザーが実プロジェクトのコードへ写経・改変して実装する。これで「教材 Markdown / samples / 実コード」の三重管理を避ける。反映の順序は「相談で決定 → samples に反映(#9)→ 教材の抜粋が追従」── samples が基準、教材 Markdown はその抜粋。教材の構成・体裁・番号の変更(章のリネーム、節の再編等)はマーカーを付けず内容で上書きする。

**#7.** 教材でコードを提案するときは、配置先のファイルパスを各コードブロックの先頭にコメントで明記する(例: `# app/service/foo.py`)。分割するモジュールはパッケージ(`__init__.py` 付き)として示し、`__init__.py` の re-export 形とファイル間の依存方向も示す。既存教材の修正時・以降の Phase でも同様。

**#9.** 検討・相談の中で提示するコード(クラス名・シグネチャ・型など)に変更が生じたら、対応する samples のサンプルコードにも同じ変更を反映する。反映後は実プロジェクトの環境で実行確認し、可能なら型チェックも通す。

### D. 章ごとの解説とテスト設計

> 実装ファイルを作らない章(設計フェーズの各章、理論のみの章など)は #13 の全ファイル解説・#15 の全ファイル import・#12 のリファクタ追従の対象外。introduction の章一覧でその旨を明記する。

**#13.** 各章は、その章で作成 / 更新する全ファイルを「責務 1 行 + 中身の要点(型・シグネチャ・非自明な判断。パッケージは #7 のとおり `__init__` の re-export 形も)」で解説する。ファイル構成ツリーに列挙するだけで解説を省略しない。各章の冒頭に「この章で作成 / 更新するファイル」を明記する。教材生成後、章の解説とサンプル / 実装前チェックリストのファイル一覧を突き合わせ、漏れが無いか確認する(#15 の「全ファイルをテストが import」と同一機会に)。

**#14.** 各章の `## テスト観点` 節では、テスト(またはテスト群)ごとに テスト対象(SUT)/ ドライバ / スタブ(テストダブル)の関係を明記する。スタブが不要な場合は「スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため」のように理由込みで書く。狙いは CL 開発の趣旨「テストを通じた設計理解の重要視」── テストダブルの要否がレイヤー設計(純粋 / 副作用)の鏡であることを各章で言語化すること。用語(SUT / ドライバ / スタブ)は初出の章で 1 行定義し、以降の章は関係の明記のみでよい。

**#15.** 章が作成 / 更新する全ファイルを、その章のテストが少なくとも 1 度は import すること(教材生成後・#13 の突き合わせと同時に確認)。複数ファイルを触って一部しかテストが import していない、のような穴を作らない ── 写経漏れ・写経ミスを検知できるようにするため。集約の機構のテスト(レジストリの検索処理等)は具体的な後発実装でなくフェイク(fixture で登録)で行う。テスト用フィクスチャも初出章の作成物として実装前チェックリストに含める。純粋関数は素で、外部依存を注入できる設計はフェイクで(#14)。
前方 import の禁止 ── 章 N が作成 / 編集するどのファイルも、その import 先(モジュール**と**モジュール内のシンボル)が {以前の Phase} ∪ {この Phase の章 N まで} で存在しなければならない。新規ファイルも既存ファイルへの追記も同じ扱い。後の章 M(> N)で生まれるモジュール・シンボルへの import を含むファイル(またはその関数・クラス)は、最初の消費者の章(≥ M)で書く。2 つの罠:(a) 新規ファイルはヘッダ以外に Phase タグを持たない ── タグの `grep` だけでは検出できない。ファイルの全 import 文を読む必要がある。(b) 「モジュールはあるが名前が無い」── import 先モジュール自体は既存でも、import する特定のシンボルが後の章の追加物であるケース。生成後の突き合わせ = 実 import 監査(#13 と同一機会):各ファイルについて ① 作成 / 初出章を実装前チェックリスト + 章本文から確定、② 全 import 文を列挙、③ 各 import 先のモジュールとシンボルの誕生章を確定、④ ③ > ① を全て潰す。タグ `grep` は補助に留める。

**#16.** → #12 のリファクタ追従条項に統合(欠番扱い)。

### E. 後続 Phase での改訂 ── 以前の Phase への遡及

**#12.** 後続 Phase で、以前の Phase の提示コード・設計・決定事項に変更が生じたら(共通化のために触ってよいかの判断は #17):
1. 変更後の内容は当該後続 Phase の教材に書く(要点の抜粋。動くコードは共有 samples)。
2. 共有サンプルの当該ファイルに変更を記録する: **更新**は旧コードをコメントアウトし新コードに `# (Phase <N>-<M>)` タグ(理由を一言、`#` の後にスペース 1 個、`Phase` と番号の間にもスペース)。**新規**はファイル冒頭コメントに出自 Phase を明記(1 つのファイルを同一 Phase の複数章で完成させる場合は各章の担当分にタグを付ける)。章タグは次の明示的なタグが現れるまで引き継がれるため、章番号が後退する境界では必ず再タグを付ける。**やらないことに確定**した計画は `> **[Phase <N> で確定 ── 〈…しない〉]** 当初〈…する予定〉→ 撤回。理由〈…〉。` の blockquote で記録する。grep 用合言葉: 更新 = `# (Phase` / 撤回 = `で確定 ──`。
3. 変更元 Phase の introduction に「後続 Phase での改訂」節を 1 行、decision digest(後述)にも要点を残す。
4. リファクタ(公開挙動を変えない整理)の写経ミスの番人 = 当該章の第一テストの統合スモーク(公開 API を素で 1 回呼ぶ)。
   教材の構成・体裁・番号の変更はこのルールの対象外(マーカーなしで上書き、決定の記録は #8・#10 のログへ)。

**#17.** 以前の Phase のコードを共通化のために触ってよいかの判断基準。後続 Phase が以前の Phase と同じドメインの事実(式・不変条件・データ構造)を必要とするとき、「コピーして重複させる」か「抽出・共通化して共有する」かの分岐では常に共有を選ぶ。触らないもの: (a) 教材本文の遡及的全面リライト (b) 駆動する新しい消費者がいない遡及クリーンアップ / 監査 (c) レイヤー境界が要求する分割(これは重複でなく必然)。判定の一問: 「この共通化を今駆動している、この Phase の実在の消費者は何か」に具体名で答えられれば実施、「将来たぶん」「一般に良い設計だから」なら見送る。

### F. 記録

**#4.** 実装段階での検討事項・検証段階で発覚した事象はプロジェクト方針ファイル(このファイル)の記録節に記録する。#4 は包括方針で、具体的な振り分けは ── 質問・相談ログ → #8 / 進行方法の所感 → #10 / 後の Phase に前向きに効く決定・知見 → decision digest。

**#8.** ユーザーが AI に行った質問・相談とその回答を専用ログファイル `textbook/q_a.md` に追記する(保存専用・作業中は参照しない)。各エントリは (1) 疑問が生じた Phase (2) 質問・相談内容 (3) 回答と対応方針。進行方針にかかわる決定・設計判断は decision digest にも要約を残す(こちらが参照用)。

**#10.** プロジェクトの進行方法について気づいた点(特徴・メリット / 課題 / 課題解決への提案)を振り返りファイル `textbook/appendix/*-retrospective.md` に追記する。課題には可能な限り「提案」を対で書く。提案をプロジェクトに組み込むかはユーザーが個別に判断する(AI は勝手に適用しない)。

### 本プロジェクト固有の追加ルール(#18〜)

**#18. セッション境界ルール**(所感5.5対応)。1 セッション = 1 Phase(または 1 章)を原則とする。振り返り(#10)・decision digest の整理(#24)・進行ルール自体の改訂・大規模リファクタは、Phase 生成セッションとは別セッションで行う。判定: セッション内に「前 Phase の全体テスト実行」「振り返りファイルへの書き込み」「進行ルールの編集」のいずれかが既に含まれていたら、そのセッションで新規 Phase の生成を開始しない。生成中の検証は影響範囲を絞った部分テストに留め、全体テスト(オーバーレイ含む)は Phase 完了時に 1〜2 回のみ行う。

**#19. 写経レベルタグ**(所感5.1-④対応)。`textbook/samples/` の各ファイル・ブロックには、作成時点で「写経レベル: コア / 定型」を付す(#13 の解説と同一機会に)。コア = ドメイン判断・設計判断を体現する箇所。定型 = 反復的・ボイラープレートで理解価値が薄い箇所。このタグは #21 のモード判定の入力になる。

**#20. 事前質問の範囲限定**(所感5.1-③対応)。#11 の実装前チェックリストで解消すべき疑問は設計レベル(責務・依存関係・テスト観点)に限定する。実装の細部(変数名・ループの書き方等)への疑問は実装着手後に都度質問してよく、チェックリスト完了の条件にしない。

**#21. モード切替ルール(学習モード / 納期モード)**(所感5.1の二モード案を採用)。デフォルトは学習モード。以下 (a) かつ (b) を満たす章に限り、その章の introduction 内で明示して納期モードに切り替えられる: (a) 対象章の主要サンプルで #19 の「定型」タグが過半数、(b) その章が MVP コアループ(チャット↔4 文書生成の中核設計 / 実装)そのものではない付随作業である。納期モードでは #14 の SUT / ドライバ / スタブ言語化は省略可、実装確認は「動くこと」まで(型チェックのみ必須)、学習の回収は Phase 完了時の振り返りで事後レビューとして行う。**コアループに関わる章は常に学習モード**とする(MVP フェーズ1の心臓部であり、かつ #25 の再帰検証の対象でもあるため速度優先を許さない)。

**#22. Phase 完了チェック**(所感5.1-⑥対応)。各 `Phase-<N>-introduction.md` に「Phase 完了チェック」として概念理解を問う設問を 3〜5 問用意する。実装前チェックリスト(#11、着手前)と対をなす完了判定(着手後)。

**#23. 写経順序の明記 + 実 import 監査の毎回実施**(所感5.6対応)。各 introduction ファイルに「写経順序」を明記する(章番号順と一致する場合も「章番号順」と明記する)。実 import 監査(#15)は Phase 生成の都度、全 import 文を読む形で行う。章単位のオーバーレイ再構築(章 N までを都度クリーンな環境に重ねて検証する方式)は、所感5.6の見送り推奨のとおり導入しない。

**#24. decision digest の更新タイミングと置き場**(所感5.2対応)。decision digest は `textbook/decision-digest.md` に置く。`q_a.md`(#8、保存専用・非参照)とは異なり、decision digest は**進行中に能動的に参照する**ファイルである。追記は Phase 完了時にまとめて 1 回行う(生成セッション中に都度追記しない)。これは #18 のセッション分離と整合させる。

**#25. 再帰検証ルール**(本プロジェクト固有)。各 Phase の振り返り(#10、`textbook/appendix/*-retrospective.md`)に、通常の CL 手法向け所感とは別に「→ Devex 仕様への示唆」という小節を設ける。問い: 「この Phase の introduction / チェックリスト / 振り返りの構造・粒度のうち、Devex が自動生成すべき要件定義 / 外部設計 / 内部設計 / 実装計画のテンプレートやヒアリング項目に転用できるものは何か」。ここで得た知見は `docs/internal_design.md` の `prompt_templates` 設計や `docs/external_design.md` のヒアリングフロー設計の入力として明示的に参照する(感想で終わらせない)。

**#26. md ファイル間の相互参照はリンクで明記する**(本プロジェクト固有)。教材・記録用に作成する `.md` ファイルが他の `.md` ファイルの内容を参照・前提とする場合、ファイル名を地の文で書くだけでなく Markdown リンク(`[表示名](相対パス)`)を張る。対象は `textbook/` 配下の教材・ログ・記録ファイル全般(`Phase-<N>-introduction.md`、`Phase-<N>-M.md`、`decision-digest.md`、`q_a.md`、`*-retrospective.md`)、および `CLAUDE.md`「進行のルール」節から `textbook/` 配下のファイルを参照する場合を含む。狙い: 参照先を辿るコストを下げ(#3・#11 の「参照して確認する」運用と整合)、ファイル移動・リネーム時にリンク切れとして検出できるようにするため。

**#27. Phase 0 の役割定義**(共通ルール候補 ── 特定プロジェクトに依存しない一般化を想定し、将来の handoff v2 に引き継ぐ候補として明記する)。Phase 0 は「要件・設計の確認」から「Phase 1 以降の実装ロードマップの具体化」までを行うフェーズとする。本プロジェクトでは、`README.md` および `docs/` 配下の詳細仕様書(`requirements.md`/`external_design.md`/`internal_design.md`/`implementation_plan.md`)を入力として実装ロードマップ(Phase 1〜N の区切りと各 Phase のスコープ)を作成する。Devex 完成後は、Devex 自身が生成するドキュメントを入力に切り替える運用を想定するが、その具体的な移行方法(何を入力に、どの粒度で読み替えるか)は今は確定せず、Devex 完成後の振り返り(#10・#25)で具体化する。

**#28. 実装着手前の仕様診断**(共通ルール候補 ── 特定プロジェクトに依存しない一般化を想定し、将来の handoff v2 に引き継ぐ候補として明記する)。Phase 0 の最後、Phase 1 のトリガー(#5)を受ける前に、要件定義〜実装計画の各文書(`docs/requirements.md`/`docs/external_design.md`/`docs/internal_design.md`/`docs/implementation_plan.md`)を対象に、不足・不明瞭な点の診断を AI が主体的に行う。診断結果は次の3段階に分類して提示する: (1) **最重要** ── 次の Phase のタスクに直結し着手前に解決すべきもの、(2) **中程度** ── 後続 Phase の設計事項だが今のうちに認識合わせしておきたいもの、(3) **軽微・運用面** ── 対応してもしなくても大きな影響が無いもの。ユーザーは各項目について「決定を下す」か「AI に提案を求める」かを選べる。AI への提案依頼があった項目は、トレードオフ比較や既存コードベース調査に基づいて具体案を提示し、ユーザーの選択を仰ぐ。全項目の決定が出揃ったら該当する `docs/*.md` に反映し、その回の対応を Phase 0 の1章(`textbook/Phase-0/Phase-0-<N>.md`)として記録する。この診断は、Devex 完成後に Devex が生成する要件定義書等でも「AI が不足点を指摘し、ユーザーが承認する」という同種のフローが期待される(#25 再帰検証ルールとも関連)ため、本プロジェクトの実施を通じてこのルール自体の実用性を検証する。

### プロジェクトのゴール

1. **プロダクト目標**: `docs/implementation_plan.md` ステージ1(MVP)が定義する Must 要件(チャットヒアリング → 要件定義 / 外部設計 / 内部設計 / 実装計画の4種 Markdown 自動生成)を満たし、ステージ1のマイルストーン1・2の受け入れ基準を満たす。
2. **手法目標**: `appendix/cl-development-handoff.md` の #1〜17 を土台に #18〜28(本節)を実プロジェクトで運用し、少なくとも1章を学習モード・1章を納期モードで実施した上で、所感5.1 / 5.2 / 5.5 / 5.6 各提案の採否とその根拠を振り返り(`textbook/appendix/*-retrospective.md`)に記録する。プロジェクト完了時、次プロジェクトに引き継げる改訂版 handoff ドキュメント相当を作成可能な状態にする。
3. **再帰検証目標**: Devex が生成すべき4文書の「質の良さ」の基準を、本プロジェクト自身が書く CL 教材(introduction / チェックリスト / 振り返り)の質を通じて具体化し、逆に Devex の生成物の構造を CL 教材テンプレートに転用できるかを #25 の振り返りで検証する。最低1回、Devex の実際の生成文書と `Phase-<N>-introduction.md` を突き合わせ、共通化できるテンプレート要素を最低1つ具体的に特定する。
