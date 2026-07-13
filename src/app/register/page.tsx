import { Metadata } from 'next';
import RegisterClient from './RegisterClient';

export const metadata: Metadata = {
  title: "Create Player Account — Shakti Gaming",
  description: "Sign up for a new Shakti Gaming esports player profile.",
  robots: {
    index: false,
    follow: true
  }
};

export default function Page() {
  return <RegisterClient />;
}
