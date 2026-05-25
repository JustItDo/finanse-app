#!/usr/bin/env zsh

set -euo pipefail

SCRIPT_DIR="${0:A:h}"
APP_ROOT="${SCRIPT_DIR:h}"
WIKI_ROOT="${APP_ROOT:h}/Obsidian Vault"
PROMPT_FILE="${WIKI_ROOT}/01 Projekty/Aplikacja - koncepcja/PROMPT STARTOWY CODEX.txt"

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
exec codex \
  --model gpt-5.4 \
  -c model_reasoning_effort="medium" \
  --add-dir "${WIKI_ROOT}" \
  "${PROMPT}"
