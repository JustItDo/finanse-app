# Usunięcie uprawnienia Android `RECORD_AUDIO`

## Cel

Usunąć nieużywane uprawnienie do mikrofonu z aplikacji Android bez naruszenia wykonywania zdjęć,
wyboru obrazów ani OCR.

## Zakres

- usunięcie jawnej deklaracji `android.permission.RECORD_AUDIO` z `android.permissions`;
- ustawienie `microphonePermission: false` dla pluginu `expo-image-picker`;
- sprawdzenie wygenerowanego i spakowanego manifestu Androida;
- build Android oraz ręczna regresja aparatu, wyboru zdjęcia i OCR.

## Poza zakresem

- zmiana logiki aparatu, galerii albo OCR;
- zmiana pozostałych uprawnień;
- publikacja buildu.

## Decyzje

- Zenifi nie nagrywa dźwięku i nie ma funkcji wymagającej mikrofonu.
- Expo SDK 56 dokumentuje, że `expo-image-picker` domyślnie dodaje `RECORD_AUDIO`, a wartość
  `microphonePermission: false` blokuje to uprawnienie na Androidzie.
- Nie wystarczy usunąć wpisu z `android.permissions`, ponieważ plugin dodałby go ponownie.

## Kryteria akceptacji

- `RECORD_AUDIO` nie występuje w finalnym manifeście APK;
- `CAMERA` pozostaje w finalnym manifeście;
- aparat wykonuje zdjęcie paragonu;
- wybór obrazu z telefonu działa;
- OCR tworzy szkic możliwy do korekty i zapisu.

## Weryfikacja

- `npm run typecheck`;
- `npm run lint`;
- build debug Android;
- inspekcja wygenerowanego i spakowanego manifestu;
- checklista ręczna na fizycznym telefonie.
