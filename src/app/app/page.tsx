import { Chat } from "@/components/chat";

// TODO(S6): the chat still uses the dev "view as" switcher + userId body param.
// S6 wires it to the signed-in user's org membership.
export default function AppPage() {
  return <Chat />;
}
