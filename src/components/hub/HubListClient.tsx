"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { useAuth } from "@/lib/auth";
import { fetchOrgBySlug, listHubs, type TopicHubSummary } from "@/lib/hubApi";
import { ArrowLeft, Hash } from "lucide-react";

export default function HubListClient({ schoolSlug }: { schoolSlug: string }) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [orgName, setOrgName] = useState("");
  const [orgId, setOrgId] = useState<number | null>(null);
  const [hubs, setHubs] = useState<TopicHubSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !user?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const org = await fetchOrgBySlug(schoolSlug);
        if (cancelled) return;
        setOrgId(org.id);
        setOrgName(org.name);
        const list = await listHubs(org.id, Number(user.id));
        if (cancelled) return;
        setHubs(list);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load hubs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [schoolSlug, user?.id, isAuthenticated, authLoading]);

  if (authLoading || (!isAuthenticated && !authLoading)) {
    return (
      <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white">
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
          href={`/school/${schoolSlug}`}
          className="inline-flex items-center text-sm text-indigo-600 dark:text-indigo-400 hover:underline mb-6"
        >
          <ArrowLeft size={16} className="mr-1" />
          Back to school
        </Link>
        <h1 className="text-3xl font-light mb-1 flex items-center gap-2">
          <Hash className="opacity-70" size={28} />
          Topic hubs
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-8">
          {orgName ? `${orgName} — ` : ""}
          Share solutions, notes, and questions. Mentors can highlight the best posts.
        </p>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin border-gray-400" />
          </div>
        )}
        {error && (
          <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        )}
        {!loading && !error && hubs.length === 0 && (
          <p className="text-gray-500 dark:text-gray-400">
            No hubs yet. A mentor or admin can create them from school admin → Topic hubs
            &amp; tags.
          </p>
        )}
        <ul className="space-y-3">
          {hubs.map((h) => (
            <li key={h.id}>
              <Link
                href={`/school/${schoolSlug}/hubs/${h.id}`}
                className="block rounded-xl border border-gray-200 dark:border-gray-800 p-4 hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors bg-gray-50/50 dark:bg-[#111]"
              >
                <div className="font-medium text-lg">{h.name}</div>
                {h.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                    {h.description}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
