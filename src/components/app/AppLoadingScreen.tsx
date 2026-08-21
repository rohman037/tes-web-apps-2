'use client';

interface AppLoadingScreenProps {
  tone?: 'light' | 'dark';
}

export default function AppLoadingScreen({ tone = 'light' }: AppLoadingScreenProps) {
  if (tone === 'dark') {
    return (
      <div className="min-h-screen bg-[#0d0f17] flex items-center justify-center">
        <div className="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5b50e5]" />
    </div>
  );
}
