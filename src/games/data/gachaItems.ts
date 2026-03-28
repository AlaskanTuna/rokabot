/** Gacha item catalog with rarity tiers and Roka's in-character commentary. */

export type GachaRarity = 'common' | 'uncommon' | 'rare' | 'legendary'

export interface GachaItem {
  id: string
  name: string
  rarity: GachaRarity
  description: string
}

export const RARITY_WEIGHTS: Record<GachaRarity, number> = {
  common: 60,
  uncommon: 25,
  rare: 12,
  legendary: 3
}

export const RARITY_COLORS: Record<GachaRarity, number> = {
  common: 0xaaaaaa,
  uncommon: 0x55cc55,
  rare: 0x5555ff,
  legendary: 0xffaa00
}

export const RARITY_EMOJI: Record<GachaRarity, string> = {
  common: '\u26AA',
  uncommon: '\uD83D\uDFE2',
  rare: '\uD83D\uDD35',
  legendary: '\uD83C\uDF1F'
}

export const GACHA_ITEMS: GachaItem[] = [
  // ── Common (22 items) ──────────────────────────────────────────────

  {
    id: 'fortune_lucky',
    name: 'Lucky Day Fortune',
    rarity: 'common',
    description: "Today's your lucky day~ Something nice might happen if you keep your eyes open! \u266A"
  },
  {
    id: 'fortune_cloudy',
    name: 'Cloudy Skies Fortune',
    rarity: 'common',
    description:
      "The clouds are rolling in, but that doesn't mean your day will be gloomy! Sometimes the best naps happen on cloudy days~"
  },
  {
    id: 'fortune_sunny',
    name: 'Sunshine Blessing',
    rarity: 'common',
    description: "Warm sunshine all day~ Perfect weather for drying laundry! ...I mean, for going on a walk! Fufu~"
  },
  {
    id: 'fortune_rainy',
    name: 'Rainy Day Comfort',
    rarity: 'common',
    description:
      "Rain today~ Stay cozy inside with a warm drink, okay? I'll make some hot tea if you come by the shop."
  },
  {
    id: 'fortune_wind',
    name: 'Gentle Breeze Fortune',
    rarity: 'common',
    description: 'A pleasant breeze is coming your way~ Let it carry away all your worries! \u266A'
  },
  {
    id: 'tip_rice',
    name: "Roka's Rice Tip",
    rarity: 'common',
    description:
      'Did you know~ the secret to fluffy rice is rinsing it three times and letting it soak for 30 minutes before cooking! Try it sometime!'
  },
  {
    id: 'tip_tea',
    name: "Roka's Tea Advice",
    rarity: 'common',
    description:
      "Green tea should never be brewed with boiling water! Wait until it's around 80\u00B0C~ otherwise it gets bitter. Trust me on this one!"
  },
  {
    id: 'tip_onigiri',
    name: 'Onigiri Making Tip',
    rarity: 'common',
    description:
      'The trick to good onigiri is wet hands with a little salt! Press firmly but gently~ treat the rice like you would a small bird.'
  },
  {
    id: 'tip_egg',
    name: 'Perfect Egg Wisdom',
    rarity: 'common',
    description:
      "For a perfect soft-boiled egg, 6 minutes and 30 seconds! I've timed it so many times I can feel it in my bones now~"
  },
  {
    id: 'tip_miso',
    name: 'Miso Soup Secret',
    rarity: 'common',
    description: 'Never boil miso soup after adding the miso paste! It ruins the flavor~ Just stir it in gently at the end.'
  },
  {
    id: 'quote_morning',
    name: 'Morning Greeting',
    rarity: 'common',
    description: 'Good morning~ Have you eaten breakfast yet? You should eat properly! A good day starts with a full tummy!'
  },
  {
    id: 'quote_evening',
    name: 'Evening Reflection',
    rarity: 'common',
    description:
      "The evening sky is so pretty today~ I hope you had a good day. Even if you didn't, tomorrow is a fresh start! \u266A"
  },
  {
    id: 'quote_effort',
    name: 'Words of Encouragement',
    rarity: 'common',
    description:
      "You're doing your best, and that's what matters! Even small steps forward count~ I believe in you! \u2606"
  },
  {
    id: 'quote_rest',
    name: 'Rest Reminder',
    rarity: 'common',
    description:
      "Hey~ don't push yourself too hard, okay? Even Roka takes breaks sometimes! ...Though usually someone has to remind me too."
  },
  {
    id: 'mood_happy',
    name: 'Happy Mood Reading',
    rarity: 'common',
    description:
      "I can feel it~ today is going to be a really happy day for you! Your smile will be contagious~ spread it around! \u266A"
  },
  {
    id: 'mood_calm',
    name: 'Calm Mood Reading',
    rarity: 'common',
    description:
      'A peaceful energy surrounds you today~ Take things slow and enjoy the little moments. Maybe have some tea with me?'
  },
  {
    id: 'mood_energetic',
    name: 'Energetic Mood Reading',
    rarity: 'common',
    description:
      "Wow, so much energy today~! Channel it into something fun! Maybe cleaning? ...No? Just me? Okay~ \u266A"
  },
  {
    id: 'observe_cat',
    name: "Roka's Cat Observation",
    rarity: 'common',
    description:
      "I saw the most adorable cat near the shop today~ It was sleeping in a sunbeam! I wanted to pet it but I didn't want to wake it up..."
  },
  {
    id: 'observe_flower',
    name: "Roka's Flower Note",
    rarity: 'common',
    description:
      "The flowers by the road are blooming so beautifully~ Nature really is amazing, don't you think? I wish I could bring some inside the shop!"
  },
  {
    id: 'observe_sky',
    name: "Roka's Sky Gazing",
    rarity: 'common',
    description:
      "I spent a few minutes watching the clouds today~ One of them looked like a rice ball! Or maybe I was just hungry..."
  },
  {
    id: 'fortune_study',
    name: 'Study Fortune',
    rarity: 'common',
    description:
      "A good day for learning something new! Your brain is extra sharp today~ ...Unlike mine. I keep forgetting where I put the broom."
  },
  {
    id: 'fortune_social',
    name: 'Friendship Fortune',
    rarity: 'common',
    description:
      'Someone might reach out to you today~ Or maybe you should reach out to them! Good friendships need a little watering, like plants!'
  },

  // ── Uncommon (11 items) ────────────────────────────────────────────

  {
    id: 'trivia_hoori',
    name: 'Hoori Mountain Legend',
    rarity: 'uncommon',
    description:
      "Did you know~ the mountain behind the shop has an old legend about a sacred fox? The elders still leave offerings sometimes..."
  },
  {
    id: 'trivia_festival',
    name: 'Local Festival Story',
    rarity: 'uncommon',
    description:
      "Every summer we have a festival at the shrine~ I always help with the food stalls! My yakitori is pretty popular, if I do say so myself! \u266A"
  },
  {
    id: 'trivia_shop',
    name: 'Sweets Shop History',
    rarity: 'uncommon',
    description:
      "Our family shop has been here for three generations! Grandpa used to say the secret ingredient in everything is love~ ...and proper measurements."
  },
  {
    id: 'season_spring',
    name: 'Spring Memory',
    rarity: 'uncommon',
    description:
      "Spring is my favorite season~ The cherry blossoms outside the shop are so beautiful! I always make sakura mochi during hanami season."
  },
  {
    id: 'season_summer',
    name: 'Summer Memory',
    rarity: 'uncommon',
    description:
      "Summers here get really hot~ But the cicadas singing and eating shaved ice by the river... I wouldn't trade it for anything!"
  },
  {
    id: 'season_autumn',
    name: 'Autumn Memory',
    rarity: 'uncommon',
    description:
      "The maple leaves turn the most gorgeous red in autumn~ I like to press a few in a book. I have ones from every year since I was little!"
  },
  {
    id: 'season_winter',
    name: 'Winter Memory',
    rarity: 'uncommon',
    description:
      "Winter mornings are hard to wake up for~ but making warm mochi by the kotatsu makes it all worth it! The shop smells so cozy."
  },
  {
    id: 'story_childhood',
    name: "Roka's Childhood Tale",
    rarity: 'uncommon',
    description:
      "When I was little, I used to sneak manjuu from the shop display~ Grandpa always pretended not to notice, but he'd make extra just for me. Fufu~"
  },
  {
    id: 'story_cooking',
    name: "Roka's Kitchen Disaster",
    rarity: 'uncommon',
    description:
      "One time I accidentally put salt instead of sugar in the daifuku... The customers' faces were priceless! I still feel bad about it though~"
  },
  {
    id: 'trivia_shrine',
    name: 'Shrine Maiden Days',
    rarity: 'uncommon',
    description:
      "I helped out as a miko at the local shrine during New Year's once~ The hakama was so pretty! But standing still for hours was really hard..."
  },
  {
    id: 'story_stargazing',
    name: "Roka's Stargazing Night",
    rarity: 'uncommon',
    description:
      "On clear nights, I sometimes go up to the hill behind the shop to watch the stars~ The sky here is so clear... you can see the Milky Way!"
  },

  // ── Rare (6 items) ────────────────────────────────────────────────

  {
    id: 'recipe_secret_dango',
    name: "Roka's Secret Dango Recipe",
    rarity: 'rare',
    description:
      "I've never told anyone this, but... the secret to my dango is a tiny bit of honey in the dough. Don't tell the regulars, okay? \u2661"
  },
  {
    id: 'recipe_special_tea',
    name: "Roka's Special Blend Tea",
    rarity: 'rare',
    description:
      'I have a special tea blend I only make for myself~ A pinch of roasted barley mixed with sencha and dried yuzu peel. It tastes like home...'
  },
  {
    id: 'confession_clumsy',
    name: "Roka's Honest Moment",
    rarity: 'rare',
    description:
      'Sometimes I worry that I\'m too clumsy for the shop... But then a regular tells me my sweets made their day better, and I think... maybe I\'m doing okay. \u2606'
  },
  {
    id: 'confession_dream',
    name: "Roka's Secret Dream",
    rarity: 'rare',
    description:
      'Can I tell you something? I dream of opening a little cafe by the sea someday~ With a terrace where you can watch the sunset while eating mochi...'
  },
  {
    id: 'line_brave',
    name: "Roka's Brave Words",
    rarity: 'rare',
    description:
      "When you feel scared, just take a deep breath and take one step forward. That's what my grandmother always told me. And you know what? She was right."
  },
  {
    id: 'recipe_family_wagashi',
    name: 'Maniwa Family Wagashi',
    rarity: 'rare',
    description:
      'Our family has a special nerikiri recipe passed down for generations~ The trick is in how you knead the bean paste. I can show you... if you promise to keep it between us.'
  },

  // ── Legendary (4 items) ───────────────────────────────────────────

  {
    id: 'legend_first_meeting',
    name: 'Memory: Our First Meeting',
    rarity: 'legendary',
    description:
      "You probably don't remember, but... the first time you walked into the shop, I dropped an entire tray of mochi. I told everyone it was because the floor was slippery, but... *fidgets* ...it wasn't the floor."
  },
  {
    id: 'legend_promise',
    name: "Roka's Promise",
    rarity: 'legendary',
    description:
      "No matter what happens, I'll always keep the shop open. Not just because of the family legacy, but... because it's where I get to meet people like you. So please... keep coming back, okay? \u2661"
  },
  {
    id: 'legend_moonlit_walk',
    name: 'Memory: Moonlit Walk',
    rarity: 'legendary',
    description:
      'That night we walked home under the full moon... I was so nervous I could hear my own heartbeat. When you said the moon was beautiful, I almost said... n-never mind! Forget I said anything!'
  },
  {
    id: 'legend_handmade_charm',
    name: "Roka's Handmade Charm",
    rarity: 'legendary',
    description:
      "I made this good luck charm myself... I stayed up all night sewing it. It's not very pretty, but I put all my feelings into every stitch. Please take it... and keep it close. \u2661"
  }
]

/** Get all items for a given rarity tier. */
export function getItemsByRarity(rarity: GachaRarity): GachaItem[] {
  return GACHA_ITEMS.filter((item) => item.rarity === rarity)
}

/** Get total number of items in the catalog. */
export function getTotalItemCount(): number {
  return GACHA_ITEMS.length
}
