import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import TournamentDetailClient from './TournamentDetailClient';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const id = resolvedParams?.id;
  if (!id) {
    return {
      title: 'Tournament Match Brackets — Shakti Gaming',
      description: 'Browse details, view brackets, and register for community tournaments.',
    };
  }

  try {
    const docRef = doc(db, 'tournaments', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const title = `${data.name} — ${data.game} Tournament | Shakti Gaming`;
      const description = `Compete in ${data.name}, a bracket-style ${data.game} tournament on Shakti Gaming. Status: ${data.status}. Register your team roster now!`;
      return {
        title,
        description,
        openGraph: {
          title,
          description,
          type: 'website',
          url: `https://shakti-gaming.web.app/tournaments/${id}`,
        },
      };
    }
  } catch (e) {
    console.error("Error generating tournament metadata:", e);
  }
  return {
    title: 'Tournament Match Brackets — Shakti Gaming',
    description: 'Browse details, view brackets, and register for community tournaments.',
  };
}

export default async function Page({ params }: Props) {
  const resolvedParams = await params;
  const id = resolvedParams?.id;
  if (!id) {
    notFound();
  }

  // Server-side check for existence to trigger 404
  try {
    const docRef = doc(db, 'tournaments', id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      notFound();
    }
  } catch (err) {
    console.error("Error checking tournament document on server:", err);
    // If it's a permission denied or network issue, we can throw the error or render.
    // If it's a permission-denied we may want to throw it to let app/error.tsx catch it.
  }

  return <TournamentDetailClient id={id} />;
}
