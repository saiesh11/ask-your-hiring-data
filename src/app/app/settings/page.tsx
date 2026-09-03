import { getRequestContext } from "@/lib/tenancy/context";
import { SettingsPanel } from "@/components/settings-panel";

export default async function SettingsPage() {
  const ctx = await getRequestContext();
  return (
    <SettingsPanel
      name={ctx.org.name}
      slug={ctx.org.slug}
      canManage={ctx.permissions.includes("org:manage")}
    />
  );
}
