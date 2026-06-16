'use client'
// components/trustseal/certificate/print-button.tsx  (asq-trustseal-phase3)
// Triggers the browser print dialog → "Save as PDF". The certificate page's
// print CSS hides the nav/footer so the printed/PDF output is the cert only.
export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg px-4 py-2 text-sm font-semibold"
      style={{ background: 'rgb(var(--ts-accent))', color: '#06121e' }}
    >
      {label}
    </button>
  )
}
