# Zenifi — karta projektu

Ten plik zawiera wyłącznie kontekst właściwy dla Zenifi. Zasady pracy Codeksa są w `AGENTS.md`,
a trwała dokumentacja produktu w osobnym prywatnym repozytorium `../Obsidian Vault/`.

## Kontekst

Zenifi to prywatna aplikacja do codziennego zarządzania finansami: rejestrowania przychodów i
wydatków, pracy z paragonami i screenami przez OCR, kontroli budżetu oraz obserwowania
oszczędności.

Pierwszym i obecnie jedynym użytkownikiem jest Jakub. Aplikacja ma najpierw udowodnić wartość w
realnym, codziennym użyciu jednej osoby. Konta, backend, synchronizacja i model produktu dla wielu
użytkowników nie są zatwierdzonym zakresem.

Stan na 2026-09-19: działająca wersja alpha po domknięciu MVP. Najbliższy etap to stabilizacja na
fizycznym telefonie, test odtworzenia backupu i pierwsze testy automatyczne. Dopiero później ma
zostać wybrana jedna mała funkcja V1.

## Zespół i persony

- **Jakub** — właściciel, deweloper i główny użytkownik. Podejmuje decyzje i wykonuje testy na
  fizycznym telefonie.
- **Przyszły użytkownik indywidualny** — osoba chcąca prostego narzędzia do kontroli wydatków,
  bez księgowości i rozbudowanej konfiguracji. To hipoteza produktowa, nie obecny klient.

Telefon jest głównym urządzeniem. Web służy pomocniczo do przeglądania historii, budżetów i
analiz; nie ma pełnego odpowiednika natywnego OCR ani mobilnego backupu.

## Stack

- Expo `56.0.x`, React Native `0.85.x`, React `19.2.x`, TypeScript `6.0.x`;
- nawigacja React Navigation;
- lokalna baza `expo-sqlite` z migracjami w `src/storage/sqlite/migrations.ts`;
- OCR na urządzeniu przez `@react-native-ml-kit/text-recognition`;
- pliki i backup: Expo FileSystem, DocumentPicker, Sharing oraz `fflate`;
- PIN i ustawienia blokady: `expo-secure-store`; biometria: `expo-local-authentication`;
- brak backendu, kont użytkowników i synchronizacji chmurowej.

Przed pisaniem kodu zależnego od Expo czytaj dokumentację dokładnie dla wersji 56:
`https://docs.expo.dev/versions/v56.0.0/`.

## Ścieżki

- kod aplikacji: `src/`;
- aktywna prywatna wiki: `../Obsidian Vault/01 Projekty/Aplikacja - koncepcja/`;
- indeks wiki: `../Obsidian Vault/01 Projekty/Aplikacja - koncepcja/README.md`;
- backlog: `../Obsidian Vault/01 Projekty/Aplikacja - koncepcja/04 Plan/Backlog.md`;
- decyzje techniczne: `../Obsidian Vault/01 Projekty/Aplikacja - koncepcja/03 Technologia/Decyzje techniczne.md`;
- raporty zmian: `../Obsidian Vault/01 Projekty/Aplikacja - koncepcja/04 Plan/Dziennik wdrożeń.md`;
- otwarte konkretne zadania: `.claude/projekt/skrzynka-zadan.md`;
- rozwinięcia zadań: `.claude/projekt/skrzynka-zadan/`;
- uzgodnione specyfikacje do wdrożenia: `.claude/projekt/stan-zespolu/`;
- instrukcje ról: `.claude/agents/`.

## Moduły krytyczne

1. **Transakcje i kwoty** — zapis, edycja, usuwanie, filtrowanie i agregacje.
2. **SQLite i migracje** — trwałość danych oraz zgodność schematu po aktualizacji.
3. **OCR i korekta** — wynik rozpoznania jest szkicem; użytkownik zatwierdza dane przed zapisem.
4. **Budżety, bilans i oszczędności** — obliczenia wpływające na interpretację sytuacji
   finansowej.
5. **Backup ZIP i import** — jedyna obecna droga przeniesienia/odzyskania danych.
6. **Blokada aplikacji** — PIN, biometria, zachowanie po starcie i powrocie z tła.

## Dostęp i bezpieczeństwo aplikacji

Zenifi nie ma kont ani ról. PIN i biometria są lokalną blokadą interfejsu, a nie systemem
uwierzytelniania do serwera. PIN ma cztery cyfry i jest przechowywany przez SecureStore na
platformach natywnych. Web ma słabszy fallback właściwy dla przeglądarki.

Blokada chroni przed przypadkowym dostępem do otwartej aplikacji. Nie zastępuje szyfrowania bazy,
załączników ani backupu i nie może być opisywana jako ochrona klasy forensic.

## Dane wrażliwe

- kwoty, daty, kategorie, opisy, sklepy i metody płatności;
- surowy tekst OCR, zdjęcia paragonów i screeny płatności;
- budżety miesięczne, limity kategorii, saldo startowe i cele oszczędnościowe;
- niezaszyfrowana lokalna baza SQLite i lokalne załączniki;
- niezaszyfrowany backup ZIP zawierający dane finansowe i załączniki.

Backup nie zawiera PIN-u, ustawienia biometrii ani wartości z SecureStore. Wyeksportowany ZIP
traktuj jak wrażliwy dokument finansowy. Nie wprowadzaj chmury, telemetrii ani zewnętrznego OCR
bez jawnej decyzji o prywatności i przepływie danych.

## Czego nie wolno osłabić

- Kwoty przechowuj i licz w najmniejszych jednostkach jako liczby całkowite; nie używaj `float`
  do logiki finansowej.
- OCR nie zapisuje transakcji bez możliwości korekty i świadomego zatwierdzenia.
- Import backupu musi walidować manifest i ścieżki ZIP oraz scalać dane bez cichego kasowania
  lokalnego stanu.
- Migracje SQLite muszą zachować dane istniejących instalacji i podnosić `user_version` dopiero
  po udanej zmianie.
- PIN i sekrety urządzenia nie trafiają do SQLite, logów, backupu ani dokumentacji.
- Nie deklaruj synchronizacji: kafel synchronizacji jest informacyjny, a realny sync nie istnieje.
- Nie rozszerzaj zakresu o backend, konta czy integracje bankowe przy okazji innego zadania.
- Nie uznawaj działania web za dowód działania natywnego aparatu, ML Kit, biometrii lub plików.

## Komendy

```bash
npm start
npm run android
npm run web
npm run typecheck
npm run lint
```

Projekt nie ma jeszcze runnera testów automatycznych. Build natywny i test na urządzeniu są
osobnymi dowodami; wynik `typecheck`/`lint` ich nie zastępuje.

## Zasady specyficzne dla projektu

- Jedna iteracja ma jedną hipotezę i możliwy do sprawdzenia efekt.
- Najpierw stabilność obecnej alpha, potem jedna mała funkcja V1; bez równoległego otwierania
  kilku dużych obszarów.
- Publikacja EAS/build do dystrybucji wymaga wyraźnego polecenia Jakuba oraz GO jakościowego.
- Publiczne repozytorium GitHub zawiera aplikację bez `wiki/`, raportów i danych wewnętrznych.
- Dokumentację aktualizuj i commituj osobno w prywatnym repozytorium `finanse-wiki`.
- Kod i dokumentację zapisuj w osobnych commitach, jeśli dają się logicznie rozdzielić.
- Bez trailerów atrybucji AI w commitach.
