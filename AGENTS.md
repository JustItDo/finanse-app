# Zenifi — zasady pracy agentów Codex

Repozytorium zawiera publiczny kod aplikacji. Agent główny prowadzi pracę, chroni dane użytkownika
i korzysta z wyspecjalizowanych ról tylko wtedy, gdy zakres zadania tego wymaga.

`AGENTS.md` opisuje sposób pracy Codeksa. Fakty o produkcie i ograniczenia techniczne są w
`CLAUDE.md`; trwałe decyzje, plan i raporty są w osobnym prywatnym repozytorium
`../Obsidian Vault/`, w katalogu `01 Projekty/Aplikacja - koncepcja/`.

## Język

Cała komunikacja z Jakubem odbywa się po polsku. Kod, nazwy plików, komendy i identyfikatory
techniczne pozostają po angielsku.

## Początek pracy

1. Sprawdź `git status --short` i chroń zastane zmiany.
2. Przeczytaj `CLAUDE.md` oraz tylko te dokumenty prywatnej wiki, których dotyczy zadanie.
3. Sprawdź `.claude/projekt/stan-zespolu/`. Jeśli zawiera plik poza `README.md`, jest to
   uzgodniona specyfikacja o pierwszeństwie przed skrzynką.
4. Gdy nie ma gotowej specyfikacji, sprawdź `.claude/projekt/skrzynka-zadan.md` w zakresie
   związanym z bieżącą pracą.
5. Nie wykonuj automatycznej odprawy ani rytuału powitalnego.

Claude Code dostaje stan zespołu albo skrzynkę przez hook `SessionStart`. Codex odczytuje je
ręcznie. Prywatny `Obsidian Vault` jest bieżącym źródłem prawdy dla dokumentacji projektu.

## Źródła prawdy

Kolejność rozstrzygania sprzeczności:

1. działający kod i konfiguracja w repozytorium;
2. najnowszy wpis w prywatnym `04 Plan/Dziennik wdrożeń.md`;
3. aktywna specyfikacja w `.claude/projekt/stan-zespolu/`;
4. bieżące dokumenty w prywatnej wiki;
5. skrzynka zadań i backlog;
6. historyczne briefy i archiwalne plany.

## Raport zmian

Po sesji zmieniającej kod, konfigurację albo system pracy dopisz wpis do prywatnego
`04 Plan/Dziennik wdrożeń.md`. Wpis zawiera:

- **Co** — wynik pracy;
- **Gdzie** — zmienione pliki lub moduły;
- **Stan** — stan roboczy, commit albo faktycznie wykonany release;
- **Weryfikacja** — uruchomione kontrole i testy manualne;
- **Ryzyko / do zrobienia** — to, czego nie sprawdzono lub co pozostało.

Raportów ani danych wewnętrznych nie zapisuj w publicznym repozytorium aplikacji.

## Weryfikacja

- Expo w projekcie jest wersji 56. Przed zmianą kodu zależnego od Expo korzystaj z dokładnej,
  wersjonowanej dokumentacji `https://docs.expo.dev/versions/v56.0.0/`.
- Dla zmian TypeScript uruchom `npm run typecheck`.
- Dla zmian w kodzie uruchom `npm run lint`.
- Projekt nie ma jeszcze runnera testów automatycznych. Nie opisuj kontroli statycznych jako
  testów i nie deklaruj testu telefonu, OCR, biometrii ani restore backupu bez jego wykonania.
- Zmiany w SQLite, imporcie backupu, OCR, obliczeniach kwot lub dacie wymagają testu regresji
  odpowiadającego ryzyku; dopóki nie ma automatyzacji, przygotuj konkretną checklistę manualną.
- Przed wydaniem buildu na urządzenie sprawdź główne flow: wpis ręczny, OCR z korektą, historię,
  budżety, analizy, blokadę aplikacji i eksport/import backupu.

## Git i zakres zmian

- Chroń cudzą pracę. Nie cofaj ani nie nadpisuj zmian spoza bieżącego zadania.
- Nie używaj `git add .` ani `git add -A`; dodawaj wyłącznie pliki z bieżącego zakresu.
- Kod i dokumentację commituj osobno, jeśli tworzą niezależne logiczne rezultaty.
- Nie twórz commita, nie pushuj i nie publikuj buildu bez autoryzacji użytkownika.
- Nie dodawaj trailerów `Co-Authored-By` przypisujących autorstwo AI.
- `origin` jest publicznym repozytorium aplikacji. Nie dodawaj do niego `wiki/`, raportów ani
  innych wewnętrznych materiałów; dokumentację commituj osobno w prywatnym `finanse-wiki`.

## Role agentów

Role są dostępne w `.claude/agents/` jako lokalne instrukcje projektu. Każda rola przed pracą
czyta `CLAUDE.md`; nie przenosi do odpowiedzi założeń z innych projektów.

- `kierownik-it` — kierunek techniczny i orkiestracja większych funkcji;
- `analityk-procesow` — wymagania, prostota flow i wartość dla użytkownika;
- `projektant-ux` — ekrany, hierarchia i stany brzegowe mobile/web;
- `architekt-systemu` — model danych, granice modułów i migracje SQLite;
- `recenzent-kodu` — poprawność gotowej zmiany i regresje;
- `audytor-bezpieczenstwa` — blokada aplikacji, uprawnienia urządzenia, ekspozycja danych i
  przyszłe integracje;
- `inzynier-danych-rodo` — dane finansowe, backup, retencja, szyfrowanie i usługi zewnętrzne;
- `straznik-jakosci` — GO/NO-GO przed buildem, publikacją albo zmianą mogącą utracić dane;
- `pomyslowy-przemyslaw` — zapis pomysłów do prywatnego `04 Plan/Backlog.md`;
- role Lean — przegląd procesu pracy wyłącznie na żądanie.

Agent główny implementuje kod. Konsultacje mają być konkretne i proporcjonalne do ryzyka; nie
uruchamiaj całego zespołu do drobnej korekty tekstu lub stylu.

## Przepływ większej funkcji

Pełny przepływ stosuj dla nowego ekranu, nowego źródła danych, zmiany modelu finansowego albo
funkcji wymagającej decyzji produktowych. Nie stosuj go automatycznie do małego, jednoznacznego
bugfixu.

1. Faza A: wymagania z `analityk-procesow`; dla nowego interfejsu także `projektant-ux`;
   następnie decyzje techniczne z `architekt-systemu`.
2. Pytania zmieniające zakres, sposób liczenia pieniędzy, prywatność lub stack rozstrzyga Jakub.
3. Agent główny implementuje i uruchamia właściwą weryfikację.
4. `recenzent-kodu` sprawdza gotowy diff przy zmianach nietrywialnych.
5. Faza B jest obowiązkowa, gdy zmiana dotyka danych finansowych, migracji, OCR, backupu,
   importu, PIN-u/biometrii, uprawnień systemowych, synchronizacji lub usługi zewnętrznej.
6. `straznik-jakosci` wydaje GO/NO-GO przed buildem przeznaczonym dla użytkownika, EAS Update,
   wysłaniem do sklepu albo inną publikacją.

## Backlog, inbox i stan zespołu

- prywatny `04 Plan/Backlog.md` — pomysły i kandydaci; wpis nie oznacza decyzji o realizacji.
- `.claude/projekt/skrzynka-zadan.md` — konkretne otwarte zgłoszenia, blokery i prace do
  doprecyzowania.
- `.claude/projekt/stan-zespolu/` — wyłącznie uzgodnione specyfikacje gotowe do wdrożenia;
  jeden plik na jedną zmianę.
- Po wdrożeniu usuń plik specyfikacji ze `stan-zespolu`; wynik ma zostać w kodzie, commicie i
  prywatnym `04 Plan/Dziennik wdrożeń.md`.

## Wydania

Nie ma aktywnego automatycznego wdrożenia produkcyjnego. `npm start` i `npm run android` są
czynnościami deweloperskimi, nie publikacją. Komendy EAS budujące, aktualizujące albo wysyłające
aplikację wymagają wyraźnego polecenia Jakuba oraz aktualnego GO Strażnika Jakości.

Publiczny GitHub zawiera aplikację bez `wiki/`. Dokumentację, decyzje i raporty aktualizuj oraz
commituj wyłącznie w osobnym prywatnym repozytorium `finanse-wiki`.
