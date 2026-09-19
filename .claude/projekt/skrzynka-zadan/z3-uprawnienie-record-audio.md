# Z3 — wyjaśnienie uprawnienia Android `RECORD_AUDIO`

## Problem

`app.json` deklaruje `android.permission.RECORD_AUDIO`, choć Zenifi nie ma funkcji nagrywania.
Niepotrzebne uprawnienie obniża zaufanie i zwiększa zakres deklarowanej ingerencji w urządzenie.

## Do sprawdzenia

- czy uprawnienie jest wymagane przez którąkolwiek używaną bibliotekę lub konfigurację Expo 56;
- wynik manifestu wygenerowanego buildu, nie tylko wpis w `app.json`;
- wpływ usunięcia na aparat, wybór zdjęć, OCR i build Androida.

## Oczekiwany wynik

Jeśli brak funkcjonalnego uzasadnienia, usunąć jawne uprawnienie, zbudować Androida i potwierdzić
główne flow aparatu/OCR. Jeśli jest wymagane, zapisać konkretne źródło i powód w wiki.
