export interface CatalogGame {
  id: string;
  name: string;
  genre: string;
  roles: string[];
  description: string;
}

export const GAME_CATALOG: CatalogGame[] = [
  {
    id: "valorant",
    name: "Valorant",
    genre: "Tactical FPS",
    roles: ["Duelist", "Sentinel", "IGL (In-Game Leader)", "Entry Fragger", "Support", "Sniper"],
    description: "A 5v5 character-based tactical shooter where precise gunplay meets unique agent abilities."
  },
  {
    id: "league-of-legends",
    name: "League of Legends",
    genre: "MOBA",
    roles: ["Mid Laner", "Jungler", "Support", "Carry", "Tank", "Flex"],
    description: "A team-based strategy game where two teams of five powerful champions face off to destroy the enemy Nexus."
  },
  {
    id: "cs-go",
    name: "CS:GO",
    genre: "Tactical FPS",
    roles: ["IGL (In-Game Leader)", "Entry Fragger", "Sniper", "Support"],
    description: "The classic team-based tactical shooter focusing on objective execution and weapon economy."
  },
  {
    id: "apex-legends",
    name: "Apex Legends",
    genre: "Battle Royale",
    roles: ["IGL (In-Game Leader)", "Support", "Sniper", "Flex"],
    description: "A fast-paced squad-based battle royale featuring unique hero characters and movement mechanics."
  },
  {
    id: "rocket-league",
    name: "Rocket League",
    genre: "Sports",
    roles: ["Striker", "Support", "Flex"],
    description: "High-powered hybrid of arcade soccer and vehicular mayhem with physics-driven gameplay."
  },
  {
    id: "overwatch-2",
    name: "Overwatch 2",
    genre: "Hero Shooter",
    roles: ["Tank", "Support", "Flex"],
    description: "An optimistic team-based action game set in the near future, where every match is an intense 5v5 battlefield."
  },
  {
    id: "dota-2",
    name: "Dota 2",
    genre: "MOBA",
    roles: ["Carry", "Jungler", "Support", "Mid Laner", "Tank"],
    description: "A deep strategy game featuring a massive roster of unique heroes and complex map layout mechanics."
  },
  {
    id: "fortnite",
    name: "Fortnite",
    genre: "Battle Royale",
    roles: ["Carry", "Support", "Flex"],
    description: "A battle royale game combining fast building, pop-culture crossovers, and fluid gunplay."
  },
  {
    id: "pubg",
    name: "PUBG",
    genre: "Battle Royale",
    roles: ["IGL (In-Game Leader)", "Sniper", "Support"],
    description: "A realistic tactical battle royale focused on resource scavenging, positioning, and gunplay."
  },
  {
    id: "rainbow-six-siege",
    name: "Rainbow Six Siege",
    genre: "Tactical FPS",
    roles: ["Entry Fragger", "Support", "IGL (In-Game Leader)", "Sniper"],
    description: "A high-precision tactical shooter focused on close-quarters combat, team play, and destructible environments."
  },
  {
    id: "street-fighter-6",
    name: "Street Fighter 6",
    genre: "Fighting",
    roles: ["Flex"],
    description: "The next evolution of fighting games featuring classic street brawls and modern control interfaces."
  },
  {
    id: "tekken-8",
    name: "Tekken 8",
    genre: "Fighting",
    roles: ["Flex"],
    description: "A next-generation fighting game featuring high-intensity defensive battles and massive character movesets."
  },
  {
    id: "call-of-duty-warzone",
    name: "Call of Duty: Warzone",
    genre: "Battle Royale",
    roles: ["Entry Fragger", "IGL (In-Game Leader)", "Sniper", "Support"],
    description: "A massive, free-to-play combat arena battle royale with realistic Call of Duty gunplay."
  },
  {
    id: "hearthstone",
    name: "Hearthstone",
    genre: "Card Game",
    roles: ["Flex"],
    description: "A fast-paced digital collectible card game where players build decks to cast spells and summon creatures."
  },
  {
    id: "starcraft-ii",
    name: "StarCraft II",
    genre: "RTS",
    roles: ["Flex"],
    description: "A sci-fi real-time strategy game focusing on resource management, base building, and high-speed micro actions."
  },
  {
    id: "halo-infinite",
    name: "Halo Infinite",
    genre: "Arena Shooter",
    roles: ["IGL (In-Game Leader)", "Support", "Sniper"],
    description: "The return of master chief in high-intensity arena battles with power-ups and squad-based combat."
  },
  {
    id: "dead-by-daylight",
    name: "Dead by Daylight",
    genre: "Asymmetrical Horror",
    roles: ["Support", "Flex"],
    description: "A 4v1 multiplayer horror game where one player takes on the role of the Killer, and the other four play as Survivors."
  },
  {
    id: "super-smash-bros-ultimate",
    name: "Super Smash Bros. Ultimate",
    genre: "Platform Fighter",
    roles: ["Flex"],
    description: "Legendary game worlds and fighters collide in the ultimate showdown crossover."
  }
];
