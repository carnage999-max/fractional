import { Button } from "@/components/ui/Button";
export default function CreatePage(){
  return (<main className="mx-auto max-w-3xl px-4 py-10">
    <h1 className="text-2xl font-bold mb-6">List an Asset</h1>
    <form action="/api/assets" method="post" className="space-y-4 rounded-3xl border border-border bg-card/70 p-6 shadow-innerglow">
      <div><label className="text-xs text-foreground/70 mb-1 block">Name</label>
        <input name="name" required className="w-full rounded-2xl bg-muted/80 border border-border px-3 py-2 text-foreground placeholder:text-foreground/40"/></div>
      <div><label className="text-xs text-foreground/70 mb-1 block">Description</label>
        <textarea name="description" required rows={3} className="w-full rounded-2xl bg-muted/80 border border-border px-3 py-2 text-foreground placeholder:text-foreground/40"/></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label className="text-xs text-foreground/70 mb-1 block">Total Shares</label>
          <input name="totalShares" type="number" required min="1" className="w-full rounded-2xl bg-muted/80 border border-border px-3 py-2 text-foreground"/></div>
        <div><label className="text-xs text-foreground/70 mb-1 block">Price per Share (USD)</label>
          <input name="pricePerShare" type="text" required className="w-full rounded-2xl bg-muted/80 border border-border px-3 py-2 text-foreground"/></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label className="text-xs text-foreground/70 mb-1 block">Category</label>
          <select name="category" className="w-full rounded-2xl bg-muted/80 border border-border px-3 py-2 text-foreground"><option value="RWA">RWA</option><option value="GAMING">GAMING</option></select></div>
        <div><label className="text-xs text-foreground/70 mb-1 block">Image URL</label>
          <input name="image" placeholder="/logo.svg or ipfs://..." className="w-full rounded-2xl bg-muted/80 border border-border px-3 py-2 text-foreground"/></div>
      </div>
      <Button type="submit">Mint & Create</Button>
    </form>
  </main>);
}
