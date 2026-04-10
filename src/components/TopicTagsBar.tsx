"use client";

export interface TopicTagItem {
  id: number;
  name: string;
}

interface TopicTagsBarProps {
  hubName?: string | null;
  tags?: TopicTagItem[];
  className?: string;
}

/**
 * Hub name + topic chips for learner task headers (course task hub context).
 */
export default function TopicTagsBar({
  hubName,
  tags = [],
  className = "",
}: TopicTagsBarProps) {
  const hasHub = Boolean(hubName?.trim());
  const hasTags = tags && tags.length > 0;
  if (!hasHub && !hasTags) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-2 mt-2 ${className}`}
      aria-label="Hub and topics for this activity"
    >
      {hasHub && (
        <span className="inline-flex items-center rounded-full border border-indigo-300/60 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-900 dark:border-indigo-500/40 dark:bg-indigo-950/50 dark:text-indigo-100">
          {hubName}
        </span>
      )}
      {hasTags &&
        tags.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center rounded-full border border-gray-300/80 bg-gray-100 px-2.5 py-0.5 text-xs text-gray-800 dark:border-gray-600 dark:bg-[#222] dark:text-gray-200"
          >
            {t.name}
          </span>
        ))}
    </div>
  );
}
