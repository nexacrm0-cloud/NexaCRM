'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/login');
  }, [router]);

  return (
    <div className="bg-background flex h-screen items-center justify-center">
      <Loader2 className="text-primary h-6 w-6 animate-spin" />
    </div>
  );
}
