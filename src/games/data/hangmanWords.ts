/** Curated word bank for the Hangman mini-game. ~110 anime/VN/Japanese-culture terms with category hints. */

export interface HangmanWord {
  word: string
  hint: string
}

export const HANGMAN_WORDS: HangmanWord[] = [
  // Food (~25)
  { word: 'taiyaki', hint: "It's food-related~ A fish-shaped treat filled with sweet bean paste — 7 letters!" },
  { word: 'onigiri', hint: "It's food-related~ A rice ball wrapped in nori seaweed, starts with 'O'~" },
  { word: 'ramen', hint: "It's food-related~ A warm noodle soup with broth, toppings, and wheat noodles — 5 letters~" },
  { word: 'sushi', hint: "It's food-related~ Vinegared rice topped with raw fish — everyone knows this one!" },
  { word: 'mochi', hint: "It's food-related~ Chewy rice cake made from pounded glutinous rice — 5 letters~" },
  { word: 'takoyaki', hint: "It's food-related~ Round balls with octopus inside, a street food from Osaka!" },
  {
    word: 'tempura',
    hint: "It's food-related~ Seafood or veggies coated in light batter and deep-fried — starts with 'T'~"
  },
  { word: 'udon', hint: "It's food-related~ Thick, chewy wheat noodles served in hot broth — only 4 letters!" },
  { word: 'matcha', hint: "It's food-related~ Ground green tea powder used in lattes and sweets — 6 letters~" },
  { word: 'dango', hint: "It's food-related~ Sweet rice dumplings on a skewer, often three in a row — 5 letters!" },
  { word: 'yakitori', hint: "It's food-related~ Grilled chicken pieces on bamboo skewers — 'yaki' means grilled!" },
  { word: 'katsudon', hint: "It's food-related~ A breaded pork cutlet served on top of a bowl of rice — 8 letters!" },
  {
    word: 'okonomiyaki',
    hint: "It's food-related~ A savory pancake from Osaka you can customize — starts with 'O', 11 letters!"
  },
  {
    word: 'gyoza',
    hint: "It's food-related~ Pan-fried dumplings with a crispy bottom, originally from China — 5 letters!"
  },
  { word: 'teriyaki', hint: "It's food-related~ A sweet soy sauce glaze used on grilled meat — ends in '-yaki'~" },
  { word: 'wagashi', hint: "It's food-related~ Traditional Japanese confections served with tea — starts with 'W'!" },
  { word: 'daifuku', hint: "It's food-related~ A mochi ball stuffed with sweet red bean paste — 7 letters!" },
  {
    word: 'dorayaki',
    hint: "It's food-related~ Two fluffy pancakes sandwiching red bean paste — Doraemon's favorite!"
  },
  { word: 'karaage', hint: "It's food-related~ Japanese-style fried chicken marinated in soy and ginger — 7 letters!" },
  {
    word: 'nikujaga',
    hint: "It's food-related~ A comforting home-cooked stew with meat and potatoes — 'niku' means meat!"
  },
  { word: 'tonkatsu', hint: "It's food-related~ Deep-fried breaded pork cutlet — 'ton' means pork, starts with 'T'!" },
  {
    word: 'edamame',
    hint: "It's food-related~ Young green soybeans boiled in their pods — 7 letters, starts with 'E'~"
  },
  { word: 'wasabi', hint: "It's food-related~ That spicy green paste served with sushi — 6 letters!" },
  {
    word: 'umeboshi',
    hint: "It's food-related~ Extremely sour pickled plums, often put inside onigiri — starts with 'U'!"
  },
  {
    word: 'natto',
    hint: "It's food-related~ Sticky fermented soybeans with a strong smell — love it or hate it, 5 letters!"
  },

  // Anime/Manga terms (~25)
  { word: 'shounen', hint: "It's an anime genre~ Aimed at young boys, think Naruto and Dragon Ball — 7 letters!" },
  { word: 'shoujo', hint: "It's an anime genre~ Romance and sparkles for young girls — rhymes with 'dojo'~" },
  {
    word: 'isekai',
    hint: "It's an anime genre~ Getting transported to another world — literally means 'different world', 6 letters!"
  },
  { word: 'mecha', hint: "It's an anime genre~ Giant piloted robots like Gundam and Evangelion — 5 letters!" },
  { word: 'chibi', hint: "It's an anime art style~ Super small and cute proportions with a big head — 5 letters!" },
  { word: 'kawaii', hint: "It's a Japanese word used in anime~ Means 'cute' — 6 letters, starts with 'K'~" },
  { word: 'otaku', hint: "It's an anime culture term~ Someone deeply obsessed with anime and manga — 5 letters!" },
  { word: 'sensei', hint: "It's a Japanese honorific~ Used for teachers, doctors, and masters — 6 letters!" },
  { word: 'senpai', hint: "It's a Japanese honorific~ An upperclassman or senior you look up to — 'notice me, ___!'~" },
  { word: 'kohai', hint: "It's a Japanese honorific~ The opposite of senpai — a junior or underclassman, 5 letters!" },
  {
    word: 'tsundere',
    hint: "It's an anime character type~ 'It's not like I like you or anything!' — cold outside, warm inside!"
  },
  {
    word: 'yandere',
    hint: "It's an anime character type~ Sweet and loving... until they snap — dangerously obsessive, starts with 'Y'!"
  },
  {
    word: 'kuudere',
    hint: "It's an anime character type~ Cool, calm, and emotionless on the surface — 'kuu' from 'cool', 7 letters!"
  },
  {
    word: 'dandere',
    hint: "It's an anime character type~ Quiet and shy until they warm up to you — starts with 'D', 7 letters!"
  },
  { word: 'bishoujo', hint: "It's an anime term~ Literally 'beautiful girl' — 8 letters, starts with 'B'!" },
  {
    word: 'bishounen',
    hint: "It's an anime term~ A beautiful, often androgynous young man — 9 letters, starts with 'B'!"
  },
  { word: 'mangaka', hint: "It's an anime/manga term~ A person who creates manga — like Oda or Toriyama, 7 letters!" },
  { word: 'seiyuu', hint: "It's an anime industry term~ A Japanese voice actor — 6 letters, starts with 'S'!" },
  {
    word: 'sakuga',
    hint: "It's an anime production term~ Exceptionally well-animated sequences that fans go crazy over — 6 letters!"
  },
  {
    word: 'seinen',
    hint: "It's an anime genre~ Aimed at adult men with more mature themes — rhymes with 'shounen' but for grown-ups!"
  },
  {
    word: 'josei',
    hint: "It's an anime genre~ Aimed at adult women with realistic romance — 5 letters, starts with 'J'~"
  },
  { word: 'harem', hint: "It's an anime genre~ One protagonist surrounded by multiple love interests — 5 letters!" },
  {
    word: 'ecchi',
    hint: "It's an anime genre~ Suggestive and a bit naughty but not explicit — 5 letters, starts with 'E'~"
  },
  {
    word: 'cosplay',
    hint: "It's an anime culture term~ Dressing up in costume as a fictional character — 'costume' + 'play'!"
  },
  { word: 'waifu', hint: "It's an anime culture term~ A fictional character someone calls their 'wife' — 5 letters!" },

  // Japanese culture (~25)
  {
    word: 'kimono',
    hint: "It's Japanese culture~ A traditional T-shaped full-length robe tied with an obi — 6 letters!"
  },
  {
    word: 'yukata',
    hint: "It's Japanese culture~ A casual cotton kimono worn at summer festivals — 6 letters, starts with 'Y'~"
  },
  {
    word: 'torii',
    hint: "It's Japanese culture~ Those red gates you see at Shinto shrine entrances — starts with 'T', 5 letters!"
  },
  {
    word: 'sakura',
    hint: "It's Japanese culture~ Cherry blossoms that bloom in spring — Japan's most iconic flower, 6 letters~"
  },
  {
    word: 'hanami',
    hint: "It's Japanese culture~ The tradition of picnicking under cherry blossom trees — 'hana' means flower!"
  },
  {
    word: 'matsuri',
    hint: "It's Japanese culture~ A traditional Japanese festival with food stalls and games — 7 letters!"
  },
  {
    word: 'origami',
    hint: "It's Japanese culture~ The art of folding paper into shapes like cranes — 7 letters, starts with 'O'!"
  },
  {
    word: 'bonsai',
    hint: "It's Japanese culture~ The art of growing miniature trees in pots — 6 letters, starts with 'B'~"
  },
  { word: 'futon', hint: "It's Japanese culture~ A foldable sleeping mattress laid on tatami floors — 5 letters!" },
  {
    word: 'tatami',
    hint: "It's Japanese culture~ Woven rush straw mats used as flooring in traditional rooms — 6 letters!"
  },
  {
    word: 'shoji',
    hint: "It's Japanese culture~ Sliding doors made of translucent paper and wood frames — 5 letters, starts with 'S'~"
  },
  {
    word: 'ikebana',
    hint: "It's Japanese culture~ The traditional art of arranging flowers — 'ike' means to arrange, 7 letters!"
  },
  {
    word: 'kabuki',
    hint: "It's Japanese culture~ A classical form of theater with elaborate makeup and costumes — 6 letters!"
  },
  { word: 'samurai', hint: "It's Japanese culture~ Noble warriors who served feudal lords in old Japan — 7 letters!" },
  {
    word: 'ninja',
    hint: "It's Japanese culture~ Stealthy covert agents skilled in espionage — 5 letters, everyone knows this one!"
  },
  {
    word: 'geisha',
    hint: "It's Japanese culture~ A traditional entertainer trained in dance, music, and conversation — 6 letters!"
  },
  { word: 'onsen', hint: "It's Japanese culture~ Natural volcanic hot spring baths — so relaxing, 5 letters~" },
  { word: 'karate', hint: "It's Japanese culture~ A martial art meaning 'empty hand' — 6 letters, starts with 'K'!" },
  {
    word: 'sumo',
    hint: "It's Japanese culture~ Traditional wrestling where you push your opponent out of a ring — only 4 letters!"
  },
  {
    word: 'kendama',
    hint: "It's Japanese culture~ A cup-and-ball wooden toy that requires skill — 7 letters, starts with 'K'!"
  },
  {
    word: 'daruma',
    hint: "It's Japanese culture~ A round red doll you paint one eye on when making a wish — 6 letters!"
  },
  {
    word: 'tanabata',
    hint: "It's Japanese culture~ The star festival on July 7th celebrating two lovers reuniting — 8 letters!"
  },
  {
    word: 'hanabi',
    hint: "It's Japanese culture~ Literally 'fire flowers' — what the Japanese call fireworks, 6 letters!"
  },
  {
    word: 'kotatsu',
    hint: "It's Japanese culture~ A heated table with a blanket over it, perfect for winter — 7 letters, starts with 'K'~"
  },
  {
    word: 'engawa',
    hint: "It's Japanese culture~ A wooden veranda along the edge of a traditional house — 6 letters, starts with 'E'!"
  },

  // Visual novel terms (~25)
  { word: 'otome', hint: "It's a VN genre~ Games targeted at women, with romance and handsome love interests!" },
  { word: 'otoge', hint: "It's a VN slang~ Short for 'otome game' — 5 letters!" },
  { word: 'charage', hint: "It's a VN type~ Focused on character interactions over plot — 'chara' + 'ge'!" },
  { word: 'nakige', hint: "It's a VN type~ Designed to make you cry... 'naki' means crying!" },
  { word: 'moege', hint: "It's a VN type~ All about cute 'moe' characters and warm feelings~" },
  { word: 'kamige', hint: "It's VN slang~ The highest praise — a 'god-tier' game!" },
  { word: 'kusoge', hint: "It's VN slang~ The opposite of kamige... a 'trash' game!" },
  { word: 'heroine', hint: "It's a VN term~ The main female love interest on a route — 7 letters!" },
  { word: 'route', hint: "It's a VN term~ A specific story path dedicated to one character!" },
  { word: 'ending', hint: "It's a VN term~ The conclusion of a story path — can be happy, sad, or bad!" },
  { word: 'prologue', hint: "It's a VN term~ The common path before routes branch off — starts with 'P'!" },
  { word: 'epilogue', hint: "It's a VN term~ A scene after the ending, often showing the future~" },
  { word: 'flagging', hint: "It's a VN term~ Making the right choices to unlock a character's route!" },
  { word: 'walkthrough', hint: "It's a VN term~ A guide telling you which choices to pick!" },
  { word: 'backlog', hint: "It's a VN feature~ Scrolling back to re-read previous dialogue — 7 letters!" },
  { word: 'sprite', hint: "It's a VN term~ The character art that appears on screen during dialogue!" },
  { word: 'textbox', hint: "It's a VN feature~ The UI element where dialogue text appears!" },
  { word: 'scenario', hint: "It's a VN term~ The script or story written by the writer — 8 letters!" },
  { word: 'fandisc', hint: "It's a VN term~ A sequel disc with extra stories and fan service content!" },
  { word: 'confession', hint: "It's a VN scene~ When feelings are finally put into words — 'kokuhaku'!" },
  { word: 'transfer', hint: "It's a VN trope~ A type of student who arrives mid-year and changes everything!" },
  { word: 'ciallo', hint: "It's a VN meme~ A greeting from Yuzusoft's Sanoba Witch — Ciallo~(angle・omega＜)star!" },
  {
    word: 'chuuni',
    hint: "It's a VN character type~ Someone who acts like they have special powers... 'eighth-grader syndrome'!"
  },
  { word: 'imouto', hint: "It's a VN archetype~ The little sister character — often a heroine!" },
  { word: 'osananajimi', hint: "It's a VN archetype~ The childhood friend who's always been by your side!" },

  // General Japanese words (~10)
  { word: 'sugoi', hint: "It's a Japanese word~ Means amazing or awesome — 5 letters, starts with 'S'!" },
  { word: 'arigatou', hint: "It's a Japanese word~ The way to say 'thank you' in Japanese — 8 letters!" },
  {
    word: 'ganbatte',
    hint: "It's a Japanese word~ It means 'do your best!' or 'good luck!' — 8 letters, starts with 'G'!"
  },
  {
    word: 'itadakimasu',
    hint: "It's a Japanese word~ Said before eating a meal, means 'I humbly receive' — 11 letters!"
  },
  { word: 'okaeri', hint: "It's a Japanese word~ Said to welcome someone home — paired with 'tadaima', 6 letters!" },
  { word: 'tadaima', hint: "It's a Japanese word~ Said when arriving home — paired with 'okaeri', 7 letters!" },
  { word: 'sayonara', hint: "It's a Japanese word~ A farewell greeting — 8 letters, starts with 'S'!" },
  {
    word: 'konnichiwa',
    hint: "It's a Japanese word~ The standard daytime greeting meaning 'good afternoon' — 10 letters!"
  },
  { word: 'oyasumi', hint: "It's a Japanese word~ Said before going to sleep, means 'good night' — 7 letters!" },
  { word: 'ohayo', hint: "It's a Japanese word~ A casual morning greeting, short for 'ohayou gozaimasu' — 5 letters!" }
]
