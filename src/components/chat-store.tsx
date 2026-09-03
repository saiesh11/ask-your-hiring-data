"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AnsweredResponse, RefusedResponse } from "@/lib/api";

export type Turn =
  | { role: "user"; text: string }
  | { role: "assistant"; response: AnsweredResponse | RefusedResponse }
  | { role: "error"; text: string };

export interface Conversation {
  id: string;
  title: string;
  turns: Turn[];
  updatedAt: number;
}

interface ChatStore {
  conversations: Conversation[];
  activeId: string | null;
  activeTurns: Turn[];
  newConversation: () => void;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  appendTurn: (turn: Turn) => void;
}

const KEY = "ayhd.chats.v1";
const NEW_TITLE = "New chat";
const Ctx = createContext<ChatStore | null>(null);

export function ChatStoreProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Mount-time hydration from localStorage: server and first client render
    // both start empty (no mismatch), then this pulls in persisted chats.
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          conversations?: Conversation[];
          activeId?: string | null;
        };
        setConversations(parsed.conversations ?? []);
        setActiveId(parsed.activeId ?? null);
      }
    } catch {
      /* fresh start */
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ conversations, activeId }));
    } catch {
      /* storage unavailable */
    }
  }, [conversations, activeId, hydrated]);

  const newConversation = useCallback(() => setActiveId(null), []);
  const selectConversation = useCallback((id: string) => setActiveId(id), []);
  const deleteConversation = useCallback((id: string) => {
    setConversations((cs) => cs.filter((c) => c.id !== id));
    setActiveId((cur) => (cur === id ? null : cur));
  }, []);
  const renameConversation = useCallback((id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setConversations((cs) =>
      cs.map((c) => (c.id === id ? { ...c, title: trimmed.slice(0, 80) } : c)),
    );
  }, []);

  const appendTurn = useCallback(
    (turn: Turn) => {
      const existing = activeId ? conversations.find((c) => c.id === activeId) : undefined;
      if (existing) {
        setConversations((cs) =>
          cs.map((c) =>
            c.id === existing.id ? { ...c, turns: [...c.turns, turn], updatedAt: Date.now() } : c,
          ),
        );
        return;
      }
      const id = crypto.randomUUID();
      const title = turn.role === "user" ? turn.text.slice(0, 60) || NEW_TITLE : NEW_TITLE;
      setConversations((cs) => [{ id, title, turns: [turn], updatedAt: Date.now() }, ...cs]);
      setActiveId(id);
    },
    [activeId, conversations],
  );

  const activeTurns = useMemo(
    () => conversations.find((c) => c.id === activeId)?.turns ?? [],
    [conversations, activeId],
  );

  const value = useMemo<ChatStore>(
    () => ({
      conversations,
      activeId,
      activeTurns,
      newConversation,
      selectConversation,
      deleteConversation,
      renameConversation,
      appendTurn,
    }),
    [
      conversations,
      activeId,
      activeTurns,
      newConversation,
      selectConversation,
      deleteConversation,
      renameConversation,
      appendTurn,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChatStore(): ChatStore {
  const value = useContext(Ctx);
  if (!value) throw new Error("useChatStore must be used within ChatStoreProvider");
  return value;
}
