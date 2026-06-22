/**
 * review-engine/ui/progressClient.js
 * ─────────────────────────────────────────────────────────────
 * 클라이언트 진행 구독 (spec §13/§15) — SSE/polling 추상화.
 * 긴 토론은 서버(edge)에서 돌고, 클라는 진행/비용을 구독만 한다(spec §14).
 * T5 범위: pluggable 추상화 + polling 구현. 실 SSE(EventSource) 연결은 edge 배포(T6+)와 함께 활성화.
 * @module review-engine/ui/progressClient
 */

/**
 * polling 기반 진행 구독. fetchState 는 호출측이 주입(Supabase select 또는 edge GET).
 * @param {{
 *   fetchState: ()=>Promise<Object>,   // 최신 ReviewState(또는 {rounds,budget,phase}) 반환
 *   onTick: (state:Object)=>void,       // 매 폴마다 호출(UI 갱신)
 *   intervalMs?: number,
 *   isDone?: (state:Object)=>boolean,   // true 면 구독 종료(기본: phase∈converged|escalated)
 *   signal?: AbortSignal
 * }} opts
 * @returns {{ stop: ()=>void }}
 */
export function subscribePolling(opts) {
  const intervalMs = opts.intervalMs ?? 2000;
  const isDone = opts.isDone || ((s) => s && (s.phase === 'converged' || s.phase === 'escalated' || s.phase === 'finalized'));
  let stopped = false;
  let timer = null;
  const stop = () => { stopped = true; if (timer) clearTimeout(timer); };
  if (opts.signal) opts.signal.addEventListener('abort', stop, { once: true });

  async function tick() {
    if (stopped) return;
    try {
      const state = await opts.fetchState();
      opts.onTick(state);
      if (isDone(state)) { stop(); return; }
    } catch (e) {
      // 폴 실패는 치명적이지 않음 — 다음 폴에서 재시도(§15 관측만)
      if (opts.onError) opts.onError(e);
    }
    if (!stopped) timer = setTimeout(tick, intervalMs);
  }
  tick();
  return { stop };
}

/**
 * SSE 기반 진행 구독(EventSource). edge가 text/event-stream 으로 라운드 이벤트를 푸시할 때 사용.
 * T5: 인터페이스만 제공(브라우저 EventSource 필요). edge SSE 핸들러는 T6+.
 * @param {{ url:string, onEvent:(ev:Object)=>void, onError?:Function }} opts
 * @returns {{ stop:()=>void }}
 */
export function subscribeSSE(opts) {
  if (typeof EventSource === 'undefined') throw new Error('progressClient: EventSource 미지원 환경(SSE는 브라우저/Deno 전용)');
  const es = new EventSource(opts.url);
  es.onmessage = (e) => { try { opts.onEvent(JSON.parse(e.data)); } catch (err) { opts.onError && opts.onError(err); } };
  es.onerror = (e) => { opts.onError && opts.onError(e); };
  return { stop: () => es.close() };
}

export default { subscribePolling, subscribeSSE };
