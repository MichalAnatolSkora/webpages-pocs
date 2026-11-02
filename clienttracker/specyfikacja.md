# Tracker zgłoszeń: specyfikacja v1

Narzędzie do prowadzenia zgłoszeń klientów w abonamencie. Ten plik to źródło wymagań dla agenta, który buduje aplikację, i dla `qa-scenario-writer`, który pisze z niego scenariusze testów.

Nazwa robocza: **ClientTracker**. Do nowego repo kopiujesz go jako `docs/specyfikacja.md`. Plik jest samowystarczalny: reguły SLA, ceny i szablon raportu są przepisane z rootRepo (`szablony/sla.md`, `notatki/cennik.md`, `szablony/raport-miesieczny.md`).

Agent buduje według sekcji [Etapy](#etapy) na końcu.

## Po co

Proste listy zadań nie łączą trzech rzeczy, na których stoi abonament:

1. **Pula godzin z pakietu** i godziny faktycznie przepracowane.
2. **Termin reakcji z SLA**, zależny od pakietu, priorytetu, godzin obsługi i świąt.
3. **Raport miesięczny** dla klienta oraz wskaźniki dla właściciela: godziny na klienta, dotrzymane terminy, efektywna stawka.

## Założenia v1

- Jeden użytkownik: właściciel. Klienci się nie logują. Zgłoszenia z maila, formularza albo telefonu wpisuje się ręcznie, z godziną przyjęcia z maila, bo od niej liczy się SLA.
- Model danych nie zamyka drogi do panelu klienta w v2: każde zgłoszenie i wpis czasu należą do klienta, konto ma rolę.
- W repo tylko dane fikcyjne. Żadnych prawdziwych klientów w danych demo, testach ani przykładach.

## Stos i konwencje

- .NET 10, ASP.NET Core minimal API, EF Core + SQLite z migracjami uruchamianymi przy starcie.
- Frontend: statyczne strony w `wwwroot` i czysty JavaScript, bez frameworka i bez kroku budowania.
- Testy xUnit: reguły jako czyste funkcje, API na tymczasowej bazie.
- Obraz Dockera i `compose.yaml` z Caddy przed aplikacją. Aplikacja nie wystawia portu na zewnątrz.
- Kod i nazwy po angielsku, interfejs i komunikaty po polsku.
- Czas zawsze przez `TimeProvider`. W bazie UTC. Obliczenia i wyświetlanie w strefie `Europe/Warsaw` wskazanej w kodzie, nigdy ze strefy serwera.
- Formaty: data `06.11.2026 16:00`, godziny z przecinkiem i bez zbędnych zer (`2,5`, `0,25`, `3`), kwoty z dwoma miejscami (`500,00 zł`), czas trwania `2 h 30 min`, `45 min`, `12 h`.
- Build, testy, uruchomienie i reset danych przez `dotnet`, bez skryptów bash, tak samo na Windows i macOS. Port lokalny 5080.
- Wzorzec do podejrzenia, jeśli jest dostępny: repo `restaurantDeliveryApp` (`Program.cs`, `Panel/Users.cs`, `Panel/SameOrigin.cs`, `deploy/`, `MONITORING.md`).

## Pojęcia

| Pojęcie | Znaczenie |
| --- | --- |
| Klient | firma w abonamencie: nazwa, e-mail kontaktowy, pakiet, cena abonamentu, pula godzin, aktywny |
| Pakiet | Basic, Standard albo Premium. Wyznacza reguły SLA oraz domyślną cenę i pulę |
| Zgłoszenie | prośba albo awaria od klienta lub z monitoringu, z priorytetem i terminem reakcji |
| Reakcja | potwierdzenie zgłoszenia i początek diagnozy. SLA gwarantuje czas reakcji, nie naprawy |
| Okno obsługi | godziny, w których biegnie czas reakcji |
| Wpis czasu | przepracowane godziny u klienta, opcjonalnie przy zgłoszeniu |

## Wymagania

Numery kryteriów (`S-5`, `Z-4`) służą do odwołań w testach i scenariuszach.

### Logowanie i konta (L)

- L-1 Bez rejestracji w interfejsie. Konto zakłada polecenie `create-user --email <e-mail>`, hasło jest czytane ze standardowego wejścia, nie z argumentu. Hasło zmienia `set-password --email <e-mail>`.
- L-2 Logowanie: e-mail i hasło, potem 6-cyfrowy kod TOTP. Konto bez TOTP po haśle trafia na konfigurację: kod QR i klucz do przepisania, potwierdzenie kodem. Bez tego nie ma dostępu do aplikacji.
- L-3 Błędny e-mail, hasło albo kod daje ten sam komunikat, bez zdradzania, co było źle.
- L-4 Najwyżej 5 prób logowania na minutę z jednego IP. Po 10 nieudanych próbach z rzędu konto jest blokowane na 15 minut.
- L-5 Hasło ma co najmniej 12 znaków i jest hashowane wbudowanym `PasswordHasher` z ASP.NET Core.
- L-6 Sesja w ciasteczku, ważna 7 dni od ostatniej aktywności. Wylogowanie kończy sesję. `set-password` i `reset-totp --email <e-mail>` kończą wszystkie sesje konta.
- L-7 Konto ma rolę. W v1 jest tylko `owner`.

### Klienci (K)

- K-1 Lista klientów: nazwa, pakiet, pula w bieżącym miesiącu (`1,5 z 3 h`), liczba otwartych zgłoszeń. Nieaktywni są ukryci, przełącznik „pokaż nieaktywnych” ich pokazuje.
- K-2 Dodanie i edycja: nazwa (wymagana, unikalna), e-mail kontaktowy, pakiet, cena abonamentu miesięcznie, pula godzin. Wybór pakietu podpowiada cenę i pulę z tabeli niżej, obie można zmienić.
- K-3 Klienta nie da się usunąć, tylko oznaczyć jako nieaktywnego. Nieaktywnemu nie można dodać zgłoszenia.
- K-4 Karta klienta: dane, wszystkie zgłoszenia od najnowszego z filtrem po statusie, przejście do widoku miesiąca.

| Pakiet | Cena domyślna | Pula domyślna |
| --- | --- | --- |
| Basic | 400 zł | 0 h |
| Standard | 900 zł | 3 h |
| Premium | 1 800 zł | 8 h |

### SLA: termin reakcji (S)

- S-1 Termin reakcji liczy serwer przy zapisie zgłoszenia. Interfejs pokazuje go jako datę i godzinę.
- S-2 Reguły według pakietu i priorytetu:

| Priorytet | Basic | Standard | Premium |
| --- | --- | --- | --- |
| Krytyczny | 1 dzień roboczy | 4 h w oknie dni roboczych | 2 h w oknie codziennym |
| Wysoki | 2 dni robocze | 1 dzień roboczy | 4 h w oknie dni roboczych |
| Normalny | 5 dni roboczych | 3 dni robocze | 2 dni robocze |

- S-3 Okna obsługi, godziny do zmiany w Ustawieniach:
  - **dni robocze:** poniedziałek–piątek bez świąt, domyślnie 9:00–17:00,
  - **codzienne:** każdy dzień, także święta, domyślnie 10:00–22:00.

  Okno obejmuje godzinę otwarcia, ale nie zamknięcia: zgłoszenie z 17:00 przychodzi już po zamknięciu.
- S-4 „N h w oknie”: liczy się tylko czas w oknie. Zgłoszenie spoza okna zaczyna biec od najbliższego otwarcia.
- S-5 „N dni roboczych”: termin to zamknięcie okna dni roboczych w N-tym dniu roboczym po dniu przyjęcia. „1 dzień roboczy” to następny dzień roboczy.
- S-6 Święta liczone z reguł, nie z listy wpisanej na sztywno: 1.01, 6.01, Wielkanoc, Poniedziałek Wielkanocny, 1.05, 3.05, Zielone Świątki (Wielkanoc + 49 dni), Boże Ciało (Wielkanoc + 60 dni), 15.08, 1.11, 11.11, 24.12 (od 2025), 25.12, 26.12. Kontrola: w 2026 Wielkanoc 5.04 i Boże Ciało 4.06, w 2027 Wielkanoc 28.03 i Boże Ciało 27.05.
- S-7 Zgłoszenie zapamiętuje pakiet klienta i godziny okien z chwili utworzenia. Późniejsza zmiana pakietu albo Ustawień nie przesuwa terminów istniejących zgłoszeń.
- S-8 Zmiana priorytetu albo godziny przyjęcia przelicza termin z zapamiętanych reguł.
- S-9 Stan SLA zgłoszenia, opóźnienie liczone zegarowo:
  - bez reakcji, przed terminem: `Zostało 1 h 20 min`,
  - bez reakcji, po terminie: `Po terminie`,
  - reakcja nie później niż termin: `W terminie`,
  - reakcja po terminie: `Spóźniona o 16 h`.

Przykłady przy domyślnych oknach, w czasie `Europe/Warsaw`. Każdy wiersz to test jednostkowy:

| Pakiet | Priorytet | Przyjęte | Termin reakcji | Co sprawdza |
| --- | --- | --- | --- | --- |
| Standard | Krytyczny | pt 06.11.2026 16:00 | pn 09.11.2026 12:00 | przejście przez weekend |
| Standard | Krytyczny | wt 10.11.2026 15:00 | czw 12.11.2026 11:00 | 11.11 święto |
| Standard | Krytyczny | pn 09.11.2026 17:00 | wt 10.11.2026 13:00 | przyjęte na zamknięciu okna |
| Premium | Krytyczny | sob 07.11.2026 08:00 | sob 07.11.2026 12:00 | przed otwarciem okna |
| Premium | Krytyczny | sob 07.11.2026 21:30 | ndz 08.11.2026 11:30 | reszta czasu następnego dnia |
| Premium | Krytyczny | sob 24.10.2026 21:00 | ndz 25.10.2026 11:00 | zmiana czasu na zimowy w nocy |
| Basic | Krytyczny | pt 06.11.2026 10:00 | pn 09.11.2026 17:00 | następny dzień roboczy |
| Basic | Wysoki | wt 10.11.2026 09:00 | pt 13.11.2026 17:00 | dni robocze ze świętem |
| Basic | Normalny | wt 22.12.2026 10:00 | czw 31.12.2026 17:00 | 24–26.12 wolne |

### Zgłoszenia (Z)

- Z-1 Pola: klient, tytuł (wymagany), opis, priorytet (Krytyczny, Wysoki, Normalny), źródło (Mail, Formularz, Telefon, Monitoring, Własne), przyjęte o.
- Z-2 „Przyjęte o” domyślnie teraz. Można ustawić wcześniejszą godzinę, ale nie przyszłą.
- Z-3 Statusy: Nowe, W toku, Czeka na klienta, Zrobione, Odrzucone. Nowe zgłoszenie ma status Nowe i nie da się do niego wrócić.
- Z-4 Pierwsza zmiana statusu z Nowe zapisuje godzinę reakcji. Można ją poprawić ręcznie, np. gdy odpowiedź mailem poszła wcześniej, ale nie na wcześniejszą niż przyjęcie i nie na przyszłą.
- Z-5 Zrobione i Odrzucone zapisują godzinę zamknięcia. Powrót do W toku albo Czeka na klienta ją czyści.
- Z-6 Widok zgłoszenia: wszystkie pola, termin reakcji, stan SLA (S-9), wpisy czasu z sumą, historia.
- Z-7 Historia zapisuje każdą zmianę statusu, priorytetu i godziny przyjęcia, np. `06.11.2026 16:20 status: Nowe → W toku`.
- Z-8 Zgłoszenia nie da się usunąć. Pomyłkę zamyka się statusem Odrzucone.
- Z-9 Zgłoszenia mają kolejne numery, wyświetlane jako `#12`.

### Wpisy czasu (C)

- C-1 Pola: klient, zgłoszenie (opcjonalne, tylko tego klienta), data (domyślnie dziś), czas w godzinach, rodzaj, opis.
- C-2 Czas większy od 0 i najwyżej 24, w krokach co 0,25 h. Pole przyjmuje `1,5` i `1.5`.
- C-3 Rodzaje:
  - **Pula:** zmiany i promocje, odejmowane od puli pakietu,
  - **Utrzymanie:** w cenie abonamentu (awarie, aktualizacje, backupy), puli nie zmniejsza,
  - **Dodatkowe:** poza pakietem, płatne stawką za prace dodatkowe.
- C-4 Wpis można poprawić i usunąć.
- C-5 Wpis należy do miesiąca według swojej daty.

### Pulpit (P)

- P-1 Strona startowa pokazuje otwarte zgłoszenia wszystkich klientów: Nowe, W toku, Czeka na klienta.
- P-2 Kolejność: najpierw zgłoszenia bez reakcji, według terminu reakcji rosnąco, potem pozostałe, od najstarszego przyjęcia.
- P-3 Kolumny: numer, klient, tytuł, priorytet, status, termin reakcji, stan SLA (S-9). Stan i priorytet podane tekstem, nie tylko kolorem.
- P-4 Filtr po kliencie.

### Miesiąc i raport (M)

- M-1 Widok miesiąca klienta, domyślnie bieżący, z przejściem do poprzedniego i następnego.
- M-2 Podsumowanie:
  - Pula: suma wpisów Pula z miesiąca i pula klienta (`2,5 z 3 h`), nadwyżka jako `ponad pulę o 1,5 h`,
  - Utrzymanie i Dodatkowe w godzinach, Dodatkowe także jako kwota: godziny razy stawka,
  - razem godzin,
  - zgłoszenia przyjęte w miesiącu: wszystkie, w terminie, spóźnione, bez reakcji,
  - efektywna stawka: (cena abonamentu + kwota Dodatkowe) / razem godzin, przy 0 h `—`.
- M-3 Cena abonamentu i stawka są brane z bieżących danych klienta i Ustawień, także dla minionych miesięcy.
- M-4 Przycisk „Raport” pokazuje raport w Markdownie w polu tekstowym, z przyciskiem do skopiowania. W raporcie nie ma kwot ani efektywnej stawki: to liczby dla właściciela, nie dla klienta.
- M-5 Postać raportu:

```markdown
# Raport miesięczny: {klient}, {miesiąc słownie, np. październik 2026}

Pakiet {pakiet} · wykorzystane godziny {suma Pula} z {pula}

## Dostępność

…

## Aktualizacje i backupy

- Aktualizacje: …
- Backupy: …

## Bezpieczeństwo i incydenty

- Zablokowane ataki: …
- Incydenty i czas reakcji:
  - {data przyjęcia} {tytuł} ({priorytet}): reakcja po {czas}, {w terminie | spóźniona o {czas}}

## Naprawione, zanim zauważyliście

- {tytuł}

## Zrealizowane zmiany

| Zmiana | Godziny |
| --- | --- |
| {tytuł} ({dopiski}) | {godziny} |

## Na kolejny miesiąc

- …
```

- M-6 Wypełnianie raportu:
  - Pula 0 h: druga linia to samo `Pakiet Basic`.
  - Incydenty: zgłoszenia Krytyczne i Wysokie przyjęte w miesiącu, według przyjęcia. Bez reakcji: `bez reakcji`. Gdy ich nie ma: `- Incydenty i czas reakcji: brak`.
  - Naprawione, zanim zauważyliście: zgłoszenia ze źródłem Monitoring albo Własne, zamknięte jako Zrobione w miesiącu. Gdy ich nie ma: `- …`.
  - Zrealizowane zmiany: jeden wiersz na zgłoszenie i rodzaj (Pula, Dodatkowe), według numeru zgłoszenia, godziny z wpisów z miesiąca. Dopiski w jednym nawiasie po przecinku: `w toku` przy zgłoszeniu niezamkniętym, `poza pakietem` przy rodzaju Dodatkowe. Bez dopisków nie ma nawiasu. Wpisy bez zgłoszenia i wpisy Utrzymanie nie trafiają do tabeli. Gdy nie ma wierszy, zamiast tabeli: `Brak zmian w tym miesiącu.`
  - Sekcje z `…` właściciel uzupełnia ręcznie, bo narzędzie nie ma tych danych.
- M-7 Przykład z danych demo (Q-3), Bistro Testowe, październik 2026:
  - Pula 2,5 z 3 h, Utrzymanie 1,5 h, Dodatkowe 2 h (500,00 zł), razem 6 h,
  - zgłoszenia 4: w terminie 3, spóźnione 1, bez reakcji 0,
  - efektywna stawka 233,33 zł/h,
  - raport:

```markdown
# Raport miesięczny: Bistro Testowe, październik 2026

Pakiet Standard · wykorzystane godziny 2,5 z 3

## Dostępność

…

## Aktualizacje i backupy

- Aktualizacje: …
- Backupy: …

## Bezpieczeństwo i incydenty

- Zablokowane ataki: …
- Incydenty i czas reakcji:
  - 09.10.2026 Nie działa płatność online (krytyczny): reakcja po 2 h 30 min, w terminie
  - 27.10.2026 Kończy się certyfikat SSL (wysoki): reakcja po 12 h, w terminie

## Naprawione, zanim zauważyliście

- Kończy się certyfikat SSL

## Zrealizowane zmiany

| Zmiana | Godziny |
| --- | --- |
| Promocja na Halloween na stronie głównej | 2,5 |
| Moduł rezerwacji stolików: wycena (w toku, poza pakietem) | 2 |

## Na kolejny miesiąc

- …
```

### Ustawienia (U)

- U-1 Godziny okna dni roboczych i okna codziennego: od, do, przy czym od < do.
- U-2 Stawka za prace dodatkowe, domyślnie 250 zł/h.
- U-3 Nowe godziny okien obowiązują tylko nowe zgłoszenia (S-7).

### Bezpieczeństwo (T)

- T-1 Każdy endpoint poza logowaniem i `/api/health` wymaga zalogowania. API odpowiada 401 albo 403, nigdy przekierowaniem. Test przechodzi po wszystkich zarejestrowanych endpointach i sprawdza 401 bez ciasteczka.
- T-2 Ciasteczko `HttpOnly`, `Secure`, `SameSite=Strict`. Zapisy (POST, PUT, DELETE) tylko z własnego originu.
- T-3 Wejście przez osobne DTO na każdy endpoint. Pola liczone przez serwer (termin reakcji, zamknięcie, historia, numer) nie przychodzą z formularza.
- T-4 Tekst wpisany w formularze pokazywany jako tekst (`textContent`), nigdy jako HTML.
- T-5 Nagłówki: CSP bez skryptów inline, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `frame-ancestors 'none'`.
- T-6 Sekrety i ścieżka bazy ze zmiennych środowiskowych, w repo tylko przykład bez wartości. Klucze Data Protection trwałe, w katalogu danych.
- T-7 Logi strukturalne, bez treści zgłoszeń, e-maili, haseł i kodów.
- T-8 Automatyczne powiadomienia o podatnych zależnościach (Dependabot).

### Utrzymanie (O)

- O-1 `GET /api/health` zwraca 200, gdy baza odpowiada, bez żadnych danych.
- O-2 Polecenie `backup <plik>` robi spójną kopię bazy przy działającej aplikacji (`VACUUM INTO`). Odtworzenie opisane w README. Test: backup, odtworzenie, te same dane.
- O-3 README prowadzi od pustej maszyny do działającej aplikacji, bez kroków spoza README.
- O-4 Wdrożenie to obraz z tagiem wersji. Wycofanie to uruchomienie poprzedniego tagu, opisane w README.
- O-5 Wynik obliczeń nie zależy od strefy serwera: kod nie używa `DateTime.Now` ani `TimeZoneInfo.Local`.

### Dane demo i testy manualne (Q)

- Q-1 Polecenie `reset-demo` usuwa klientów, zgłoszenia, wpisy czasu i Ustawienia, potem wgrywa dane demo. Kont i sesji nie rusza, więc zapisana sesja QA przeżywa reset. W środowisku Production odmawia działania.
- Q-2 `docs/qa/env.md` i `.env.qa` według `instrukcje/testy-manualne.md` z rootRepo: URL `http://localhost:5080`, konto `QA_OWNER_EMAIL` i `QA_OWNER_PASSWORD`, zapisana sesja `.auth/user.json`, komenda `reset-demo`.
- Q-3 Dane demo. Terminy wylicza ten sam kod co w aplikacji, kolumna „Termin reakcji” służy do sprawdzenia.

| Klient | Pakiet | Cena | Pula |
| --- | --- | --- | --- |
| Kawiarnia Demo | Basic | 400 zł | 0 h |
| Bistro Testowe | Standard | 900 zł | 3 h |
| Pizzeria Przykładowa | Premium | 1 800 zł | 8 h |

| # | Klient | Tytuł | Priorytet | Źródło | Przyjęte | Termin reakcji | Reakcja | Status | Wpisy czasu |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Kawiarnia Demo | Zmiana godzin otwarcia | Normalny | Mail | 05.10.2026 11:00 | 12.10.2026 17:00 | 06.10.2026 10:00 | Zrobione 06.10.2026 10:30 | Utrzymanie 0,25 h, 06.10.2026 |
| 2 | Bistro Testowe | Nie działa płatność online | Krytyczny | Mail | 09.10.2026 16:00 | 12.10.2026 12:00 | 09.10.2026 18:30 | Zrobione 10.10.2026 12:00 | Utrzymanie 1 h, 09.10.2026 |
| 3 | Bistro Testowe | Promocja na Halloween na stronie głównej | Normalny | Mail | 14.10.2026 10:00 | 19.10.2026 17:00 | 20.10.2026 09:00 | Zrobione 21.10.2026 20:00 | Pula 1,5 h, 20.10.2026; Pula 1 h, 21.10.2026 |
| 4 | Bistro Testowe | Moduł rezerwacji stolików: wycena | Normalny | Telefon | 22.10.2026 12:00 | 27.10.2026 17:00 | 22.10.2026 19:00 | W toku | Dodatkowe 2 h, 24.10.2026 |
| 5 | Bistro Testowe | Kończy się certyfikat SSL | Wysoki | Monitoring | 27.10.2026 08:00 | 28.10.2026 17:00 | 27.10.2026 20:00 | Zrobione 27.10.2026 20:30 | Utrzymanie 0,5 h, 27.10.2026 |
| 6 | Pizzeria Przykładowa | Zdjęcia w menu się nie ładują | Wysoki | Formularz | 30.10.2026 15:00 | 02.11.2026 11:00 | — | Nowe | — |

Ustawienia po resecie mają wartości domyślne. Po resecie pulpit pokazuje #6 (`Po terminie`), potem #4 (`W terminie`).

- Q-4 Każde pole formularza ma `<label>`, przyciski mają tekst, przyciski z samą ikoną mają `aria-label`.
- Q-5 Logowanie z kodem TOTP jest poza zasięgiem `qa-tester`, bo wymaga kodu z aplikacji. Scenariusze startują z zapisanej sesji, logowanie pokrywają testy xUnit.

## Poza zakresem v1

- Panel klienta: logowanie klienta, jego zgłoszenia i pula, dodawanie zgłoszeń.
- Przyjmowanie zgłoszeń z maila, powiadomienia mailem, SMS-em i push.
- Faktury i eksport do księgowości.
- Czas obejścia i naprawy. V1 mierzy tylko reakcję.
- Załączniki, wielu użytkowników, wyszukiwarka.
- Dane do raportu z zewnątrz: dostępność z monitoringu, backupy, zablokowane ataki.

## Do potwierdzenia

Agent nie czeka na odpowiedzi i buduje z wartościami domyślnymi.

| Pytanie | Domyślnie |
| --- | --- |
| Godziny okna dni roboczych: czy da się w nich reagować obok pracy na etacie? | 9:00–17:00 |
| Czy okno codzienne obejmuje święta? | tak |
| Stawka za prace dodatkowe | 250 zł/h |
| Czy niewykorzystana pula przechodzi na kolejny miesiąc? | nie |
| Gdzie działa v1: lokalnie czy na VPS za Caddy? | gotowe na oba |
| Dokąd trafiają kopie zapasowe poza serwerem? | do ustalenia przed wdrożeniem |
| Czy klienci mają się logować? | w v2 |

## Etapy

Etap jest skończony, gdy testy przechodzą. Wtedy agent odhacza go w tym pliku i robi lokalny commit.

- [ ] 1. Szkielet: rozwiązanie, `CLAUDE.md` (stos, polecenia, czego nie ruszać), `/api/health`, migracje, xUnit, Dockerfile, `compose.yaml`, README z uruchomieniem.
- [ ] 2. Kalendarz i SLA: święta, okna, termin reakcji, stan SLA, testy z tabeli przykładów S.
- [ ] 3. Model i API: klienci, zgłoszenia, historia, wpisy czasu.
- [ ] 4. Konta i logowanie: polecenia CLI, hasło, TOTP, sesje, limity, test 401 dla wszystkich endpointów.
- [ ] 5. Ekrany: pulpit, klienci, karta klienta, zgłoszenie, wpisy czasu, Ustawienia.
- [ ] 6. Miesiąc i raport: podsumowanie, raport, test na przykładzie M-7.
- [ ] 7. Dane demo i QA: `reset-demo`, dane z Q-3, `docs/qa/env.md`.
- [ ] 8. Utrzymanie: backup z testem odtworzenia, nagłówki, logi, README wdrożenia i wycofania.

Sposób pracy:

- Przed pierwszą zmianą przeczytaj cały plik.
- Reguły SLA, święta i tabele przykładów to kontrakt. Gdy test z tabeli nie przechodzi, poprawiasz kod, nie tabelę.
- Nie dodajesz niczego spoza zakresu. Gdy specyfikacja milczy, wybierasz najprostsze rozwiązanie i dopisujesz pytanie do „Do potwierdzenia”.
- Nie łączysz się z serwerami, nie robisz `git push` i niczego nie wdrażasz.
