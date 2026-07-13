import { Metadata } from 'next';
import LeaderboardClient from './LeaderboardClient';

export const metadata: Metadata = {
  title: "Esports Leaderboards & Rankings — Shakti Gaming",
  description: "See the highest ranked esports teams and players on the Shakti Gaming leaderboard. Synced in real-time.",
};

export default function Page() {
  return <LeaderboardClient />;
}
