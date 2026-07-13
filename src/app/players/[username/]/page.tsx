import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import PlayerPublicProfileClient from './PlayerPublicProfileClient';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ username: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const usernameParam = resolvedParams?.username;
  if (!usernameParam) {
    return {
      title: 'Player Public Profile — Shakti Gaming',
      description: 'View player stats, preferred games, and role choices.',
    };
  }

  const username = decodeURIComponent(usernameParam).toLowerCase();
  try {
    const q = query(collection(db, "profiles"), where("gamertag", "==", username));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const pData = snap.docs[0].data();
      const title = `${pData.displayName} (@${pData.gamertag}) — Player Profile | Shakti Gaming`;
      const description = `Check out combat statistics, XP rating (${pData.stats?.points || 1000} XP), match wins (${pData.stats?.wins || 0} wins), preferred games, and roles for ${pData.displayName} on Shakti Gaming.`;
      return {
        title,
        description,
        openGraph: {
          title,
          description,
          type: 'profile',
          url: `https://shakti-gaming.web.app/players/${pData.gamertag}`,
        },
      };
    }
  } catch (e) {
    console.error("Error generating player profile metadata:", e);
  }
  return {
    title: 'Player Public Profile — Shakti Gaming',
    description: 'View player stats, preferred games, and role choices.',
  };
}

export default async function Page({ params }: Props) {
  const resolvedParams = await params;
  const usernameParam = resolvedParams?.username;
  if (!usernameParam) {
    notFound();
  }

  // Server-side check for profile existence to trigger 404
  try {
    const username = decodeURIComponent(usernameParam).toLowerCase();
    const q = query(collection(db, "profiles"), where("gamertag", "==", username));
    const snap = await getDocs(q);
    if (snap.empty) {
      notFound();
    }
  } catch (err) {
    console.error("Error checking player document on server:", err);
  }

  return <PlayerPublicProfileClient username={usernameParam} />;
}
