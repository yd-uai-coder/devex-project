// 更新：Phase-3-2
"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { AlertDialog, Button, Input, Theme, XStack, YStack } from "tamagui";
import { CheckboxWithLabel } from "@/components/ui/form/CheckboxWithLabel";
import FormGeneral from "@/components/ui/form/FormGeneral";
import InputEmail from "@/components/ui/form/InputEmail";
import InputPassword from "@/components/ui/form/InputPassword";
import InputSimpleText from "@/components/ui/form/InputSimpleText";
import TextAreaWithLabel from "@/components/ui/form/TextAreaWithLabel";
import RadioGroupWithLabel from "@/components/ui/form/RadioGroupWithLabel";
import SelectGroupWithLabel from "@/components/ui/form/SelectGroupWithLabel";
import { sampleFormSchema } from "./sample-form-schema";
import type { SampleFormValues } from "./sample-form-schema";
import { SubmissionSummary } from "./SubmissionSummary";

const LABEL_WIDTH = 84

const ANIMAL_ITEMS = [
  { value: "dog", label: "犬" },
  { value: "cat", label: "猫" },
  { value: "bird", label: "鳥" },
  { value: "other", label: "その他" },
];

const FRUIT_ITEMS = [
  { value: "apple", label: "りんご" },
  { value: "orange", label: "みかん" },
  { value: "grape", label: "ぶどう" },
  { value: "banana", label: "バナナ" },
];

const INITIAL_VALUES: SampleFormValues = {
  user: "",
  mail: "",
  password: "",
  postCode: "",
  phonNum: "",
  agree: false,
  animal: "",
  fruit: "",
  note: "",
};

// ハニーポットはこのページ固有のUI/セキュリティ上の実装詳細であり、sample-form-store/
// SubmissionSummaryが扱う共有ドメイン型(SampleFormValues)には含めたくないため、
// 共有スキーマをextend()したページローカルな型として扱う。空文字以外は不正。
const layoutFormSchema = sampleFormSchema.extend({
  honeypot: z.string().max(0),
});
type LayoutFormValues = z.infer<typeof layoutFormSchema>;

export function LayoutForm() {
  const [alertOpen, setAlertOpen] = useState(false);
  const [submittedValues, setSubmittedValues] = useState<SampleFormValues | null>(null);

  const { control, handleSubmit, reset } = useForm<LayoutFormValues>({
    resolver: zodResolver(layoutFormSchema),
    defaultValues: { ...INITIAL_VALUES, honeypot: "" },
  });

  const handleBeforeSubmit = (): Promise<boolean> =>
    new Promise((resolve) => {
      void handleSubmit(
        (data) => {
          reset(data);
          // ハニーポットの値は以降どこにも渡さない
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { honeypot, ...rest } = data;
          setSubmittedValues(rest);
          resolve(true);
        },
        // ハニーポットが埋まっていた場合もここに来るが、対応するUIにerrorMessageを
        // 出していないため、通常のエラー表示なしに黙って送信がブロックされる
        // (ボットに気づかせないための挙動をスキーマ制約のみで実現している)。
        () => resolve(false),
      )();
    });

  const handleSubmitted = () => {
    setAlertOpen(true);
    return;
  };

  return (
    <YStack width="100%" alignItems="center">
      <YStack width="100%" maxWidth={640}>
        {/* copy-themeページ(WelcomeBackCard/SubscribeCard等)と同じ配色言語(CLAUDE.md記載の
            「ボタン系は基本的に緑」方針)に揃えるため、フォーム全体を緑テーマでラップしている。
            各*WithLabel部品はstatus="default"時に<Theme name={null}>(=素通し)になるため、
            個々の部品を変更しなくてもこの外側の緑テーマがフォーカス枠・選択状態の色に伝播する。 */}
        <Theme name="gray">
          <FormGeneral
            buttonName="送信する"
            onBeforeSubmit={handleBeforeSubmit}
            onSubmitted={handleSubmitted}
            // Phase-3-2:追記 ── このデモには実バックエンドが無くonBeforeSubmitが同期的に
            // 完了してしまうため、スピナーが表示された瞬間に消えてしまう。デモ用に2秒間表示を保つ。
            demoDelayMs={2000}
            buttonProps={{
              theme: "green",
              backgroundColor: "$color9",
              color: "white",
              hoverStyle: { backgroundColor: "$color10" },
              pressStyle: { backgroundColor: "$color8" },
            }}
          >
            {/* ボット対策のハニーポット。視覚的に非表示・タブ移動不可・スクリーンリーダーからも
                除外し、実際の利用者が誤って入力しないようにしている。 */}
            <Controller
              name="honeypot"
              control={control}
              render={({ field }) => (
                <Input
                  position="absolute"
                  left={-9999}
                  width={1}
                  height={1}
                  opacity={0}
                  tabIndex={-1}
                  aria-hidden="true"
                  autoComplete="off"
                  name="website"
                  value={field.value}
                  onChangeText={field.onChange}
                />
              )}
            />
            <Controller
              name="user"
              control={control}
              render={({ field, fieldState }) => (
                <InputSimpleText
                  label="名前"
                  labelWidth={LABEL_WIDTH}
                  size="$3"
                  width="100%"
                  name="user"
                  maxLength={10}
                  placeholder="全角10文字以内で入力してください。"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  errorMessage={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="mail"
              control={control}
              render={({ field, fieldState }) => (
                <InputEmail
                  label="メール"
                  labelWidth={LABEL_WIDTH}
                  width="100%"
                  name="mail"
                  maxLength={254}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  errorMessage={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="password"
              control={control}
              render={({ field, fieldState }) => (
                <InputPassword
                  labelWidth={LABEL_WIDTH}
                  width="100%"
                  name="password"
                  maxLength={128}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  errorMessage={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="postCode"
              control={control}
              render={({ field, fieldState }) => (
                <InputSimpleText
                  label="郵便番号"
                  labelWidth={LABEL_WIDTH}
                  width="100%"
                  name="postCode"
                  maxLength={7}
                  placeholder="〒（ハイフンなし）"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  errorMessage={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="phonNum"
              control={control}
              render={({ field, fieldState }) => (
                <InputSimpleText
                  label="電話番号"
                  labelWidth={LABEL_WIDTH}
                  width="100%"
                  name="phonNum"
                  maxLength={11}
                  placeholder="Tel（ハイフンなし10～11桁）"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  errorMessage={fieldState.error?.message}
                />
              )}
            />

            <Controller
              name="animal"
              control={control}
              render={({ field, fieldState }) => (
                <RadioGroupWithLabel
                  items={ANIMAL_ITEMS}
                  label="好きな動物"
                  labelWidth={LABEL_WIDTH}
                  width="100%"
                  name="animal"
                  value={field.value}
                  onValueChange={field.onChange}
                  errorMessage={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="fruit"
              control={control}
              render={({ field, fieldState }) => (
                <SelectGroupWithLabel
                  items={FRUIT_ITEMS}
                  label="好きな食べ物"
                  labelWidth={LABEL_WIDTH}
                  width="100%"
                  name="fruit"
                  value={field.value}
                  onValueChange={field.onChange}
                  errorMessage={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="note"
              control={control}
              render={({ field, fieldState }) => (
                <TextAreaWithLabel
                  label="その他"
                  labelWidth={LABEL_WIDTH}
                  width="100%"
                  name="note"
                  maxLength={500}
                  placeholder="フリー入力(全角のみ)"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  errorMessage={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="agree"
              control={control}
              render={({ field, fieldState }) => (
                <CheckboxWithLabel
                  label="個人情報の取扱いに同意する"
                  justifyContent="center"
                  alignItems="center"
                  width="100%"
                  name="agree"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  errorMessage={fieldState.error?.message}
                />
              )}
            />
          </FormGeneral>
        </Theme>
      </YStack>

      <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay
            key="overlay"
            transition="quick"
            opacity={0.5}
            enterStyle={{ opacity: 0 }}
            exitStyle={{ opacity: 0 }}
          />
          <AlertDialog.Content
            key="content"
            bordered
            elevate
            gap="$4"
            padding="$5"
            maxWidth={420}
            transition="quick"
            enterStyle={{ opacity: 0, scale: 0.95, y: 10 }}
            exitStyle={{ opacity: 0, scale: 0.95, y: 10 }}
          >
            <AlertDialog.Title>送信内容の確認</AlertDialog.Title>
            <AlertDialog.Description>以下の内容で送信します。</AlertDialog.Description>
            {submittedValues ? <SubmissionSummary values={submittedValues} /> : null}
            <XStack justifyContent="flex-end">
              <AlertDialog.Cancel asChild>
                <Button>閉じる</Button>
              </AlertDialog.Cancel>
            </XStack>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog>
    </YStack>
  );
}
