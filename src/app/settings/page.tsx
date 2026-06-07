import { getRules } from "@/lib/db";
import { RulesEditor } from "@/components/RulesEditor";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const rules = await getRules();
  return <RulesEditor initial={rules} />;
}
