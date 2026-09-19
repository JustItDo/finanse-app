# Stan zespołu — Zenifi

Ten katalog przechowuje wyłącznie uzgodnione specyfikacje gotowe do implementacji.

## Format

- Jeden plik to jedna zmiana.
- Nazwa w `kebab-case`, opisująca temat; bez daty, ponieważ to kolejka, nie dziennik.
- Plik zawiera cel, zakres, poza zakresem, decyzje, kryteria akceptacji i weryfikację.
- Gdy zmiana zostanie wdrożona, usuń plik. Historia pozostaje w commicie i prywatnym
  `04 Plan/Dziennik wdrożeń.md` w repo `finanse-wiki`.

## Różnica względem pozostałych miejsc

- prywatny `04 Plan/Backlog.md` — luźne pomysły i kandydaci.
- `.claude/projekt/skrzynka-zadan/` — problemy albo zgłoszenia, które nie są jeszcze gotową
  specyfikacją.
- `stan-zespolu/` — decyzje są zamknięte; następna sesja może od razu implementować.

Jeśli w katalogu jest plik poza tym `README.md`, hook `SessionStart` pokaże go przed skrzynką.
