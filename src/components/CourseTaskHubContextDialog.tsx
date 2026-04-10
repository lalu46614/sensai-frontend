"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { ModuleItem } from "@/types/course";

interface HubRow {
  id: number;
  name: string;
}

interface TopicRow {
  id: number;
  name: string;
}

interface CourseTaskHubContextDialogProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  courseId: string;
  userId: string;
  item: ModuleItem | null;
  onSaved?: () => void;
}

export default function CourseTaskHubContextDialog({
  open,
  onClose,
  orgId,
  courseId,
  userId,
  item,
  onSaved,
}: CourseTaskHubContextDialogProps) {
  const [hubs, setHubs] = useState<HubRow[]>([]);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [hubId, setHubId] = useState<string>("");
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = process.env.NEXT_PUBLIC_BACKEND_URL || "";
  const courseTaskId = item?.course_task_id;

  useEffect(() => {
    if (!open || !orgId || !userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [hRes, tRes] = await Promise.all([
          fetch(`${base}/organizations/${orgId}/hubs?user_id=${userId}`),
          fetch(`${base}/organizations/${orgId}/topics?user_id=${userId}`),
        ]);
        if (!hRes.ok || !tRes.ok) throw new Error("Failed to load hubs or topics");
        const [hData, tData] = await Promise.all([hRes.json(), tRes.json()]);
        if (cancelled) return;
        setHubs(hData);
        setTopics(tData);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Load failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, orgId, userId, base]);

  useEffect(() => {
    if (!open || !item) return;
    setHubId(item.hub_id != null ? String(item.hub_id) : "");
    const next = new Set<number>();
    (item.topic_tags || []).forEach((t) => next.add(t.id));
    setSelectedTopicIds(next);
  }, [open, item]);

  const toggleTopic = (id: number) => {
    setSelectedTopicIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const handleSave = async () => {
    if (!item || courseTaskId == null) {
      setError("This task has no course_task_id yet. Reload the page after saving the course.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const hid = hubId === "" ? null : parseInt(hubId, 10);
      const body = {
        user_id: parseInt(userId, 10),
        hub_id: hid,
        org_topic_ids: Array.from(selectedTopicIds),
      };
      const res = await fetch(
        `${base}/courses/${courseId}/course-tasks/${courseTaskId}/hub-context`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || res.statusText);
      }
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!open || !item) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            Hub &amp; topics
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Task: <span className="font-medium text-gray-900 dark:text-white">{item.title}</span>
          </p>
          {courseTaskId == null && (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Reload the course page so this task gets a course_task_id, then try again.
            </p>
          )}
          {loading && <p className="text-sm text-gray-500">Loading hubs and topics…</p>}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Topic hub
            </label>
            <select
              value={hubId}
              onChange={(e) => setHubId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111] text-gray-900 dark:text-white px-3 py-2 text-sm"
            >
              <option value="">— None —</option>
              {hubs.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              Topics (multi-select)
            </label>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              {topics.map((t) => {
                const on = selectedTopicIds.has(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTopic(t.id)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                      on
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-indigo-400"
                    }`}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
            {topics.length === 0 && !loading && (
              <p className="text-xs text-gray-500 mt-1">
                Create topics under Learning hubs → Topics in your school admin.
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || courseTaskId == null}
            className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
