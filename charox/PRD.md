# PRD — Zakład Pogrzebowy "Charox"

**Źródło:** http://www.charox.pl/
**Data analizy:** 2026-04-24

---

## 1. Przegląd

Strona internetowa lokalnego zakładu pogrzebowego **"Charox"** z siedzibą w Starachowicach. Firma działa od 1989 roku i świadczy kompleksowe usługi pogrzebowe na terenie miasta i okolic. Strona jest klasyczną, statyczną witryną wizytówkową wykonaną w technologii HTML/tabelkowej (XHTML 1.0 Transitional, kodowanie ISO-8859-2), z osobnym modułem galerii opartym o Zenphoto 1.4.7.

## 2. Cele biznesowe

- Budowanie wiarygodności zakładu jako doświadczonego, lokalnego usługodawcy (37 lat obecności na rynku).
- Prezentacja pełnej oferty usług pogrzebowych w jednym miejscu.
- Udostępnienie danych kontaktowych i informacji o godzinach pracy oraz numerów alarmowych czynnych całodobowo.
- Umożliwienie zapoznania się z asortymentem (trumny, urny, karawany, nagrobki, kwiaty) poprzez galerię zdjęć.

## 3. Grupa docelowa

- Osoby z Starachowic i okolic organizujące pogrzeb bliskiej osoby.
- Rodziny potrzebujące szybkiego kontaktu w sytuacji kryzysowej (zgon) — stąd eksponowane telefony całodobowe.
- Osoby szukające usług dodatkowych: ekshumacje, pomniki granitowe, porządki na grobach, transport zwłok z kraju i zagranicy.

## 4. Struktura strony (Information Architecture)

Strona składa się z 4 głównych sekcji dostępnych z nawigacji:

| # | Pozycja | URL | Opis |
|---|---------|-----|------|
| 1 | Strona główna | `index.html` | Obraz powitalny / wizytówka |
| 2 | Oferta | `oferta.html` | Pełna lista usług |
| 3 | Galeria | `galeria/index.php` | Albumy zdjęć produktów (Zenphoto) |
| 4 | Kontakt | `kontakt.html` | Adres, telefony, mapa Google |

### Układ wizualny (wspólny dla każdej podstrony)

1. **Header (1024 × 221 px)** — trzy grafiki: lewe tło, środkowe logo ("CHAROX"), prawe tło.
2. **Pasek nawigacji (1024 × 30 px)** — 4 przyciski graficzne z efektem hover (JS `MM_swapImage` z Macromedia/Dreamweaver).
3. **Obszar treści (1024 × 558 px)** — na stronie głównej pełna grafika; na pozostałych podstronach grafika tła (`tresc2_10.jpg`) z nałożonym tekstem w prawej kolumnie.
4. **Stopka (1024 × 159 px)** — grafika `graf_11.gif`.

Tło całej strony: `#000000` (czarne). Kolor tekstu zasadniczego: `#999999` (szary). Kolor akcentu / wyróżnień: `#996633` (ciepły brąz).

## 5. Zawartość podstron

### 5.1 Strona główna (`index.html`)

Wyłącznie grafika przedstawiająca wnętrze/atmosferę firmy (`tresc_10.jpg`, 1024 × 558 px) — brak tekstu.

### 5.2 Oferta (`oferta.html`)

Nagłówek:
> Zakład Pogrzebowy "CHAROX" od 1989 roku zajmuje się kompleksową obsługą pogrzebów na terenie miasta Starachowice i okolic.
> W naszej ofercie znajdziecie Państwo wszystkie usługi dotyczące pogrzebu.

Lista usług (19 pozycji):

- Trumny
- Tabliczki na trumny
- Karawany (Volvo, Mercedes)
- Autobusy
- Usługi żałobników
- Nekrologi
- Stroiki
- Wieńce
- Wiązanki
- Usługi kremacji zwłok
- Urny
- Obsługa na cmentarzach parafialnych i komunalnych
- Groby murowane i ziemne
- Pomniki granitowe
- Ekshumacje
- Usługi porządkowe na grobach
- Przewozy zwłok całodobowe
- Transport zwłok z kraju i zagranicy
- Oprawy muzyczne ceremonii pogrzebowych

Wyróżnione informacje (w kolorze brązowym):
- "Dla Państwa wygody załatwiamy wszystkie formalności związane z rozliczeniem zasiłku pogrzebowego w ZUS i KRUS."
- "Wszelkie sprawy finansowe są załatwiane w korzystny dla Państwa sposób. Bez płatności gotówkowych."

### 5.3 Galeria (`galeria/index.php`)

Moduł **Zenphoto 1.4.7** (motyw `basic/dark`). Zawiera 7 albumów podzielonych na 2 strony:

**Strona 1:**
1. **Trumny** (03/19/2015)
2. **Urny** (03/19/2015)
3. **Karawany** (03/19/2015)
4. **Nagrobki granitowe** (03/19/2015)
5. **Odzież dla zmarłych** (03/19/2015)
6. **Kwiaty** (03/23/2015)

**Strona 2:**
7. **Znicze**

Stopka galerii: link RSS, "Archive View", informacja "Powered by zenPHOTO".

### 5.4 Kontakt (`kontakt.html`)

**Deklaracja dostępności:**
> Jesteśmy do Państwa dyspozycji 7 dni w tygodniu.

**Adres:** 27-200 Starachowice, ul. Kościelna 56

**Biuro czynne:**
- Poniedziałek–piątek: 8.00 – 15.00
- Sobota: 8.00 – 13.00

**Niedziela po wcześniejszym uzgodnieniu telefonicznym:**
- tel. 41 274 71 74
- tel. 605 303 909

**CAŁĄ DOBĘ — sprawy pilne i przewozy zwłok:**
- tel. 41 274 34 81
- tel. 605 303 909
- tel. 601 99 37 13
- tel. 504 46 97 94

**E-mail:** charox@op.pl

**Mapa dojazdu:** osadzona mapa Google (iframe `mapy.google.pl`), lokalizacja ok. 51.047343, 21.095145 (Starachowice).

## 6. Aspekty techniczne (obecny stan)

| Element | Stan |
|---------|------|
| Typ dokumentu | XHTML 1.0 Transitional |
| Kodowanie | ISO-8859-2 (polski, starsze) |
| Layout | Table-based (1024 px stała szerokość) |
| Responsywność | **Brak** — niedostosowana do mobile |
| JS | Stare skrypty Dreamweavera (MM_preloadImages, MM_swapImage) |
| Grafika nawigacji | Obrazy + hover swap (pliki z folderu `grafika/zamien/`) |
| Galeria | Zenphoto 1.4.7 (wydanie z ~2014 r.) |
| SEO (meta keywords) | Obecne, rozbudowane (zakład, pogrzeb, trumny, kremacja, starachowice, charox...) |
| HTTPS | **Brak** (certyfikat nieważny — tylko HTTP) |
| Dostępność (a11y) | Minimalne `alt` na części obrazów; większość treści to grafika bez tekstu |

## 7. Słowa kluczowe (meta keywords)

zakład, pogrzeb, pogrzebowy, pochówek, trumny, trumna, kremacja, żałobnicy, żałobników, usługi, usług, zwłoki, pomnik, pomniki, ekshumacja, ekshumacje, starachowice, grób, groby, transport, karawan, karawany, cmentarz, urna, urny, przewóz, przewozy, oprawy, muzyczne, ceremonia, ceremonii, pogrzebowych, nekrolog, nekrologi, wiązanka, wiązanki, wieniec, wieńce, granitowe, charox

## 8. Wykaz grafik pobranych do `charox/images/`

### `grafika/` — elementy layoutu i nawigacji

| Plik | Wymiary | Rola |
|------|---------|------|
| `graf_01.gif` | 287 × 221 | Lewa część headera (tło) |
| `graf_02.gif` | 410 × 221 | Środek headera — **logo "Charox"** |
| `graf_03.jpg` | 327 × 221 | Prawa część headera (tło) |
| `graf_04.gif` | 251 × 30 | Lewa część paska nawigacji |
| `graf_05.gif` | 159 × 30 | Przycisk nawigacji "Strona główna" (stan domyślny) |
| `graf_06.gif` | 102 × 30 | Przycisk nawigacji "Oferta" (stan domyślny) |
| `graf_07.gif` | 111 × 30 | Przycisk nawigacji "Galeria" (stan domyślny) |
| `graf_08.gif` | 116 × 30 | Przycisk nawigacji "Kontakt" (stan domyślny) |
| `graf_09.gif` | 285 × 30 | Prawa część paska nawigacji |
| `graf_11.gif` | 1024 × 159 | **Stopka** — dane kontaktowe w formie grafiki |
| `tresc_10.jpg` | 1024 × 558 | **Treść strony głównej** (pełna grafika) |
| `tresc2_10.jpg` | 1024 × 558 | Tło obszaru treści na podstronach Oferta/Kontakt |

### `grafika/zamien/` — warianty hover przycisków nawigacji

| Plik | Wymiary | Rola |
|------|---------|------|
| `grafp_05.jpg` | 159 × 30 | Hover "Strona główna" |
| `grafp_06.jpg` | 102 × 30 | Hover "Oferta" |
| `grafp_07.jpg` | 111 × 30 | Hover "Galeria" |
| `grafp_08.jpg` | 116 × 30 | Hover "Kontakt" |

### `galeria_thumbs/` — miniatury albumów w galerii

| Plik | Album |
|------|-------|
| `trumny_thumb.jpg` | Trumny |
| `urny_thumb.jpg` | Urny |
| `karawany_thumb.jpg` | Karawany |
| `nagrobki_thumb.jpg` | Nagrobki granitowe |
| `odziez_thumb.jpg` | Odzież dla zmarłych |
| `kwiaty_thumb.png` | Kwiaty |
| `znicze_thumb.jpg` | Znicze |
| `rss.png` | Ikona RSS stopki galerii |

## 9. Rekomendacje (jeśli strona miałaby być odświeżona)

1. **Responsywność** — layout działa tylko na desktopie (1024 px), należy przejść na responsywną siatkę.
2. **Tekst zamiast grafik** — stopka, menu i headery to obrazki; blokuje to SEO i a11y.
3. **HTTPS** — brak ważnego certyfikatu (obecny certyfikat nie pasuje do domeny).
4. **UTF-8** zamiast ISO-8859-2.
5. **Aktualizacja Zenphoto** (wersja 1.4.7 z ~2014 roku — potencjalne luki bezpieczeństwa).
6. **Wyraźne CTA dla numeru całodobowego** — obecnie numer jest tylko tekstem, warto wyeksponować jako duży, klikalny `tel:` button.
7. **Usunięcie zależności od Dreamweaver `MM_*` JS** — nowoczesny hover CSS.
