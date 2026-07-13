import { Metadata } from 'next';
import TournamentsClient from './TournamentsClient';

export const metadata: Metadata = {
  title: "Esports Tournaments & Bracket Matches — Shakti Gaming",
  description: "Browse, register, and compete in competitive bracket matches hosted by the community.",
};

export default function Page() {
  return <TournamentsClient />;
}
