# Repository guidance

- This is a static browser game. Keep the page in `index.html`, game logic in `src/`, styles in `styles/`, media in `assets/`, and project notes in `docs/`.
- Keep the project dependency-free unless a task needs a dependency. For local preview, serve the repository root with `python3 -m http.server 8000`.
- Preserve the custom rights-reserved terms in `LICENSE.md`. Do not replace them with an open-source license unless the user asks.
- Use a suitable Lucide SVG from `assets/icons/` for interface icons when one exists, and preserve `assets/icons/LICENSE-LUCIDE.txt`. Keep custom illustrations and template art as game content.
- The background track in `assets/audio/` was generated with Gemini. Keep its provenance documented and do not claim exclusive copyright in the generated audio.
## Git workflow

- By default, make changes only to local working files. Editing files does not imply permission to commit or push.
- Do not create new Git branches. Keep work on the existing `main` branch.
- Commit or push only when the user explicitly requests that action. Do not infer authorization from a general request to implement or edit something.
- When a commit or push is explicitly authorized, review the complete diff first and confirm the target branch is `main` before pushing.
