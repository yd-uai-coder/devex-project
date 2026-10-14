// 作成：Phase-53-3
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decideFinding,
  getCurrentUser,
  listReviewGates,
  requestReview,
  updateReviewSettings,
} from "../reviewApi";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

// SUT は reviewApi の各関数、ドライバは vitest。スタブは stubFetch(fetch を差し替え、送った
// リクエストを記録する)── 外部依存(HTTP)を呼ぶ関数なので、通信を偽物にして URL・メソッド・本文を確かめる。
describe("reviewApi", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("ユーザーと設定は /users/me を読み、PUT で切り替える", async () => {
    await getCurrentUser();
    await updateReviewSettings(true);

    expect(stub.requests[0].url).toContain("/api/v1/users/me");
    expect(stub.requests[1].url).toContain("/api/v1/users/me/review-settings");
    expect(stub.requests[1].init?.method).toBe("PUT");
    expect(JSON.parse(String(stub.requests[1].init?.body))).toEqual({ review_enabled: true });
  });

  it("区切りの一覧・レビューの受け付け・採否のURL", async () => {
    stub.queue({ status: 200, body: [] });
    stub.queue({ status: 202, body: {} });

    await listReviewGates("p1");
    await requestReview("p1", "stage6");
    await decideFinding("p1", "f1", "adopted");

    expect(stub.requests[0].url).toMatch(/\/api\/v1\/projects\/p1\/reviews$/);
    expect(stub.requests[1].url).toContain("/api/v1/projects/p1/reviews/stage6");
    expect(stub.requests[1].init?.method).toBe("POST");
    expect(stub.requests[2].url).toContain("/api/v1/projects/p1/reviews/findings/f1");
    expect(stub.requests[2].init?.method).toBe("PUT");
    expect(JSON.parse(String(stub.requests[2].init?.body))).toEqual({ decision: "adopted" });
  });
});
