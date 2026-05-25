/**
 * scrollDebug — dev-only message-list scroll recorder.
 *
 * NOT WIRED INTO PRODUCTION CODE. This file exists for ad-hoc debugging of
 * the message-list scroll behavior. To use, temporarily import + call from
 * MessageList, DirectMessage, MessageService, or wherever you need the
 * signal during a debugging session:
 *
 *   import { scrollDebug } from '../../dev/scrollDebug';
 *   useEffect(() => {
 *     const el = document.querySelector('[data-virtuoso-scroller]');
 *     if (el) scrollDebug.attach(el as HTMLElement);
 *   }, []);
 *   // and/or sprinkle: scrollDebug.log({ kind: 'note', note: '...' });
 *
 * Then from DevTools console:
 *
 *   1. Filter the console for: SCROLL-DEBUG
 *   2. __scrollDebug.startSession('what-you-are-testing')
 *   3. Reproduce the behavior
 *   4. __scrollDebug.endSession()
 *      → copies a Markdown report to clipboard + downloads as .md backup
 *
 * Captures: every scrollTop write (with stack trace), every item resize
 * (with snapshot of which children were mounted at resize time), item
 * add/remove, plus whatever .log() calls you sprinkle in. Auto-flags
 * scrollTop drops larger than 30px from non-application code as suspect.
 * SessionStorage persistence across page reloads.
 *
 * Built during the investigation documented in
 * .agents/bugs/2026-05-24-virtuoso-measurement-scroll-reset.md. Architecture
 * reference: .agents/docs/features/messages/scroll-anchoring.md.
 *
 * API surface (via window.__scrollDebug):
 *   startSession(label) / endSession() / clear() / dump()
 *   attach(scrollerEl)
 *   snapEnabled  — flag, gates legacy snap-loop call sites (kept for back-compat)
 *   verbose      — also stream events to console live
 */

type ScrollEventKind =
  | 'session-start'
  | 'session-end'
  | 'scrollTop-set'
  | 'scroll-untracked'  // scrollTop changed but our setter wrapper didn't see it
  | 'item-resize'
  | 'item-added'
  | 'item-removed'
  | 'addMessage'
  | 'render'
  | 'followOutput'
  | 'atBottomStateChange'
  | 'rangeChanged'
  | 'snap-raf'
  | 'snap-timeout'
  | 'submit-snap'
  | 'note';

export type ScrollEvent = {
  t: number;                // ms relative to session start (or first event)
  kind: ScrollEventKind;
  scrollTop?: number;
  prev?: number;
  scrollHeight?: number;
  clientHeight?: number;
  gap?: number;             // scrollHeight - clientHeight - scrollTop (0 = at bottom)
  delta?: number;           // generic delta (item height change, scrollTop diff)
  itemIndex?: number;       // which item this event refers to
  itemId?: string;          // message id or data attribute
  note?: string;
  stack?: string;           // trimmed stack trace (scrollTop-set only)
  suspect?: boolean;        // true = automatically flagged as likely-jank
};

const TAG = '[SCROLL-DEBUG]';
const STORAGE_KEY = '__scrollDebug.buffer';
const MAX_EVENTS = 2000;
const JANK_THRESHOLD_PX = 30;      // scrollTop decrease larger than this = suspect
const OUR_WRITERS = ['snap-raf', 'snap-timeout', 'submit-snap', 'scrollToIndex'];

class ScrollDebug {
  events: ScrollEvent[] = [];
  origin: number | null = null;
  snapEnabled = true;
  verbose = false;
  sessionLabel: string | null = null;

  private wrappedElement: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  private observedItems = new WeakSet<Element>();
  private itemHeights = new WeakMap<Element, number>();
  private lastKnownScrollTop: number | null = null;

  /**
   * Snapshot which interesting child elements are mounted inside a message
   * row. Returns a short string like "avatar+header+content+sending+receipt".
   * Helps correlate item-resize events with what changed visually.
   */
  private snapshotMessageChildren(itemEl: HTMLElement): string {
    const present: string[] = [];
    if (itemEl.querySelector('.message-row-first, .message-compact')) present.push('compact');
    if (itemEl.querySelector('.message-avatar, [class*="avatar"]')) present.push('avatar');
    if (itemEl.querySelector('.message-header, .message-meta')) present.push('header');
    if (itemEl.querySelector('.message-status.sending')) present.push('sending');
    if (itemEl.querySelector('.message-status.failed')) present.push('failed');
    if (itemEl.querySelector('.message-status.delivered')) present.push('receipt');
    if (itemEl.querySelector('.reactions-list, [class*="reaction"]')) present.push('reactions');
    if (itemEl.querySelector('.thread-indicator, [class*="thread"]')) present.push('thread');
    if (itemEl.querySelector('.message-date-separator')) present.push('dateSep');
    if (itemEl.querySelector('img[src]')) present.push('img');
    return present.join('+') || '(none)';
  }

  constructor() {
    this.restoreFromStorage();
  }

  // ===== Session control =====

  startSession(label?: string) {
    this.clear();
    this.sessionLabel = label || 'unnamed';
    this.origin = performance.now();
    this.log({
      kind: 'session-start',
      note: `label="${this.sessionLabel}" snapEnabled=${this.snapEnabled} url=${location.pathname}`,
    });
    // eslint-disable-next-line no-console
    console.log(`${TAG} session "${this.sessionLabel}" started. Send messages now. Run __scrollDebug.endSession() when done.`);
  }

  endSession() {
    this.log({
      kind: 'session-end',
      note: `label="${this.sessionLabel}" eventCount=${this.events.length}`,
    });
    const report = this.buildMarkdownReport();
    const suspectCount = this.events.filter(e => e.suspect).length;

    // Download report file (the only reliable path — clipboard often blocked when console focused)
    try {
      const blob = new Blob([report], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      a.href = url;
      a.download = `scroll-debug-${stamp}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      // eslint-disable-next-line no-console
      console.log(`${TAG} END — events:${this.events.length} suspects:${suspectCount} — downloaded ${a.download}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`${TAG} download failed: ${err}. Report below — copy manually:\n${report}`);
    }

    return report;
  }

  // ===== Event recording =====

  log(e: Omit<ScrollEvent, 't'>) {
    if (this.origin === null) this.origin = performance.now();
    const t = +(performance.now() - this.origin).toFixed(1);
    const event: ScrollEvent = { t, ...e };
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) this.events.shift();
    this.persistThrottled();
    if (this.verbose) {
      // eslint-disable-next-line no-console
      console.log(`${TAG} ${t}ms ${e.kind}`, e);
    }
  }

  clear() {
    this.events = [];
    this.origin = null;
    this.sessionLabel = null;
    try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
    // eslint-disable-next-line no-console
    console.log(`${TAG} cleared.`);
  }

  dump() {
    // eslint-disable-next-line no-console
    console.log(`${TAG} ${this.events.length} events:`);
    // eslint-disable-next-line no-console
    console.table(this.events.map(e => ({
      t: e.t,
      kind: e.kind,
      scrollTop: e.scrollTop,
      prev: e.prev,
      gap: e.gap,
      delta: e.delta,
      itemIndex: e.itemIndex,
      suspect: e.suspect,
      note: e.note,
    })));
    // eslint-disable-next-line no-console
    console.log(`${TAG} full events (with stacks):`, this.events);
  }

  // ===== Observers =====

  /**
   * Wrap scrollTop setter and attach observers. Call once the Virtuoso scroller
   * element exists in the DOM. Idempotent for the same element.
   */
  attach(scroller: HTMLElement) {
    if (this.wrappedElement === scroller) return;
    this.wrappedElement = scroller;

    // 1. Wrap scrollTop setter
    let proto: any = Object.getPrototypeOf(scroller);
    let nativeDesc: PropertyDescriptor | undefined;
    while (proto && !nativeDesc) {
      nativeDesc = Object.getOwnPropertyDescriptor(proto, 'scrollTop');
      proto = Object.getPrototypeOf(proto);
    }
    if (!nativeDesc || !nativeDesc.get || !nativeDesc.set) {
      // eslint-disable-next-line no-console
      console.warn(`${TAG} could not find native scrollTop descriptor`);
      return;
    }
    const nativeGet = nativeDesc.get;
    const nativeSet = nativeDesc.set;
    const debug = this;

    Object.defineProperty(scroller, 'scrollTop', {
      configurable: true,
      get() {
        return nativeGet.call(this);
      },
      set(value: number) {
        const prev = nativeGet.call(this);
        const el = this as HTMLElement;
        const scrollHeight = el.scrollHeight;
        const clientHeight = el.clientHeight;
        const stack = (new Error().stack || '').split('\n').slice(2, 10).join('\n');
        const delta = value - prev;
        const isOurs = OUR_WRITERS.some(w => stack.includes(w));
        const suspect = !isOurs && delta < -JANK_THRESHOLD_PX;
        debug.log({
          kind: 'scrollTop-set',
          scrollTop: value,
          prev,
          scrollHeight,
          clientHeight,
          gap: scrollHeight - clientHeight - value,
          delta,
          stack,
          suspect,
          note: suspect ? `LIKELY JANK: scrollTop dropped ${-delta}px from non-ours code` : undefined,
        });
        nativeSet.call(this, value);
      },
    });

    // 1b. Native 'scroll' event listener — catches ALL scrollTop changes
    // regardless of API used. Virtuoso may write via Element.scrollTo() or
    // through some path that bypasses our property-descriptor wrapper.
    // We compare the current scrollTop to the last value seen by ANY of our
    // hooks; if it changed but we didn't log a scrollTop-set, that's an
    // untracked write — the smoking gun for the silent-write theory.
    scroller.addEventListener('scroll', () => {
      const cur = nativeGet.call(scroller);
      // Was the most recent scroll-affecting event a setter write to the same value?
      // Look back a small window of recent events for a matching write.
      const recent = this.events.slice(-5);
      const matched = recent.some(e =>
        (e.kind === 'scrollTop-set' || e.kind === 'snap-raf' || e.kind === 'snap-timeout' || e.kind === 'submit-snap')
        && typeof e.scrollTop === 'number'
        && Math.abs(e.scrollTop - cur) < 1
      );
      const prev = this.lastKnownScrollTop ?? cur;
      const delta = cur - prev;
      if (!matched && Math.abs(delta) >= 1) {
        const sH = scroller.scrollHeight;
        const cH = scroller.clientHeight;
        // Capture a tight stack trace of whoever is currently on the JS event-loop.
        // Scroll events fire async after the write, so this stack rarely contains
        // the original writer — but it can still tell us if it was a frame callback,
        // resize observer, etc.
        const stack = (new Error().stack || '').split('\n').slice(2, 8).join('\n');
        this.log({
          kind: 'scroll-untracked',
          scrollTop: cur,
          prev,
          scrollHeight: sH,
          clientHeight: cH,
          gap: sH - cH - cur,
          delta,
          stack,
          suspect: delta < -JANK_THRESHOLD_PX,
          note: `scroll fired but no matching setter write logged (delta=${delta.toFixed(1)})`,
        });
      }
      this.lastKnownScrollTop = cur;
    }, { passive: true });

    // 2. ResizeObserver on the scroller content — observe each item child
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        const newH = entry.contentRect.height;
        const prevH = this.itemHeights.get(el);
        if (prevH === undefined) {
          this.itemHeights.set(el, newH);
          continue; // initial observation, not a "change"
        }
        if (Math.abs(newH - prevH) < 0.5) continue; // noise
        this.itemHeights.set(el, newH);
        const indexAttr = el.getAttribute('data-item-index');
        const knownIndex = indexAttr ? parseInt(indexAttr, 10) : undefined;
        // Snapshot which Message child elements are mounted at the moment of
        // the resize — helps correlate the height delta with what changed
        // visually (sending indicator, reactions, thread badge, etc.).
        const childSnap = this.snapshotMessageChildren(el);
        this.log({
          kind: 'item-resize',
          itemIndex: knownIndex,
          delta: +(newH - prevH).toFixed(1),
          note: `${prevH.toFixed(1)} → ${newH.toFixed(1)} | children: ${childSnap}`,
        });
      }
    });

    // 3. MutationObserver — detect added/removed items, and start observing them
    this.mutationObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          // Each direct child of the inner Virtuoso list is an item
          const items = node.matches('[data-item-index]')
            ? [node]
            : Array.from(node.querySelectorAll('[data-item-index]'));
          for (const item of items) {
            if (this.observedItems.has(item)) continue;
            this.observedItems.add(item);
            this.resizeObserver?.observe(item);
            const indexAttr = item.getAttribute('data-item-index');
            this.log({
              kind: 'item-added',
              itemIndex: indexAttr ? parseInt(indexAttr, 10) : undefined,
              note: `height=${(item as HTMLElement).offsetHeight}`,
            });
          }
        });
        m.removedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          const items = node.matches('[data-item-index]')
            ? [node]
            : Array.from(node.querySelectorAll('[data-item-index]'));
          for (const item of items) {
            const indexAttr = item.getAttribute('data-item-index');
            this.log({
              kind: 'item-removed',
              itemIndex: indexAttr ? parseInt(indexAttr, 10) : undefined,
            });
          }
        });
      }
    });
    this.mutationObserver.observe(scroller, { childList: true, subtree: true });

    // Observe items already present
    scroller.querySelectorAll('[data-item-index]').forEach((item) => {
      if (this.observedItems.has(item)) return;
      this.observedItems.add(item);
      this.resizeObserver?.observe(item);
    });

    // eslint-disable-next-line no-console
    console.log(`${TAG} attached to scroller. Use __scrollDebug.startSession('label') to begin.`);
  }

  // ===== Markdown report =====

  buildMarkdownReport(): string {
    const lines: string[] = [];
    const suspects = this.events.filter(e => e.suspect);
    lines.push(`# Scroll-Debug Report`);
    lines.push('');
    lines.push(`- **Session label:** ${this.sessionLabel || 'unnamed'}`);
    lines.push(`- **URL:** ${location.pathname}`);
    lines.push(`- **Timestamp:** ${new Date().toISOString()}`);
    lines.push(`- **Total events:** ${this.events.length}`);
    lines.push(`- **Suspects (auto-flagged jank):** ${suspects.length}`);
    lines.push(`- **Snap workarounds enabled:** ${this.snapEnabled}`);
    lines.push('');
    lines.push(`## Timeline`);
    lines.push('');
    lines.push('| t (ms) | kind | scrollTop | prev | gap | Δ | item | note |');
    lines.push('|---:|---|---:|---:|---:|---:|---:|---|');
    for (const e of this.events) {
      const marker = e.suspect ? '🔴 ' : '';
      lines.push(
        `| ${e.t} | ${marker}${e.kind} | ${fmt(e.scrollTop)} | ${fmt(e.prev)} | ${fmt(e.gap)} | ${fmt(e.delta)} | ${fmt(e.itemIndex)} | ${(e.note ?? '').replace(/\|/g, '\\|')} |`
      );
    }
    if (suspects.length > 0) {
      lines.push('');
      lines.push(`## Suspect events (stack traces)`);
      lines.push('');
      for (const s of suspects) {
        lines.push(`### t=${s.t}ms — ${s.kind}`);
        lines.push(`- scrollTop: ${s.prev} → ${s.scrollTop} (Δ${s.delta})`);
        lines.push(`- note: ${s.note ?? ''}`);
        lines.push('```');
        lines.push(s.stack || '(no stack)');
        lines.push('```');
        lines.push('');
      }
    }
    return lines.join('\n');
  }

  // ===== Persistence =====

  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private persistThrottled() {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
          origin: this.origin,
          sessionLabel: this.sessionLabel,
          events: this.events,
        }));
      } catch {
        // sessionStorage may be full; ignore
      }
    }, 200);
  }

  private restoreFromStorage() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      this.origin = parsed.origin;
      this.sessionLabel = parsed.sessionLabel;
      this.events = parsed.events || [];
      if (this.events.length > 0) {
        // eslint-disable-next-line no-console
        console.log(`${TAG} restored ${this.events.length} events from previous page (sessionStorage).`);
      }
    } catch {
      // ignore
    }
  }
}

function fmt(v: number | undefined): string {
  if (v === undefined || v === null) return '';
  return typeof v === 'number' ? v.toFixed(1).replace(/\.0$/, '') : String(v);
}

export const scrollDebug = new ScrollDebug();

if (typeof window !== 'undefined') {
  (window as any).__scrollDebug = scrollDebug;
}
