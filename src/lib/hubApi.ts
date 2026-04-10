const apiBase = () => process.env.NEXT_PUBLIC_BACKEND_URL || "";

export interface OrgInfo {
  id: number;
  name: string;
  slug: string;
}

export async function fetchOrgBySlug(slug: string): Promise<OrgInfo> {
  const r = await fetch(`${apiBase()}/organizations/slug/${encodeURIComponent(slug)}`);
  if (!r.ok) throw new Error("School not found");
  return r.json();
}

export interface TopicHubSummary {
  id: number;
  name: string;
  description: string | null;
  slug: string | null;
}

export interface OrgTopic {
  id: number;
  name: string;
}

export interface HubPostFeedItem {
  id: number;
  title: string;
  post_type: string;
  linked_task_id: number | null;
  linked_question_id: number | null;
  mentor_recommended: boolean;
  created_at: string | null;
  author_name: string;
  helpful_count: number;
  topic_tags: { id: number; name: string }[];
}

export interface HubPostReply {
  id: number;
  body: string;
  created_at: string | null;
  author_name: string;
}

export interface HubPostDetail {
  id: number;
  hub_id: number;
  title: string;
  body: string;
  post_type: string;
  linked_task_id: number | null;
  linked_question_id: number | null;
  ai_suggestion_json: Record<string, unknown> | null;
  mentor_recommended: boolean;
  mentor_recommended_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  author_name: string;
  helpful_count: number;
  i_marked_helpful: boolean;
  topic_tags: { id: number; name: string }[];
  replies: HubPostReply[];
}

export interface SuggestMappingResult {
  suggested_task_id: number | null;
  suggested_question_id: number | null;
  suggested_org_topic_ids: number[];
  confidence: number;
  rationale: string;
}

export async function listHubs(orgId: number, userId: number): Promise<TopicHubSummary[]> {
  const r = await fetch(
    `${apiBase()}/organizations/${orgId}/hubs?user_id=${userId}`
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function listOrgTopics(
  orgId: number,
  userId: number
): Promise<OrgTopic[]> {
  const r = await fetch(
    `${apiBase()}/organizations/${orgId}/topics?user_id=${userId}`
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function listHubPosts(
  orgId: number,
  hubId: number,
  userId: number,
  opts?: { limit?: number; offset?: number; linkedTaskId?: number }
): Promise<HubPostFeedItem[]> {
  const q = new URLSearchParams({ user_id: String(userId) });
  if (opts?.limit != null) q.set("limit", String(opts.limit));
  if (opts?.offset != null) q.set("offset", String(opts.offset));
  if (opts?.linkedTaskId != null)
    q.set("linked_task_id", String(opts.linkedTaskId));
  const r = await fetch(
    `${apiBase()}/organizations/${orgId}/hubs/${hubId}/posts?${q}`
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getHubPost(
  orgId: number,
  hubId: number,
  postId: number,
  userId: number
): Promise<HubPostDetail> {
  const r = await fetch(
    `${apiBase()}/organizations/${orgId}/hubs/${hubId}/posts/${postId}?user_id=${userId}`
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function createHubPost(
  orgId: number,
  hubId: number,
  userId: number,
  body: {
    title: string;
    body: string;
    post_type?: string;
    linked_task_id?: number | null;
    linked_question_id?: number | null;
    org_topic_ids?: number[];
  }
): Promise<{ id: number }> {
  const r = await fetch(
    `${apiBase()}/organizations/${orgId}/hubs/${hubId}/posts`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        title: body.title,
        body: body.body,
        post_type: body.post_type ?? "thread",
        linked_task_id: body.linked_task_id ?? null,
        linked_question_id: body.linked_question_id ?? null,
        org_topic_ids: body.org_topic_ids ?? [],
      }),
    }
  );
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(typeof err.detail === "string" ? err.detail : r.statusText);
  }
  return r.json();
}

export async function addHubReply(
  orgId: number,
  hubId: number,
  postId: number,
  userId: number,
  body: string
): Promise<{ id: number }> {
  const r = await fetch(
    `${apiBase()}/organizations/${orgId}/hubs/${hubId}/posts/${postId}/replies`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, body }),
    }
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function toggleHubHelpful(
  orgId: number,
  hubId: number,
  postId: number,
  userId: number
): Promise<{ marked_helpful: boolean; helpful_count: number }> {
  const r = await fetch(
    `${apiBase()}/organizations/${orgId}/hubs/${hubId}/posts/${postId}/helpful`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    }
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function setMentorRecommend(
  orgId: number,
  hubId: number,
  postId: number,
  userId: number,
  recommended: boolean
): Promise<void> {
  const r = await fetch(
    `${apiBase()}/organizations/${orgId}/hubs/${hubId}/posts/${postId}/mentor-recommend`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, recommended }),
    }
  );
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(typeof err.detail === "string" ? err.detail : r.statusText);
  }
}

export async function updateHubPostLinks(
  orgId: number,
  hubId: number,
  postId: number,
  userId: number,
  links: {
    linked_task_id: number | null;
    linked_question_id: number | null;
    org_topic_ids: number[] | null;
  }
): Promise<void> {
  const r = await fetch(
    `${apiBase()}/organizations/${orgId}/hubs/${hubId}/posts/${postId}/links`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        linked_task_id: links.linked_task_id,
        linked_question_id: links.linked_question_id,
        org_topic_ids: links.org_topic_ids,
      }),
    }
  );
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(typeof err.detail === "string" ? err.detail : r.statusText);
  }
}

export async function suggestHubPostMapping(
  userId: number,
  orgId: number,
  hubId: number,
  title: string,
  body: string,
  postId?: number | null
): Promise<SuggestMappingResult> {
  const r = await fetch(`${apiBase()}/ai/hub-post-suggest-mapping`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: userId,
      org_id: orgId,
      hub_id: hubId,
      title,
      body,
      post_id: postId ?? null,
    }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(typeof err.detail === "string" ? err.detail : r.statusText);
  }
  return r.json();
}
