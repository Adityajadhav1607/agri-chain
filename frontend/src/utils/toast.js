/**
 * AgriChain Toast Notification System
 * Lightweight, dependency-free toast manager
 */

let _listeners = [];

export function subscribe(fn) {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter(l => l !== fn); };
}

function emit(toast) {
  _listeners.forEach(fn => fn(toast));
}

let _id = 0;

export function toast(msg, type = "info", duration = 4000) {
  const id = ++_id;
  emit({ id, msg, type, duration });
  return id;
}

export const toastSuccess = (msg, duration) => toast(msg, "success", duration);
export const toastError   = (msg, duration) => toast(msg, "error",   duration);
export const toastInfo    = (msg, duration) => toast(msg, "info",    duration);
export const toastLoading = (msg)           => toast(msg, "loading", 99999);
export const toastDismiss = (id)            => emit({ id, dismiss: true });
