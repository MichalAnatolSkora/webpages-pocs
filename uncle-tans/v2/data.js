// One restaurant, menu merged from the two photos in realMenuApp1/:
//   a147b418-….jpeg – Uncle Tan's Asian Express (name, address, hours, pho/wonton/starters/curry/fried rice/beef)
//   126e352d-….jpeg – items 26–67 of a second menu (chicken, duck, noodles, udon, pad thai, bun cha, veg, sides, drinks, desserts)
// Beef dishes appeared in both menus at the same price – kept once, with the longer description.
// Delivery fee / min order / ETA are not on either menu – placeholder values.
// Languages: `name` is the Polish name from the menu, `en` the English one printed next to it, `de` / `vi` translations.
// Descriptions and labels are { pl, en, de, vi }. UI strings are in i18n.js.

const WITH_RICE = {
  pl: 'Kapusta pekińska, marchew, cebula, por, pieczarki, grzyby mun, cukinia, brokuł, ryż biały, surówka.',
  en: 'Chinese cabbage, carrot, onion, leek, button mushrooms, wood ear mushrooms, zucchini, broccoli, white rice, salad.',
  de: 'Chinakohl, Karotte, Zwiebel, Lauch, Champignons, Mu-Err-Pilze, Zucchini, Brokkoli, weißer Reis, Rohkostsalat.',
  vi: 'Cải thảo, cà rốt, hành tây, tỏi tây, nấm mỡ, mộc nhĩ, bí ngòi, súp lơ xanh, cơm trắng, salad.',
};

const RESTAURANT = {
  name: "Uncle Tan's Asian Express",
  logo: '🍜',
  tagline: 'Big Flavor. Fast!',
  orderPrefix: 'UT',
  address: { street: 'Kotlarska 25A', city: '50-120 Wrocław' },
  hours: { open: '12:00', close: '22:00' },
  delivery: { fee: 7, minOrder: 40, eta: '45–60' }, // placeholder; eta in minutes
  pickup: { eta: '20' },                            // placeholder
};

const CATEGORIES = [
  { id: 'pho',      icon: '🍲', name: 'Phở & zupy', en: 'Phở & Soup', de: 'Phở & Suppen', vi: 'Phở & súp' },
  { id: 'wonton',   icon: '🥟', name: 'Zupa wonton', en: 'Wonton Soup', de: 'Wan-Tan-Suppe', vi: 'Súp hoành thánh',
    desc: {
      pl: 'Mielona wieprzowina, krewetki, kalmary, szczypiorek, kolendra, kiełki fasoli mung oraz aromatyczny bulion gotowany na kościach wołowych.',
      en: 'Minced pork, shrimp, squid, chives, coriander, mung bean sprouts and a fragrant broth simmered on beef bones.',
      de: 'Schweinehack, Garnelen, Tintenfisch, Schnittlauch, Koriander, Mungbohnensprossen und eine aromatische Brühe, auf Rinderknochen gekocht.',
      vi: 'Thịt lợn xay, tôm, mực, hành lá, rau mùi, giá đỗ và nước dùng thơm ninh từ xương bò.',
    } },
  { id: 'starters', icon: '🥢', name: 'Przystawki', en: 'Starters', de: 'Vorspeisen', vi: 'Món khai vị' },
  { id: 'curry',    icon: '🍛', name: 'Curry & krewetki', en: 'Curry & Shrimp', de: 'Curry & Garnelen', vi: 'Cà ri & tôm',
    desc: { pl: 'Curry do wyboru: żółte lub czerwone.', en: 'Choice of yellow or red curry.', de: 'Curry nach Wahl: gelb oder rot.', vi: 'Chọn cà ri vàng hoặc cà ri đỏ.' } },
  { id: 'chicken',  icon: '🍗', name: 'Filet z kurczaka', en: 'Chicken', de: 'Hähnchen', vi: 'Món gà' },
  { id: 'beef',     icon: '🥩', name: 'Wołowina', en: 'Beef', de: 'Rindfleisch', vi: 'Món bò' },
  { id: 'duck',     icon: '🦆', name: 'Kaczka', en: 'Duck', de: 'Ente', vi: 'Món vịt',
    desc: {
      pl: 'Chrupiąca kaczka bez kości, pokrojona w plastry, podawana z sosem warzywnym, ryżem białym i surówką.',
      en: 'Crispy boneless duck, sliced, served with vegetable sauce, white rice and salad.',
      de: 'Knusprige Ente ohne Knochen, in Scheiben geschnitten, mit Gemüsesoße, weißem Reis und Rohkostsalat.',
      vi: 'Vịt giòn rút xương, thái lát, ăn kèm sốt rau củ, cơm trắng và salad.',
    } },
  { id: 'rice',     icon: '🍚', name: 'Ryż smażony', en: 'Fried Rice', de: 'Gebratener Reis', vi: 'Cơm rang' },
  { id: 'noodles',  icon: '🍜', name: 'Makaron chiński', en: 'Chinese Noodles', de: 'Chinesische Nudeln', vi: 'Mì xào' },
  { id: 'udon',     icon: '🍝', name: 'Udon smażony', en: 'Stir-fried Udon', de: 'Gebratene Udon', vi: 'Udon xào' },
  { id: 'padthai',  icon: '🍤', name: 'Pad Thai', en: 'Pad Thai', de: 'Pad Thai', vi: 'Pad Thai',
    desc: {
      pl: 'Jajko, cebula, kapusta pekińska, fasolka szparagowa, orzechy, kolendra, cytryna.',
      en: 'Egg, onion, Chinese cabbage, green beans, nuts, coriander, lemon.',
      de: 'Ei, Zwiebel, Chinakohl, grüne Bohnen, Nüsse, Koriander, Zitrone.',
      vi: 'Trứng, hành tây, cải thảo, đậu cô ve, các loại hạt, rau mùi, chanh.',
    } },
  { id: 'buncha',   icon: '🥗', name: 'Bun cha', en: 'Bun Cha', de: 'Bún chả', vi: 'Bún chả' },
  { id: 'veg',      icon: '🥬', name: 'Dania warzywne', en: 'Vegetable Dishes', de: 'Gemüsegerichte', vi: 'Món chay' },
  { id: 'addons',   icon: '➕', name: 'Dodatki', en: 'Sides', de: 'Beilagen', vi: 'Món thêm' },
  { id: 'drinks',   icon: '🧋', name: 'Napoje', en: 'Drinks', de: 'Getränke', vi: 'Đồ uống' },
  { id: 'desserts', icon: '🍌', name: 'Desery', en: 'Desserts', de: 'Desserts', vi: 'Tráng miệng' },
];

const VARIANT_GROUPS = {
  curry: { label: { pl: 'Rodzaj curry', en: 'Curry type', de: 'Currysorte', vi: 'Loại cà ri' }, options: [
    { id: 'yellow', name: 'Żółte curry', en: 'Yellow curry', de: 'Gelbes Curry', vi: 'Cà ri vàng' },
    { id: 'red', name: 'Czerwone curry', en: 'Red curry', de: 'Rotes Curry', vi: 'Cà ri đỏ' },
  ] },
  mogu: { label: { pl: 'Smak', en: 'Flavour', de: 'Geschmack', vi: 'Hương vị' }, options: [
    { id: 'strawberry', name: 'Truskawka', en: 'Strawberry', de: 'Erdbeere', vi: 'Dâu tây' },
    { id: 'melon', name: 'Melon', en: 'Melon', de: 'Melone', vi: 'Dưa lưới' },
    { id: 'lychee', name: 'Liczi', en: 'Lychee', de: 'Litschi', vi: 'Vải' },
  ] },
};

const PRODUCTS = [
  { id: 'p1', cat: 'pho', price: 32, name: 'Phở wołowina', en: 'Beef Pho', de: 'Phở mit Rindfleisch', vi: 'Phở bò' },
  { id: 'p2', cat: 'pho', price: 26, name: 'Phở z kurczakiem', en: 'Chicken Pho', de: 'Phở mit Hähnchen', vi: 'Phở gà' },
  { id: 'p3', cat: 'pho', price: 22, name: 'Zupa kimchi z tofu i kurczakiem', en: 'Kimchi Soup with Tofu and Chicken',
    de: 'Kimchi-Suppe mit Tofu und Hähnchen', vi: 'Súp kim chi đậu phụ và gà' },

  { id: 'w1', cat: 'wonton', price: 18, name: 'Zupa wonton', en: 'Wonton Soup', de: 'Wan-Tan-Suppe', vi: 'Súp hoành thánh' },
  { id: 'w2', cat: 'wonton', price: 35, name: 'Zupa wonton z kurczakiem', en: 'Wonton Soup with Chicken', de: 'Wan-Tan-Suppe mit Hähnchen', vi: 'Súp hoành thánh gà' },
  { id: 'w3', cat: 'wonton', price: 40, name: 'Zupa wonton z wołowiną', en: 'Wonton Soup with Beef', de: 'Wan-Tan-Suppe mit Rindfleisch', vi: 'Súp hoành thánh bò' },
  { id: 'w4', cat: 'wonton', price: 45, name: 'Zupa wonton z krewetkami', en: 'Wonton Soup with Shrimp', de: 'Wan-Tan-Suppe mit Garnelen', vi: 'Súp hoành thánh tôm' },

  { id: 's1', cat: 'starters', price: 15, name: 'Sajgonki 3 szt.', en: 'Spring Rolls (3 pcs)', de: 'Frühlingsrollen (3 Stk.)', vi: 'Nem rán (3 chiếc)' },
  { id: 's2', cat: 'starters', price: 15, name: 'Sajgonki wege 3 szt.', en: 'Vegan Spring Rolls (3 pcs)', de: 'Vegane Frühlingsrollen (3 Stk.)', vi: 'Nem rán chay (3 chiếc)', veg: true },
  { id: 's3', cat: 'starters', price: 17, name: 'Pierożki „Hacao” 5 szt.', en: 'Hacao Dumplings (5 pcs)', de: 'Hacao-Teigtaschen (5 Stk.)', vi: 'Há cảo (5 chiếc)' },
  { id: 's4', cat: 'starters', price: 17, name: 'Pierożki „SiuMai” 5 szt.', en: 'Siu Mai Dumplings (5 pcs)', de: 'Siu-Mai-Teigtaschen (5 Stk.)', vi: 'Xíu mại (5 chiếc)' },
  { id: 's5', cat: 'starters', price: 18, name: 'Spring roll 2 szt.', en: 'Fresh Spring Rolls (2 pcs)', de: 'Sommerrollen (2 Stk.)', vi: 'Gỏi cuốn (2 chiếc)',
    desc: {
      pl: 'Makaron ryżowy, wieprzowina, krewetki, ogórek, sałata.',
      en: 'Rice noodles, pork, shrimp, cucumber, lettuce.',
      de: 'Reisnudeln, Schweinefleisch, Garnelen, Gurke, Salat.',
      vi: 'Bún, thịt lợn, tôm, dưa chuột, xà lách.',
    } },

  { id: 'c1', cat: 'curry', price: 40, name: 'Curry z krewetkami', en: 'Shrimp Curry', de: 'Curry mit Garnelen', vi: 'Cà ri tôm', variants: 'curry' },
  { id: 'c2', cat: 'curry', price: 30, name: 'Curry z tofu', en: 'Tofu Curry', de: 'Curry mit Tofu', vi: 'Cà ri đậu phụ', variants: 'curry', veg: true },
  { id: 'c3', cat: 'curry', price: 32, name: 'Curry z kurczakiem', en: 'Chicken Curry', de: 'Curry mit Hähnchen', vi: 'Cà ri gà', variants: 'curry' },
  { id: 'c4', cat: 'curry', price: 40, name: 'Krewetki chrupiące 7 szt.', en: 'Crispy Shrimp (7 pcs)', de: 'Knusprige Garnelen (7 Stk.)', vi: 'Tôm chiên giòn (7 con)' },
  { id: 'c5', cat: 'curry', price: 41, name: 'Krewetki chrupiące w sosie słodko-kwaśnym', en: 'Crispy Shrimp in Sweet & Sour Sauce',
    de: 'Knusprige Garnelen in Süß-Sauer-Soße', vi: 'Tôm chiên giòn sốt chua ngọt' },

  { id: 'k1', cat: 'chicken', price: 30, name: 'Kurczak chrupiący', en: 'Crispy chicken', de: 'Knuspriges Hähnchen', vi: 'Gà chiên giòn',
    desc: {
      pl: 'Kapusta pekińska, marchew, cebula, por, ryż biały, surówka.',
      en: 'Chinese cabbage, carrot, onion, leek, white rice, salad.',
      de: 'Chinakohl, Karotte, Zwiebel, Lauch, weißer Reis, Rohkostsalat.',
      vi: 'Cải thảo, cà rốt, hành tây, tỏi tây, cơm trắng, salad.',
    } },
  { id: 'k2', cat: 'chicken', price: 31, name: 'Kurczak Wietnam pikantny', en: 'Spicy Vietnamese chicken',
    de: 'Scharfes Hähnchen nach vietnamesischer Art', vi: 'Gà cay kiểu Việt', desc: WITH_RICE, spicy: true },
  { id: 'k3', cat: 'chicken', price: 30, name: 'Kurczak słodko-kwaśny', en: 'Sweet & sour chicken', de: 'Hähnchen süß-sauer', vi: 'Gà sốt chua ngọt', desc: WITH_RICE },
  { id: 'k4', cat: 'chicken', price: 31, name: 'Kurczak Gong Bao z orzeszkami', en: 'Kung Pao chicken with peanuts',
    de: 'Kung-Pao-Hähnchen mit Erdnüssen', vi: 'Gà xào Cung Bảo với lạc', desc: WITH_RICE },
  { id: 'k5', cat: 'chicken', price: 30, name: 'Kurczak Hongkong', en: 'Hong Kong chicken', de: 'Hähnchen Hongkong-Art', vi: 'Gà kiểu Hồng Kông', desc: WITH_RICE },

  { id: 'b1', cat: 'beef', price: 38, name: 'Wołowina Vietnam pikantna', en: 'Spicy Vietnamese Beef',
    de: 'Scharfes Rindfleisch nach vietnamesischer Art', vi: 'Bò cay kiểu Việt', spicy: true,
    desc: {
      pl: 'Kapusta pekińska, marchew, cebula, por, grzyby, cukinia i brokuł, podawane z ryżem białym i świeżą surówką.',
      en: 'Chinese cabbage, carrot, onion, leek, mushrooms, zucchini and broccoli, served with white rice and a fresh salad.',
      de: 'Chinakohl, Karotte, Zwiebel, Lauch, Pilze, Zucchini und Brokkoli, serviert mit weißem Reis und frischem Rohkostsalat.',
      vi: 'Cải thảo, cà rốt, hành tây, tỏi tây, nấm, bí ngòi và súp lơ xanh, ăn kèm cơm trắng và salad tươi.',
    } },
  { id: 'b2', cat: 'beef', price: 38, name: 'Wołowina z czosnkiem', en: 'Garlic Beef', de: 'Rindfleisch mit Knoblauch', vi: 'Bò xào tỏi', desc: WITH_RICE },

  { id: 'd1', cat: 'duck', price: 40, name: 'Kaczka w sosie słodko-kwaśnym', en: 'Duck in sweet & sour sauce', de: 'Ente in Süß-Sauer-Soße', vi: 'Vịt sốt chua ngọt' },
  { id: 'd2', cat: 'duck', price: 40, name: 'Kaczka w sosie teriyaki', en: 'Duck in teriyaki sauce', de: 'Ente in Teriyaki-Soße', vi: 'Vịt sốt teriyaki' },

  { id: 'r1', cat: 'rice', price: 24, name: 'Smażony ryż z czosnkiem i jajkiem', en: 'Fried Rice with Garlic and Egg',
    de: 'Gebratener Reis mit Knoblauch und Ei', vi: 'Cơm rang tỏi trứng' },
  { id: 'r2', cat: 'rice', price: 30, name: 'Smażony ryż z kurczakiem', en: 'Fried Rice with Chicken', de: 'Gebratener Reis mit Hähnchen', vi: 'Cơm rang gà' },
  { id: 'r3', cat: 'rice', price: 35, name: 'Smażony ryż z wołowiną', en: 'Fried Rice with Beef', de: 'Gebratener Reis mit Rindfleisch', vi: 'Cơm rang bò' },
  { id: 'r4', cat: 'rice', price: 40, name: 'Smażony ryż z owocami morza', en: 'Fried Rice with Seafood', de: 'Gebratener Reis mit Meeresfrüchten', vi: 'Cơm rang hải sản' },

  { id: 'n1', cat: 'noodles', price: 32, name: 'Makaron chiński z kurczakiem', en: 'Chinese noodles with chicken', de: 'Chinesische Nudeln mit Hähnchen', vi: 'Mì xào gà' },
  { id: 'n2', cat: 'noodles', price: 35, name: 'Makaron chiński z wołowiną', en: 'Chinese noodles with beef', de: 'Chinesische Nudeln mit Rindfleisch', vi: 'Mì xào bò' },
  { id: 'n3', cat: 'noodles', price: 30, name: 'Makaron chiński z tofu', en: 'Chinese noodles with tofu', de: 'Chinesische Nudeln mit Tofu', vi: 'Mì xào đậu phụ', veg: true },
  { id: 'n4', cat: 'noodles', price: 40, name: 'Makaron chiński z krewetkami', en: 'Chinese noodles with shrimp', de: 'Chinesische Nudeln mit Garnelen', vi: 'Mì xào tôm' },

  { id: 'u1', cat: 'udon', price: 30, name: 'Udon smażony z tofu', en: 'Stir-fried udon with tofu', de: 'Gebratene Udon mit Tofu', vi: 'Udon xào đậu phụ', veg: true },
  { id: 'u2', cat: 'udon', price: 35, name: 'Udon smażony z wołowiną', en: 'Stir-fried udon with beef', de: 'Gebratene Udon mit Rindfleisch', vi: 'Udon xào bò' },
  { id: 'u3', cat: 'udon', price: 32, name: 'Udon smażony z kurczakiem', en: 'Stir-fried udon with chicken', de: 'Gebratene Udon mit Hähnchen', vi: 'Udon xào gà' },
  { id: 'u4', cat: 'udon', price: 40, name: 'Udon smażony z krewetkami', en: 'Stir-fried udon with shrimp', de: 'Gebratene Udon mit Garnelen', vi: 'Udon xào tôm' },

  { id: 't1', cat: 'padthai', price: 32, name: 'Pad Thai z kurczakiem', en: 'Pad Thai with chicken', de: 'Pad Thai mit Hähnchen', vi: 'Pad Thai gà' },
  { id: 't2', cat: 'padthai', price: 28, name: 'Pad Thai z tofu', en: 'Pad Thai with tofu', de: 'Pad Thai mit Tofu', vi: 'Pad Thai đậu phụ', veg: true },
  { id: 't3', cat: 'padthai', price: 35, name: 'Pad Thai z wołowiną', en: 'Pad Thai with beef', de: 'Pad Thai mit Rindfleisch', vi: 'Pad Thai bò' },
  { id: 't4', cat: 'padthai', price: 40, name: 'Pad Thai z krewetkami', en: 'Pad Thai with shrimp', de: 'Pad Thai mit Garnelen', vi: 'Pad Thai tôm' },

  { id: 'bc1', cat: 'buncha', price: 35, name: 'Bun cha z grillowaną wieprzowiną', en: 'Bun cha with grilled pork',
    de: 'Bún chả mit gegrilltem Schweinefleisch', vi: 'Bún chả thịt nướng',
    desc: {
      pl: 'Grillowana wieprzowina, sajgonki, makaron ryżowy, świeże warzywa i sałata.',
      en: 'Grilled pork, spring rolls, rice noodles, fresh vegetables and lettuce.',
      de: 'Gegrilltes Schweinefleisch, Frühlingsrollen, Reisnudeln, frisches Gemüse und Salat.',
      vi: 'Thịt lợn nướng, nem rán, bún, rau sống và xà lách.',
    } },
  { id: 'bc2', cat: 'buncha', price: 42, name: 'Bun cha z owocami morza', en: 'Bun cha with seafood',
    de: 'Bún chả mit Meeresfrüchten', vi: 'Bún chả hải sản',
    desc: {
      pl: 'Z owocami morza, sajgonkami, sałatą i orzeszkami ziemnymi.',
      en: 'With seafood, spring rolls, lettuce and peanuts.',
      de: 'Mit Meeresfrüchten, Frühlingsrollen, Salat und Erdnüssen.',
      vi: 'Với hải sản, nem rán, xà lách và lạc rang.',
    } },

  { id: 'v1', cat: 'veg', price: 27, name: 'Makaron chiński z warzywami', en: 'Chinese noodles with vegetables', de: 'Chinesische Nudeln mit Gemüse', vi: 'Mì xào rau củ', veg: true },
  { id: 'v2', cat: 'veg', price: 27, name: 'Makaron udon z warzywami', en: 'Udon noodles with vegetables', de: 'Udon mit Gemüse', vi: 'Udon xào rau củ', veg: true },
  // printed menu repeats "Stir-fried bok choy with rice" as the EN line here – fixed
  { id: 'v3', cat: 'veg', price: 27, name: 'Pad Thai z warzywami', en: 'Pad Thai with vegetables', de: 'Pad Thai mit Gemüse', vi: 'Pad Thai rau củ', veg: true },
  { id: 'v4', cat: 'veg', price: 27, name: 'Smażony pak choi z ryżem', en: 'Stir-fried bok choy with rice', de: 'Gebratener Pak Choi mit Reis', vi: 'Cải chíp xào ăn kèm cơm', veg: true },

  { id: 'a1', cat: 'addons', price: 12, name: 'Kurczak chrupiący', en: 'Crispy chicken', de: 'Knuspriges Hähnchen', vi: 'Gà chiên giòn' },
  { id: 'a2', cat: 'addons', price: 22, name: 'Krewetki chrupiące 4 szt.', en: 'Crispy shrimp (4 pcs)', de: 'Knusprige Garnelen (4 Stk.)', vi: 'Tôm chiên giòn (4 con)' },
  { id: 'a3', cat: 'addons', price: 17, name: 'Wołowina', en: 'Beef', de: 'Rindfleisch', vi: 'Thịt bò' },
  { id: 'a4', cat: 'addons', price: 15, name: 'Wieprzowina', en: 'Pork', de: 'Schweinefleisch', vi: 'Thịt lợn' },
  { id: 'a5', cat: 'addons', price: 20, name: 'Kaczka chrupiąca', en: 'Crispy duck', de: 'Knusprige Ente', vi: 'Vịt chiên giòn' },

  { id: 'x1', cat: 'drinks', price: 20, name: 'Kawa wietnamska', en: 'Vietnamese coffee', de: 'Vietnamesischer Kaffee', vi: 'Cà phê Việt Nam' },
  { id: 'x2', cat: 'drinks', price: 20, name: 'Kumquat iced tea', en: 'Kumquat iced tea', de: 'Kumquat-Eistee', vi: 'Trà quất' },
  { id: 'x3', cat: 'drinks', price: 20, name: 'Tamarind & pineapple tea', en: 'Tamarind & pineapple tea', de: 'Tamarinden-Ananas-Tee', vi: 'Trà me dứa' },
  { id: 'x4', cat: 'drinks', price: 10, name: 'Fuzetea brzoskwiniowa 0,5 l', en: 'Fuze Tea peach 0.5 l', de: 'Fuze Tea Pfirsich 0,5 l', vi: 'Fuze Tea đào 0,5 l' },
  { id: 'x5', cat: 'drinks', price: 10, name: 'Fuzetea lemoniada 0,5 l', en: 'Fuze Tea lemonade 0.5 l', de: 'Fuze Tea Limonade 0,5 l', vi: 'Fuze Tea chanh 0,5 l' },
  { id: 'x6', cat: 'drinks', price: 10, name: 'Sok pomarańczowy 0,33 l', en: 'Orange juice 0.33 l', de: 'Orangensaft 0,33 l', vi: 'Nước cam 0,33 l' },
  { id: 'x7', cat: 'drinks', price: 10, name: 'Mogu', en: 'Mogu Mogu', de: 'Mogu Mogu', vi: 'Mogu Mogu', variants: 'mogu' },
  { id: 'x8', cat: 'drinks', price: 12, name: 'Piwo Żywiec', en: 'Żywiec beer', de: 'Żywiec Bier', vi: 'Bia Żywiec', alcohol: true },

  { id: 'e1', cat: 'desserts', price: 10, name: 'Chrupiące banany w cieście', en: 'Crispy battered bananas', de: 'Knusprige Bananen im Teigmantel', vi: 'Chuối chiên giòn' },
  { id: 'e2', cat: 'desserts', price: 10, name: 'Tofu deserowe po singapursku', en: 'Singapore-style tofu pudding', de: 'Tofu-Pudding nach Singapur-Art', vi: 'Tào phớ kiểu Singapore' },
];
