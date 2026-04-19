type Listener = () => void;

const listeners = new Set<Listener>();

export function triggerHomeInlineProjectComposer() {
  listeners.forEach((listener) => {
    listener();
  });
}

export function subscribeHomeInlineProjectComposer(listener: Listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
