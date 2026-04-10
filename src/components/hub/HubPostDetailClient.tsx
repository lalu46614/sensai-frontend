"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { useAuth } from "@/lib/auth";
import {
  addHubReply,
  fetchOrgBySlug,
  getHubPost,
  listOrgTopics,
  setMentorRecommend,
  suggestHubPostMapping,
  toggleHubHelpful,
  updateHubPostLinks,
  type HubPostDetail,
  type OrgTopic,
  type SuggestMappingResult,
} from "@/lib/hubApi";
import TopicTagsBar from "@/components/TopicTagsBar";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  ThumbsUp,
  Star,
  Send,
} from "lucide-react";

export default function HubPostDetailClient({
  schoolSlug,
  hubId,
  postId,
}: {
  schoolSlug: string;
  hubId: number;
  postId: number;
}) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [orgId, setOrgId] = useState<number | null>(null);
  const [post, setPost] = useState<HubPostDetail | null>(null);
  const [topics, setTopics] = useState<OrgTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [helpfulWorking, setHelpfulWorking] = useState(false);
  const [mentorWorking, setMentorWorking] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<SuggestMappingResult | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const uid = user?.id != null ? Number(user.id) : null;

  const refresh = useCallback(async () => {
    if (uid == null || orgId == null) return;
    const p = await getHubPost(orgId, hubId, postId, uid);
    setPost(p);
  }, [orgId, hubId, postId, uid]);

  useEffect(() => {
    if (authLoading || !isAuthenticated || uid == null) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const org = await fetchOrgBySlug(schoolSlug);
        if (cancelled) return;
        setOrgId(org.id);
        const [p, tops] = await Promise.all([
          getHubPost(org.id, hubId, postId, uid),
          listOrgTopics(org.id, uid),
        ]);
        if (cancelled) return;
        setPost(p);
        setTopics(tops);
        if (p.ai_suggestion_json && typeof p.ai_suggestion_json === "object") {
          const j = p.ai_suggestion_json as Record<string, unknown>;
          setAiResult({
            suggested_task_id: (j.suggested_task_id as number) ?? null,
            suggested_question_id: (j.suggested_question_id as number) ?? null,
            suggested_org_topic_ids: Array.isArray(j.suggested_org_topic_ids)
              ? (j.suggested_org_topic_ids as number[])
              : [],
            confidence: typeof j.confidence === "number" ? j.confidence : 0,
            rationale: typeof j.rationale === "string" ? j.rationale : "",
          });
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load post");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [schoolSlug, hubId, postId, uid, isAuthenticated, authLoading]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim() || uid == null || orgId == null) return;
    setReplySending(true);
    try {
      await addHubReply(orgId, hubId, postId, uid, replyBody.trim());
      setReplyBody("");
      await refresh();
    } catch {
      showToast("Could not add reply");
    } finally {
      setReplySending(false);
    }
  };

  const handleHelpful = async () => {
    if (uid == null || orgId == null) return;
    setHelpfulWorking(true);
    try {
      const s = await toggleHubHelpful(orgId, hubId, postId, uid);
      setPost((prev) =>
        prev
          ? {
              ...prev,
              helpful_count: s.helpful_count,
              i_marked_helpful: s.marked_helpful,
            }
          : null
      );
    } catch {
      showToast("Could not update helpful");
    } finally {
      setHelpfulWorking(false);
    }
  };

  const handleMentorRecommend = async (recommended: boolean) => {
    if (uid == null || orgId == null) return;
    setMentorWorking(true);
    try {
      await setMentorRecommend(orgId, hubId, postId, uid, recommended);
      await refresh();
      showToast(recommended ? "Marked as mentor pick" : "Removed mentor pick");
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : "Only mentors/admins can do this"
      );
    } finally {
      setMentorWorking(false);
    }
  };

  const runAiSuggest = async () => {
    if (!post || uid == null || orgId == null) return;
    setAiLoading(true);
    setError(null);
    try {
      const res = await suggestHubPostMapping(
        uid,
        orgId,
        hubId,
        post.title,
        post.body,
        postId
      );
      setAiResult(res);
      await refresh();
      showToast("Suggestion saved on this post");
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI mapping failed");
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiLinks = async () => {
    if (!aiResult || uid == null || orgId == null) return;
    setApplyLoading(true);
    try {
      await updateHubPostLinks(orgId, hubId, postId, uid, {
        linked_task_id: aiResult.suggested_task_id,
        linked_question_id: aiResult.suggested_question_id,
        org_topic_ids: [...aiResult.suggested_org_topic_ids],
      });
      await refresh();
      showToast("Links applied to this post");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not apply links");
    } finally {
      setApplyLoading(false);
    }
  };

  const topicNameMap = Object.fromEntries(topics.map((t) => [t.id, t.name]));

  if (authLoading || (!isAuthenticated && !authLoading)) {
    return (
      <div className="min-h-screen bg-white dark:bg-black">
        <Header showCreateCourseButton={false} />
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin border-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white">
      <Header showCreateCourseButton={false} />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href={`/school/${schoolSlug}/hubs/${hubId}`}
          className="inline-flex items-center text-sm text-indigo-600 dark:text-indigo-400 hover:underline mb-6"
        >
          <ArrowLeft size={16} className="mr-1" />
          Back to hub
        </Link>

        {toast && (
          <div className="mb-4 text-sm px-3 py-2 rounded-lg bg-emerald-900/30 text-emerald-100 border border-emerald-700/50">
            {toast}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-gray-400" />
          </div>
        )}
        {error && !loading && (
          <p className="text-red-600 dark:text-red-400">{error}</p>
        )}

        {post && !loading && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <h1 className="text-2xl sm:text-3xl font-light leading-tight flex-1">
                {post.title}
              </h1>
              {post.mentor_recommended && (
                <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                  Mentor recommended
                </span>
              )}
            </div>
            <TopicTagsBar tags={post.topic_tags} className="mb-4" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              {post.author_name}
              {post.created_at
                ? ` · ${new Date(post.created_at).toLocaleString()}`
                : ""}
            </p>

            <div className="flex flex-wrap gap-2 mb-8">
              <button
                type="button"
                onClick={handleHelpful}
                disabled={helpfulWorking || uid == null}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border ${
                  post.i_marked_helpful
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-900"
                }`}
              >
                <ThumbsUp size={16} />
                Helpful
                {post.helpful_count > 0 && (
                  <span className="opacity-80">({post.helpful_count})</span>
                )}
              </button>
              <button
                type="button"
                onClick={() =>
                  handleMentorRecommend(!post.mentor_recommended)
                }
                disabled={mentorWorking || uid == null}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border border-amber-600/60 text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/40"
              >
                <Star size={16} />
                {post.mentor_recommended
                  ? "Unmark mentor pick"
                  : "Mentor pick"}
              </button>
            </div>

            <div className="text-sm sm:text-base leading-relaxed mb-10 whitespace-pre-wrap border border-gray-200 dark:border-gray-800 rounded-xl p-4 bg-gray-50/50 dark:bg-[#111] text-gray-800 dark:text-gray-100">
              {post.body}
            </div>

            {(post.linked_task_id != null ||
              post.linked_question_id != null) && (
              <div className="mb-8 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <div className="font-medium text-gray-800 dark:text-gray-200">
                  Linked activity
                </div>
                {post.linked_task_id != null && (
                  <div>Task ID: {post.linked_task_id}</div>
                )}
                {post.linked_question_id != null && (
                  <div>Question ID: {post.linked_question_id}</div>
                )}
              </div>
            )}

            <section className="mb-10 rounded-xl border border-violet-200 dark:border-violet-900/60 bg-violet-50/40 dark:bg-violet-950/20 p-4">
              <div className="flex items-center gap-2 text-violet-800 dark:text-violet-200 font-medium mb-2">
                <Sparkles size={18} />
                AI mapping
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                Suggests which quiz question and topics best match this post (from
                your org catalog). Results are stored on the post; you can apply them
                as official links.
              </p>
              <button
                type="button"
                onClick={runAiSuggest}
                disabled={aiLoading || uid == null}
                className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm hover:bg-violet-700 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {aiLoading ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Sparkles size={16} />
                )}
                Suggest mapping
              </button>

              {aiResult && (
                <div className="mt-4 space-y-2 text-sm border-t border-violet-200/60 dark:border-violet-800 pt-4">
                  {aiResult.rationale && (
                    <p className="text-gray-700 dark:text-gray-300 italic">
                      {aiResult.rationale}
                    </p>
                  )}
                  <p className="text-gray-600 dark:text-gray-400">
                    Confidence:{" "}
                    <span className="font-mono">
                      {(aiResult.confidence * 100).toFixed(0)}%
                    </span>
                  </p>
                  <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
                    <li>
                      Task ID:{" "}
                      {aiResult.suggested_task_id ?? "—"}
                    </li>
                    <li>
                      Question ID:{" "}
                      {aiResult.suggested_question_id ?? "—"}
                    </li>
                    <li>
                      Topics:{" "}
                      {aiResult.suggested_org_topic_ids.length === 0
                        ? "—"
                        : aiResult.suggested_org_topic_ids
                            .map((id) => topicNameMap[id] || `#${id}`)
                            .join(", ")}
                    </li>
                  </ul>
                  <button
                    type="button"
                    onClick={applyAiLinks}
                    disabled={
                      applyLoading ||
                      (aiResult.suggested_task_id == null &&
                        aiResult.suggested_question_id == null &&
                        aiResult.suggested_org_topic_ids.length === 0)
                    }
                    className="mt-2 px-4 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-black text-sm disabled:opacity-40"
                  >
                    {applyLoading ? "Applying…" : "Apply to post"}
                  </button>
                </div>
              )}
            </section>

            <section>
              <h2 className="text-lg font-medium mb-3">
                Replies & alternate approaches
              </h2>
              <ul className="space-y-3 mb-4">
                {post.replies.map((r) => (
                  <li
                    key={r.id}
                    className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-sm"
                  >
                    <div className="text-xs text-gray-500 mb-1">
                      {r.author_name}
                      {r.created_at
                        ? ` · ${new Date(r.created_at).toLocaleString()}`
                        : ""}
                    </div>
                    <div className="whitespace-pre-wrap">{r.body}</div>
                  </li>
                ))}
              </ul>
              <form onSubmit={handleReply} className="space-y-2">
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Add a clarification or another approach…"
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0a0a0a] px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={replySending || !replyBody.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-50"
                >
                  <Send size={16} />
                  {replySending ? "Sending…" : "Post reply"}
                </button>
              </form>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
