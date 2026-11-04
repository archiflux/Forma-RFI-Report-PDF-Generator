import type { Scene3D } from "@/lib/three-d/spec";
import { View3DButton } from "@/components/three-d/view-3d-button";

export function Panel({
  title,
  children,
  action,
  view3d,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  // Builds this panel's data as a 3D scene; adds a "3D" button when set.
  view3d?: () => Scene3D | null;
}) {
  return (
    <section className="flex h-full min-w-0 flex-col rounded-2xl border border-[color:var(--brand-border)] bg-white p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[color:var(--brand-primary)]">{title}</h3>
        {action || view3d ? (
          <div className="flex flex-wrap items-center gap-2">
            {action}
            {view3d ? <View3DButton build={view3d} /> : null}
          </div>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}
