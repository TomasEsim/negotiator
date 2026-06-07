import { notFound } from "next/navigation";
import { getNegotiationDetail, getRules } from "@/lib/db";
import { Workspace } from "@/components/Workspace";

export const dynamic = "force-dynamic";

export default async function NegotiationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getNegotiationDetail(id);
  if (!detail) notFound();
  const rules = await getRules();
  return <Workspace initial={detail} rules={rules} />;
}
