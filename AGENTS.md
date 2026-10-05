<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project rules

- Documents are stored server-side and accessed only via server functions filtered by a per-browser owner key (no login); the table has RLS with no public policies. Why: no-login requirement without exposing everyone's docs.
- Step images are compressed in the browser and stored inline as data URLs in the document JSON. Why: simple, no storage bucket needed.
- AI conversion runs in the `/api/ai-convert` server route (Responses API, streamed and buffered server-side, JSON parsed). Word/Excel are extracted to text in the browser; PDFs and images are sent as multimodal input.
- Each template is a branch in `DocPage`; the page body auto-scales to fit the paper. Step text pieces are module-level components reading context so inline editing keeps focus.
- `HANDOFF.md` at the project root is the onboarding doc for the next developer/AI; update it whenever the structure, data model, AI contract, or known gaps change, so handoff never relies on chat history. Why: the project must be continue-able outside this conversation.
- Adding a template requires two edits: `TEMPLATES` in `src/lib/doc-model.ts` and the `TEMPLATE_IDS` list in the AI system prompt in `src/routes/api/ai-convert.ts`. Why: the AI can only choose template ids it is told about.
