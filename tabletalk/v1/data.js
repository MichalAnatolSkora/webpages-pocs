// TableTalk v1 — the demo venue (a made-up pocha in Kraków): floor plan, menu with options in three
// languages, call reasons, quick replies, song book, the daily vote, staff, the bot tables that fill
// the room, the owner's default configuration and the seed of a Friday evening already under way.

const DB_V = 1;

const VENUE = {
  name: 'Nolja Pocha',
  ko: '놀자포차',
  tagline: { pl: 'Koreański bar z soju · Kazimierz', en: 'Korean soju bar · Kazimierz', ko: '크라쿠프 카지미에시의 한국 포차' },
  address: 'ul. Przykładowa 7, Kraków (lokal fikcyjny)',
  domain: 'nolja.tabletalk.app',
};

const LANGS = { pl: 'Polski', en: 'English', ko: '한국어' };

const ZONES = [
  { id: 'sala', name: { pl: 'Sala', en: 'Main room', ko: '홀' } },
  { id: 'ogrodek', name: { pl: 'Ogródek', en: 'Garden', ko: '야외석' } },
];

// x / y are percentages of the floor drawing; seats are the plastic stools around each table
const TABLES = [
  [1, 'sala', 10, 17, 2], [2, 'sala', 26, 17, 2], [3, 'sala', 45, 17, 4], [4, 'sala', 65, 17, 4], [5, 'sala', 86, 17, 4],
  [6, 'sala', 12, 44, 4], [7, 'sala', 35, 44, 6], [8, 'sala', 60, 44, 4], [9, 'sala', 84, 44, 6],
  [10, 'sala', 12, 71, 2], [11, 'sala', 38, 71, 4], [12, 'sala', 63, 71, 4],
  [21, 'ogrodek', 15, 26, 4], [22, 'ogrodek', 39, 26, 4], [23, 'ogrodek', 63, 26, 4], [24, 'ogrodek', 86, 26, 2],
  [25, 'ogrodek', 26, 66, 6], [26, 'ogrodek', 68, 66, 6],
].map(([no, zone, x, y, seats]) => ({ id: 't' + no, no, zone, x, y, seats }));

const DECOR = {
  sala: [
    { x: 0, y: 88, w: 40, h: 12, label: 'BAR · 바' },
    { x: 60, y: 88, w: 40, h: 12, label: 'KUCHNIA · 주방' },
    { x: 0, y: 0, w: 14, h: 5, label: 'WEJŚCIE', door: true },
  ],
  ogrodek: [
    { x: 0, y: 0, w: 100, h: 7, label: 'PLANDEKA · 포장마차', tarp: true },
    { x: 44, y: 86, w: 12, h: 14, label: 'DO SALI', door: true },
  ],
};

const CATS = [
  { id: 'chicken', name: { pl: 'K-Chicken', en: 'K-Chicken', ko: '치킨' } },
  { id: 'tteok', name: { pl: 'Tteokbokki', en: 'Tteokbokki', ko: '떡볶이' } },
  { id: 'hot', name: { pl: 'Na ciepło', en: 'Hot dishes', ko: '식사' } },
  { id: 'snack', name: { pl: 'Przekąski', en: 'Snacks', ko: '안주' } },
  { id: 'soju', name: { pl: 'Soju', en: 'Soju', ko: '소주' } },
  { id: 'beer', name: { pl: 'Piwo i makgeolli', en: 'Beer & makgeolli', ko: '맥주 · 막걸리' } },
  { id: 'soft', name: { pl: 'Bez procentów', en: 'Soft drinks', ko: '음료' } },
  { id: 'sweet', name: { pl: 'Desery', en: 'Desserts', ko: '디저트' } },
];

const ALLERGENS = {
  gluten: { n: 1, pl: 'gluten', en: 'gluten', ko: '글루텐' },
  crustaceans: { n: 2, pl: 'skorupiaki', en: 'crustaceans', ko: '갑각류' },
  egg: { n: 3, pl: 'jaja', en: 'eggs', ko: '달걀' },
  fish: { n: 4, pl: 'ryby', en: 'fish', ko: '생선' },
  peanuts: { n: 5, pl: 'orzeszki ziemne', en: 'peanuts', ko: '땅콩' },
  soy: { n: 6, pl: 'soja', en: 'soy', ko: '대두' },
  milk: { n: 7, pl: 'mleko', en: 'milk', ko: '우유' },
  nuts: { n: 8, pl: 'orzechy', en: 'tree nuts', ko: '견과류' },
  sesame: { n: 11, pl: 'sezam', en: 'sesame', ko: '참깨' },
  molluscs: { n: 14, pl: 'mięczaki', en: 'molluscs', ko: '연체동물' },
};

// Option groups: "one" = pick exactly one (first is the default), "many" = any up to max.
const MODS = {
  size: { name: { pl: 'Porcja', en: 'Portion', ko: '사이즈' }, type: 'one', opts: [
    { id: 'half', name: { pl: 'Pół kurczaka', en: 'Half chicken', ko: '반 마리' }, price: 0 },
    { id: 'whole', name: { pl: 'Cały kurczak', en: 'Whole chicken', ko: '한 마리' }, price: 26 },
  ] },
  sauce: { name: { pl: 'Sos', en: 'Sauce', ko: '소스' }, type: 'one', opts: [
    { id: 'none', name: { pl: 'Bez sosu, chrupiący', en: 'No sauce, extra crispy', ko: '후라이드' }, price: 0 },
    { id: 'soy', name: { pl: 'Sojowo-czosnkowy', en: 'Soy garlic', ko: '간장 마늘' }, price: 0 },
    { id: 'honey', name: { pl: 'Miodowo-maślany', en: 'Honey butter', ko: '허니 버터' }, price: 3 },
  ] },
  heat: { name: { pl: 'Ostrość', en: 'Heat', ko: '맵기' }, type: 'one', opts: [
    { id: 'mild', name: { pl: 'Łagodna', en: 'Mild', ko: '순한맛' }, price: 0 },
    { id: 'mid', name: { pl: 'Średnia', en: 'Medium', ko: '보통맛' }, price: 0 },
    { id: 'hot', name: { pl: 'Ostra', en: 'Hot', ko: '매운맛' }, price: 0 },
    { id: 'hell', name: { pl: 'Piekielna 🔥', en: 'Hell 🔥', ko: '지옥맛 🔥' }, price: 0 },
  ] },
  cheese: { name: { pl: 'Dodatek', en: 'Extra', ko: '추가' }, type: 'many', max: 1, opts: [
    { id: 'snow', name: { pl: 'Posypka serowa „snow cheese”', en: 'Snow cheese powder', ko: '스노윙 치즈' }, price: 5 },
  ] },
  tteokAdd: { name: { pl: 'Dodatki', en: 'Add-ons', ko: '토핑' }, type: 'many', max: 4, opts: [
    { id: 'cheese', name: { pl: 'Mozzarella', en: 'Mozzarella', ko: '모짜렐라' }, price: 5 },
    { id: 'egg', name: { pl: 'Jajko', en: 'Boiled egg', ko: '삶은 달걀' }, price: 3 },
    { id: 'odeng', name: { pl: 'Odeng (ciasto rybne)', en: 'Fish cake', ko: '어묵' }, price: 4 },
    { id: 'ramyeon', name: { pl: 'Makaron ramyeon', en: 'Ramyeon noodles', ko: '라면사리' }, price: 6 },
  ] },
  ramenAdd: { name: { pl: 'Dodatki', en: 'Add-ons', ko: '토핑' }, type: 'many', max: 3, opts: [
    { id: 'egg', name: { pl: 'Jajko', en: 'Egg', ko: '달걀' }, price: 3 },
    { id: 'cheese', name: { pl: 'Plaster sera', en: 'Cheese slice', ko: '치즈' }, price: 5 },
    { id: 'mandu', name: { pl: 'Pierożki mandu', en: 'Mandu dumplings', ko: '만두' }, price: 6 },
  ] },
  kimbap: { name: { pl: 'Wersja', en: 'Filling', ko: '종류' }, type: 'one', opts: [
    { id: 'tuna', name: { pl: 'Z tuńczykiem', en: 'Tuna mayo', ko: '참치' }, price: 0 },
    { id: 'veg', name: { pl: 'Wege', en: 'Veggie', ko: '야채' }, price: 0 },
  ] },
  flavor: { name: { pl: 'Smak', en: 'Flavour', ko: '맛' }, type: 'one', opts: [
    { id: 'peach', name: { pl: 'Brzoskwinia', en: 'Peach', ko: '복숭아' }, price: 0 },
    { id: 'grapefruit', name: { pl: 'Grejpfrut', en: 'Grapefruit', ko: '자몽' }, price: 0 },
    { id: 'grape', name: { pl: 'Zielone winogrono', en: 'Green grape', ko: '청포도' }, price: 0 },
    { id: 'apple', name: { pl: 'Jabłko', en: 'Apple', ko: '사과' }, price: 0 },
  ] },
  makgeolli: { name: { pl: 'Rodzaj', en: 'Style', ko: '종류' }, type: 'one', opts: [
    { id: 'classic', name: { pl: 'Klasyczne', en: 'Classic', ko: '생막걸리' }, price: 0 },
    { id: 'banana', name: { pl: 'Bananowe', en: 'Banana', ko: '바나나' }, price: 4 },
  ] },
};

const MENU = [
  { id: 'm01', cat: 'chicken', ko: '후라이드 치킨', price: 42, art: 'chicken', mods: ['size', 'sauce', 'cheese'], allergens: ['gluten', 'soy', 'egg'], kitchen: true,
    name: { pl: 'Kurczak smażony po koreańsku', en: 'Korean fried chicken', ko: '후라이드 치킨' },
    desc: { pl: 'Smażony dwa razy, bardzo chrupiący, z marynowaną rzepą', en: 'Double-fried and very crunchy, with pickled radish', ko: '두 번 튀겨 바삭한 치킨, 치킨무 포함' } },
  { id: 'm02', cat: 'chicken', ko: '양념치킨', price: 46, art: 'yangnyeom', mods: ['size', 'heat', 'cheese'], allergens: ['gluten', 'soy', 'sesame'], spicy: 2, featured: 'hit', kitchen: true,
    name: { pl: 'Yangnyeom chicken', en: 'Yangnyeom chicken', ko: '양념치킨' },
    desc: { pl: 'W lepkiej, słodko-pikantnej glazurze gochujang, z sezamem', en: 'Sticky sweet-and-spicy gochujang glaze with sesame', ko: '달콤 매콤한 고추장 양념에 참깨' } },
  { id: 'm03', cat: 'chicken', ko: '간장 윙', price: 34, art: 'wings', mods: ['cheese'], allergens: ['gluten', 'soy'], kitchen: true,
    name: { pl: 'Skrzydełka soja-czosnek', en: 'Soy garlic wings', ko: '간장 마늘 윙' },
    desc: { pl: '8 sztuk w glazurze sojowej z czosnkiem i dymką', en: 'Eight wings, soy-garlic glaze, spring onion', ko: '윙 8조각, 간장 마늘 소스' } },
  { id: 'm04', cat: 'tteok', ko: '떡볶이', price: 32, art: 'tteok', mods: ['heat', 'tteokAdd'], allergens: ['gluten', 'fish', 'egg', 'soy'], spicy: 2, kitchen: true,
    name: { pl: 'Tteokbokki klasyczne', en: 'Classic tteokbokki', ko: '떡볶이' },
    desc: { pl: 'Kluski ryżowe w ostrym sosie gochujang, odeng, jajko', en: 'Rice cakes in hot gochujang sauce, fish cake, egg', ko: '고추장 떡볶이, 어묵, 달걀' } },
  { id: 'm05', cat: 'tteok', ko: '로제 떡볶이', price: 36, art: 'rose', mods: ['heat', 'tteokAdd'], allergens: ['gluten', 'milk', 'soy'], spicy: 1, featured: 'chef', kitchen: true,
    name: { pl: 'Rose tteokbokki', en: 'Rosé tteokbokki', ko: '로제 떡볶이' },
    desc: { pl: 'Kremowy sos gochujang ze śmietanką i ciągnącą się mozzarellą', en: 'Creamy gochujang sauce with cream and stretchy mozzarella', ko: '크림과 고추장, 쭉 늘어나는 모짜렐라' } },
  { id: 'm06', cat: 'tteok', ko: '궁중떡볶이', price: 34, art: 'gungjung', mods: ['tteokAdd'], allergens: ['soy', 'sesame'], vege: true, kitchen: true,
    name: { pl: 'Gungjung tteokbokki', en: 'Royal court tteokbokki', ko: '궁중떡볶이' },
    desc: { pl: 'Łagodna „dworska” wersja w sosie sojowym z warzywami i grzybami', en: 'The mild royal version: soy sauce, vegetables, mushrooms' } },
  { id: 'm07', cat: 'hot', ko: '라면', price: 22, art: 'ramen', mods: ['ramenAdd'], allergens: ['gluten', 'soy', 'egg'], spicy: 2, kitchen: true,
    name: { pl: 'Ramyeon w garnku', en: 'Pot ramyeon', ko: '냄비 라면' },
    desc: { pl: 'Podawany w złotym garnuszku, jedzony prosto z pokrywki', en: 'Served in the golden pot, eaten straight from the lid', ko: '양은냄비에 끓여 뚜껑에 덜어 먹는 라면' } },
  { id: 'm08', cat: 'hot', ko: '어묵탕', price: 29, art: 'odeng', allergens: ['fish', 'gluten', 'soy'], kitchen: true,
    name: { pl: 'Odeng-tang', en: 'Fish cake soup', ko: '어묵탕' },
    desc: { pl: 'Bulion z szaszłykami z ciasta rybnego, rzodkiew, por', en: 'Broth with fish cake skewers, radish and leek', ko: '어묵꼬치와 무를 넣은 시원한 국물' } },
  { id: 'm09', cat: 'hot', ko: '김치전', price: 28, art: 'kimchijeon', allergens: ['gluten', 'fish', 'soy'], spicy: 1, kitchen: true,
    name: { pl: 'Kimchi-jeon', en: 'Kimchi pancake', ko: '김치전' },
    desc: { pl: 'Chrupiący placek z kimchi, sos sojowy do maczania', en: 'Crispy kimchi pancake with soy dipping sauce', ko: '바삭한 김치전과 초간장' } },
  { id: 'm10', cat: 'hot', ko: '해물파전', price: 38, art: 'pajeon', allergens: ['gluten', 'crustaceans', 'molluscs', 'egg'], soldOut: true, kitchen: true,
    name: { pl: 'Haemul-pajeon', en: 'Seafood scallion pancake', ko: '해물파전' },
    desc: { pl: 'Placek z dymką, krewetkami i kalmarem', en: 'Spring onion pancake with shrimp and squid', ko: '새우와 오징어를 넣은 파전' } },
  { id: 'm11', cat: 'snack', ko: '김밥', price: 24, art: 'kimbap', mods: ['kimbap'], allergens: ['sesame', 'egg', 'fish'], kitchen: true,
    name: { pl: 'Kimbap', en: 'Kimbap', ko: '김밥' },
    desc: { pl: '10 kawałków, z tuńczykiem albo wege', en: 'Ten pieces, tuna mayo or veggie', ko: '10조각, 참치 또는 야채' } },
  { id: 'm12', cat: 'snack', ko: '김치 감자튀김', price: 19, art: 'fries', allergens: ['milk', 'fish'], spicy: 1, kitchen: true,
    name: { pl: 'Frytki z kimchi i serem', en: 'Kimchi cheese fries', ko: '김치 치즈 감자튀김' },
    desc: { pl: 'Frytki, smażone kimchi, sos serowy', en: 'Fries, fried kimchi, cheese sauce', ko: '감자튀김에 볶은 김치와 치즈 소스' } },
  { id: 'm13', cat: 'snack', ko: '계란말이', price: 18, art: 'omelette', allergens: ['egg'], vege: true, kitchen: true,
    name: { pl: 'Gyeran-mari', en: 'Rolled omelette', ko: '계란말이' },
    desc: { pl: 'Zwijany omlet z warzywami i ketchupem', en: 'Rolled omelette with vegetables and ketchup', ko: '야채 계란말이와 케첩' } },
  { id: 'd01', cat: 'soju', ko: '소주', price: 35, art: 'soju', gift: true,
    name: { pl: 'Soju klasyczne 360 ml', en: 'Classic soju 360 ml', ko: '소주 360ml' },
    desc: { pl: '16,5%, z lodowatymi kieliszkami dla całego stolika', en: '16.5%, with ice-cold shot glasses for the table', ko: '16.5%, 차가운 소주잔과 함께' } },
  { id: 'd02', cat: 'soju', ko: '과일소주', price: 38, art: 'fruitsoju', mods: ['flavor'], gift: true,
    name: { pl: 'Soju owocowe 360 ml', en: 'Fruit soju 360 ml', ko: '과일소주 360ml' },
    desc: { pl: '13%, wybierz smak', en: '13%, pick a flavour', ko: '13%, 맛을 고르세요' } },
  { id: 'd03', cat: 'soju', ko: '소맥', price: 24, art: 'somaek', gift: true,
    name: { pl: 'Somaek, czyli soju-bomba', en: 'Somaek, the soju bomb', ko: '소맥' },
    desc: { pl: 'Kieliszek soju wrzucony do piwa. Stuknij w stół i pij!', en: 'A shot of soju dropped into beer. Tap the table, drink!', ko: '소주 한 잔을 맥주에 퐁당' } },
  { id: 'd04', cat: 'beer', ko: '맥주', price: 22, art: 'beer', allergens: ['gluten'], gift: true,
    name: { pl: 'Piwo koreańskie 500 ml', en: 'Korean lager 500 ml', ko: '생맥주 500ml' },
    desc: { pl: 'Jasny, lekki lager do ostrego jedzenia', en: 'Light pale lager for spicy food', ko: '매운 음식과 잘 어울리는 라거' } },
  { id: 'd05', cat: 'beer', ko: '막걸리', price: 39, art: 'makgeolli', mods: ['makgeolli'], gift: true,
    name: { pl: 'Makgeolli 750 ml', en: 'Makgeolli 750 ml', ko: '막걸리 750ml' },
    desc: { pl: 'Musujące wino ryżowe, 6%, pite z miseczek', en: 'Sparkling rice wine, 6%, drunk from bowls', ko: '6%, 양은 사발에 마시는 막걸리' } },
  { id: 'd06', cat: 'soft', ko: '유자에이드', price: 16, art: 'yuzu',
    name: { pl: 'Lemoniada yuzu', en: 'Yuzu ade', ko: '유자에이드' },
    desc: { pl: 'Yuzu, woda gazowana, lód', en: 'Yuzu, sparkling water, ice', ko: '유자청, 탄산수, 얼음' } },
  { id: 'd07', cat: 'soft', ko: '보리차', price: 9, art: 'tea',
    name: { pl: 'Herbata jęczmienna', en: 'Barley tea', ko: '보리차' },
    desc: { pl: 'Dzbanek, na ciepło albo z lodem', en: 'A jug, hot or iced', ko: '따뜻하게 또는 차갑게' } },
  { id: 's01', cat: 'sweet', ko: '호떡', price: 16, art: 'hotteok', allergens: ['gluten', 'nuts'], vege: true, gift: true, kitchen: true,
    name: { pl: 'Hotteok', en: 'Hotteok', ko: '호떡' },
    desc: { pl: 'Smażone placuszki z cukrem trzcinowym i orzechami', en: 'Fried pancakes filled with brown sugar and nuts', ko: '흑설탕과 견과류가 든 호떡' } },
  { id: 's02', cat: 'sweet', ko: '망고빙수', price: 29, art: 'bingsu', allergens: ['milk'], vege: true, gift: true, kitchen: true,
    name: { pl: 'Bingsu z mango', en: 'Mango bingsu', ko: '망고빙수' },
    desc: { pl: 'Mleczny lód kruszony, mango, mleko skondensowane, dla dwojga', en: 'Shaved milk ice, mango, condensed milk, for two', ko: '우유 빙수에 망고, 연유, 2인용' } },
];

// The venue's own gift (game prize), sent by staff and never billed
const HOUSE_GIFT = { id: 'house', ko: '서비스', price: 0, art: 'shot', name: { pl: 'Kolejka soju od lokalu', en: 'A round of soju on the house', ko: '서비스 소주' } };

const CALL_REASONS = [
  { id: 'bill', icon: 'receipt', on: true, name: { pl: 'Rachunek', en: 'The bill', ko: '계산서' } },
  { id: 'water', icon: 'drop', on: true, name: { pl: 'Woda', en: 'Water', ko: '물' } },
  { id: 'cutlery', icon: 'chop', on: true, name: { pl: 'Pałeczki i sztućce', en: 'Chopsticks & cutlery', ko: '수저' } },
  { id: 'clean', icon: 'sparkle', on: true, name: { pl: 'Sprzątnięcie stolika', en: 'Clear the table', ko: '테이블 정리' } },
  { id: 'help', icon: 'help', on: true, name: { pl: 'Pomoc', en: 'Help', ko: '도와주세요' } },
  { id: 'other', icon: 'pen', on: true, text: true, name: { pl: 'Inne', en: 'Something else', ko: '기타' } },
];
const OPEN_REASON = { id: 'open', icon: 'door', name: { pl: 'Otwarcie stolika', en: 'Open the table', ko: '테이블 열기' } };

const QUICK_REPLIES = [
  { id: 'cute', pl: 'Jesteście uroczy 😊', en: 'You are adorable 😊', ko: '너무 귀여우세요 😊' },
  { id: 'join', pl: 'Przysiądźcie się do nas 💕', en: 'Come sit with us 💕', ko: '같이 앉아요 💕' },
  { id: 'cheers', pl: 'Na zdrowie! 🍶', en: 'Cheers! 🍶', ko: '건배! 🍶' },
  { id: 'thanks', pl: 'Dziękujemy! 🙏', en: 'Thank you! 🙏', ko: '감사합니다! 🙏' },
  { id: 'song', pl: 'Dobra piosenka! 🎶', en: 'Great song! 🎶', ko: '노래 좋다! 🎶' },
  { id: 'game', pl: 'Gramy w kapsla? 🎯', en: 'Bottle-cap game? 🎯', ko: '병뚜껑 게임 할래요? 🎯' },
];

const EMOJI = ['😊', '😂', '🥹', '😍', '😎', '🥳', '🙏', '👍', '👏', '🔥', '💕', '💜', '🍶', '🍻', '🥂', '🍗', '🌶️', '🎶', '🎤', '🎂', '🎉', '✨', '👋', '🫶'];

const BANNED = {
  pl: ['kurwa', 'kurwy', 'chuj', 'chuja', 'pierdol', 'jebac', 'jebać', 'spierdalaj', 'pizda', 'debil'],
  en: ['fuck', 'shit', 'bitch', 'asshole', 'cunt'],
  ko: ['씨발', '시발', '병신', '개새끼', '좆'],
};

// The venue's song book; each entry gets a karaoke-style number
const SONGS = [
  ['APT.', 'ROSÉ & Bruno Mars'], ['Gangnam Style', 'PSY'], ['Dynamite', 'BTS'], ['Butter', 'BTS'], ['Super Shy', 'NewJeans'],
  ['Ditto', 'NewJeans'], ['Hype Boy', 'NewJeans'], ['Love Dive', 'IVE'], ['I AM', 'IVE'], ['Spicy', 'aespa'], ['Supernova', 'aespa'],
  ['Next Level', 'aespa'], ['Pink Venom', 'BLACKPINK'], ['How You Like That', 'BLACKPINK'], ['DDU-DU DDU-DU', 'BLACKPINK'],
  ['Fantastic Baby', 'BIGBANG'], ['Bang Bang Bang', 'BIGBANG'], ['Gee', "Girls' Generation"], ['Fancy', 'TWICE'], ['What is Love?', 'TWICE'],
  ['Antifragile', 'LE SSERAFIM'], ['Perfect Night', 'LE SSERAFIM'], ['Magnetic', 'ILLIT'], ["God's Menu", 'Stray Kids'],
  ['Seven', 'Jung Kook'], ['Love Scenario', 'iKON'], ['Psycho', 'Red Velvet'], ['Queencard', '(G)I-DLE'], ['Sorry, Sorry', 'Super Junior'], ['Ring Ding Dong', 'SHINee'],
].map(([title, artist]) => ({ title, artist, no: 10000 + (hash(title + artist) % 89999) }));

const VOTE = {
  title: { pl: 'Drink wieczoru', en: 'Drink of the night', ko: '오늘의 술' },
  options: [
    { id: 'peach', art: 'fruitsoju', item: 'd02', name: { pl: 'Soju brzoskwiniowe', en: 'Peach soju', ko: '복숭아 소주' } },
    { id: 'somaek', art: 'somaek', item: 'd03', name: { pl: 'Somaek', en: 'Somaek', ko: '소맥' } },
    { id: 'banana', art: 'makgeolli', item: 'd05', name: { pl: 'Makgeolli bananowe', en: 'Banana makgeolli', ko: '바나나 막걸리' } },
    { id: 'yuzu', art: 'yuzu', item: 'd06', name: { pl: 'Yuzu z soju', en: 'Yuzu soju', ko: '유자 소주' } },
  ],
};

const STAFF = [
  { id: 'ola', name: 'Ola', role: 'waiter', pin: '1111' },
  { id: 'kuba', name: 'Kuba', role: 'kitchen', pin: '2222' },
  { id: 'minjun', name: 'Min-jun', role: 'dj', pin: '3333' },
  { id: 'ania', name: 'Ania', role: 'manager', pin: '4444' },
];
const STAFF_ROLES = {
  waiter: { label: 'Sala', views: ['sala', 'zamowienia', 'wezwania', 'prezenty', 'czat', 'menu'] },
  kitchen: { label: 'Kuchnia', views: ['kuchnia', 'menu'] },
  dj: { label: 'DJ i bar', views: ['piosenki', 'zamowienia', 'czat'] },
  manager: { label: 'Manager', views: ['sala', 'zamowienia', 'kuchnia', 'wezwania', 'piosenki', 'prezenty', 'czat', 'menu', 'dziennik'] },
};
const CREW = { id: 'crew', name: 'Obsługa (auto)' };

// Who sits at the other tables tonight (simulated phones)
const BOTS = {
  2: { lang: 'pl', nick: 'Kasia i Ania', lines: ['Kto bierze bingsu na pół? 🍧', 'To rose tteokbokki to sztos 🔥', 'Stolik 9, jakie soju polecacie?', 'Kolejka dla całej sali! 😂'] },
  3: { lang: 'pl', nick: 'Hallyu Crew', lines: ['DJ, poprosimy coś z aespa! 💜', 'Kto na kapsla? Prowadzimy w rankingu 😎', 'Stolik 7, sto lat dla Marty! 🎂', 'Gramy rewanż?'] },
  6: { lang: 'pl', nick: '', lines: ['Pierwszy raz tutaj. Co polecacie?', 'Ramyeon w garnku ❤️', 'Ale tu klimat 😄'] },
  7: { lang: 'pl', nick: 'Urodziny Marty 🎂', lines: ['Marta kończy dziś 25 lat! 🎉', 'Kto zaśpiewa z nami Gangnam Style? 🎤', 'Dzięki za życzenia ❤️', 'Sto lat! 🥂'] },
  9: { lang: 'en', nick: 'Erasmus gang', lines: ['Anyone up for a soju bomb challenge? 🍻', 'This place is amazing 🔥', 'Table 3, rematch at the cap game?', 'How do you say cheers in Polish? 😅'] },
  11: { lang: 'ko', nick: '서울에서 왔어요', lines: ['안녕하세요! 크라쿠프 너무 좋아요 😊', '떡볶이 진짜 맛있어요 👍', '건배! 🍶', '여기 한국 같아요 ㅋㅋ'] },
  21: { lang: 'pl', nick: '', lines: ['W ogródku cieplej, niż myśleliśmy 😅', 'Ogródek pozdrawia salę 👋'] },
  23: { lang: 'pl', nick: 'Ziomki z ogródka', lines: ['Sala, słychać was aż tutaj 😂', 'Kto gra w kapsla z ogródkiem?'] },
};
const BOT_DM = {
  pl: ['Hej! Fajnie się bawicie 😄', 'Polecacie coś ostrego?', 'Wasze jedzenie wygląda lepiej niż nasze 😂', 'Może później się przysiądziemy 😊'],
  en: ['Hey! You look like you know the menu 😄', 'What are you drinking? Looks good!', 'Cheers from our table 🍻'],
  ko: ['안녕하세요! 반가워요 😊', '뭐 드세요? 맛있어 보여요!', '건배해요 🍶'],
};
const BOT_REPLY = {
  pl: ['Haha, dzięki! 😄', 'Na zdrowie! 🍶', 'Może później się przysiądziemy 😊', 'Polecamy rose tteokbokki!', 'Dzięki, wzajemnie! 🙌'],
  en: ['Haha thanks! 😄', 'Cheers! 🍻', 'Maybe we will come over later 😊', 'Try the yangnyeom chicken!'],
  ko: ['감사합니다! 😄', '건배! 🍶', '좋아요 ㅋㅋ', '떡볶이 추천해요!'],
};
const BOT_GIFT_MSG = {
  pl: ['Za dobrą energię przy waszym stoliku! 🎶', 'Na zdrowie od sąsiadów 🍶'],
  en: ['From the Erasmus table, cheers! 🍻', 'For the best table in the room 😄'],
  ko: ['즐거운 밤 되세요! 🍶', '한국에서 온 선물이에요 😊'],
};

const DEFAULT_CONFIG = {
  sessionMode: 'staff', // 'staff' = staff opens the table; 'auto' = first scan opens it, first order waits for staff
  pinRequired: false,
  maxParticipants: 12,
  orderLimit: 300,
  modules: { chat: true, dm: true, gifts: true, songs: true, votes: true, games: true },
  chatOn: true,
  chatRate: 3,
  chatMax: 200,
  retentionH: 24,
  giftAccept: true,
  giftMax: 5,
  giftMaxValue: 200,
  songPending: 3,
  songDaily: 100,
  langs: ['pl', 'en', 'ko'],
  defaultLang: 'pl',
  currency: 'PLN',
  dayReset: '06:00',
  wifi: { ssid: 'Nolja-Goscie', pass: 'soju2026' },
  quick: QUICK_REPLIES,
  reasons: CALL_REASONS,
  banned: BANNED,
};

// ---------- prices ----------
const itemIn = (menu, id) => (id === 'house' ? HOUSE_GIFT : menu.find(i => i.id === id));
function defaultSel(it) {
  const sel = {};
  (it.mods || []).forEach(g => { sel[g] = MODS[g].type === 'one' ? [MODS[g].opts[0].id] : []; });
  return sel;
}
function unitPrice(it, sel = {}) {
  return it.price + sum(it.mods || [], g => sum(sel[g] || [], o => MODS[g].opts.find(x => x.id === o)?.price || 0));
}
function lineFor(menu, item, qty = 1, sel = null, note = '') {
  const it = itemIn(menu, item);
  const s = sel || defaultSel(it);
  return { item, qty, sel: s, note, unit: unitPrice(it, s), kitchen: !!it.kitchen };
}

// The operating day starts at the venue's reset hour (votes, song limits, rankings)
function opDay(ts, reset = '06:00') {
  const [h, m] = reset.split(':').map(Number);
  return isoDay(ts - (h * 60 + m) * MIN);
}

// ---------- the evening so far ----------
function seed(now = Date.now()) {
  const ago = m => Math.round(now - m * MIN);
  const d = {
    v: DB_V, seededAt: now,
    config: structuredClone(DEFAULT_CONFIG),
    tables: TABLES.map(t => ({ ...t, token: makeToken(seeded('nolja-' + t.no)), old: [] })),
    menu: structuredClone(MENU),
    sessions: [], participants: [], orders: [], calls: [], msgs: [], gifts: [], songs: [], votes: [], games: [], reports: [], audit: [],
    seq: { order: 29 }, done: {},
  };
  const S = {};
  const open = (no, mins, by = 'ola', phones = 2, nick) => {
    const s = { id: uid('s'), table: 't' + no, status: 'open', openedAt: ago(mins), openedBy: by, pin: String(1000 + Math.floor(Math.random() * 9000)), approved: true, muted: false, private: false, blocks: [] };
    d.sessions.push(s);
    S[no] = s;
    const P = BOTS[no] || { lang: 'pl', nick: '' };
    for (let i = 0; i < phones; i++) d.participants.push({ id: uid('p'), session: s.id, device: 'bot', lang: P.lang, nick: i ? '' : (nick ?? P.nick), joinedAt: ago(mins - 1 - i) });
    return s;
  };
  [[2, 64], [3, 95], [6, 18], [7, 52], [9, 77], [11, 40], [21, 33], [23, 58]].forEach(([no, m]) => open(no, m));
  open(5, 22, 'ola', 1, 'Kuba'); // the demo table: a friend's phone is already in

  const by = no => d.participants.find(p => p.session === S[no].id).id;
  const order = (no, mins, status, lines) => {
    const at = ago(mins), items = lines.map(([item, qty, sel, note]) => lineFor(d.menu, item, qty, sel, note));
    const times = { sent: at };
    if (status !== 'sent') times.accepted = at + 50 * SEC;
    if (status === 'prep' || status === 'served') times.prep = at + 2 * MIN;
    if (status === 'served') times.served = at + 11 * MIN;
    d.orders.push({ id: uid('o'), no: ++d.seq.order, key: uid('k'), session: S[no].id, by: by(no), at, items, total: sum(items, l => l.unit * l.qty), status, times });
  };
  order(23, 50, 'served', [['d04', 3], ['m12', 2]]);
  order(2, 48, 'served', [['m05', 1, { heat: ['mid'], tteokAdd: ['cheese'] }], ['d05', 1, { makgeolli: ['banana'] }]]);
  order(11, 36, 'served', [['m08', 1], ['m07', 2, { ramenAdd: ['egg'] }], ['d01', 2]]);
  order(5, 19, 'served', [['d02', 2, { flavor: ['peach'] }]]);
  order(3, 30, 'accepted', [['m02', 1, { size: ['whole'], heat: ['hot'], cheese: [] }], ['d03', 4]]);
  order(9, 15, 'prep', [['m01', 1, { size: ['whole'], sauce: ['soy'], cheese: ['snow'] }], ['d04', 4]]);
  order(5, 8, 'prep', [['m02', 1, { size: ['half'], heat: ['mid'], cheese: [] }], ['m11', 1, { kimbap: ['veg'] }, 'bez ogórka']]);
  order(7, 1.2, 'sent', [['s02', 2], ['d01', 3], ['m12', 1]]);
  order(21, 0.5, 'sent', [['m04', 1, { heat: ['hot'], tteokAdd: ['ramyeon', 'egg'] }], ['d06', 2]]);

  d.calls.push({ id: uid('c'), session: S[11].id, table: 't11', reason: 'bill', text: '', at: ago(2.2), status: 'new' });
  d.calls.push({ id: uid('c'), session: S[6].id, table: 't6', reason: 'water', text: '', at: ago(4), status: 'onway', times: { onway: ago(3) } });

  const msg = (no, mins, text, ch = 'all') => d.msgs.push({ id: uid('m'), ch, from: S[no].id, by: by(no), nick: BOTS[no]?.nick || '', text, at: ago(mins) });
  msg(3, 41, 'Ktoś na kapsla? Prowadzimy w rankingu 😎');
  msg(11, 33, '안녕하세요! 크라쿠프 너무 좋아요 😊');
  msg(9, 27, 'Anyone up for a soju bomb challenge? 🍻');
  msg(7, 21, 'Marta kończy dziś 25 lat! 🎉');
  msg(2, 16, 'Sto lat dla Marty! 🎂');
  msg(9, 9, 'Na zdrowie = 건배 = cheers 🥂');
  msg(7, 3, 'Kto zaśpiewa z nami Gangnam Style? 🎤');

  const gift = (from, to, mins, item, status, text, sel) => {
    const it = itemIn(d.menu, item), s = sel || defaultSel(it);
    d.gifts.push({ id: uid('g'), from: S[from].id, to: S[to].id, item, sel: s, price: unitPrice(it, s), msg: text, at: ago(mins), status, times: status === 'pending' ? {} : { accepted: ago(mins - 0.5) } });
  };
  gift(9, 7, 3, 'd01', 'accepted', 'Happy birthday Marta! 🎂');
  gift(3, 2, 1, 's01', 'pending', 'Dla stolika z najlepszym śmiechem 😄');
  gift(11, 3, 26, 'd02', 'delivered', '건배! 🍶', { flavor: ['grape'] });

  const song = (no, mins, title, status, hearts = []) => {
    const s = SONGS.find(x => x.title === title);
    d.songs.push({ id: uid('r'), session: S[no].id, title: s.title, artist: s.artist, no: s.no, msg: '', at: ago(mins), status, hearts: hearts.map(n => S[n].id), times: {} });
  };
  song(3, 44, 'Supernova', 'played', [9, 11]);
  song(9, 31, 'APT.', 'played', [2, 3, 7, 11]);
  song(7, 12, 'Gangnam Style', 'accepted', [9, 23]);
  song(11, 4, 'Love Scenario', 'pending', [3]);
  song(2, 1, 'Super Shy', 'pending');

  const day = opDay(now, d.config.dayReset);
  [[3, 'peach'], [7, 'somaek'], [9, 'somaek'], [11, 'banana'], [2, 'peach'], [21, 'yuzu'], [23, 'somaek']].forEach(([no, option], i) => d.votes.push({ session: S[no].id, day, option, at: ago(40 - i * 5) }));

  const game = (a, b, mins, fa, fb) => d.games.push({ id: uid('k'), kind: 'kapsel', mode: 'quick', max: 2, by: S[a].id, at: ago(mins), status: 'done', endedAt: ago(mins - 1.5),
    players: [{ s: S[a].id, flicks: fa }, { s: S[b].id, flicks: fb }] });
  game(3, 9, 70, [88, 71, 93], [64, 80, 52]);
  game(3, 11, 45, [76, 90, 69], [81, 58, 62]);
  game(9, 2, 38, [92, 66, 85], [47, 70, 61]);
  game(11, 6, 12, [70, 88, 77], [69, 54, 80]);
  return d;
}
