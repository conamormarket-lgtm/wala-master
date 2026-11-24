// A running clock does not prove that the browser has presented a video frame.
// Wait for the compositor when available; never leave a failed start as a blank tile.
export function prepareDetailVideo(video, { autoPlay, muted, enabled = true, onState }) {
  let disposed = false, frame = null, timer = null, previewTime = null, recovered = false, needsGesture = false;
  const hasFrameCallback = typeof video.requestVideoFrameCallback === 'function';
  const state = value => { if (!disposed) onState(value); };
  const clearWatch = () => {
    clearTimeout(timer);
    timer = null;
    if (frame !== null) video.cancelVideoFrameCallback?.(frame);
    frame = null;
  };
  const ready = () => { clearWatch(); state(needsGesture ? 'manual' : 'ready'); };
  const visible = () => {
    if (video.ownerDocument?.visibilityState === 'hidden') return false;
    const rect = video.getBoundingClientRect();
    const win = video.ownerDocument?.defaultView;
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0
      && (!win || (rect.top < win.innerHeight && rect.left < win.innerWidth));
  };
  const watchFrame = () => {
    if (disposed || frame !== null || !hasFrameCallback) return;
    frame = video.requestVideoFrameCallback(() => { if (!disposed) ready(); });
  };
  const watchPlayback = () => {
    if (!hasFrameCallback || disposed || video.paused || !enabled) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (disposed || video.paused) return;
      // Offscreen/background videos may legitimately stop presenting frames.
      if (!visible()) { watchPlayback(); return; }
      if (video.readyState < 2) { watchPlayback(); return; }
      if (!recovered && video.readyState >= 2 && Number.isFinite(video.duration)) {
        recovered = true;
        // Request a fresh decoded frame without restarting the clip or its audio.
        video.currentTime = Math.min(video.currentTime + 0.001, Math.max(0, video.duration - 0.001));
        watchPlayback();
      } else {
        clearWatch();
        video.pause();
        state('retry');
      }
    }, 2500);
  };
  const loaded = () => {
    if (video.readyState < 2 || video.seeking) return;
    if (hasFrameCallback) watchFrame(); else ready();
  };
  const metadata = () => {
    // Existing uploads without a poster also need a still image before play.
    if (video.paused && !video.poster && Number.isFinite(video.duration) && video.duration > 0) {
      previewTime = video.currentTime === 0 ? Math.min(0.1, video.duration / 2) : null;
      watchFrame();
      video.currentTime = previewTime ?? video.currentTime;
    } else if (video.poster && video.paused) ready();
  };
  const playing = () => {
    if (previewTime !== null && Math.abs(video.currentTime - previewTime) < 0.05) video.currentTime = 0;
    previewTime = null;
    needsGesture = false;
    clearWatch();
    watchFrame();
    if (hasFrameCallback) watchPlayback(); else loaded();
  };
  const failed = () => { clearWatch(); state('error'); };
  const start = () => { recovered = false; needsGesture = false; };
  const listeners = { loadedmetadata: metadata, loadeddata: loaded, seeked: loaded, play: start, playing, error: failed };
  for (const [event, listener] of Object.entries(listeners)) video.addEventListener(event, listener);
  video.muted = muted;
  video.defaultMuted = muted;
  video.playsInline = true;
  state(video.poster ? 'ready' : 'loading');
  watchFrame();
  if (!enabled) video.pause();
  const play = () => {
    recovered = false;
    needsGesture = false;
    state(video.poster ? 'ready' : 'loading');
    watchFrame();
    const pending = video.play();
    pending?.catch(error => {
      if (disposed || error.name === 'AbortError') return;
      clearWatch();
      needsGesture = error.name === 'NotAllowedError';
      metadata();
      state(needsGesture ? 'manual' : 'error');
    });
    return pending;
  };
  if (autoPlay && enabled) play();
  if (video.readyState >= 1) metadata();
  if (video.readyState >= 2) loaded();
  return {
    retry() {
      clearWatch();
      previewTime = null;
      if (video.error) video.load();
      play();
    },
    dispose() {
      disposed = true;
      clearWatch();
      for (const [event, listener] of Object.entries(listeners)) video.removeEventListener(event, listener);
      video.pause();
    },
  };
}
