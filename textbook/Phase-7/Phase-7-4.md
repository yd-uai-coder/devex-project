# Phase-7-4: decitimaエンジン移植の見通し(文書化のみ)

## この章の目的

Phase 9で行う予定のdecitima `engine.py`移植に先立ち、実装に着手せず移植可否・リスクを文書化する。コードのコピーはこの章では行わない。

学習モード(詳細は[introduction](./Phase-7-introduction.md)参照)。

## 調査結果

対象: `/home/yoshi1115/my-apps/uai-apps/decitima/textbook/architecture/diagrams/src/engine.py`(約950行)。

### 移植容易性

- **標準ライブラリのみ**: `html`/`itertools`/`math`/`re`/`unicodedata`/`dataclasses`のみに依存し、サードパーティパッケージが無い。`devex-api`の`uv`環境への追加依存は不要。
- **自己完結**: decitima固有の設定・他パッケージへの参照を一切持たない。`defs_*.py`(decitima自身の図定義)は移植対象外で、DSLの使い方を示す参考資料としてのみ扱う。
- **ライセンス**: decitima・devexは同一ユーザー(`ydyd1115@gmail.com`)所有であり、`engine.py`はdecitima内の単一コミット(`6f49c48 "Phase15完了"`)による自作コード。ライセンス障壁は無い。出自明記は「decitimaの図生成エンジンより移植(commit 6f49c48、Phase15)」という内部由来コメントで足りる。

### 移植時に対応が必要な点(Phase 9への申し送り)

1. **`assert`ベースの不変条件チェック**: `node()`/`edge()`の重複ID・未定義ノード参照チェックが`assert`(スクリプト実行前提)になっている。FastAPI経由で叩く場合は、4xxへ変換可能な専用例外に置き換える必要がある(バリデーションのM4と統合)。
2. **計算量**: `route()`/`optimize()`はO(n²)〜O(n!)(小規模図は問題ないが、AI生成で大きい図になった場合はノード数上限と`asyncio.to_thread`実行が必須。[`appendix/stage3-requirements-organization.md`](../../appendix/stage3-requirements-organization.md)診断3と一致)。
3. **未使用コード・マジックナンバー**: 未使用の`import math`、`_cost()`内の無コメントな重み定数(交差+400、重なり+1500等)。移植時にコメントを補うか、定数化する。
4. **日本語文字幅推定**: `wrap`/`tw`/`cw`(`unicodedata.east_asian_width`ベース)はdevexでもそのまま必要(生成文書・図ラベルは日本語)。
5. **既存テストが無い**: decitima側にも`engine.py`のテストは一切無い。移植時はゴールデンファイル比較・交差数ゼロ等の新規テストが必要(既存の動作を担保するテストが存在しない状態からの移植になる)。

## Phase 9への申し送り

上記5点をPhase 9の実装前チェックリストの検討材料とする。`app/uml/layout/`パッケージ([`docs/internal_design.md`](../../docs/internal_design.md) 3.3節に追記済み)に、`assert`を例外化した`engine.py`の移植版を置く想定。

## テスト観点

スタブ不要 ── 本章は設計討議のみでファイルを作成しないため(SUT/ドライバ/スタブという区分自体が適用対象外)。
