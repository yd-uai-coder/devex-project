// 作成：Phase-3-5
import { ChatPageContent } from "@/features/hearing/components/ChatPageContent";
import { RequireAuth } from "@/components/auth/RequireAuth";

// Next.js 16のApp Routerではparamsがpromiseになる(Server Component側でawaitする)。
// このページ自体は非同期のServer Componentのままにし、フック(useState/useRouter等)を
// 使う実処理はClient Component(ChatPageContent)に切り出して解決済みのidだけを渡す。
export default async function ProjectChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireAuth>
      <ChatPageContent projectId={id} />
    </RequireAuth>
  );
}
