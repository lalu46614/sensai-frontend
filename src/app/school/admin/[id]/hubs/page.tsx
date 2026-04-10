"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { useAuth } from "@/lib/auth";
import { ArrowLeft } from "lucide-react";

interface TopicRow {
  id: number;
  name: string;
}

interface HubRow {
  id: number;
  name: string;
  description: string | null;
}

export default function LearningHubsAdminPage() {
  const params = useParams();
  const orgId = params.id as string;
  const { user } = useAuth();
  const userId = user?.id != null ? String(user.id) : "";
  const base = process.env.NEXT_PUBLIC_BACKEND_URL || "";

  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [hubs, setHubs] = useState<HubRow[]>([]);
  const [newTopicName, setNewTopicName] = useState("");
  const [newHubName, setNewHubName] = useState("");
  const [newHubDesc, setNewHubDesc] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgSlug, setOrgSlug] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId || !orgId) return;
    setLoading(true);
    setError(null);
    try {
      const [tRes, hRes] = await Promise.all([
        fetch(`${base}/organizations/${orgId}/topics?user_id=${userId}`),
        fetch(`${base}/organizations/${orgId}/hubs?user_id=${userId}`),
      ]);
      if (!tRes.ok || !hRes.ok) throw new Error("Failed to load");
      setTopics(await tRes.json());
      setHubs(await hRes.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [base, orgId, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!orgId) return;
    fetch(`${base}/organizations/${orgId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setOrgSlug(d?.slug ?? null))
      .catch(() => setOrgSlug(null));
  }, [orgId, base]);

  const addTopic = async () => {
    if (!newTopicName.trim() || !userId) return;
    const res = await fetch(`${base}/organizations/${orgId}/topics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: parseInt(userId, 10), name: newTopicName.trim() }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.detail || "Could not create topic");
      return;
    }
    setNewTopicName("");
    refresh();
  };

  const addHub = async () => {
    if (!newHubName.trim() || !userId) return;
    const res = await fetch(`${base}/organizations/${orgId}/hubs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: parseInt(userId, 10),
        name: newHubName.trim(),
        description: newHubDesc.trim() || null,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(typeof j.detail === "string" ? j.detail : "Could not create hub");
      return;
    }
    setNewHubName("");
    setNewHubDesc("");
    refresh();
  };

  if (!userId) {
    return (
      <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white p-8">
        <p>Sign in to manage learning hubs.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white">
      <Header />
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link
          href={`/school/admin/${orgId}`}
          className="inline-flex items-center text-sm text-indigo-600 dark:text-indigo-400 hover:underline mb-6"
        >
          <ArrowLeft size={16} className="mr-1" />
          Back to school
        </Link>
        <h1 className="text-3xl font-light mb-2">Learning hubs</h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-8">
          Create org-wide topics and hubs (e.g. DSA). Mentors tag course tasks with a hub and
          topics from the course editor (tags icon on each task). Learners see those tags on each
          activity. Members open <strong>Topic hubs — community posts</strong> from the school home
          to read and write hub posts.
        </p>
        {orgSlug && (
          <p className="text-sm text-indigo-600 dark:text-indigo-400 mb-6">
            <Link
              href={`/school/${orgSlug}/hubs`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              Open member hub directory (new tab) →
            </Link>
          </p>
        )}

        {error && (
          <div className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</div>
        )}
        {loading && <p className="text-sm text-gray-500 mb-6">Loading…</p>}

        <section className="mb-10">
          <h2 className="text-lg font-medium mb-3">Topics</h2>
          <div className="flex gap-2 mb-4">
            <input
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              placeholder="e.g. Dynamic programming"
              className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111] px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={addTopic}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
            >
              Add topic
            </button>
          </div>
          <ul className="flex flex-wrap gap-2">
            {topics.map((t) => (
              <li
                key={t.id}
                className="px-3 py-1 rounded-full text-sm border border-gray-300 dark:border-gray-600"
              >
                {t.name}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-medium mb-3">Hubs</h2>
          <div className="space-y-2 mb-4">
            <input
              value={newHubName}
              onChange={(e) => setNewHubName(e.target.value)}
              placeholder="Hub name (e.g. DSA)"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111] px-3 py-2 text-sm"
            />
            <textarea
              value={newHubDesc}
              onChange={(e) => setNewHubDesc(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111] px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={addHub}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700"
            >
              Create hub
            </button>
          </div>
          <ul className="space-y-2">
            {hubs.map((h) => (
              <li
                key={h.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2"
              >
                <div>
                  <div className="font-medium">{h.name}</div>
                  {h.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{h.description}</p>
                  )}
                </div>
                {orgSlug && (
                  <Link
                    href={`/school/${orgSlug}/hubs/${h.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap"
                  >
                    Posts &amp; AI mapping →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
