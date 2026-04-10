"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { useAuth } from "@/lib/auth";
import {
  createHubPost,
  fetchOrgBySlug,
  listHubPosts,
  listHubs,
  listOrgTopics,
  type HubPostFeedItem,
  type OrgTopic,
} from "@/lib/hubApi";
import { ArrowLeft, MessageSquarePlus, Sparkles } from "lucide-react";

const POST_TYPES = [
  { value: "thread", label: "Discussion" },
  { value: "solution", label: "Solution / write-up" },
  { value: "note", label: "Note" },
  { value: "question", label: "Question" },
];

export default function HubFeedClient({
  schoolSlug,
  hubId,
}: {
  schoolSlug: string;
  hubId: number;
}) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [orgId, setOrgId] = useState<number | null>(null);
  const [hubName, setHubName] = useState("");
  const [posts, setPosts] = useState<HubPostFeedItem[]>([]);
  const [topics, setTopics] = useState<OrgTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [postType, setPostType] = useState("thread");
  const [selectedTopics, setSelectedTopics] = useState<Set<number>>(new Set());
  const [linkedTaskId, setLinkedTaskId] = useState("");
  const [linkedQuestionId, setLinkedQuestionId] = useState("");

  const loadFeed = useCallback(
    async (oid: number, uid: number) => {
      const [feed, tops] = await Promise.all([
        listHubPosts(oid, hubId, uid, { limit: 50 }),
        listOrgTopics(oid, uid),
      ]);
      setPosts(feed);
      setTopics(tops);
    },
    [hubId]
  );

  useEffect(() => {
    if (authLoading || !isAuthenticated || !user?.id) return;
    let cancelled = false;
    const uid = Number(user.id);
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const org = await fetchOrgBySlug(schoolSlug);
        if (cancelled) return;
        setOrgId(org.id);
        const hubs = await listHubs(org.id, uid);
        const me = hubs.find((h) => h.id === hubId);
        if (!me) {
          setError("This hub does not exist or you cannot access it.");
          setLoading(false);
          return;
        }
        setHubName(me.name);
        await loadFeed(org.id, uid);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load hub");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [schoolSlug, hubId, user?.id, isAuthenticated, authLoading, loadFeed]);

  const toggleTopic = (id: number) => {
    setSelectedTopics((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || orgId == null || !title.trim() || !body.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await createHubPost(orgId, hubId, Number(user.id), {
        title: title.trim(),
        body: body.trim(),
        post_type: postType,
        org_topic_ids: Array.from(selectedTopics),
        linked_task_id: linkedTaskId.trim()
          ? parseInt(linkedTaskId, 10)
          : null,
        linked_question_id: linkedQuestionId.trim()
          ? parseInt(linkedQuestionId, 10)
          : null,
      });
      setTitle("");
      setBody("");
      setSelectedTopics(new Set());
      setLinkedTaskId("");
      setLinkedQuestionId("");
      setShowComposer(false);
      await loadFeed(orgId, Number(user.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish");
    } finally {
      setSubmitting(false);
    }
  };

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
          href={`/school/${schoolSlug}/hubs`}
          className="inline-flex items-center text-sm text-indigo-600 dark:text-indigo-400 hover:underline mb-4"
        >
          <ArrowLeft size={16} className="mr-1" />
          All hubs
        </Link>
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-light">{hubName || "Hub"}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Posts from everyone in this school. Open a post to reply, mark helpful,
              or run AI mapping.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowComposer((v) => !v)}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full bg-indigo-600 text-white text-sm hover:bg-indigo-700"
          >
            <MessageSquarePlus size={18} />
            New post
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
        )}

        {showComposer && orgId != null && (
          <form
            onSubmit={handleCreate}
            className="mb-8 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3 bg-gray-50/80 dark:bg-[#111]"
          >
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-sm font-medium">
              <Sparkles size={16} />
              New post
            </div>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0a0a0a] px-3 py-2 text-sm"
            />
            <textarea
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your solution, question, or note…"
              rows={6}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0a0a0a] px-3 py-2 text-sm"
            />
            <div>
              <label className="text-xs text-gray-500 block mb-1">Type</label>
              <select
                value={postType}
                onChange={(e) => setPostType(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0a0a0a] px-3 py-2 text-sm"
              >
                {POST_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Task ID (optional)
                </label>
                <input
                  value={linkedTaskId}
                  onChange={(e) => setLinkedTaskId(e.target.value)}
                  placeholder="e.g. 42"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0a0a0a] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Question ID (optional)
                </label>
                <input
                  value={linkedQuestionId}
                  onChange={(e) => setLinkedQuestionId(e.target.value)}
                  placeholder="e.g. 108"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0a0a0a] px-3 py-2 text-sm"
                />
              </div>
            </div>
            {topics.length > 0 && (
              <div>
                <span className="text-xs text-gray-500 block mb-2">Topics</span>
                <div className="flex flex-wrap gap-2">
                  {topics.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTopic(t.id)}
                      className={`px-2.5 py-1 rounded-full text-xs border ${
                        selectedTopics.has(t.id)
                          ? "bg-indigo-600 border-indigo-600 text-white"
                          : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowComposer(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white disabled:opacity-50"
              >
                {submitting ? "Publishing…" : "Publish"}
              </button>
            </div>
          </form>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin border-gray-400" />
          </div>
        )}

        {!loading && posts.length === 0 && !error && (
          <p className="text-gray-500 dark:text-gray-400 text-center py-12">
            No posts yet. Be the first to share something.
          </p>
        )}

        <ul className="space-y-3">
          {posts.map((p) => (
            <li key={p.id}>
              <Link
                href={`/school/${schoolSlug}/hubs/${hubId}/posts/${p.id}`}
                className="block rounded-xl border border-gray-200 dark:border-gray-800 p-4 hover:border-indigo-400/60 dark:hover:border-indigo-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-medium text-lg leading-snug">{p.title}</h2>
                  {p.mentor_recommended && (
                    <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                      Mentor pick
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {p.author_name}
                  {p.created_at
                    ? ` · ${new Date(p.created_at).toLocaleString()}`
                    : ""}
                  {p.helpful_count > 0
                    ? ` · ${p.helpful_count} helpful`
                    : ""}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[10px] uppercase tracking-wide text-gray-400">
                    {p.post_type}
                  </span>
                  {p.topic_tags.map((t) => (
                    <span
                      key={t.id}
                      className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                    >
                      {t.name}
                    </span>
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
