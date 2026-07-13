import { NextResponse } from 'next/server';

interface CacheEntry {
  data: any;
  timestamp: number;
}

// In-memory cache map (riotId lowercased -> cache entry)
const statsCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const riotId = searchParams.get('riotId');

  if (!riotId) {
    return NextResponse.json(
      { error: "Missing query parameter: riotId is required (format: name#tag)." },
      { status: 400 }
    );
  }

  // Validate format name#tag
  const hashIdx = riotId.indexOf('#');
  if (hashIdx === -1 || hashIdx === 0 || hashIdx === riotId.length - 1) {
    return NextResponse.json(
      { error: "Invalid Riot ID format. Please use 'name#tag' (e.g., Rioter#NA1)." },
      { status: 400 }
    );
  }

  const gameName = riotId.substring(0, hashIdx);
  const tagLine = riotId.substring(hashIdx + 1);
  const cacheKey = riotId.toLowerCase().trim();

  // 1. Check in-memory caching
  const cached = statsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  // 2. Check API key configuration
  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey || apiKey === 'mock-riot-api-key' || apiKey === 'your_riot_developer_key_here') {
    return NextResponse.json(
      { 
        error: "Riot API Key is not configured on the server.", 
        setupInstructions: "To enable live stats, register for a Riot Games Developer API key at https://developer.riotgames.com/ and add RIOT_API_KEY to your server environment (.env.local)."
      },
      { status: 401 }
    );
  }

  // 3. Resolve Region maps based on tagline tag
  const tagUpper = tagLine.toUpperCase();
  let routingRegion = 'americas';
  if (['EUW', 'EUNE', 'TR', 'RU', 'EU'].some(r => tagUpper.includes(r))) {
    routingRegion = 'europe';
  } else if (['KR', 'JP', 'OCE', 'ASIA', 'SG'].some(r => tagUpper.includes(r))) {
    routingRegion = 'asia';
  }

  let platformRegion = 'na1';
  if (tagUpper.includes('EUW')) platformRegion = 'euw1';
  else if (tagUpper.includes('EUNE')) platformRegion = 'eun1';
  else if (tagUpper.includes('KR')) platformRegion = 'kr';
  else if (tagUpper.includes('JP')) platformRegion = 'jp1';
  else if (tagUpper.includes('OCE')) platformRegion = 'oc1';
  else if (tagUpper.includes('BR')) platformRegion = 'br1';

  try {
    const headers = { 'X-Riot-Token': apiKey };

    // Step A: Resolve PUUID by gameName and tagLine
    const accountUrl = `https://${routingRegion}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    const accountRes = await fetch(accountUrl, { headers });

    if (!accountRes.ok) {
      if (accountRes.status === 404) {
        return NextResponse.json({ error: `Riot Account '${riotId}' could not be found.` }, { status: 404 });
      }
      if (accountRes.status === 403) {
        return NextResponse.json({ error: "Riot API key is invalid or has expired." }, { status: 403 });
      }
      if (accountRes.status === 429) {
        return NextResponse.json({ error: "Riot API rate limit exceeded. Please try again later." }, { status: 429 });
      }
      return NextResponse.json({ error: `Riot Account fetch failed: Status ${accountRes.status}` }, { status: accountRes.status });
    }

    const accountData = await accountRes.json();
    const puuid = accountData.puuid;

    if (!puuid) {
      return NextResponse.json({ error: "Invalid response from Riot Account API: missing PUUID." }, { status: 502 });
    }

    // Step B: Resolve Summoner ID by PUUID
    const summonerUrl = `https://${platformRegion}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;
    const summonerRes = await fetch(summonerUrl, { headers });

    if (!summonerRes.ok) {
      if (summonerRes.status === 404) {
        return NextResponse.json({ error: `League of Legends summoner profile not found on ${platformRegion.toUpperCase()}.` }, { status: 404 });
      }
      return NextResponse.json({ error: `Summoner profile fetch failed: Status ${summonerRes.status}` }, { status: summonerRes.status });
    }

    const summonerData = await summonerRes.json();
    const summonerId = summonerData.id;

    // Step C: Retrieve League Ranked Entries by Summoner ID
    const leagueUrl = `https://${platformRegion}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`;
    const leagueRes = await fetch(leagueUrl, { headers });

    if (!leagueRes.ok) {
      return NextResponse.json({ error: `League entries fetch failed: Status ${leagueRes.status}` }, { status: leagueRes.status });
    }

    const leagueEntries = await leagueRes.json();

    // Step D: Extract Solo Queue rank
    const soloQueue = leagueEntries.find((e: any) => e.queueType === "RANKED_SOLO_5x5");
    
    const statsPayload = {
      riotId,
      summonerName: summonerData.name,
      summonerLevel: summonerData.summonerLevel,
      rankInfo: soloQueue ? {
        tier: soloQueue.tier, // e.g. "GOLD"
        rank: soloQueue.rank, // e.g. "III"
        leaguePoints: soloQueue.leaguePoints,
        wins: soloQueue.wins,
        losses: soloQueue.losses,
        winRate: parseFloat(((soloQueue.wins / (soloQueue.wins + soloQueue.losses)) * 100).toFixed(1))
      } : {
        tier: "UNRANKED",
        rank: "",
        leaguePoints: 0,
        wins: 0,
        losses: 0,
        winRate: 0
      }
    };

    // 4. Save to in-memory cache
    statsCache.set(cacheKey, {
      data: statsPayload,
      timestamp: Date.now()
    });

    return NextResponse.json(statsPayload);

  } catch (err: any) {
    console.error("Error calling Riot API:", err);
    return NextResponse.json(
      { error: "Failed to communicate with Riot API endpoints. Check server network connectivity." },
      { status: 500 }
    );
  }
}
