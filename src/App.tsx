import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ChangeEvent } from 'react';
import { Icon } from './Icons';
import { SimulationClock } from './app/clock';
import { TidepoolRenderer } from './render/TidepoolRenderer';
import { addLight, createWorld, getStats, stepWorld } from './world/simulation';
import { restoreWorld, serializeWorld } from './world/persistence';
import { isInPool, WORLD_HEIGHT, WORLD_WIDTH } from './world/types';
import type { Point, Tool, World } from './world/types';

const SAVE_KEY = 'elsewhere:tidepool:v1';
type Panel = 'guide' | 'specimen' | 'pocket' | null;
function loadInitialWorld(): { world: World; remembered: boolean; storageAvailable: boolean } {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    const world = saved ? restoreWorld(saved) : null;
    return { world: world ?? createWorld(), remembered: Boolean(world), storageAvailable: true };
  } catch { return { world: createWorld(), remembered: false, storageAvailable: false }; }
}
function timeLabel(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  return `${String(mins).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

export function App() {
  const [initial] = useState(loadInitialWorld);
  const worldRef = useRef(initial.world);
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<TidepoolRenderer | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const resetRef = useRef<HTMLDialogElement>(null);
  const resetTriggerRef = useRef<HTMLElement | null>(null);
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [paused, setPaused] = useState(reducedMotion);
  const [tool, setTool] = useState<Tool>('light');
  const [panel, setPanel] = useState<Panel>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [stats, setStats] = useState(() => getStats(initial.world));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [storageAvailable, setStorageAvailable] = useState(initial.storageAvailable);
  const [notice, setNoticeState] = useState(initial.remembered ? 'Your tidepool remembers you.' : 'Leave a little light. See what follows.');
  const [feedback, setFeedback] = useState('');
  function setNotice(message: string): void { setNoticeState(message); setFeedback(message); }
  const controlsRef = useRef({ paused, tool, selectedId, reducedMotion });
  controlsRef.current = { paused, tool, selectedId, reducedMotion };
  const cursorRef = useRef<Point | null>(null);
  const heldRef = useRef(false);
  const keyboardRef = useRef(false);
  const lastPlaceRef = useRef(0);
  const [hintVisible, setHintVisible] = useState(!initial.remembered);

  function saveWorld(): void {
    try {
      localStorage.setItem(SAVE_KEY, serializeWorld(worldRef.current));
      setStorageAvailable(true);
    } catch { setStorageAvailable(false); }
  }

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    let lastTime = 0;
    let lastStats = 0;
    const clock = new SimulationClock();
    const host = hostRef.current!;
    const hidden = () => {
      lastTime = 0;
      heldRef.current = false;
      clock.reset();
      if (document.hidden) {
        cancelAnimationFrame(frame);
        saveWorld();
      } else if (rendererRef.current) frame = requestAnimationFrame(tick);
    };
    const tick = (now: number) => {
      if (cancelled || document.hidden) return;
      const renderer = rendererRef.current;
      if (!renderer) return;
      const delta = lastTime ? (now - lastTime) / 1000 : 0;
      lastTime = now;
      if (!controlsRef.current.paused) clock.advance(delta, dt => stepWorld(worldRef.current, dt));
      else clock.reset();
      if (heldRef.current && controlsRef.current.tool === 'light' && cursorRef.current && now - lastPlaceRef.current > 180) {
        addLight(worldRef.current, cursorRef.current.x, cursorRef.current.y);
        lastPlaceRef.current = now;
      }
      renderer.render(worldRef.current, controlsRef.current.selectedId, cursorRef.current, controlsRef.current.tool);
      if (now - lastStats > 450) {
        setStats(getStats(worldRef.current));
        lastStats = now;
      }
      // A paused world still responds to cursor and tool changes.
      frame = requestAnimationFrame(tick);
    };
    TidepoolRenderer.create(host).then(renderer => {
      if (cancelled) { renderer.destroy(); return; }
      rendererRef.current = renderer;
      renderer.setReducedMotion(controlsRef.current.reducedMotion);
      setReady(true);
      if (!document.hidden) frame = requestAnimationFrame(tick);
    }).catch(cause => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : 'The tidepool could not open.');
    });
    document.addEventListener('visibilitychange', hidden);
    const pagehide = () => saveWorld();
    window.addEventListener('pagehide', pagehide);
    const saveTimer = window.setInterval(saveWorld, 5000);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearInterval(saveTimer);
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', pagehide);
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => { setReducedMotion(query.matches); if (query.matches) setPaused(true); };
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(''), 4500);
    return () => clearTimeout(timer);
  }, [feedback]);
  useEffect(() => { rendererRef.current?.setReducedMotion(reducedMotion); }, [reducedMotion, ready]);
  useEffect(() => {
    if (!panel) return;
    const previousFocus = document.activeElement as HTMLElement;
    panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [panel]);
  useEffect(() => {
    const key = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPanel(null); setSelectedId(null); heldRef.current = false;
        return;
      }
      if (resetRef.current?.open || panelRef.current?.contains(event.target as Node)) return;
      const target = event.target as HTMLElement;
      if (target.closest('button,input,select,textarea,a') || target.isContentEditable || target === hostRef.current) return;
      if (event.key.toLowerCase() === 'l') setTool('light');
      if (event.key.toLowerCase() === 'o') setTool('observe');
      if (event.code === 'Space') { event.preventDefault(); setPaused(value => !value); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  function activateAt(point: Point): void {
    if (!ready) return;
    if (tool === 'light') {
      if (addLight(worldRef.current, point.x, point.y)) {
        setHintVisible(false);
        setNotice('Light left in the water. The lucents will find it.');
        setStats(getStats(worldRef.current));
      } else if (isInPool(point.x, point.y)) setNotice('The pool is full of light. Let the lucents feed for a moment.');
      else setNotice('Leave your light inside the shoreline.');
    } else {
      let nearest = null;
      const origin = rendererRef.current!.screenToWorld(0, 0);
      const unit = rendererRef.current!.screenToWorld(1, 0);
      let distance = Math.max(48, Math.hypot(unit.x - origin.x, unit.y - origin.y) * 24);
      for (const organism of worldRef.current.organisms) {
        const d = Math.hypot(organism.x - point.x, organism.y - point.y);
        if (d < distance) { nearest = organism; distance = d; }
      }
      setSelectedId(nearest?.id ?? null);
      if (nearest) { setPanel('specimen'); setNotice('A lucent, briefly known.'); }
      else setNotice('Touch a luminous creature to look more closely.');
    }
  }
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!ready || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const point = rendererRef.current!.screenToWorld(event.clientX, event.clientY);
    cursorRef.current = point;
    keyboardRef.current = false;
    hostRef.current?.focus({ preventScroll: true });
    activateAt(point);
    heldRef.current = tool === 'light';
    lastPlaceRef.current = performance.now();
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!ready) return;
    keyboardRef.current = false;
    cursorRef.current = rendererRef.current!.screenToWorld(event.clientX, event.clientY);
  }
  function habitatKey(event: KeyboardEvent<HTMLDivElement>) {
    const point = cursorRef.current ?? { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
    if (event.key.startsWith('Arrow')) {
      event.preventDefault();
      const renderer = rendererRef.current;
      if (!renderer) return;
      const dx = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      const dy = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
      const origin = renderer.screenToWorld(0, 0);
      const destination = renderer.screenToWorld(dx, dy);
      const length = Math.hypot(destination.x - origin.x, destination.y - origin.y);
      keyboardRef.current = true;
      cursorRef.current = {
        x: Math.max(0, Math.min(WORLD_WIDTH, point.x + (destination.x - origin.x) / length * 24)),
        y: Math.max(0, Math.min(WORLD_HEIGHT, point.y + (destination.y - origin.y) / length * 24)),
      };
    } else if (event.key === 'Enter') { event.preventDefault(); activateAt(point); }
    else if (event.code === 'Space') { event.preventDefault(); setPaused(value => !value); }
    else if (event.key.toLowerCase() === 'l') setTool('light');
    else if (event.key.toLowerCase() === 'o') setTool('observe');
  }
  function exportSnapshot() {
    const blob = new Blob([serializeWorld(worldRef.current)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `elsewhere-tidepool-${worldRef.current.seed}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('A little world, saved for later.');
  }
  async function importSnapshot(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 2_000_000) { setNotice('That file is too large to be a tidepool snapshot.'); return; }
    try {
      const restored = restoreWorld(await file.text());
      if (!restored) { setNotice('That snapshot could not be read. Your tidepool is still here.'); return; }
      worldRef.current = restored;
      heldRef.current = false;
      setSelectedId(null);
      setStats(getStats(restored));
      saveWorld();
      setNotice('A remembered tidepool has returned.');
    } catch { setNotice('That file could not be opened. Your tidepool is still here.'); }
  }
  function resetWorld() {
    worldRef.current = createWorld(worldRef.current.seed);
    heldRef.current = false;
    setSelectedId(null);
    setStats(getStats(worldRef.current));
    saveWorld();
    setNotice('A new beginning, along the same shore.');
    resetRef.current?.close();
    resetTriggerRef.current?.focus();
  }
  const selected = worldRef.current.organisms.find(organism => organism.id === selectedId);
  const openPanel = (next: Panel) => setPanel(current => current === next ? null : next);

  return <main className="elsewhere">
    <div ref={hostRef} className={`habitat tool-${tool}`} role="group" tabIndex={0}
      aria-label="Interactive luminous tidepool" aria-describedby="habitat-instructions"
      onPointerDown={pointerDown} onPointerMove={pointerMove}
      onPointerUp={() => { heldRef.current = false; }} onPointerCancel={() => { heldRef.current = false; }}
      onLostPointerCapture={() => { heldRef.current = false; }}
      onPointerLeave={() => { if (!heldRef.current && !keyboardRef.current) cursorRef.current = null; }}
      onFocus={() => { if (!cursorRef.current) cursorRef.current = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 }; }}
      onBlur={() => { heldRef.current = false; if (keyboardRef.current) cursorRef.current = null; }}
      onKeyDown={habitatKey} />

    <header className="masthead">
      <a className="wordmark" href="./" aria-label="Elsewhere home"><Icon name="spark" size={25}/><span>elsewhere<span className="wordmark-dot">.</span></span></a>
      <div className="masthead-right"><span className="edition">AN UNFINISHED WORLD</span><button className="guide-toggle" onClick={() => openPanel('guide')} aria-expanded={panel === 'guide'} aria-controls="field-panel"><Icon name="book"/><span>Field guide</span></button></div>
    </header>

    <section className="habitat-heading" aria-label="Current habitat">
      <p className="eyebrow"><span className="tiny-line"/> HABITAT 001 <span className="eyebrow-divider">/</span> THE FIRST SHORE</p>
      <h1>The luminous<br/><em>tidepool.</em></h1>
      <p className="habitat-description">Some things grow where<br/>a little light is left behind.</p>
    </section>
    <div className="habitat-coordinate" aria-hidden="true"><span>01 — 001</span><span>SHALLOW WATER / LOW TIDE</span></div>

    {!ready && <div className="loading-state" role="status">{error ? <><Icon name="spark" size={32}/><h2>The shore is out of reach.</h2><p>{error}</p><p>Try a browser with WebGL enabled, then reload.</p><button className="text-button" onClick={() => location.reload()}>Try again <Icon name="arrow"/></button></> : <><span className="loading-ring"/><p>Finding the shoreline…</p></>}</div>}

    {ready && hintVisible && <div className="first-hint"><span className="hint-star">✧</span><span>Touch the water to leave light</span></div>}

    <aside className="pool-readout" aria-label="Tidepool observations">
      <span className={`live-dot ${paused ? 'is-paused' : ''}`}/><span>{paused ? 'STILL, FOR A MOMENT' : 'A SMALL WORLD, ALIVE'}</span>
      <div className="readout-values"><span><strong>{stats.population}</strong> lucents</span><span className="readout-separator">·</span><span><strong>{Math.round(stats.pigment)}</strong> pigment</span><span className="readout-separator">·</span><time>{timeLabel(stats.elapsed)}</time></div>
    </aside>

    <div className="toolbar-area">
      <div className="tool-hint" id="habitat-instructions">{tool === 'light' ? 'Touch or hold to leave light' : 'Touch a lucent to observe'}<span className="keyboard-hint"> · Arrows + Enter when the pool is focused</span></div>
      <nav className="tool-dock" aria-label="Tidepool tools">
        <button className={`tool-button ${tool === 'light' ? 'active' : ''}`} onClick={() => setTool('light')} aria-pressed={tool === 'light'} title="Leave light (L)"><Icon name="spark"/><span>Leave light</span><kbd>L</kbd></button>
        <button className={`tool-button ${tool === 'observe' ? 'active' : ''}`} onClick={() => { setTool('observe'); setHintVisible(false); }} aria-pressed={tool === 'observe'} title="Observe (O)"><Icon name="eye"/><span>Observe</span><kbd>O</kbd></button>
        <span className="dock-divider"/>
        <button className="icon-button" onClick={() => setPaused(value => !value)} aria-label={paused ? 'Resume the tidepool' : 'Pause the tidepool'} aria-pressed={paused} title={paused ? 'Resume (Space)' : 'Pause (Space)'}><Icon name={paused ? 'play' : 'pause'}/></button>
        <button className="icon-button" onClick={event => { resetTriggerRef.current = event.currentTarget; resetRef.current?.showModal(); }} aria-label="Reset tidepool" title="Begin again"><Icon name="reset"/></button>
      </nav>
    </div>
    <footer className="site-footer"><span>A WORLD WE DISCOVER BY BUILDING IT</span><button className="pocket-button" onClick={() => openPanel('pocket')} aria-expanded={panel === 'pocket'} aria-controls="field-panel"><Icon name="download" size={15}/><span>Pocket this world</span></button></footer>

    {panel && <>
      <div className="panel-scrim" onClick={() => setPanel(null)} aria-hidden="true"/>
      <aside ref={panelRef} className="field-panel" id="field-panel" role="dialog" aria-modal="true" aria-labelledby="panel-title"
        onKeyDown={event => {
          if (event.key !== 'Tab') return;
          const nodes = panelRef.current?.querySelectorAll<HTMLElement>('button,input,a,[tabindex="0"]');
          if (!nodes?.length) return;
          const first = nodes[0], last = nodes[nodes.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }}>
        <div className="panel-top"><span className="eyebrow">NOTES FROM ELSEWHERE</span><button className="icon-button" aria-label="Close panel" onClick={() => setPanel(null)}><Icon name="close"/></button></div>
        {panel === 'guide' && <>
          <h2 id="panel-title">A field guide<br/><em>to small wonders.</em></h2>
          <p className="panel-intro">The first place in an unfinished world. Stay a while. Leave something behind.</p>
          <div className="specimen-art" aria-hidden="true"><svg viewBox="0 0 280 130"><defs><radialGradient id="body-glow"><stop stopColor="#d8ecc1" stopOpacity=".7"/><stop offset="1" stopColor="#99d1bb" stopOpacity="0"/></radialGradient></defs><ellipse cx="140" cy="62" rx="72" ry="58" fill="url(#body-glow)"/><path d="M145 63q-30 8-52 32t-25 13M144 69q-8 25-37 31t-20 16M149 73q10 30-8 42M155 64q30 20 37 39" fill="none" stroke="#b7d5ae" strokeWidth=".7"/><ellipse cx="150" cy="61" rx="22" ry="15" fill="#b0d8b6" fillOpacity=".2" stroke="#c1ddba" strokeWidth=".8" transform="rotate(-22 150 61)"/><circle cx="157" cy="56" r="3" fill="#e3f3c8"/><path d="M184 45h45m-16-4 16 4-16 4" fill="none" stroke="#66897c" strokeWidth=".6"/><text x="215" y="32" fill="#a6b8a6" fontSize="9" fontFamily="monospace">FIG. 001</text></svg></div>
          <div className="guide-entry"><span className="entry-number">01</span><div><h3>The lucent</h3><p>A little wanderer drawn to light. As it feeds, it grows brighter and leaves a trace of colored sediment.</p></div></div>
          <div className="guide-entry"><span className="entry-number">02</span><div><h3>A gift of light</h3><p>Touch or hold inside the shoreline. Your light slowly fades, and nearby lucents come to feed. A full pool needs a moment to catch up.</p></div></div>
          <div className="guide-entry"><span className="entry-number">03</span><div><h3>What remains</h3><p>Pigment settles on the pool floor. Watch the landscape change as the lucents travel. Perhaps something else will learn to live on it.</p></div></div>
          <div className="guide-controls"><p className="eyebrow">WAYS TO VISIT</p><p><kbd>L</kbd> Leave light <kbd>O</kbd> Observe <kbd>Space</kbd> Pause</p><p>Tab to the pool, move with arrow keys, then press Enter. <kbd>Esc</kbd> closes these notes.</p></div>
        </>}
        {panel === 'specimen' && <>
          <h2 id="panel-title">A lucent,<br/><em>briefly known.</em></h2>
          <p className="panel-intro">Every wanderer is part of the same small story.</p>
          {selected ? <><div className="specimen-orb" aria-hidden="true"/><p className="eyebrow">LUCENT / {String(selected.id).padStart(3, '0')}</p><dl className="specimen-details"><div><dt>Time in the pool</dt><dd>{timeLabel(selected.age)}</dd></div><div><dt>Energy</dt><dd>{Math.round(selected.energy * 50)}%</dd></div><div><dt>Disposition</dt><dd>{selected.energy > 1 ? 'Radiant' : selected.energy > 0.4 ? 'Wandering' : 'Seeking light'}</dd></div></dl><p className="guide-caption">Leave light nearby and watch this one's path change.</p></> : <p className="panel-intro">Choose Observe and touch a creature in the water.</p>}
        </>}
        {panel === 'pocket' && <>
          <h2 id="panel-title">A world<br/><em>in your pocket.</em></h2>
          <p className="panel-intro">Your tidepool is {storageAvailable ? 'remembered automatically on this device' : 'running without automatic saves'}. Take a snapshot to carry it somewhere else.</p>
          <div className="snapshot-stamp"><Icon name="spark" size={38}/><span>THE FIRST SHORE</span><strong>{timeLabel(stats.elapsed)}</strong><span>{stats.population} LUCENTS · SEED {worldRef.current.seed}</span></div>
          <button className="primary-button" onClick={exportSnapshot}><Icon name="download"/>Save a snapshot <Icon name="arrow"/></button>
          <button className="secondary-button" onClick={() => importRef.current?.click()}><Icon name="upload"/>Open a snapshot</button>
          <p className="snapshot-feedback" role="status">{notice}</p>
          <p className="guide-caption">Opening a snapshot replaces the current pool. Save this one first if you'd like to keep both. A snapshot captures this version of the world.</p>
        </>}
        <div className="panel-foot">ELSEWHERE <span>CHAPTER 01</span></div>
      </aside>
    </>}
    <input ref={importRef} type="file" accept=".json,application/json" hidden aria-label="Open tidepool snapshot" onChange={importSnapshot}/>
    <dialog ref={resetRef} className="reset-dialog" aria-labelledby="reset-title" onClose={() => resetTriggerRef.current?.focus()}>
      <p className="eyebrow">THE TIDE TURNS</p><h2 id="reset-title">Begin again?</h2><p>The pool will return to its first moment. Save a snapshot first to keep what you've made.</p>
      <div className="dialog-actions"><button className="secondary-button" autoFocus onClick={() => resetRef.current?.close()}>Stay here</button><button className="primary-button" onClick={resetWorld}>Begin again <Icon name="reset"/></button></div>
    </dialog>
    <p className="sr-only" role="status" aria-live="polite">{notice}</p>
    {feedback && !panel && <div className="action-notice" aria-hidden="true">{feedback}</div>}
    {!storageAvailable && <div className="storage-notice">Automatic saving is unavailable. Use “Pocket this world” to keep a snapshot.</div>}
    {reducedMotion && paused && <div className="motion-notice">Opened quietly for your motion preference. Press Play to bring it to life.</div>}
  </main>;
}
