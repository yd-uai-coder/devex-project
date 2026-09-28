// 作成：Phase-6-4
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { TemplateSelectField } from "../TemplateSelectField";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";
import type { EnvironmentValues } from "@/features/hearing/schemas";

const TEMPLATE_A = {
  id: "t1",
  name: "Webアプリケーション標準",
  target_type: "Web",
  system_prompt: "x",
  default_environment: {
    languages: ["python"],
    frameworks: ["fastapi"],
    databases: ["postgresql"],
    deploy_targets: [],
  },
  created_at: "2026-01-01T00:00:00Z",
};
const TEMPLATE_B = {
  id: "t2",
  name: "API向け",
  target_type: "API",
  system_prompt: "y",
  default_environment: null,
  created_at: "2026-01-01T00:00:00Z",
};

// TemplateSelectFieldは(react-hook-formのControllerと同様に)value propで選択状態を
// 描画する制御コンポーネントのため、テストでも選択変更をvalueへ反映するラッパーを介して
// レンダリングする(固定のnullを渡し続けると、2回目以降のクリックがRadioGroup上で
// 「既に選択済みの項目を再度選ぶ」扱いになりonValueChangeが発火しない)。
function Wrapper({ onChange }: { onChange: (templateId: string | null, environment: EnvironmentValues | null) => void }) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <TemplateSelectField
      value={value}
      onChange={(templateId, environment) => {
        setValue(templateId);
        onChange(templateId, environment);
      }}
    />
  );
}

function renderField(onChange = vi.fn()) {
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <Wrapper onChange={onChange} />
    </TamaguiProvider>,
  );
  return onChange;
}

describe("TemplateSelectField", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("取得したテンプレート一覧+「テンプレートを使わない」を選択肢として表示する", async () => {
    stub.queue({ status: 200, body: [TEMPLATE_A, TEMPLATE_B] });
    renderField();

    expect(await screen.findByRole("radio", { name: /Webアプリケーション標準/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /API向け/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "テンプレートを使わない" })).toBeInTheDocument();
  });

  it("テンプレートを選択するとtemplateId+default_environmentをonChangeへ渡す", async () => {
    stub.queue({ status: 200, body: [TEMPLATE_A, TEMPLATE_B] });
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderField(onChange);

    await user.click(await screen.findByRole("radio", { name: /Webアプリケーション標準/ }));

    expect(onChange).toHaveBeenCalledWith("t1", {
      languages: ["python"],
      frameworks: ["fastapi"],
      databases: ["postgresql"],
      deployTargets: [],
    });
  });

  it("「テンプレートを使わない」を選択するとnull,nullをonChangeへ渡す", async () => {
    stub.queue({ status: 200, body: [TEMPLATE_A, TEMPLATE_B] });
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderField(onChange);
    await user.click(await screen.findByRole("radio", { name: /Webアプリケーション標準/ }));

    await user.click(screen.getByRole("radio", { name: "テンプレートを使わない" }));

    expect(onChange).toHaveBeenLastCalledWith(null, null);
  });

  it("default_environment未設定のテンプレートはenvironmentにnullを渡す", async () => {
    stub.queue({ status: 200, body: [TEMPLATE_A, TEMPLATE_B] });
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderField(onChange);

    await user.click(await screen.findByRole("radio", { name: /API向け/ }));

    expect(onChange).toHaveBeenCalledWith("t2", null);
  });

  it("テンプレートが0件なら何も表示しない", async () => {
    stub.queue({ status: 200, body: [] });
    renderField();

    await vi.waitFor(() => expect(stub.requests).toHaveLength(1));
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("取得失敗時はエラーを表示する", async () => {
    stub.queue({ status: 500, body: {} });
    renderField();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
