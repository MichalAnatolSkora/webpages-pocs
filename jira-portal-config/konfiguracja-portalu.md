# Konfiguracja portalu Jira Service Management - StableTech Bug Tracker

## Informacje ogolne

- **Instancja Atlassian:** michal89.atlassian.net
- **Konto:** skorek.michal@gmail.com
- **Projekt:** StableTech (klucz: STAB)
- **Typ:** Service space (Jira Service Management)

---

## 1. Utworzenie typow zgloszen

**Strona:** https://michal89.atlassian.net/jira/servicedesk/projects/STAB/settings/request-types/

Utworzono 3 niestandardowe typy zgloszen (jako "Create blank"):

| Nazwa | Opis | Kategoria ITSM |
|-------|------|-----------------|
| Zglos blad | Zglos blad lub problem znaleziony w aplikacji | Service requests |
| Propozycja ulepszenia | Zaproponuj nowa funkcje lub ulepszenie istniejacej | Service requests |
| Problem z wydajnoscia | Zglos problem z wydajnoscia lub wolnym dzialaniem aplikacji | Service requests |

## 2. Usuniecie domyslnych typow zgloszen

**Strona:** https://michal89.atlassian.net/jira/servicedesk/projects/STAB/settings/request-types/

Usunieto 8 domyslnych typow zgloszen IT:

**Z kategorii Service requests (6):**
- Get IT help
- Fix an account problem
- Get a guest wifi account
- Request a new account
- Request admin access
- Request a new/replacement laptop, phone, etc.

**Z kategorii Incidents (2):**
- Report a system problem
- Report a broken printer

**Nie mozna bylo usunac:**
- "Emailed request" - typ systemowy (opcja Delete wyszarzona). Jest oznaczony jako "Hidden from portal" wiec nie jest widoczny dla klientow.

## 3. Konfiguracja portalu (nazwa, opis)

**Strona:** https://michal89.atlassian.net/jira/servicedesk/projects/STAB/settings/portal-settings

Ustawiono:
- **Portal name:** StableTech Bug Tracker
- **Introduction text:** Znalazles blad? Masz pomysl na ulepszenie? Zglos to tutaj. Nasz zespol dev sprawdzi kazde zgloszenie i wroci z odpowiedzia.

## 4. Konfiguracja wygladu Help Center (look and feel)

**Strona:** https://michal89.atlassian.net/servicedesk/customer/portals -> przycisk "Customise" -> "Customise look and feel"

(Bezposredni URL: https://michal89.atlassian.net/servicedesk/customer/portals?customize=true&experience=theme)

Ustawiono:
- **Help center name:** StableTech Dev Portal
- **Home page title:** System zgloszen bledow i ulepszen
- **Banner background, link and button colour:** #1a1a2e (ciemny granat)
- **Navigation background colour:** #0f0f1a (bardzo ciemny granat)
- **Help center banner:** usunieto domyslny obrazek z chmurkami (zostal sam kolor)

## 5. Zmiana jezyka na polski

### 5a. Domyslny jezyk Jiry

**Strona:** https://michal89.atlassian.net/secure/admin/EditApplicationProperties!default.jspa

(Mozna tez dotrzec: Jira admin settings -> General configuration -> Edit Settings)

W sekcji "Internationalisation" zmieniono:
- **Default language:** z "English (United States)" na **"polski (Polska)" / pl_PL**

### 5b. Domyslny jezyk Help Center

**Strona:** https://michal89.atlassian.net/servicedesk/customer/portals?customize=true&experience=theme

Po zmianie jezyka Jiry na polski, panel "Customise look and feel" automatycznie:
- Zmienil "Default language" na **Polish (Poland)**
- Podmienil nazwy na polskie domyslne ("Centrum pomocy", "Witamy w Centrum pomocy")
- Utworzyl sekcje "Translation: English (United States)" z poprzednimi angielskimi wartosciami

Ponownie ustawiono niestandardowe nazwy:
- **Help center name:** StableTech Dev Portal
- **Home page title:** System zgloszen bledow i ulepszen

### 5c. Jezyk profilu uzytkownika (NIE ZMIENIONY)

**Strona:** https://id.atlassian.com/manage-profile/account-preferences

(Mozna dotrzec: Jira -> Personal settings -> General -> link "profile settings page" przy Language)

Jezyk profilu uzytkownika admina jest ustawiony na **English (United Kingdom)**. Ta zmiana musi byc wykonana recznie na stronie id.atlassian.com, poniewaz kontroluje ona jezyk tekstow systemowych portalu (np. "What can we help you with?" -> "W czym mozemy pomoc?").

**UWAGA:** Dla klientow portalu - jezyk wyswietlany zalezy od ustawien ich przegladarki. Jesli przegladarka klienta jest ustawiona na polski, portal wyswietli teksty systemowe po polsku automatycznie.

---

## 6. Dostep do portalu dla klientow (bez logowania)

### Aktualny stan

**Strona:** https://michal89.atlassian.net/jira/servicedesk/projects/STAB/settings/customer-permissions

Channel access jest ustawiony na **Restricted** - tylko zaproszone osoby moga zglaszac tickety.

Dostepne opcje w ustawieniu Channel access:
- **Restricted** (obecne) - tylko zaproszone osoby
- **Open** - kazdy z kontem Atlassian moze zglaszac (ale nadal wymaga logowania)

### Problem: link personalizowany bez logowania

Jira Service Management **nie wspiera** w pelni anonimowego zglaszania ticketow przez portal. Nawet przy ustawieniu "Open" klient musi zalogowac sie kontem Atlassian.

Natywne opcje Jiry (Forms, Widget, Portal) nie pozwalaja na stworzenie unikalnego linku per klient z GUIDem, ktory identyfikowalby klienta bez logowania.

### Mozliwe rozwiazania

**Opcja A: Wlasna strona + Jira REST API (rekomendowane)**
- Prosty formularz webowy hostowany np. na Vercel/Netlify
- URL z unikalnym tokenem klienta, np. `https://twoja-strona.com/zgloszenie?token=a1b2c3d4`
- Backend mapuje token na klienta i tworzy ticket w Jirze przez REST API
- Klient nie musi sie logowac ani miec konta Atlassian
- Wymaga: hosting z backendem (Vercel Functions, Netlify Functions, itp.), API token Jiry

**Opcja B: Email channel**
- Wlaczenie kanalu email w STAB (Channels & self service -> Email)
- Strona: https://michal89.atlassian.net/jira/servicedesk/projects/STAB/settings/email
- Klienci wysylaja maila na adres projektu, ticket tworzy sie automatycznie
- Formularz HTML moze wysylac maila z pre-wypelnionym polem "od kogo"
- Najprostsza opcja, zero backendu

**Opcja C: Portal z ustawieniem "Open"**
- Zmiana Channel access na "Open" na stronie Customer permissions
- Link do portalu: https://michal89.atlassian.net/servicedesk/customer/portal/2
- Kazdy moze zglaszac, ale musi sie zalogowac/zarejestrowac kontem Atlassian
- Darmowe konta dla klientow, nie licza sie do licencji

### Status: NIE WDROZONE - wymaga decyzji ktore podejscie wybrac

---

## Adresy URL - podsumowanie

| Co | URL |
|----|-----|
| Portal (widok klienta) | https://michal89.atlassian.net/servicedesk/customer/portal/2 |
| Help Center (widok klienta) | https://michal89.atlassian.net/servicedesk/customer/portals |
| Ustawienia portalu | https://michal89.atlassian.net/jira/servicedesk/projects/STAB/settings/portal-settings |
| Typy zgloszen | https://michal89.atlassian.net/jira/servicedesk/projects/STAB/settings/request-types/ |
| Grupy portalu | https://michal89.atlassian.net/jira/servicedesk/projects/STAB/settings/portal-settings/portal-groups |
| Wyglad Help Center | https://michal89.atlassian.net/servicedesk/customer/portals?customize=true&experience=theme |
| Ustawienia globalne Jiry | https://michal89.atlassian.net/secure/admin/EditApplicationProperties!default.jspa |
| Profil uzytkownika (jezyk) | https://id.atlassian.com/manage-profile/account-preferences |
