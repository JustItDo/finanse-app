# Zespół agentów Zenifi

Pliki w tym katalogu definiują role konsultacyjne Claude Code. Codex korzysta z tych samych ról
według procedury w `AGENTS.md`.

## Zasady

- Każda rola najpierw czyta `CLAUDE.md` w korzeniu repo.
- Rola doradza w swoim obszarze; agent główny odpowiada użytkownikowi i wdraża kod.
- Nie uruchamiaj pełnego zespołu do drobnej zmiany.
- Nie przenoś założeń z Pracownikplus, Planera ani innego projektu.
- Fakty o Zenifi są w karcie projektu i kodzie, nie w ogólnym opisie roli.

## Role

- `kierownik-it` — kierunek i orkiestracja;
- `analityk-procesow` — wymagania i wartość;
- `projektant-ux` — interfejs i stany;
- `architekt-systemu` — model danych i architektura;
- `recenzent-kodu` — przegląd gotowych zmian;
- `audytor-bezpieczenstwa` — bezpieczeństwo aplikacji mobilnej i danych;
- `inzynier-danych-rodo` — prywatność, backup i retencja;
- `straznik-jakosci` — bramka builda/release;
- `pomyslowy-przemyslaw` — backlog;
- role Lean — przegląd systemu pracy na żądanie.
