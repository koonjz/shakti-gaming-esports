import { Metadata } from 'next';
import TeamsClient from './TeamsClient';

export const metadata: Metadata = {
  title: "Esports Team Roster Management — Shakti Gaming",
  description: "Create a team organization, invite players by gamertag, manage your active roster, and register for tournaments.",
};

export default function Page() {
  return <TeamsClient />;
}
