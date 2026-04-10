"use client";

import { useParams } from "next/navigation";
import HubListClient from "@/components/hub/HubListClient";

export default function SchoolHubsPage() {
  const params = useParams();
  const slug = params?.id as string;
  return <HubListClient schoolSlug={slug} />;
}
