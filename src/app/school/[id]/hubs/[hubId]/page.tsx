"use client";

import { useParams } from "next/navigation";
import HubFeedClient from "@/components/hub/HubFeedClient";

export default function SchoolHubFeedPage() {
  const params = useParams();
  const slug = params?.id as string;
  const hubId = parseInt(String(params?.hubId), 10);
  if (Number.isNaN(hubId)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black text-gray-900 dark:text-white">
        Invalid hub
      </div>
    );
  }
  return <HubFeedClient schoolSlug={slug} hubId={hubId} />;
}
