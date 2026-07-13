import { Metadata } from 'next';
import CreateTournamentClient from './CreateTournamentClient';

export const metadata: Metadata = {
  title: "Host Esports Tournament — Shakti Gaming",
  description: "Create bracket size, register games, entry types, and host a tournament on Shakti Gaming.",
  robots: {
    index: false,
    follow: false
  }
};

export default function Page() {
  return <CreateTournamentClient />;
}
