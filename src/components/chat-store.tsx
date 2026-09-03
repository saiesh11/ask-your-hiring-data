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
  /** The demo principal this chat belongs to — chats never cross accounts. */
  userId: string;
  title: string;
  turns: Turn[];
  updatedAt: number;
}

interface ChatStore {
  /** false until localStorage has been read — consumers hold their render to avoid a flash. */
  hydrated: boolean;
  /** Only the active principal's conversations. */
  conversations: Conversation[];
  activeId: string | null;
  activeTurns: Turn[];
  /** Which demo principal (`chro` | `recruiter_eng` | `recruiter_sales`) the next ask runs as. */
  activeUserId: string;
  setActiveUserId: (id: string) => void;
  newConversation: () => void;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  appendTurn: (turn: Turn) => void;
}

const KEY = "ayhd.chats.v1";
const NEW_TITLE = "New chat";
const DEFAULT_USER = "chro";
const Ctx = createContext<ChatStore | null>(null);

export function ChatStoreProvider({ children }: { children: ReactNode }) {
  // The full store across every principal; the context only ever exposes the
  // active one's slice.
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [activeUserId, setActiveUserIdState] = useState<string>(DEFAULT_USER);
  const [hydrated, setHydrated] = useState(false);

  // Refs so an in-flight ask() that captured an older render still writes the
  // model's answer to the right conversation, owned by the right principal.
  const activeIdRef = useRef<string | null>(null);
  const activeUserIdRef = useRef<string>(DEFAULT_USER);

  const setActiveId = useCallback((id: string | null) => {
    activeIdRef.current = id;
    setActiveIdState(id);
  }, []);

  const setActiveUserId = useCallback(
    (id: string) => {
      if (id === activeUserIdRef.current) return;
      activeUserIdRef.current = id;
      setActiveUserIdState(id);
      // Switching accounts lands on a fresh empty state; the previous
      // account's chats stay in storage, hidden until you switch back.
      setActiveId(null);
    },
    [setActiveId],
  );

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          conversations?: Conversation[];
          activeId?: string | null;
          activeUserId?: string;
        };
        // migrate pre-partition chats onto the default principal
        setAllConversations(
          (parsed.conversations ?? []).map((c) => ({ ...c, userId: c.userId ?? DEFAULT_USER })),
        );
        setActiveId(parsed.activeId ?? null);
        if (parsed.activeUserId) {
          activeUserIdRef.current = parsed.activeUserId;
          setActiveUserIdState(parsed.activeUserId);
        }
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
      localStorage.setItem(
        KEY,
        JSON.stringify({ conversations: allConversations, activeId, activeUserId }),
      );
    } catch {
      /* storage unavailable */
    }
  }, [allConversations, activeId, activeUserId, hydrated]);

  const newConversation = useCallback(() => setActiveId(null), [setActiveId]);
  const selectConversation = useCallback((id: string) => setActiveId(id), [setActiveId]);
  const deleteConversation = useCallback(
    (id: string) => {
      setAllConversations((cs) => cs.filter((c) => c.id !== id));
      if (activeIdRef.current === id) setActiveId(null);
    },
    [setActiveId],
  );
  const renameConversation = useCallback((id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setAllConversations((cs) =>
      cs.map((c) => (c.id === id ? { ...c, title: trimmed.slice(0, 80) } : c)),
    );
  }, []);

  const appendTurn = useCallback(
    (turn: Turn) => {
      const target = activeIdRef.current;
      if (target) {
        setAllConversations((cs) =>
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
      setAllConversations((cs) => [
        { id, userId: activeUserIdRef.current, title, turns: [turn], updatedAt: Date.now() },
        ...cs,
      ]);
    },
    [setActiveId],
  );

  const conversations = useMemo(
    () => allConversations.filter((c) => c.userId === activeUserId),
    [allConversations, activeUserId],
  );

  const activeTurns = useMemo(() => {
    const c = allConversations.find((x) => x.id === activeId);
    return c && c.userId === activeUserId ? c.turns : [];
  }, [allConversations, activeId, activeUserId]);

  const value = useMemo<ChatStore>(
    () => ({
      hydrated,
      conversations,
      activeId,
      activeTurns,
      activeUserId,
      setActiveUserId,
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
      activeUserId,
      setActiveUserId,
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
