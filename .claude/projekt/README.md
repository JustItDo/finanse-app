# System pracy projektu Zenifi

Ten katalog obsługuje kolejkę pracy agentów. Nie zastępuje wiki.

## Przepływ informacji

1. Luźny pomysł trafia do prywatnego `04 Plan/Backlog.md` w repo `finanse-wiki`.
2. Konkretny problem, blocker albo temat wymagający decyzji trafia do `skrzynka-zadan.md`.
3. Większe zgłoszenie może dostać rozwinięcie w `skrzynka-zadan/`.
4. Po podjęciu wszystkich ważnych decyzji powstaje jeden plik w `stan-zespolu/` — gotowa
   specyfikacja do wdrożenia.
5. Po implementacji plik ze `stan-zespolu/` jest usuwany, a wynik trafia do kodu i prywatnego
   `04 Plan/Dziennik wdrożeń.md` w repo `finanse-wiki`.

Backlog nie jest kolejką obowiązkową. Skrzynka nie jest archiwum. Stan zespołu nie jest miejscem
na reguły trwałe — te są w `CLAUDE.md`, `AGENTS.md` lub właściwym dokumencie wiki.
