import { GAME_CATALOG, CatalogGame } from './gameCatalog';

export interface GameRecommendation {
  game: CatalogGame;
  score: number;
  explanation: string;
}

export function recommendGames(
  registeredGames: string[] = [],
  preferredRoles: string[] = []
): GameRecommendation[] {
  // Normalize player's games to lowcase for safe search
  const playerGamesLower = registeredGames.map(g => g.trim().toLowerCase());

  // 1. Resolve genres of games the player currently plays
  const playerGenres: { [genre: string]: string } = {}; // genre -> gameName
  GAME_CATALOG.forEach(catalogGame => {
    if (playerGamesLower.includes(catalogGame.name.toLowerCase())) {
      playerGenres[catalogGame.genre] = catalogGame.name;
    }
  });

  // 2. Process all games in catalog
  const recommendations: GameRecommendation[] = [];

  GAME_CATALOG.forEach(candidate => {
    // Exclude games the player already has registered
    if (playerGamesLower.includes(candidate.name.toLowerCase())) {
      return;
    }

    let score = 0;
    let explanationParts: string[] = [];

    // Check genre overlap
    if (playerGenres[candidate.genre]) {
      score += 3;
      explanationParts.push(`Because you play ${playerGenres[candidate.genre]} (${candidate.genre})`);
    }

    // Check preferred roles overlap
    const matchingRoles = candidate.roles.filter(role => 
      preferredRoles.some(prefRole => prefRole.trim().toLowerCase() === role.toLowerCase())
    );

    if (matchingRoles.length > 0) {
      score += matchingRoles.length * 2;
      explanationParts.push(`Fits your preferred ${matchingRoles[0]} role`);
    }

    // If there is no explanation, set default fallback label
    const explanation = explanationParts.length > 0 
      ? explanationParts.join(' & ') 
      : 'Popular esports game to try';

    recommendations.push({
      game: candidate,
      score,
      explanation
    });
  });

  // 3. Rank recommendations
  recommendations.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score; // Score descending
    }
    // Alphabetical fallback on tie
    return a.game.name.localeCompare(b.game.name);
  });

  // 4. Return top 4 recommendations
  return recommendations.slice(0, 4);
}
