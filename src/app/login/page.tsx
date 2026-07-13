import { Metadata } from 'next';
import LoginClient from './LoginClient';

export const metadata: Metadata = {
  title: "Sign In — Shakti Gaming",
  description: "Log in to your Shakti Gaming player account.",
  robots: {
    index: false,
    follow: true
  }
};

export default function Page() {
  return <LoginClient />;
}
