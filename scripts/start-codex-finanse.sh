#!/usr/bin/env zsh

set -euo pipefail

SCRIPT_DIR="${0:A:h}"
APP_ROOT="${SCRIPT_DIR:h}"
WIKI_ROOT="${APP_ROOT:h}/Obsidian Vault"
PROMPT_FILE="${WIKI_ROOT}/01 Projekty/Aplikacja - koncepcja/PROMPT STARTOWY CODEX.txt"
CODEX_BIN="${CODEX_BIN:-}"

PATH="${HOME}/.npm-global/bin:${HOME}/.local/bin:${HOME}/.npm/bin:${PATH}"

if [[ ! -f "${PROMPT_FILE}" ]]; then
  echo "Brak pliku promptu: ${PROMPT_FILE}" >&2
  exit 1
fi

PROMPT="$(<"${PROMPT_FILE}")"

PROMPT="${PROMPT}

Additional app context:
- The implementation workspace is the current app repository.
- Project wiki is available in: ${WIKI_ROOT}
- When implementation work depends on documentation, read the relevant wiki files from that path.
- Make code changes in the app repository unless the task explicitly asks to update the wiki."

cd "${APP_ROOT}"

if [[ -z "${CODEX_BIN}" ]]; then
  CODEX_BIN="$(command -v codex || true)"
fi

if [[ -z "${CODEX_BIN}" || ! -x "${CODEX_BIN}" ]]; then
  echo "Nie znaleziono binarki codex." >&2
  echo "Sprawdzone PATH: ${PATH}" >&2
  echo "Jeśli Codex jest zainstalowany lokalnie, ustaw CODEX_BIN=/pełna/ścieżka/do/codex." >&2
  exit 127
fi

exec "${CODEX_BIN}" \
  --model gpt-5.5 \
  -c model_reasoning_effort="medium" \
  --add-dir "${WIKI_ROOT}" \
  "${PROMPT}"
