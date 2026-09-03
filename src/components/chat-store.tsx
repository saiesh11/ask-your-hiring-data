"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  /** false until localStorage has been read — consumers hold their render to avoid a flash. */
  hydrated: boolean;
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
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // The source of truth for "which conversation appends target". A ref, not
  // state, so an in-flight ask() that captured an older render still writes the
  // model's answer to the conversation its question created.
  const activeIdRef = useRef<string | null>(null);
  const setActiveId = useCallback((id: string | null) => {
    activeIdRef.current = id;
    setActiveIdState(id);
  }, []);

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
  }, [setActiveId]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ conversations, activeId }));
    } catch {
      /* storage unavailable */
    }
  }, [conversations, activeId, hydrated]);

  const newConversation = useCallback(() => setActiveId(null), [setActiveId]);
  const selectConversation = useCallback((id: string) => setActiveId(id), [setActiveId]);
  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((cs) => cs.filter((c) => c.id !== id));
      if (activeIdRef.current === id) setActiveId(null);
    },
    [setActiveId],
  );
  const renameConversation = useCallback((id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setConversations((cs) =>
      cs.map((c) => (c.id === id ? { ...c, title: trimmed.slice(0, 80) } : c)),
    );
  }, []);

  const appendTurn = useCallback(
    (turn: Turn) => {
      const target = activeIdRef.current;
      if (target) {
        setConversations((cs) =>
          cs.map((c) =>
            c.id === target ? { ...c, turns: [...c.turns, turn], updatedAt: Date.now() } : c,
          ),
        );
        return;
      }
      const id = crypto.randomUUID();
      activeIdRef.current = id; // synchronous, so the next append in this ask() lands here
      setActiveId(id);
      const title = turn.role === "user" ? turn.text.slice(0, 60) || NEW_TITLE : NEW_TITLE;
      setConversations((cs) => [{ id, title, turns: [turn], updatedAt: Date.now() }, ...cs]);
    },
    [setActiveId],
  );

  const activeTurns = useMemo(
    () => conversations.find((c) => c.id === activeId)?.turns ?? [],
    [conversations, activeId],
  );

  const value = useMemo<ChatStore>(
    () => ({
      hydrated,
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
      hydrated,
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
