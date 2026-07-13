'use client';

import { useEffect, useState } from 'react';

export default function Template({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className={`page-transition-wrapper ${mounted ? 'is-mounted' : ''}`}>
      {children}
    </div>
  );
}
