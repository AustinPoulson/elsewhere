const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);

function setTimeout(callback, delay, ...args) {
  let wait = delay;
  if (delay === 60_000 && typeof callback === 'function') {
    const source = Function.prototype.toString.call(callback);
    if (source.includes('onTimeoutError') || source.includes('[birpc]')) wait = 600_000;
  }
  return nativeSetTimeout(callback, wait, ...args);
}

globalThis.setTimeout = setTimeout;
