# Wymagania — system zamówień i interakcji przy stoliku (web app na telefonie gościa)

> Robocza nazwa: **TableTalk**
> Punkt odniesienia: system EatTalk działający na tabletach w Soju Bam (Korean Food & Soju Bar, Kraków).
> Kluczowa zmiana: **brak tabletów** — gość skanuje kod QR na stoliku i korzysta z systemu w przeglądarce własnego telefonu (PWA, bez instalacji).

---

## 1. Cel produktu

System dla barów i restauracji (szczególnie koncept „pocha” / soju bar / K-pop bar), który łączy:

1. **Zamawianie przy stoliku** — menu, koszyk, wysyłka zamówienia do obsługi/kuchni, wezwanie obsługi.
2. **Warstwę społecznościową między stolikami** — czat ogólny i prywatny, wysyłanie prezentów (np. drinka) innemu stolikowi, wspólne gry.
3. **Rozrywkę i zaangażowanie** — prośby o piosenki, głosowania, rankingi.

Cel biznesowy dla lokalu: wyższy średni rachunek (impulsowe zamówienia, prezenty), mniejsze obciążenie obsługi, unikalna atmosfera.
Przewaga nad rozwiązaniem tabletowym: **zerowy koszt sprzętu**, wdrożenie w jeden dzień (wydruk kodów QR), brak serwisu i ładowania urządzeń.

---

## 2. Słownik

| Pojęcie | Znaczenie |
|---|---|
| **Lokal (Venue)** | Pojedyncza restauracja/bar — klient systemu (tenant). |
| **Strefa** | Grupa stolików, np. „Sala”, „Ogródek”, „Na wynos”. |
| **Stolik** | Fizyczny stolik z unikalnym kodem QR. |
| **Sesja stolika** | Okres od otwarcia stolika przez obsługę do jego zamknięcia (rozliczenia). Wszystkie zamówienia, czat i prezenty są przypisane do sesji. |
| **Uczestnik** | Pojedynczy telefon (urządzenie) dołączony do sesji stolika. Przy jednym stoliku może być kilku uczestników. |
| **Obsługa** | Kelner / barman / DJ korzystający z panelu obsługi. |
| **Właściciel** | Administrator lokalu: menu, konfiguracja, statystyki. |

---

## 3. Role i aplikacje

| Rola | Aplikacja | Urządzenie |
|---|---|---|
| Gość | Web app gościa (PWA) | Własny telefon |
| Obsługa (sala/bar) | Panel obsługi | Tablet/telefon lokalu |
| Kuchnia | Ekran kuchni (KDS) — może być widokiem panelu obsługi | Tablet/monitor |
| DJ / właściciel | Kolejka piosenek — widok w panelu obsługi | Dowolne |
| Właściciel | Panel administracyjny | Przeglądarka desktop |
| Operator platformy | Panel super-admina (lokale, abonamenty) | Przeglądarka desktop |

---

## 4. Wejście gościa do systemu (główna różnica względem tabletów)

### 4.1 Kod QR

- **FR-QR-1** Każdy stolik ma naklejkę/stojak z kodem QR prowadzącym do `https://{domena}/t/{tableToken}`.
- **FR-QR-2** `tableToken` jest losowym, nieprzewidywalnym identyfikatorem (nie numerem stolika) — nie da się „zgadnąć” innych stolików.
- **FR-QR-3** Panel admina generuje kody QR do druku (PDF, z numerem stolika i logo lokalu). Możliwość unieważnienia i wygenerowania nowego kodu dla stolika.
- **FR-QR-4** Opcjonalnie na naklejce: dane Wi-Fi gościnnego (lokale w piwnicach często mają słaby zasięg LTE).

### 4.2 Ochrona przed zamówieniami spoza lokalu

Kod QR można sfotografować i użyć z domu — przy tabletach ten problem nie istnieje. Wymagania:

- **FR-SEC-1** Sesja stolika jest **otwierana przez obsługę** (przy sadzaniu gości) albo automatycznie przy pierwszym skanie, ale wtedy **pierwsze zamówienie wymaga akceptacji obsługi**. Tryb wybiera właściciel w konfiguracji.
- **FR-SEC-2** Skan kodu stolika bez otwartej sesji → ekran „Poproś obsługę o otwarcie stolika” + przycisk wezwania obsługi (jeśli lokal dopuszcza auto-otwarcie — sesja startuje w trybie „do weryfikacji”).
- **FR-SEC-3** Zamknięcie sesji (rozliczenie) natychmiast odłącza wszystkie telefony przy stoliku; ponowny skan wymaga nowej sesji.
- **FR-SEC-4** Opcjonalny krótki **PIN stolika** (4 cyfry) widoczny dla obsługi i podawany gościom — dla lokali o podwyższonym ryzyku nadużyć.
- **FR-SEC-5** Limit liczby uczestników na sesję (konfigurowalny, domyślnie 12) i limit wartości zamówień bez akceptacji obsługi.

### 4.3 Onboarding gościa

- **FR-ON-1** Ekran powitalny w brandingu lokalu (grafika, logo, nazwa) z wyborem języka (EN / KO / PL — lista konfigurowalna). Domyślny język z ustawień przeglądarki.
- **FR-ON-2** Akceptacja regulaminu i potwierdzenie **18+** (alkohol, czat z obcymi). Jednorazowo na urządzenie.
- **FR-ON-3** Opcjonalny pseudonim uczestnika (domyślnie „Stolik 5”). Na czacie publicznym widoczny jest **numer stolika**, pseudonim jest opcjonalny.
- **FR-ON-4** Brak zakładania konta i logowania. Tożsamość = anonimowy token urządzenia w `localStorage` + cookie sesji.
- **FR-ON-5** Odświeżenie strony, zamknięcie karty lub zgaszenie ekranu nie wylogowuje — powrót przywraca stan (koszyk, czat, statusy).
- **FR-ON-6** Podpowiedź „Dodaj do ekranu głównego” (wymagana na iOS do powiadomień push — patrz NFR).

---

## 5. Moduły funkcjonalne — aplikacja gościa

Nawigacja (mobile-first, dolny pasek zakładek): **Menu · Czat · Rozrywka (Piosenki/Gry/Głosowania) · Stolik (rachunek, wezwanie obsługi, ustawienia)**.
Stałe elementy: numer stolika w nagłówku, wskaźnik nowych wiadomości, szybki przycisk „Wezwij obsługę”.

### 5.1 Menu i zamówienia

- **FR-ORD-1** Menu podzielone na kategorie (zakładki przewijane poziomo: „Całe menu”, „K-Chicken”, „Tteokbokki”, …).
- **FR-ORD-2** Wyróżnione kafelki na górze menu: „Hit dnia”, „Polecenie szefa” (konfigurowane przez właściciela).
- **FR-ORD-3** Pozycja: nazwa, opis, cena, zdjęcie, alergeny, oznaczenia (ostre, wege), status **„Wyprzedane”** (niemożliwe do dodania).
- **FR-ORD-4** Warianty i dodatki (np. sos, poziom ostrości, rozmiar, ser +5 zł) z wpływem na cenę.
- **FR-ORD-5** Koszyk z sumą, edycją ilości i notatką do pozycji.
- **FR-ORD-6** **Koszyk osobisty per telefon**; po wysłaniu zamówienie trafia na wspólny rachunek stolika. Każdy uczestnik widzi listę zamówień całego stolika i ich statusy.
- **FR-ORD-7** Statusy zamówienia w czasie rzeczywistym: `wysłane → przyjęte → w przygotowaniu → wydane` (+ `odrzucone` z powodem).
- **FR-ORD-8** Podgląd bieżącego rachunku stolika (pozycje, suma, w tym prezenty otrzymane — bez ceny — i wysłane).
- **FR-ORD-9** Waluta i format cen per lokal (PLN, CZK, EUR…).
- **FR-ORD-10** Strefa „Na wynos” — zamówienie bez stolika (opcjonalne, później).

### 5.2 Wezwanie obsługi

- **FR-CALL-1** Przycisk „Wezwij obsługę” z predefiniowanymi powodami (konfigurowalne): rachunek, woda, sztućce, sprzątnięcie, pomoc, inne (tekst).
- **FR-CALL-2** Wezwanie trafia do panelu obsługi z numerem stolika i czasem oczekiwania; gość widzi status „Obsługa powiadomiona / w drodze”.
- **FR-CALL-3** Anty-spam: max 1 aktywne wezwanie danego typu na stolik.

### 5.3 Czat między stolikami

- **FR-CHAT-1** Kanał **„Wszyscy”** — wiadomości widoczne dla wszystkich aktywnych stolików w lokalu.
- **FR-CHAT-2** **Wiadomości prywatne (DM) stolik ↔ stolik**. Nadawcą i odbiorcą jest stolik (wszyscy uczestnicy stolika widzą DM tego stolika).
- **FR-CHAT-3** Licznik aktywnych stolików („5 stolików online”) i lista/mapa aktywnych stolików.
- **FR-CHAT-4** Szybkie odpowiedzi (konfigurowalne przez lokal, wielojęzyczne), np. „Jesteś uroczy 😊”, „Przysiądźcie się do nas 💕”, „Na zdrowie! 🍶”.
- **FR-CHAT-5** Emoji; bez przesyłania zdjęć/plików w MVP (ryzyko moderacyjne).
- **FR-CHAT-6** Opcjonalne automatyczne tłumaczenie wiadomości na język odbiorcy (faza 2).
- **FR-CHAT-7** Moderacja:
  - filtr wulgaryzmów (listy per język, edytowalne),
  - limit częstotliwości (np. 1 wiadomość / 3 s, max długość 200 znaków),
  - **zgłoś** wiadomość / **zablokuj** stolik (zablokowany stolik nie może pisać DM ani wysyłać prezentów do blokującego),
  - obsługa może usunąć wiadomość, wyciszyć stolik na czas sesji, wyłączyć czat globalnie.
- **FR-CHAT-8** Stolik może wyłączyć dla siebie czat/DM/prezenty („tryb prywatny”).
- **FR-CHAT-9** Retencja: wiadomości kasowane po zamknięciu dnia operacyjnego (domyślnie po 24 h); zgłoszone wiadomości przechowywane dłużej na potrzeby wyjaśnień (konfigurowalne).

### 5.4 Prezenty

- **FR-GIFT-1** Gość wybiera stolik-odbiorcę z **mapy sali** (siatka stolików odwzorowująca układ lokalu, oznaczony „Mój stolik”, nieaktywne stoliki wyszarzone, przełącznik stref).
- **FR-GIFT-2** Wybór prezentu z dedykowanej listy (lokal wskazuje, które pozycje menu mogą być prezentem, np. soju, piwo, deser) + opcjonalna wiadomość.
- **FR-GIFT-3** Prezent dopisywany jest do **rachunku nadawcy**; obsługa dostarcza go do stolika odbiorcy.
- **FR-GIFT-4** Odbiorca dostaje powiadomienie w aplikacji (animacja) i może podziękować szybką odpowiedzią / otworzyć DM.
- **FR-GIFT-5** Ustawienie lokalu: prezent wymaga akceptacji odbiorcy (domyślnie **tak** — ochrona przed niechcianymi zalotami i podbijaniem rachunku).
- **FR-GIFT-6** Limity: max liczba/wartość prezentów na sesję; blokada stolika blokuje prezenty.

### 5.5 Prośby o piosenki

- **FR-SONG-1** Formularz: tytuł (wymagany), wykonawca, wiadomość do DJ/właściciela (opcjonalna).
- **FR-SONG-2** Podpowiedzi tytułów podczas wpisywania (katalog lokalu lub zewnętrzne API — faza 2).
- **FR-SONG-3** Statusy: `oczekuje → zaakceptowana → zagrana` lub `odrzucona`. Gość widzi listę swoich próśb i statusy.
- **FR-SONG-4** Publiczna lista ostatnich próśb (z oznaczeniem stolika).
- **FR-SONG-5** Limit kolejki (np. 100 dziennie) i limit na stolik (np. 3 oczekujące).
- **FR-SONG-6** Opcjonalnie płatne „priorytetowe” prośby (dopisywane do rachunku) — faza 2.

### 5.6 Głosowania i rankingi

- **FR-VOTE-1** **Głosowanie dnia** (np. „Idol Vote”) — lista opcji konfigurowana przez lokal (zespoły, drinki, cokolwiek), 1 głos na stolik na dobę, reset o skonfigurowanej godzinie.
- **FR-VOTE-2** **Ranking miesiąca** — najczęściej proszone/lajkowane piosenki; serduszka od stolików.
- **FR-VOTE-3** Wyniki na żywo; lokal może wyświetlać je na dużym ekranie (widok „TV”).

### 5.7 Gry

- **FR-GAME-1** Centrum gier: lista dostępnych gier, pokoje oczekujące na graczy.
- **FR-GAME-2** **Szybki mecz 1 na 1** — automatyczne dobranie przeciwnika z innego stolika.
- **FR-GAME-3** **Utwórz pokój** — nazwa, gra, min./max liczba graczy; start, gdy zbierze się minimum.
- **FR-GAME-4** Punkty za wygrane → ranking stolików wieczoru; lokal może przypisać nagrodę (np. darmowy shot dla zwycięzcy — realizowany przez obsługę jako prezent od lokalu).
- **FR-GAME-5** MVP: 1–2 proste gry turowe/szybkie, działające płynnie na telefonie (np. quiz, kółko i krzyżyk, refleks). Architektura pozwala dodawać kolejne gry jako moduły.
- **FR-GAME-6** Baner sprzedażowy w centrum gier („Głodni? Zamów popularne dania”).

### 5.8 Język

- **FR-I18N-1** Cały interfejs, menu, szybkie odpowiedzi i opcje głosowań wielojęzyczne; przełącznik języka dostępny zawsze.
- **FR-I18N-2** Brak tłumaczenia pozycji → fallback na język domyślny lokalu.

---

## 6. Panel obsługi

- **FR-STAFF-1** Mapa sali ze stanem stolików: wolny / otwarta sesja / nowe zamówienie / wezwanie / do weryfikacji.
- **FR-STAFF-2** Otwieranie i zamykanie sesji stolika; przenoszenie sesji na inny stolik; łączenie stolików.
- **FR-STAFF-3** Lista zamówień w czasie rzeczywistym z sygnałem dźwiękowym; zmiana statusu; odrzucenie z powodem; akceptacja zamówień „do weryfikacji”.
- **FR-STAFF-4** Widok kuchni (KDS): tylko pozycje kuchenne, grupowane per zamówienie, z czasem oczekiwania.
- **FR-STAFF-5** Lista wezwań obsługi z czasem oczekiwania i oznaczaniem „załatwione”.
- **FR-STAFF-6** Kolejka piosenek: akceptuj / odrzuć / oznacz jako zagraną.
- **FR-STAFF-7** Prezenty do dostarczenia (od stolika X dla stolika Y).
- **FR-STAFF-8** Moderacja czatu: podgląd, usuwanie wiadomości, wyciszanie stolików, globalny wyłącznik czatu.
- **FR-STAFF-9** Szybkie oznaczanie pozycji jako „wyprzedane” bez wchodzenia do panelu admina.
- **FR-STAFF-10** Rachunek stolika do rozliczenia (podgląd/druk); integracja z POS/fiskalizacją — faza 2.
- **FR-STAFF-11** Konta pracowników z rolami (kelner, kuchnia, DJ, manager) i PIN-em do szybkiego logowania na współdzielonym urządzeniu.

---

## 7. Panel administracyjny (właściciel)

- **FR-ADM-1** Zarządzanie menu: kategorie, pozycje, warianty/dodatki, zdjęcia, alergeny, tłumaczenia, kolejność, wyróżnienia, dostępność czasowa (np. menu lunchowe).
- **FR-ADM-2** Edytor układu sali: strefy, stoliki na siatce (drag & drop), numery, generowanie i druk kodów QR.
- **FR-ADM-3** Branding: logo, grafika ekranu powitalnego, kolory akcentu, domena/subdomena.
- **FR-ADM-4** Włączanie/wyłączanie modułów: czat, DM, prezenty, piosenki, głosowania, gry.
- **FR-ADM-5** Konfiguracja: języki, waluta, tryb otwierania sesji (FR-SEC-1), limity (czat, prezenty, piosenki), szybkie odpowiedzi, powody wezwań, lista słów zakazanych, godzina resetu dnia.
- **FR-ADM-6** Statystyki: obrót per dzień/godzina, top pozycje, średni rachunek, liczba prezentów i ich wartość, aktywność czatu/gier, czas realizacji zamówień i wezwań.
- **FR-ADM-7** Zarządzanie pracownikami i rolami.
- **FR-ADM-8** Eksport danych (CSV).

---

## 8. Wymagania niefunkcjonalne

### 8.1 Platforma i UX
- **NFR-1** Web app gościa jako **PWA**, mobile-first (od 360 px szerokości), działa w Safari iOS 16.4+ i Chrome Android (2 ostatnie wersje główne). Bez instalacji ze sklepu.
- **NFR-2** Pierwsze załadowanie po skanie QR < 2 s na 4G; początkowy pakiet JS < 250 kB (gzip); zdjęcia menu w WebP/AVIF, lazy loading, rozmiary dopasowane do ekranu.
- **NFR-3** Ciemny motyw domyślnie (warunki baru), duże przyciski, czytelność przy słabym oświetleniu.
- **NFR-4** Dostępność: kontrast WCAG AA, obsługa powiększenia tekstu.

### 8.2 Czas rzeczywisty i łączność
- **NFR-5** Komunikacja w czasie rzeczywistym przez WebSocket (z fallbackiem); opóźnienie dostarczenia wiadomości/statusu < 1 s w sieci lokalu.
- **NFR-6** Odporność na zrywanie połączenia (piwnice, zmiana Wi-Fi ↔ LTE): automatyczne wznowienie, ponowne pobranie stanu, kolejka wysyłki z idempotentnymi żądaniami (brak podwójnych zamówień przy ponownym wysłaniu).
- **NFR-7** Telefon gościa przechodzi w uśpienie — po wybudzeniu stan synchronizuje się automatycznie.

### 8.3 Powiadomienia (ograniczenie wersji telefonowej)
- **NFR-8** Gdy aplikacja jest otwarta: powiadomienia w aplikacji (toast, odznaki, dźwięk).
- **NFR-9** Gdy w tle: Web Push — na Androidzie działa w przeglądarce, na iOS **tylko po dodaniu PWA do ekranu głównego**. System nie może zakładać, że gość dostanie push; kluczowe informacje (zamówienie wydane, prezent) muszą być widoczne po powrocie do aplikacji.
- **NFR-10** Panel obsługi nie polega na push — działa jako stale otwarta aplikacja z dźwiękiem (Wake Lock API, aby ekran nie gasł).

### 8.4 Bezpieczeństwo i prywatność (RODO)
- **NFR-11** Gość anonimowy: brak zbierania imienia, e-maila, telefonu. Przechowywany tylko anonimowy identyfikator urządzenia i sesji.
- **NFR-12** Polityka prywatności i regulamin dostępne z ekranu powitalnego; informacja o moderacji czatu.
- **NFR-13** Autoryzacja każdego żądania gościa w kontekście aktywnej sesji stolika; brak dostępu do danych innych lokali/sesji (izolacja tenantów).
- **NFR-14** Rate limiting na API gościa; ochrona przed automatyzacją (boty, masowe zamówienia).
- **NFR-15** HTTPS, nagłówki bezpieczeństwa, sanityzacja treści czatu (XSS).
- **NFR-16** Logi audytowe działań obsługi (anulowanie zamówień, moderacja, zamknięcie rachunku).

### 8.5 Skalowalność i utrzymanie
- **NFR-17** Wielu lokali na jednej instancji (multi-tenant). Docelowa skala na start: 50 lokali × 30 stolików × 6 telefonów.
- **NFR-18** Wdrożenie nowego lokalu bez udziału programisty (konfiguracja w panelu + druk QR).
- **NFR-19** Kopie zapasowe bazy, monitoring błędów po stronie klienta i serwera.

---

## 9. Model danych (zarys)

```
Venue (lokal) ── Zone (strefa) ── Table (stolik, qrToken, pozycja na siatce)
   │                                   │
   ├── MenuCategory ── MenuItem ── ModifierGroup ── Modifier
   │
   ├── Staff (rola, PIN)
   │
   └── TableSession (otwarta/zamknięta, stolik, status weryfikacji)
          ├── Participant (token urządzenia, język, pseudonim)
          ├── Order ── OrderItem (+ modyfikatory, notatka)
          ├── StaffCall
          ├── Gift (od sesji → do sesji, pozycja, status akceptacji)
          ├── SongRequest
          ├── ChatMessage (kanał: ALL | DM sesja↔sesja)
          ├── Block (sesja blokuje sesję)
          └── GameRoom / GameResult / Points

DailyVote ── VoteOption ── Vote (sesja, dzień)
```

---

## 10. Zakres etapów

### MVP (pierwsze wdrożenie w jednym lokalu)
- QR → onboarding (język, 18+), sesje stolików otwierane przez obsługę.
- Menu, koszyk, zamówienia ze statusami, wezwanie obsługi.
- Czat „Wszyscy” + DM stolik↔stolik, szybkie odpowiedzi, podstawowa moderacja (filtr, rate limit, blokada, usuwanie przez obsługę).
- Prezenty z mapy sali (z akceptacją odbiorcy), na rachunek nadawcy.
- Prośby o piosenki z kolejką dla DJ/obsługi.
- Panel obsługi (zamówienia, wezwania, prezenty, piosenki, sesje, moderacja).
- Panel admina: menu, sala + QR, podstawowa konfiguracja.
- Języki: PL, EN, KO.

### Faza 2
- Gry (1v1, pokoje, punkty), głosowanie dnia, ranking miesiąca, widok „TV”.
- Płatność online przy stoliku (BLIK/karta przez bramkę płatności), dzielenie rachunku.
- Integracja z POS / drukarkami fiskalnymi i kuchennymi.
- Automatyczne tłumaczenie czatu, podpowiedzi tytułów piosenek.
- Statystyki rozszerzone, eksporty.

### Faza 3
- Płatne prośby o piosenki, program lojalnościowy, kupony.
- Zamówienia na wynos / przedsprzedaż.
- Samoobsługowa rejestracja nowych lokali i abonamenty.

---

## 11. Otwarte pytania

1. Kto płaci za prezent i kiedy — dopisanie do rachunku nadawcy (MVP) czy płatność z góry online?
2. Czy sesja stolika ma być otwierana zawsze przez obsługę, czy wystarczy akceptacja pierwszego zamówienia? (wpływa na UX i ryzyko nadużyć)
3. Czy potrzebna jest integracja z konkretnym POS-em już w pierwszym lokalu?
4. Czy rachunek jest wspólny dla stolika, czy od razu potrzebne są rachunki per osoba?
5. Model biznesowy: abonament miesięczny per lokal, opłata per stolik, czy prowizja od prezentów/płatności?
6. Czy czat i prezenty mają działać tylko w obrębie lokalu, czy kiedyś między lokalami tej samej sieci?
7. Kto odpowiada za moderację treści czatu (regulamin, zgłoszenia) — lokal czy operator platformy?
