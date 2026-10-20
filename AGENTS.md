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

- Photo analysis uses a first-party TanStack HTTP route and server-only AI SDK helpers with streamed structured output, so photo contents and secrets stay off public clients and no observations are automatically persisted.
- Apply AI analysis through the client-safe form merger, preserving zone, reporter, timestamp, subject and assignment; zones use a shared standard list so examples and uploads behave consistently.
- Observation types use the shared TOPICS tuple for form choices, typed records and AI request validation, preventing category drift across reporting flows.
- Analysis ratings and PI weightings are temporary form state in a dedicated control, reset on photo/example replacement or a new analysis; PI weights use a client-safe calculation module and the current subject's selected indicators (or all when none are selected), keeping demo weighting separate from measured values, persistence and model training.
