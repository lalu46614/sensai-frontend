"use client";

import { useParams } from "next/navigation";
import HubPostDetailClient from "@/components/hub/HubPostDetailClient";

export default function SchoolHubPostPage() {
  const params = useParams();
  const slug = params?.id as string;
  const hubId = parseInt(String(params?.hubId), 10);
  const postId = parseInt(String(params?.postId), 10);
  if (Number.isNaN(hubId) || Number.isNaN(postId)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black text-gray-900 dark:text-white">
        Invalid link
      </div>
    );
  }
  return (
    <HubPostDetailClient schoolSlug={slug} hubId={hubId} postId={postId} />
  );
}
