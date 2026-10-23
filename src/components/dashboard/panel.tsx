export function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[color:var(--brand-border)] bg-white p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[color:var(--brand-primary)]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
