# Z2 — test odtworzenia backupu ZIP

## Cel

Udowodnić, że backup da się nie tylko utworzyć, ale też poprawnie odtworzyć bez utraty lub
zdublowania danych.

## Scenariusze

1. Eksport kopii z instalacji zawierającej transakcje, budżety, kategorie i załączniki.
2. Import na czystej instalacji.
3. Ponowny import tego samego pliku.
4. Import do instalacji zawierającej już własne dane.
5. Kontrola liczników, załączników, budżetów, historii i ustawień blokady.

## Kryteria

- dane finansowe i załączniki wracają zgodnie z manifestem;
- powtórny import nie tworzy niekontrolowanych duplikatów;
- import scala dane i nie kasuje lokalnego stanu;
- PIN, biometria i sekrety SecureStore nie są przenoszone;
- błędny albo niepełny ZIP kończy się czytelnym komunikatem bez częściowego, cichego importu.

## Dowód zamknięcia

Raport z wersją aplikacji, urządzeniem, użytym plikiem testowym, wynikiem każdego scenariusza i
listą ostrzeżeń. Nie umieszczaj samego backupu w repozytorium.
