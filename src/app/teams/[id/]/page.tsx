import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import TeamDetailPublicClient from './TeamDetailPublicClient';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const teamId = resolvedParams?.id;
  if (!teamId) {
    return {
      title: 'Esports Team Profile — Shakti Gaming',
      description: 'View esports team rosters, members, points, wins, and match history.',
    };
  }

  try {
    const docRef = doc(db, "teams", teamId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const tData = snap.data();
      const title = `${tData.name} — Esports Team Profile | Shakti Gaming`;
      const description = `Check out combat roster, wins (${tData.wins || 0} wins), XP points (${tData.points || 0} XP), and match history for esports team ${tData.name} on Shakti Gaming.`;
      return {
        title,
        description,
        openGraph: {
          title,
          description,
          type: 'website',
          url: `https://shakti-gaming.web.app/teams/${teamId}`,
        },
      };
    }
  } catch (e) {
    console.error("Error generating team metadata:", e);
  }

  return {
    title: 'Esports Team Profile — Shakti Gaming',
    description: 'View esports team rosters, members, points, wins, and match history.',
  };
}

export default async function Page({ params }: Props) {
  const resolvedParams = await params;
  const teamId = resolvedParams?.id;
  if (!teamId) {
    notFound();
  }

  try {
    const docRef = doc(db, "teams", teamId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      notFound();
    }
  } catch (err) {
    console.error("Error checking team on server:", err);
  }

  return <TeamDetailPublicClient id={teamId} />;
}
