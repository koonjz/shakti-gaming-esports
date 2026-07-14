'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, collection, query, where, getDocs, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Gamepad2, User, Mail, Lock, AlertCircle } from 'lucide-react';

export default function RegisterClient() {
  const [displayName, setDisplayName] = useState('');
  const [gamertag, setGamertag] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const router = useRouter();

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 300);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validations
    if (!displayName.trim() || !gamertag.trim() || !email.trim() || !password.trim()) {
      setError('All fields are required.');
      triggerShake();
      return;
    }

    const cleanGamertag = gamertag.trim().toLowerCase();
    const gamertagRegex = /^[a-zA-Z0-9_]{3,15}$/;
    if (!gamertagRegex.test(cleanGamertag)) {
      setError('Gamertag must be 3-15 characters and contain only alphanumeric characters and underscores.');
      triggerShake();
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      triggerShake();
      return;
    }

    setLoading(true);

    try {
      // 1. Check if Gamertag is unique in Firestore profiles (Client check)
      const profilesRef = collection(db, "profiles");
      const q = query(profilesRef, where("gamertag", "==", cleanGamertag));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        setError('This gamertag is already taken. Please choose another one.');
        triggerShake();
        setLoading(false);
        return;
      }

      // 2. Create the user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // Force refresh user ID Token to ensure Firestore rules recognize auth immediately
      await user.getIdToken(true);

      // 3. Sequential Write: Claim the Gamertag document first
      const claimRef = doc(db, "gamertags", cleanGamertag);
      console.log("[DIAGNOSTIC] Pre-Gamertag Write Status:", {
        currentUid: auth.currentUser?.uid,
        userUid: user.uid,
        path: `gamertags/${cleanGamertag}`,
        payload: { uid: user.uid },
        authStatus: auth.currentUser ? "logged-in" : "null"
      });

      try {
        const claimSnap = await getDoc(claimRef);
        if (claimSnap.exists()) {
          const existingUid = claimSnap.data()?.uid;
          console.log("[DIAGNOSTIC] Gamertag document exists:", { existingUid });
          if (existingUid !== user.uid) {
            setError('This gamertag is already claimed by another user.');
            triggerShake();
            setLoading(false);
            return;
          }
        } else {
          console.log("[DIAGNOSTIC] Writing gamertag claim doc...");
          await setDoc(claimRef, { uid: user.uid });
          console.log("[DIAGNOSTIC] Gamertag claim doc written successfully.");
        }
      } catch (err: any) {
        console.error("[DIAGNOSTIC] Gamertag write failed:", {
          code: err.code,
          message: err.message,
          stack: err.stack,
          fullError: err
        });
        throw err;
      }

      // 4. Sequential Write: Create the profile document
      const profileRef = doc(db, "profiles", user.uid);
      const profilePayload = {
        uid: user.uid,
        gamertag: cleanGamertag,
        displayName: displayName.trim(),
        registeredGames: [],
        preferredRoles: [],
        skillLevel: 'Intermediate',
        stats: {
          wins: 0,
          losses: 0,
          points: 1000
        },
        createdAt: Date.now()
      };

      console.log("[DIAGNOSTIC] Pre-Profile Write Status:", {
        currentUid: auth.currentUser?.uid,
        userUid: user.uid,
        path: `profiles/${user.uid}`,
        payloadGamertag: profilePayload.gamertag,
        payload: profilePayload,
        authStatus: auth.currentUser ? "logged-in" : "null"
      });

      try {
        console.log("[DIAGNOSTIC] Writing profile doc...");
        await setDoc(profileRef, profilePayload);
        console.log("[DIAGNOSTIC] Profile doc written successfully.");
      } catch (err: any) {
        console.error("[DIAGNOSTIC] Profile write failed:", {
          code: err.code,
          message: err.message,
          stack: err.stack,
          fullError: err
        });
        throw err;
      }

      // Redirect to profile setup
      router.push('/profile');
    } catch (err: any) {
      console.error('Registration error:', err);
      triggerShake();
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered.');
      } else {
        setError(err.message || 'An error occurred during registration.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{
      position: 'relative',
      minHeight: 'calc(100vh - 4.5rem)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1.5rem',
      overflow: 'hidden'
    }}>
      {/* Background Decorative Glows */}
      <div className="hero-glow hero-glow-1" />
      <div className="hero-glow hero-glow-2" />

      <div className={`glass-panel fade-in ${shake ? 'shake' : ''}`} style={{
        position: 'relative',
        width: '100%',
        maxWidth: '480px',
        padding: '2.5rem',
        zIndex: 1
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Gamepad2 size={40} style={{ color: 'var(--accent-cyan)', marginBottom: '0.75rem' }} />
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Create Account</h1>
          <p style={{ fontSize: '0.95rem' }}>Join the ultimate gaming & esports community</p>
        </div>

        {/* Assertive live region for validation error announcer */}
        <div aria-live="assertive">
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: 'hsla(350, 85%, 55%, 0.12)',
              border: '1px solid var(--accent-red)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1.5rem',
              color: 'var(--accent-red)',
              fontSize: '0.9rem'
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <form onSubmit={handleRegister}>
          {/* Display Name */}
          <div className="form-group">
            <label htmlFor="reg-displayname" className="form-label">Display Name</label>
            <div className="input-glow-wrapper">
              <User size={18} style={{ position: 'absolute', left: '1rem', color: 'var(--text-muted)' }} />
              <input
                id="reg-displayname"
                type="text"
                className="glass-input"
                style={{ paddingLeft: '2.75rem' }}
                placeholder="e.g. John Doe"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {/* Gamertag (Username) */}
          <div className="form-group">
            <label htmlFor="reg-gamertag" className="form-label">Unique Gamertag</label>
            <div className="input-glow-wrapper">
              <span style={{ position: 'absolute', left: '1rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>@</span>
              <input
                id="reg-gamertag"
                type="text"
                className="glass-input"
                style={{ paddingLeft: '2.25rem' }}
                placeholder="gamertag (alphanumeric & _)"
                value={gamertag}
                onChange={(e) => setGamertag(e.target.value)}
                disabled={loading}
              />
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Used to invite you to teams. Must be unique.
            </p>
          </div>

          {/* Email */}
          <div className="form-group">
            <label htmlFor="reg-email" className="form-label">Email Address</label>
            <div className="input-glow-wrapper">
              <Mail size={18} style={{ position: 'absolute', left: '1rem', color: 'var(--text-muted)' }} />
              <input
                id="reg-email"
                type="email"
                className="glass-input"
                style={{ paddingLeft: '2.75rem' }}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {/* Password */}
          <div className="form-group text-glow">
            <label htmlFor="reg-password" className="form-label">Password</label>
            <div className="input-glow-wrapper">
              <Lock size={18} style={{ position: 'absolute', left: '1rem', color: 'var(--text-muted)' }} />
              <input
                id="reg-password"
                type="password"
                className="glass-input"
                style={{ paddingLeft: '2.75rem' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1rem', height: '3rem' }}
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Already have an account? </span>
          <Link href="/login" style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
            Log In
          </Link>
        </div>
      </div>
    </main>
  );
}
