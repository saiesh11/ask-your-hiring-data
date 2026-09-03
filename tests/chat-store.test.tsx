// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { ChatStoreProvider, useChatStore } from "@/components/chat-store";

afterEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

const render = () => renderHook(() => useChatStore(), { wrapper: ChatStoreProvider });

describe("chat store — per-account isolation", () => {
  it("keeps each principal's conversations separate", () => {
    const { result } = render();

    // CHRO (the default) asks something -> one conversation
    act(() => result.current.appendTurn({ role: "user", text: "headcount" }));
    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.activeTurns).toHaveLength(1);

    // switch to a recruiter -> their view is empty, CHRO's chat is hidden
    act(() => result.current.setActiveUserId("recruiter_eng"));
    expect(result.current.activeUserId).toBe("recruiter_eng");
    expect(result.current.conversations).toHaveLength(0);
    expect(result.current.activeId).toBeNull();
    expect(result.current.activeTurns).toHaveLength(0);

    // recruiter asks -> their own conversation, still 1 for CHRO underneath
    act(() => result.current.appendTurn({ role: "user", text: "open reqs" }));
    expect(result.current.conversations).toHaveLength(1);

    // back to CHRO -> their chat is there, the recruiter's is not
    act(() => result.current.setActiveUserId("chro"));
    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.conversations[0]?.turns[0]).toMatchObject({ text: "headcount" });
  });
});
