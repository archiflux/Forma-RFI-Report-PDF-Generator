// Opens the record in Forma in a new tab. Viewers still need their own
// Forma access; the link only says where the record lives.
export function FormaLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title="Open in Forma"
      className="font-medium text-[color:var(--brand-primary)] underline-offset-2 hover:underline"
    >
      {children}
      <span aria-hidden className="ml-1 text-[10px] text-[color:var(--brand-muted)]">↗</span>
    </a>
  );
}
