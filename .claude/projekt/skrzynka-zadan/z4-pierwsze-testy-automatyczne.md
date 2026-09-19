# Z4 — pierwszy runner i testy automatyczne

## Cel

Dodać lekką, utrzymywalną ochronę najbardziej ryzykownej czystej logiki bez próby testowania całej
aplikacji naraz.

## Najpierw decyzja

Runner i konfigurację trzeba dobrać do Expo 56 oraz obecnego TypeScriptu. Przed wdrożeniem sprawdź
aktualną, wersjonowaną dokumentację Expo i kompatybilność zależności.

## Pierwszy zakres

- przeliczanie kwot w najmniejszych jednostkach;
- daty i klucze miesięcy;
- agregacje budżetu i bilansu;
- czyste fragmenty parsera OCR;
- walidacja manifestu i reguły scalania backupu, w zakresie możliwym bez natywnego systemu plików.

## Poza pierwszym zakresem

- pełne E2E na urządzeniu;
- automatyzacja aparatu, biometrii i systemowego pickera plików;
- masowy refaktor ekranów tylko po to, aby zwiększyć procent coverage.

## Kryteria

- jedna standardowa komenda testowa w `package.json`;
- testy przechodzą lokalnie i wykrywają błędny wynik, nie tylko brak wyjątku;
- dokumentacja rozróżnia testy automatyczne od checklist na fizycznym telefonie.
