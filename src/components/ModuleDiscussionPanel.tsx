"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Loader2, MessageSquare, ChevronLeft, ChevronUp, BarChart2, HelpCircle, CheckCircle2 } from "lucide-react";

const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "";

export type CommunityTab = "discussion" | "poll" | "qa";

type ThreadSummary = {
  id: number;
  title: string;
  body: string;
  author_user_id: number;
  task_id: number | null;
  question_id: number | null;
  post_type?: string;
  accepted_reply_id?: number | null;
  created_at: string;
  updated_at: string;
  author_first_name: string | null;
  author_last_name: string | null;
  author_email: string | null;
  reply_count: number;
  weighted_score?: number;
  upvote_count?: number;
  my_upvoted?: boolean;
};

type PollOptionOut = {
  id: number;
  label: string;
  sort_order: number;
  vote_count: number;
};

type ReplyOut = {
  id: number;
  body: string;
  author_user_id: number;
  created_at: string;
  author_first_name: string | null;
  author_last_name: string | null;
  author_email: string | null;
  weighted_score?: number;
  upvote_count?: number;
  my_upvoted?: boolean;
};

type ThreadDetail = ThreadSummary & {
  replies: ReplyOut[];
  poll_options: PollOptionOut[];
  my_vote_option_id: number | null;
  weighted_score?: number;
  upvote_count?: number;
  my_upvoted?: boolean;
};

function authorLabel(t: {
  author_first_name?: string | null;
  author_last_name?: string | null;
  author_email?: string | null;
  author_user_id?: number;
}) {
  const n = [t.author_first_name, t.author_last_name].filter(Boolean).join(" ").trim();
  return n || t.author_email || `user_${t.author_user_id ?? "?"}`;
}

function formatRelativeTime(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 45) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  if (sec < 31536000) return `${Math.floor(sec / 604800)}w ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function MetaDot() {
  return <span className="mx-1 text-gray-400 dark:text-zinc-500">·</span>;
}

function postTypeLabel(pt: string | undefined): string {
  if (pt === "poll") return "Poll";
  if (pt === "question") return "Q&A";
  return "Discussion";
}

interface ModuleDiscussionPanelProps {
  open: boolean;
  onClose: () => void;
  /** `embedded` fills the parent (e.g. chat column); `modal` is a centered overlay. */
  variant?: "modal" | "embedded";
  cohortId: string;
  courseId: string;
  milestoneId: string;
  userId: string;
  initialTaskId?: string | null;
  initialQuestionId?: string | null;
  /** Which community tab to show when the panel opens (modal) or when `communityFocusSeq` bumps. */
  initialCommunityTab?: CommunityTab;
  /** Increment (from parent) to open/focus the panel on `initialCommunityTab` (embedded). */
  communityFocusSeq?: number;
}

const TAB_API: Record<CommunityTab, string> = {
  discussion: "thread",
  poll: "poll",
  qa: "question",
};

function communityTabStorageKey(
  cohortId: string,
  courseId: string,
  milestoneId: string,
  taskId?: string | null,
  questionId?: string | null
) {
  const t = taskId && String(taskId).trim() !== "" ? String(taskId) : "_module";
  const q =
    questionId && String(questionId).trim() !== "" ? String(questionId) : "_";
  return `senseai:communityTab:${cohortId}:${courseId}:${milestoneId}:${t}:${q}`;
}

function readStoredCommunityTab(
  cohortId: string,
  courseId: string,
  milestoneId: string,
  taskId?: string | null,
  questionId?: string | null
): CommunityTab | null {
  if (typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem(
      communityTabStorageKey(cohortId, courseId, milestoneId, taskId, questionId)
    );
    if (v === "discussion" || v === "poll" || v === "qa") return v;
  } catch {
    /* private mode / quota */
  }
  return null;
}

function writeStoredCommunityTab(
  cohortId: string,
  courseId: string,
  milestoneId: string,
  tab: CommunityTab,
  taskId?: string | null,
  questionId?: string | null
) {
  try {
    sessionStorage.setItem(
      communityTabStorageKey(cohortId, courseId, milestoneId, taskId, questionId),
      tab
    );
  } catch {
    /* ignore */
  }
}

export default function ModuleDiscussionPanel({
  open,
  onClose,
  variant = "modal",
  cohortId,
  courseId,
  milestoneId,
  userId,
  initialTaskId,
  initialQuestionId,
  initialCommunityTab = "discussion",
  communityFocusSeq = 0,
}: ModuleDiscussionPanelProps) {
  const [communityTab, setCommunityTab] = useState<CommunityTab>(() => {
    const stored = readStoredCommunityTab(
      cohortId,
      courseId,
      milestoneId,
      initialTaskId,
      initialQuestionId
    );
    return stored ?? initialCommunityTab;
  });
  const [view, setView] = useState<"list" | "thread" | "new">("list");
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [activeThread, setActiveThread] = useState<ThreadDetail | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [pollOptionDrafts, setPollOptionDrafts] = useState<string[]>(["", ""]);
  const [replyBody, setReplyBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const basePath = `${backend}/cohorts/${cohortId}/courses/${courseId}/modules/${milestoneId}/threads`;

  const loadThreads = useCallback(async () => {
    if (!open || !userId) return;
    setLoadingList(true);
    setError(null);
    try {
      const pt = TAB_API[communityTab];
      const qs = new URLSearchParams({
        user_id: userId,
        limit: "50",
        offset: "0",
        post_type: pt,
        sort: "top",
      });
      if (initialTaskId && String(initialTaskId).trim() !== "") {
        qs.set("task_id", String(initialTaskId).trim());
      }
      if (initialQuestionId && String(initialQuestionId).trim() !== "") {
        qs.set("question_id", String(initialQuestionId).trim());
      }
      const res = await fetch(`${basePath}?${qs.toString()}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || res.statusText);
      }
      const data = await res.json();
      setThreads(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load posts");
      // Keep previous list on error so "back" doesn't look empty after a failed refetch.
    } finally {
      setLoadingList(false);
    }
  }, [open, userId, basePath, communityTab, initialTaskId, initialQuestionId]);

  const initialCommunityTabRef = useRef(initialCommunityTab);
  initialCommunityTabRef.current = initialCommunityTab;

  const prevFocusSeqRef = useRef<number | null>(null);

  // Restore tab when panel opens or module changes: prefer last tab for this module
  // (survives unmount when switching AI ↔ community) over a stale parent default.
  useEffect(() => {
    if (!open) {
      setView("list");
      setActiveThread(null);
      setNewTitle("");
      setNewBody("");
      setPollOptionDrafts(["", ""]);
      setReplyBody("");
      setError(null);
      return;
    }
    const stored = readStoredCommunityTab(
      cohortId,
      courseId,
      milestoneId,
      initialTaskId,
      initialQuestionId
    );
    const nextTab = stored ?? initialCommunityTabRef.current;
    setCommunityTab(nextTab);
    setView("list");
    setActiveThread(null);
  }, [open, milestoneId, cohortId, courseId, initialTaskId, initialQuestionId]);

  // Only when the parent bumps focus seq (header Discuss / Poll / Q&A): apply that tab.
  // Do not depend on initialCommunityTab — parent re-renders were resetting the tab and
  // fetching the wrong post_type (empty list after back).
  useEffect(() => {
    if (!open) {
      prevFocusSeqRef.current = null;
      return;
    }
    if (!communityFocusSeq) return;
    if (prevFocusSeqRef.current === communityFocusSeq) return;
    prevFocusSeqRef.current = communityFocusSeq;
    const tab = initialCommunityTabRef.current;
    setCommunityTab(tab);
    writeStoredCommunityTab(
      cohortId,
      courseId,
      milestoneId,
      tab,
      initialTaskId,
      initialQuestionId
    );
    setView("list");
    setActiveThread(null);
    setError(null);
  }, [
    communityFocusSeq,
    open,
    cohortId,
    courseId,
    milestoneId,
    initialTaskId,
    initialQuestionId,
  ]);

  useEffect(() => {
    if (!open) return;
    loadThreads();
  }, [open, loadThreads]);

  useEffect(() => {
    if (open && view === "new") {
      setNewTitle("");
      setNewBody("");
      setPollOptionDrafts(["", ""]);
    }
  }, [open, view, initialTaskId, initialQuestionId, communityTab]);

  useEffect(() => {
    if (!open) return;
    writeStoredCommunityTab(
      cohortId,
      courseId,
      milestoneId,
      communityTab,
      initialTaskId,
      initialQuestionId
    );
  }, [open, cohortId, courseId, milestoneId, communityTab, initialTaskId, initialQuestionId]);

  const goBackToList = useCallback(() => {
    setError(null);
    if (view === "new") {
      setView("list");
    } else {
      setView("list");
      setActiveThread(null);
    }
    void loadThreads();
  }, [view, loadThreads]);

  const openNewThread = () => {
    setView("new");
    setNewTitle("");
    setNewBody("");
    setPollOptionDrafts(["", ""]);
    setError(null);
  };

  const openThread = async (id: number) => {
    setLoadingThread(true);
    setError(null);
    try {
      const res = await fetch(`${basePath}/${id}?user_id=${encodeURIComponent(userId)}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || res.statusText);
      }
      const data: ThreadDetail = await res.json();
      setActiveThread({
        ...data,
        replies: data.replies ?? [],
        poll_options: data.poll_options ?? [],
        my_vote_option_id: data.my_vote_option_id ?? null,
      });
      setView("thread");
      setReplyBody("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load post");
    } finally {
      setLoadingThread(false);
    }
  };

  const postTypeForNew = (): "thread" | "poll" | "question" => {
    if (communityTab === "poll") return "poll";
    if (communityTab === "qa") return "question";
    return "thread";
  };

  const submitNewThread = async () => {
    const pt = postTypeForNew();
    if (!newTitle.trim()) {
      setError("Title is required");
      return;
    }
    if (pt !== "poll" && !newBody.trim()) {
      setError("Message is required");
      return;
    }
    if (pt === "poll") {
      const opts = pollOptionDrafts.map((s) => s.trim()).filter(Boolean);
      if (opts.length < 2) {
        setError("Add at least two poll options");
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        user_id: parseInt(userId, 10),
        title: newTitle.trim(),
        body: newBody.trim(),
        post_type: pt,
      };
      if (initialTaskId) body.task_id = parseInt(initialTaskId, 10);
      if (initialQuestionId) body.question_id = parseInt(initialQuestionId, 10);
      if (pt === "poll") {
        body.poll_options = pollOptionDrafts.map((s) => s.trim()).filter(Boolean);
      }
      const res = await fetch(basePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(
          typeof d.detail === "string" ? d.detail : JSON.stringify(d.detail) || res.statusText
        );
      }
      const { id } = await res.json();
      await loadThreads();
      await openThread(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create post");
    } finally {
      setSubmitting(false);
    }
  };

  const submitReply = async () => {
    if (!activeThread || !replyBody.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${basePath}/${activeThread.id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: parseInt(userId, 10),
          body: replyBody.trim(),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(
          typeof d.detail === "string" ? d.detail : JSON.stringify(d.detail) || res.statusText
        );
      }
      setReplyBody("");
      await openThread(activeThread.id);
      await loadThreads();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not post reply");
    } finally {
      setSubmitting(false);
    }
  };

  const castVote = async (optionId: number) => {
    if (!activeThread) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${basePath}/${activeThread.id}/poll/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: parseInt(userId, 10),
          option_id: optionId,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(
          typeof d.detail === "string" ? d.detail : JSON.stringify(d.detail) || res.statusText
        );
      }
      await openThread(activeThread.id);
      await loadThreads();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record vote");
    } finally {
      setSubmitting(false);
    }
  };

  const acceptAnswer = async (replyId: number) => {
    if (!activeThread) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${basePath}/${activeThread.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: parseInt(userId, 10),
          reply_id: replyId,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(
          typeof d.detail === "string" ? d.detail : JSON.stringify(d.detail) || res.statusText
        );
      }
      await openThread(activeThread.id);
      await loadThreads();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not accept answer");
    } finally {
      setSubmitting(false);
    }
  };

  const applyThreadUpvoteState = (
    threadId: number,
    upvoted: boolean,
    upvote_count: number,
    weighted_score: number
  ) => {
    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId
          ? { ...t, my_upvoted: upvoted, upvote_count, weighted_score }
          : t
      )
    );
    setActiveThread((prev) =>
      prev && prev.id === threadId
        ? { ...prev, my_upvoted: upvoted, upvote_count, weighted_score }
        : prev
    );
  };

  const toggleThreadUpvote = async (threadId: number) => {
    setError(null);
    try {
      const res = await fetch(`${basePath}/${threadId}/upvote/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: parseInt(userId, 10) }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(
          typeof d.detail === "string" ? d.detail : JSON.stringify(d.detail) || res.statusText
        );
      }
      const data = await res.json();
      applyThreadUpvoteState(threadId, data.upvoted, data.upvote_count, data.weighted_score);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update upvote");
    }
  };

  const toggleReplyUpvote = async (replyId: number) => {
    if (!activeThread) return;
    setError(null);
    try {
      const res = await fetch(
        `${basePath}/${activeThread.id}/replies/${replyId}/upvote/toggle`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: parseInt(userId, 10) }),
        }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(
          typeof d.detail === "string" ? d.detail : JSON.stringify(d.detail) || res.statusText
        );
      }
      await openThread(activeThread.id);
      await loadThreads();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update upvote");
    }
  };

  if (!open) return null;

  const isEmbedded = variant === "embedded";
  const uid = parseInt(userId, 10);
  const isQuestionAuthor =
    activeThread && activeThread.post_type === "question" && activeThread.author_user_id === uid;

  const shell = isEmbedded
    ? "w-full h-full min-h-0 flex flex-col border-0 rounded-none shadow-none bg-[#f6f7f8] dark:bg-[#1a1a1b] overflow-hidden"
    : "w-full max-w-2xl max-h-[90vh] flex flex-col rounded border border-[#ccc] dark:border-[#343536] bg-[#f6f7f8] dark:bg-[#1a1a1b] shadow-xl overflow-hidden";

  const btnPrimary =
    "px-5 py-1.5 text-sm font-bold rounded-full bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:hover:bg-orange-600 text-white transition-colors";

  const inputBase =
    "w-full rounded border border-[#ccc] dark:border-[#343536] bg-white dark:bg-[#272729] text-[#1c1c1c] dark:text-[#d7dadc] text-sm placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500";

  const tabBtn = (tab: CommunityTab, label: string, Icon: typeof MessageSquare) => (
    <button
      key={tab}
      type="button"
      onClick={() => {
        setCommunityTab(tab);
        writeStoredCommunityTab(
          cohortId,
          courseId,
          milestoneId,
          tab,
          initialTaskId,
          initialQuestionId
        );
        setView("list");
        setActiveThread(null);
        setError(null);
      }}
      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-semibold rounded-md transition-colors ${
        communityTab === tab
          ? "bg-white dark:bg-[#272729] text-[#1c1c1c] dark:text-[#d7dadc] shadow-sm"
          : "text-[#787c7e] dark:text-[#818384] hover:text-[#1c1c1c] dark:hover:text-white"
      }`}
    >
      <Icon size={14} className="flex-shrink-0 opacity-80" />
      <span className="truncate">{label}</span>
    </button>
  );

  const panel = (
    <div className={shell}>
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#edeff1] dark:border-[#343536] bg-white dark:bg-[#1a1a1b]">
        <div className="flex items-center gap-2 min-w-0">
          {view !== "list" && (
            <button
              type="button"
              onClick={() => goBackToList()}
              className="p-1 rounded text-[#878a8c] hover:bg-[#edeff1] dark:hover:bg-[#272729]"
              aria-label="Back"
            >
              <ChevronLeft size={22} />
            </button>
          )}
          <MessageSquare size={18} className="text-[#878a8c] flex-shrink-0" />
          <h2
            id="module-discussion-title"
            className="text-sm font-bold text-[#1c1c1c] dark:text-[#d7dadc] truncate"
          >
            {view === "list" && "Community"}
            {view === "new" && (communityTab === "poll" ? "New poll" : communityTab === "qa" ? "Ask a question" : "New post")}
            {view === "thread" && (activeThread?.title || "Post")}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full text-[#878a8c] hover:bg-[#edeff1] dark:hover:bg-[#272729]"
          aria-label={isEmbedded ? "Back to AI assistant" : "Close"}
        >
          <X size={20} />
        </button>
      </div>

      {view === "list" && (
        <div className="px-3 py-2 border-b border-[#edeff1] dark:border-[#343536] bg-[#edeff1]/80 dark:bg-[#111]">
          <div className="flex rounded-lg bg-[#dae0e6] dark:bg-[#1a1a1b] p-0.5 gap-0.5">
            {tabBtn("discussion", "Discussion", MessageSquare)}
            {tabBtn("poll", "Polls", BarChart2)}
            {tabBtn("qa", "Q&A", HelpCircle)}
          </div>
        </div>
      )}

      <div
        className={`flex-1 overflow-y-auto min-h-0 bg-[#f6f7f8] dark:bg-[#030303] ${isEmbedded ? "" : "min-h-[220px]"}`}
      >
        {error && (
          <div className="mx-3 mt-3 px-3 py-2 text-sm rounded border border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        {view === "list" && (
          <div className="p-3">
            {loadingList ? (
              <div className="flex justify-center py-16">
                <Loader2 className="animate-spin text-orange-600" size={28} />
              </div>
            ) : threads.length === 0 ? (
              <div className="rounded border border-[#edeff1] dark:border-[#343536] bg-white dark:bg-[#1a1a1b] p-8 text-center">
                <p className="text-sm text-[#878a8c] dark:text-[#818384]">
                  {communityTab === "poll"
                    ? "No polls yet. Start one with New poll."
                    : communityTab === "qa"
                      ? "No questions yet. Be the first to ask."
                      : "No posts yet. Be the first to start a thread."}
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {threads.map((t) => (
                  <li
                    key={t.id}
                    className="flex gap-1 rounded border border-[#edeff1] dark:border-[#343536] bg-white dark:bg-[#1a1a1b] overflow-hidden hover:border-[#898989] dark:hover:border-[#818384] transition-colors"
                  >
                    <div
                      className="flex flex-col items-center justify-start pt-2 px-1 border-r border-[#edeff1] dark:border-[#343536] bg-[#f6f7f8] dark:bg-[#111]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        aria-label={t.my_upvoted ? "Remove upvote" : "Upvote"}
                        onClick={() => void toggleThreadUpvote(t.id)}
                        className={`flex flex-col items-center min-w-[40px] py-0.5 rounded transition-colors ${
                          t.my_upvoted
                            ? "text-orange-600 dark:text-orange-500"
                            : "text-[#878a8c] hover:text-[#1c1c1c] dark:hover:text-[#d7dadc]"
                        }`}
                      >
                        <ChevronUp size={20} strokeWidth={2.5} />
                        <span className="text-xs font-bold leading-tight">{t.weighted_score ?? 0}</span>
                        <span className="text-[9px] text-[#787c7e] dark:text-[#818384] leading-tight">
                          {t.upvote_count ?? 0}↑
                        </span>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => openThread(t.id)}
                      className="flex-1 min-w-0 text-left px-3 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-[15px] font-medium text-[#0079d3] dark:text-[#4fbcff] leading-snug min-w-0">
                          {t.title}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wide text-[#787c7e] dark:text-[#818384] flex-shrink-0">
                          {postTypeLabel(t.post_type)}
                        </span>
                      </div>
                      <div className="text-xs text-[#787c7e] dark:text-[#818384] mt-1 flex flex-wrap items-center gap-x-1">
                        <span className="font-bold text-[#1c1c1c] dark:text-[#d7dadc]">{authorLabel(t)}</span>
                        <MetaDot />
                        <span>{formatRelativeTime(t.created_at)}</span>
                        {t.post_type !== "poll" && (
                          <>
                            <MetaDot />
                            <span>
                              {t.reply_count} {t.reply_count === 1 ? "answer" : "answers"}
                            </span>
                          </>
                        )}
                      </div>
                      {t.body ? (
                        <p className="text-sm text-[#1c1c1c] dark:text-[#d7dadc] mt-2 line-clamp-2 leading-relaxed">
                          {t.body}
                        </p>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {view === "new" && (
          <div className="p-3 space-y-3">
            {(initialTaskId || initialQuestionId) && (
              <p className="text-xs text-[#787c7e] dark:text-[#818384] px-1">
                Linked to this {initialQuestionId ? "question" : "activity"}.
              </p>
            )}
            <div className="rounded border border-[#edeff1] dark:border-[#343536] bg-white dark:bg-[#1a1a1b] p-3 space-y-3">
              <input
                type="text"
                placeholder={communityTab === "qa" ? "Question title" : "Title"}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className={`${inputBase} px-3 py-2`}
              />
              <textarea
                placeholder={
                  communityTab === "poll"
                    ? "Description (optional)"
                    : communityTab === "qa"
                      ? "Details / context"
                      : "Body text"
                }
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                rows={communityTab === "poll" ? 4 : 8}
                className={`${inputBase} px-3 py-2 resize-y min-h-[100px] font-mono text-[13px] leading-relaxed`}
              />
              {communityTab === "poll" && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-[#787c7e] dark:text-[#818384]">Options</div>
                  {pollOptionDrafts.map((opt, i) => (
                    <input
                      key={i}
                      type="text"
                      placeholder={`Option ${i + 1}`}
                      value={opt}
                      onChange={(e) => {
                        const next = [...pollOptionDrafts];
                        next[i] = e.target.value;
                        setPollOptionDrafts(next);
                      }}
                      className={`${inputBase} px-3 py-2`}
                    />
                  ))}
                  {pollOptionDrafts.length < 12 && (
                    <button
                      type="button"
                      onClick={() => setPollOptionDrafts([...pollOptionDrafts, ""])}
                      className="text-xs font-semibold text-[#0079d3] dark:text-[#4fbcff] hover:underline"
                    >
                      + Add option
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {view === "thread" && (
          <div className="pb-2">
            {loadingThread || !activeThread ? (
              <div className="flex justify-center py-16">
                <Loader2 className="animate-spin text-orange-600" size={28} />
              </div>
            ) : activeThread.post_type === "poll" ? (
              <>
                <div className="flex border-b border-[#edeff1] dark:border-[#343536] bg-white dark:bg-[#1a1a1b]">
                  <div className="flex flex-col items-center justify-start pt-3 px-2 border-r border-[#edeff1] dark:border-[#343536] bg-[#f6f7f8] dark:bg-[#111]">
                    <button
                      type="button"
                      aria-label={activeThread.my_upvoted ? "Remove upvote" : "Upvote"}
                      onClick={() => void toggleThreadUpvote(activeThread.id)}
                      className={`flex flex-col items-center min-w-[44px] py-1 rounded ${
                        activeThread.my_upvoted
                          ? "text-orange-600 dark:text-orange-500"
                          : "text-[#878a8c] hover:text-[#1c1c1c] dark:hover:text-[#d7dadc]"
                      }`}
                    >
                      <ChevronUp size={22} strokeWidth={2.5} />
                      <span className="text-sm font-bold">{activeThread.weighted_score ?? 0}</span>
                      <span className="text-[10px] text-[#787c7e]">{activeThread.upvote_count ?? 0} votes</span>
                    </button>
                  </div>
                  <article className="flex-1 min-w-0 px-3 sm:px-4 py-4">
                    <h3 className="text-lg sm:text-xl font-medium text-[#1c1c1c] dark:text-[#d7dadc] leading-tight pr-2">
                      {activeThread.title}
                    </h3>
                    <div className="mt-2 text-xs text-[#787c7e] dark:text-[#818384] flex flex-wrap items-center">
                      <span className="font-bold text-[#1c1c1c] dark:text-[#d7dadc]">{authorLabel(activeThread)}</span>
                      <MetaDot />
                      <span>{formatRelativeTime(activeThread.created_at)}</span>
                    </div>
                    {activeThread.body ? (
                      <div className="mt-4 text-[15px] text-[#1c1c1c] dark:text-[#d7dadc] leading-relaxed whitespace-pre-wrap break-words">
                        {activeThread.body}
                      </div>
                    ) : null}
                  </article>
                </div>
                <div className="p-3 space-y-2">
                  {(activeThread.poll_options ?? []).map((o) => {
                    const selected = activeThread.my_vote_option_id === o.id;
                    const totalVotes = (activeThread.poll_options ?? []).reduce((s, x) => s + x.vote_count, 0);
                    const pct = totalVotes > 0 ? Math.round((o.vote_count / totalVotes) * 100) : 0;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        disabled={submitting}
                        onClick={() => castVote(o.id)}
                        className={`w-full text-left rounded border px-3 py-2.5 transition-colors ${
                          selected
                            ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30"
                            : "border-[#edeff1] dark:border-[#343536] bg-white dark:bg-[#1a1a1b] hover:border-orange-400"
                        }`}
                      >
                        <div className="flex justify-between gap-2 text-sm font-medium text-[#1c1c1c] dark:text-[#d7dadc]">
                          <span>{o.label}</span>
                          <span className="text-[#787c7e] dark:text-[#818384] font-normal">
                            {o.vote_count} ({pct}%)
                          </span>
                        </div>
                      </button>
                    );
                  })}
                  <p className="text-xs text-[#787c7e] dark:text-[#818384] px-1 pt-1">
                    Tap an option to vote. You can change your vote anytime.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="flex border-b border-[#edeff1] dark:border-[#343536] bg-white dark:bg-[#1a1a1b]">
                  <div className="flex flex-col items-center justify-start pt-3 px-2 border-r border-[#edeff1] dark:border-[#343536] bg-[#f6f7f8] dark:bg-[#111]">
                    <button
                      type="button"
                      aria-label={activeThread.my_upvoted ? "Remove upvote" : "Upvote"}
                      onClick={() => void toggleThreadUpvote(activeThread.id)}
                      className={`flex flex-col items-center min-w-[44px] py-1 rounded ${
                        activeThread.my_upvoted
                          ? "text-orange-600 dark:text-orange-500"
                          : "text-[#878a8c] hover:text-[#1c1c1c] dark:hover:text-[#d7dadc]"
                      }`}
                    >
                      <ChevronUp size={22} strokeWidth={2.5} />
                      <span className="text-sm font-bold">{activeThread.weighted_score ?? 0}</span>
                      <span className="text-[10px] text-[#787c7e]">{activeThread.upvote_count ?? 0} votes</span>
                    </button>
                  </div>
                  <article className="flex-1 min-w-0 px-3 sm:px-4 py-4">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg sm:text-xl font-medium text-[#1c1c1c] dark:text-[#d7dadc] leading-tight pr-2 flex-1">
                        {activeThread.title}
                      </h3>
                      {activeThread.post_type === "question" && (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-[#787c7e] dark:text-[#818384]">
                          Q&A
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-xs text-[#787c7e] dark:text-[#818384] flex flex-wrap items-center">
                      <span className="font-bold text-[#1c1c1c] dark:text-[#d7dadc]">{authorLabel(activeThread)}</span>
                      <MetaDot />
                      <span>{formatRelativeTime(activeThread.created_at)}</span>
                    </div>
                    <div className="mt-4 text-[15px] text-[#1c1c1c] dark:text-[#d7dadc] leading-relaxed whitespace-pre-wrap break-words">
                      {activeThread.body}
                    </div>
                  </article>
                </div>

                <div className="px-3 sm:px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#787c7e] dark:text-[#818384] border-b border-[#edeff1] dark:border-[#343536] bg-[#f6f7f8] dark:bg-[#030303]">
                  {activeThread.post_type === "question" ? "Answers" : "Comments"}{" "}
                  <span className="font-normal normal-case">({activeThread.replies?.length ?? 0})</span>
                </div>

                <div className="px-2 sm:px-3 py-2 bg-[#f6f7f8] dark:bg-[#030303]">
                  {activeThread.replies?.length ? (
                    <ul className="space-y-0">
                      {activeThread.replies.map((r, idx, arr) => {
                        const accepted = activeThread.accepted_reply_id === r.id;
                        return (
                          <li
                            key={r.id}
                            className={`flex gap-1 ${
                              idx < arr.length - 1
                                ? "border-b border-[#edeff1] dark:border-[#343536]"
                                : ""
                            }`}
                          >
                            <div className="flex flex-col items-center flex-shrink-0 w-11 pt-2 px-0.5 bg-[#f6f7f8]/80 dark:bg-[#111]/80">
                              <button
                                type="button"
                                aria-label={r.my_upvoted ? "Remove upvote" : "Upvote answer"}
                                onClick={() => void toggleReplyUpvote(r.id)}
                                className={`flex flex-col items-center min-w-[36px] py-0.5 rounded ${
                                  r.my_upvoted
                                    ? "text-orange-600 dark:text-orange-500"
                                    : "text-[#878a8c] hover:text-[#1c1c1c] dark:hover:text-[#d7dadc]"
                                }`}
                              >
                                <ChevronUp size={18} strokeWidth={2.5} />
                                <span className="text-[10px] font-bold leading-tight">{r.weighted_score ?? 0}</span>
                                <span className="text-[8px] text-[#787c7e] leading-tight">{r.upvote_count ?? 0}↑</span>
                              </button>
                            </div>
                            <div className="flex-1 min-w-0 pt-2 pb-3 pr-2">
                              <div className="text-xs text-[#787c7e] dark:text-[#818384] flex flex-wrap items-baseline gap-x-2 mb-1">
                                <span className="font-bold text-[#1c1c1c] dark:text-[#d7dadc]">
                                  {authorLabel(r)}
                                </span>
                                <MetaDot />
                                <span>{formatRelativeTime(r.created_at)}</span>
                                {accepted && (
                                  <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                                    <CheckCircle2 size={12} />
                                    Accepted
                                  </span>
                                )}
                              </div>
                              <p className="text-[14px] text-[#1c1c1c] dark:text-[#d7dadc] leading-relaxed whitespace-pre-wrap break-words">
                                {r.body}
                              </p>
                              {isQuestionAuthor && !accepted && (
                                <button
                                  type="button"
                                  disabled={submitting}
                                  onClick={() => acceptAnswer(r.id)}
                                  className="mt-2 text-xs font-bold text-[#0079d3] dark:text-[#4fbcff] hover:underline disabled:opacity-40"
                                >
                                  Accept this answer
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-[#787c7e] dark:text-[#818384] px-2 py-4">
                      {activeThread.post_type === "question"
                        ? "No answers yet. Add yours below."
                        : "No comments yet. Add yours below."}
                    </p>
                  )}
                </div>

                <div className="mx-3 mb-3 mt-1 rounded border border-[#edeff1] dark:border-[#343536] bg-white dark:bg-[#1a1a1b] p-3">
                  <div className="text-xs font-bold text-[#787c7e] dark:text-[#818384] mb-2">
                    {activeThread.post_type === "question" ? "Your answer" : "Add a comment"}
                  </div>
                  <textarea
                    placeholder={
                      activeThread.post_type === "question"
                        ? "Write your answer…"
                        : "What are your thoughts?"
                    }
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    rows={4}
                    className={`${inputBase} px-3 py-2 resize-y min-h-[100px] text-[14px] leading-relaxed`}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 px-3 py-2.5 border-t border-[#edeff1] dark:border-[#343536] bg-white dark:bg-[#1a1a1b]">
        {view === "list" && (
          <button type="button" onClick={openNewThread} className={btnPrimary}>
            {communityTab === "poll" ? "New poll" : communityTab === "qa" ? "Ask question" : "New post"}
          </button>
        )}
        {view === "new" && (
          <button type="button" onClick={submitNewThread} disabled={submitting} className={btnPrimary}>
            {submitting ? "Posting…" : "Post"}
          </button>
        )}
        {view === "thread" && activeThread && activeThread.post_type !== "poll" && (
          <button
            type="button"
            onClick={submitReply}
            disabled={submitting || !replyBody.trim()}
            className={btnPrimary}
          >
            {submitting ? "Posting…" : activeThread.post_type === "question" ? "Post answer" : "Comment"}
          </button>
        )}
      </div>
    </div>
  );

  if (isEmbedded) {
    return (
      <div
        className="flex flex-col flex-1 min-h-0 h-full overflow-hidden bg-[#f6f7f8] dark:bg-[#030303]"
        role="region"
        aria-label="Module community"
      >
        {panel}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="module-discussion-title"
    >
      {panel}
    </div>
  );
}
