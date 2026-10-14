# Deploy & Environment — SOP / WI / OPL Studio

## Stack
- TanStack Start + React + TypeScript + Tailwind
- Optional Supabase (memory fallback if unset)
- AI via server route `/api/ai-convert` (LOVABLE_API_KEY or OPENAI_API_KEY)

## Local development
```bash
git clone https://github.com/moskoom185/Grok.git
cd Grok
bun install   # or npm install
cp .env.example .env
# fill LOVABLE_API_KEY or OPENAI_API_KEY if you need AI
bun run dev
```

## Scripts
| Command | Purpose |
|---------|---------|
| `bun run dev` | Dev server |
| `bun run build` | Production build |
| `bun run test` | Unit tests (vitest) |
| `bun run lint` | ESLint |

## Vercel
1. Import GitHub repo `moskoom185/Grok` into team SOP
2. Framework: TanStack Start / Vite (auto-detect)
3. Set Environment Variables (Production + Preview):
   - `LOVABLE_API_KEY` or `OPENAI_API_KEY`
   - Optional: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy

## Supabase (optional)
Run migration SQL in Supabase SQL editor:

`drizzle/migrations/0001_documents.sql`

Without Supabase the app still runs; documents live in server memory (lost on restart / multi-instance).

## Owner session (no login)
- Cookie: `sop_owner_session` (HttpOnly, SameSite=Lax, Secure in production)
- Clearing cookies loses access to prior documents
- Internal department use only

## Manual QA checklist
- [ ] Create empty SOP/WI/OPL
- [ ] Upload Excel / Word / paste text and see extraction warnings
- [ ] Run AI structure (needs API key) → review panel → confirm
- [ ] Edit step title/body, reorder, save, reload
- [ ] Export PNG / PDF print / JSON / ZIP
- [ ] Confirm other browser/incognito cannot see your docs

## Known limitations
- PDF text extraction is limited client-side; full OCR not included
- Editor is structured (not full Canva drag canvas yet)
- PDF export uses browser print dialog
- Memory store is not shared across serverless instances
