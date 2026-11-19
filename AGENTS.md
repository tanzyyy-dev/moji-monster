# Repository guidance

- This is a static browser game. Keep the page shell in `index.html`, feature markup, logic, and styles in `src/components/`, shared styles in `styles/`, media in `assets/`, and project notes in `docs/`.
- Use Vite for development and builds. Keep the browser runtime dependency-free. Use `npm run dev` for local development and serve `dist/` for static previews after running `npm run build`.
- Preserve the custom rights-reserved terms in `LICENSE.md`. Do not replace them with an open-source license unless the user asks.
- Use a suitable Lucide SVG from `assets/icons/` for interface icons when one exists, and preserve `assets/icons/LICENSE-LUCIDE.txt`. Keep custom illustrations and template art as game content.
- The background track in `assets/audio/` was generated with Gemini. Keep its provenance documented and do not claim exclusive copyright in the generated audio.
## Git workflow

- By default, make changes only to local working files. Editing files does not imply permission to commit or push.
- Do not create new Git branches. Keep work on the existing `main` branch.
- Commit or push only when the user explicitly requests that action. Do not infer authorization from a general request to implement or edit something.
- When a commit or push is explicitly authorized, review the complete diff first and confirm the target branch is `main` before pushing.

## Mandatory UI/UX rules for Japanese preschool children

This application is designed for young children in Japan.
The following rules are mandatory and MUST NOT be weakened, relaxed, or reinterpreted in translation.

- The UI MUST provide an intuitive, picture-based user experience using icons and illustrations that young children can understand without reading.
- The UI MUST NOT use text to explain how to operate the application. This prohibition applies even when the text is written entirely in hiragana.
- The UI MUST NOT contain form-like input controls, buttons, or labels. Interactive elements MUST be presented as intuitive pictorial objects rather than conventional form UI components.
- If visible text is absolutely unavoidable, it MUST consist exclusively of Japanese hiragana characters. Kanji, katakana, Latin letters, numerals, and other writing systems MUST NOT be used for visible text. This exception does NOT permit textual operating instructions.
- These rules apply to all screens, dialogs, overlays, and interactive states.
