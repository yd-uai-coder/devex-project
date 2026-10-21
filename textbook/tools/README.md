# textbook/tools ── 本体・samples・教材のずれを防ぐ道具

T2(本体・samples・教材の三重管理)の決定で置いた道具である。経緯は [`decision-digest.md`](../decision-digest.md)「T2(ステージ4完了後)」と「samples の作成を自動実装モードで変えない」、ルールは [`CLAUDE.md`](../../CLAUDE.md) #21・#29 を参照。

## Phase 完了時の手順(自動実装モード on の Phase)

samples は off と同じ内容で作る(新規ファイルも作る)。AI が本体と samples を並行して書く。

1. 本体で作成・変更・削除したファイルを洗い出す(インフラ・設定ファイルは対象外。#21)。
2. 新規ファイルは #29 のヘッダーをつけて samples に作る。変更したファイルは `tagmerge.py` で samples に当てる。削除したファイルは samples からも削除し、教材のそのファイルへのリンクを外す(ファイル名はコード表記で地の文に残す)。
3. `samples_check.py` を、前の Phase のタグを `--api-since`・`--ui-since` に渡して流す。例外表以外の不一致・作り忘れ(本体のみ)が 0 件になることを確かめる。
4. `link_check.py` を流し、リンク切れが 0 件になることを確かめる。

off の Phase では、ユーザーが写経した後に 3・4 を流す(本体の写経漏れが不一致として出る)。

## samples_check.py ── samples と本体の一致・作り忘れの検査

```sh
devex-api/backend/.venv/bin/python textbook/tools/samples_check.py            # 本体の作業ツリーと比べる
devex-api/backend/.venv/bin/python textbook/tools/samples_check.py --api-ref stage4 -v   # ref を指定、差分も表示
devex-api/backend/.venv/bin/python textbook/tools/samples_check.py --api-since phase-24 --ui-since phase-24   # 作り忘れも調べる
```

- 対応: `samples/backend/*` ↔ `devex-api/backend/*`、`samples/frontend/*` ↔ `devex-ui/*`(route group の違いは吸収)。
- コードだけを比べる。#29 のタグ・コメントアウトした旧コード・コメント・docstring は無視する。行の集まりが同じで並び順だけ違うもの(off の Phase の写経での並べ替え)と、`__all__` の並びは失敗にしない。
- Python 3.12 以降の構文(PEP 695)を読むため、devex-api の venv の Python で動かす。
- `--api-since`・`--ui-since` に ref を渡すと、その ref 以降に本体で追加・変更したソース(`backend/app`・`backend/tests`・`backend/alembic/versions`・`src`・`e2e`)のうち、samples に無いものを「本体のみ」として数える。テンプレート由来で CL 開発の前から samples に無いファイルは、ref 以降に触らない限り出ない。
- 例外は [`samples_check_allow.txt`](./samples_check_allow.txt) に理由つきで書く(手書きの alembic・本体に無いテスト・抜粋だけの css)。

## link_check.py ── 相対リンク切れの検査

```sh
python3 textbook/tools/link_check.py
```

- 対象は `textbook/**/*.md`・`CLAUDE.md`・`README.md`・`docs/*.md`。コードブロックとインラインコードの中は見ない。

## tagmerge.py ── 本体の差分をタグつきで samples に当てる

```sh
git -C devex-api show HEAD:backend/app/services/foo.py > /tmp/old.py
devex-api/backend/.venv/bin/python textbook/tools/tagmerge.py textbook/samples/backend/app/services/foo.py /tmp/old.py devex-api/backend/app/services/foo.py 25-1 '#'
```

- 本体の旧(HEAD)→新(作業ツリー)の差分を、#29 の「追記・更新・削除」のタグつきで samples のファイルに当てる。
- Python 3.12 以降の構文(PEP 695)を読むため、devex-api の venv の Python で動かす(古い Python では import 区間と docstring を読めず、手当てが増える)。
- 自動で扱うもの(2026-10-20 の手直し。ステージ11 の振り返り 16.1 の Q2):
  - **ファイル冒頭のヘッダー**: `更新：` の列に章を足す(既にあれば触らない)。ヘッダーが無ければ `更新：Phase-<章>` を入れる。
  - **ファイル先頭の import 区間**(`if TYPE_CHECKING:` の中・TS の複数行の import を含む): samples を新の区間で置き換え、増えた名前を `Phase-<章>:追記 ── m.a, …`、減った名前を `Phase-<章>：削除 ── m.c` の1行ずつにまとめて区間の直前に積む(#29 の特則)。並べ替えだけならタグなし。samples の区間の中にあった過去のタグ・コメントアウトは区間の直前へ移す。
  - **docstring(複数行の文字列)**: 文字列を途中で切る変更には、タグもコメントアウトも差し込まない。新の行をそのまま当て、標準エラーに記録の行の案(`# Phase-<章>：更新(docstring: <名前> …)`。ヘッダーの後に人が書く)を出す。samples の文字列が本体とずれていて当てる位置が決まらないときは当てずに、新の行を標準エラーに出す。
  - 当てた後の Python が構文として読めなければ、`!! 構文エラー` を出して終了コード 1 にする(ファイルは書く)。
- 自動で扱うもの(2026-10-21 の手直し。ステージ12 の振り返り 17.1 の Q3):
  - **JSX の子の位置**(`.tsx` の開きタグと閉じタグの間): タグ・旧行のコメントアウト・`↓↓` を1行ずつ `{/* … */}` で入れる(空行は `{/* */}`、旧行の中の `*/` は `*\/` に崩す)。条件式の括弧の中・`{…}` の中・タグの属性の間は JS の位置なので `//` のまま。位置は [`tsx_context.cjs`](./tsx_context.cjs) が devex-ui の `typescript` の構文木で調べる(node と `devex-ui/node_modules` が要る。無ければ `//` で入れて「要手当て」を出す)。
  - **TS/TSX の構文の確かめ**: 当てた後の `.ts`・`.tsx` が構文として読めなければ、`!! 構文エラー` を出して終了コード 1 にする。
  - **挿入・削除の区切り**: `) : null}` のような同じ行が続くときは、区切りを下へずらし(git と同じ)、タグを既存の行でなく新しい行の前に付ける。挿入は直前の行のすぐ後に入れ、samples の次の行に付いた履歴タグとその行の間に割り込まない。
- 次のものは自動では扱わない。標準エラーの「要手当て」を見て手で直す。
  - 関数の中の import
  - 複数の章にまたがるファイルの章の振り分け(当てた章を既定にして、後の章の分を直す)
- 整形だけの変更(並び順・import の順・引用符・末尾のセミコロン)はタグを付けずに上書きしてよい(#29)。
- テスト: `devex-api/backend/.venv/bin/python -m pytest textbook/tools/test_tagmerge.py`(JSX のテストは node と devex-ui の `typescript` が無ければ飛ばす)
