type Listener = () => void;

const listeners = new Set<Listener>();

export function triggerJobsInlineComposer() {
  listeners.forEach((listener) => {
    listener();
  });
}

export function subscribeJobsInlineComposer(listener: Listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
