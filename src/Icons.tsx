export type IconName = 'spark' | 'eye' | 'pause' | 'play' | 'book' | 'reset' | 'close' | 'download' | 'upload' | 'arrow';
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    spark: <><path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l2.5 2.5m9 9L19 19M5 19l2.5-2.5m9-9L19 5"/><circle cx="12" cy="12" r="3"/></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
    pause: <><path d="M8 5v14M16 5v14" strokeWidth="3"/></>,
    play: <path d="m8 4 12 8-12 8V4Z"/>,
    book: <><path d="M12 5v15M3 4c3-1 6 0 9 2 3-2 6-3 9-2v15c-3-1-6 0-9 2-3-2-6-3-9-2V4Z"/></>,
    reset: <><path d="M4 9a8 8 0 1 1 0 7M4 3v6h6"/></>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></>,
    upload: <><path d="M12 15V3m-5 5 5-5 5 5M4 16v5h16v-5"/></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
