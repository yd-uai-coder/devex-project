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
python3 textbook/tools/tagmerge.py textbook/samples/backend/app/services/foo.py /tmp/old.py devex-api/backend/app/services/foo.py 25-1 '#'
```

- 本体の旧(HEAD)→新(作業ツリー)の差分を、#29 の「追記・更新・削除」のタグつきで samples のファイルに当てる。
- 次のものは自動では扱わない。標準エラーの「要手当て」を見て手で直す。
  - import 文(#29 の特則で、タグは import ブロックの直前にまとめる)
  - 複数行の文字列(docstring)の中
  - ファイル冒頭のヘッダー(`# 作成：…｜更新：…`)
  - JSX の中(`{/* … */}` でのコメントアウトが要る)
- 整形だけの変更(並び順・import の順・引用符・末尾のセミコロン)はタグを付けずに上書きしてよい(#29)。
