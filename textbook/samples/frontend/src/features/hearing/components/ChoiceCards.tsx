// 作成：Phase-35-3｜更新：Phase-35(完了後の調整)
// Phase-35(完了後の調整)：更新(冒頭の説明: カードごとの「この回答を送る」)
import { Button, Text, XStack, YStack } from "tamagui";
import type { HearingCard } from "@/features/hearing/api/hearingApi";
// Phase-35(完了後の調整):追記 ── 選択肢のラジオボタンのスタイル
import styles from "./ChoiceCards.module.css";

// AI の返信の後ろに付く選択肢カード。選んだ選択肢は送るまでサーバーへ送らず(選び直せる)、
// カードごとの「この回答を送る」(または全体の送信)の時点で、サーバーがその観点を「AI の提案を
// 採用」と記録する。回答済みのカード(card.selected がある)と、最新ではない AI の発言のカードは、
// 選んだ結果を読むだけ。選択肢はブラウザのラジオボタン(1つの問いから1つ選ぶ)。押した瞬間に
// 選択中の表示になるよう、色は CSS で付ける(ChoiceCards.module.css)。
export function ChoiceCards({
  cards,
  drafts,
  onSelect,
  // Phase-35(完了後の調整):追記
  onSend,
  disabled,
}: {
  cards: HearingCard[];
  drafts: Record<string, number>;
  // 無ければ読むだけ(古いカード)
  onSelect?: (cardId: string, option: number) => void;
  // Phase-35(完了後の調整):追記
  // カードの回答だけを送る(1枚送ると次の返信が最新になり、残りのカードは読むだけになる)
  onSend?: (cardId: string) => void;
  disabled?: boolean;
}) {
  return (
    <YStack gap="$3" maxWidth="80%">
      {cards.map((card) => {
        const answered = card.selected !== null;
        const chosen = answered ? card.selected : drafts[card.id];
        const selectable = Boolean(onSelect) && !answered && !disabled;
        return (
          <YStack
            key={card.id}
            role="group"
            aria-label={`選択肢カード: ${card.label}`}
            gap="$2"
            padding="$3"
            borderWidth={1}
            borderColor="$borderColor"
            borderRadius="$4"
            backgroundColor="$color2"
          >
            <Text fontSize="$2" color="$color11">
              {card.label}
              {answered ? " ── 回答済み" : ""}
            </Text>
            <Text fontWeight="600">{card.question}</Text>
            {/* Phase-35(完了後の調整)：更新(選択肢をラジオボタンにした。Button のホバーの色が選択中の青を隠し、青くなるのが遅く見えたため)
            {card.options.map((option, index) => {
              const isChosen = chosen === index;
              const isRecommended = index === card.recommended;
              return (
                <Button
                  key={option.label}
                  aria-pressed={isChosen}
                  disabled={!selectable}
                  onPress={() => onSelect?.(card.id, index)}
                  height="auto"
                  paddingVertical="$2"
                  justifyContent="flex-start"
                  borderWidth={isChosen ? 2 : 1}
                  borderColor={isChosen ? "$blue9" : "$borderColor"}
                  backgroundColor={isChosen ? "$blue3" : "$background"}
                  opacity={!selectable && !isChosen ? 0.6 : 1}
                >
                  <YStack gap="$1" flex={1} alignItems="flex-start">
                    <XStack gap="$2" alignItems="center" flexWrap="wrap">
                      <Text fontWeight="600">{option.label}</Text>
                      {isRecommended ? (
                        <Text fontSize="$1" color="$blue10" fontWeight="600">
                          おすすめ
                        </Text>
                      ) : null}
                    </XStack>
                    {option.result ? (
                      <Text fontSize="$2" color="$color11">
                        {option.result}
                      </Text>
                    ) : null}
                    {isRecommended && card.reason ? (
                      <Text fontSize="$2" color="$blue10">
                        {card.reason}
                      </Text>
                    ) : null}
                  </YStack>
                </Button>
              );
            })}
            ↓↓ */}
            <div role="radiogroup" aria-label={card.question} style={{ display: "grid", gap: 8 }}>
              {card.options.map((option, index) => {
                const isRecommended = index === card.recommended;
                return (
                  <label key={option.label} className={styles.option}>
                    <input
                      type="radio"
                      className={styles.radio}
                      name={card.id}
                      value={index}
                      checked={chosen === index}
                      disabled={!selectable}
                      onChange={() => onSelect?.(card.id, index)}
                    />
                    <YStack gap="$1" flex={1}>
                      <XStack gap="$2" alignItems="center" flexWrap="wrap">
                        <Text fontWeight="600">{option.label}</Text>
                        {isRecommended ? (
                          <Text fontSize="$1" color="$blue10" fontWeight="600">
                            おすすめ
                          </Text>
                        ) : null}
                      </XStack>
                      {option.result ? (
                        <Text fontSize="$2" color="$color11">
                          {option.result}
                        </Text>
                      ) : null}
                      {isRecommended && card.reason ? (
                        <Text fontSize="$2" color="$blue10">
                          {card.reason}
                        </Text>
                      ) : null}
                    </YStack>
                  </label>
                );
              })}
            </div>
            {/* Phase-35(完了後の調整):追記 ── カードごとの送信 */}
            {selectable && onSend ? (
              <Button
                size="$3"
                theme="blue"
                alignSelf="flex-end"
                disabled={chosen === undefined}
                onPress={() => onSend(card.id)}
              >
                この回答を送る
              </Button>
            ) : null}
          </YStack>
        );
      })}
      {onSelect && !disabled && cards.some((card) => card.selected === null) ? (
        <Text fontSize="$2" color="$color11">
          {/* Phase-35(完了後の調整)：更新
          選んだ内容は「送信」で送ります。選ばずに、チャットに自分の言葉で答えてもかまいません。
          ↓↓ */}
          選んだら「この回答を送る」で送ります。選ばずに、チャットに自分の言葉で答えてもかまいません
          (入力欄の文は、カードの回答と一緒に送られます)。
        </Text>
      ) : null}
    </YStack>
  );
}
