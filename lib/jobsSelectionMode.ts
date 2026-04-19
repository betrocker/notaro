type Listener = (active: boolean) => void;

let isActive = false;
const listeners = new Set<Listener>();

export function setJobsSelectionActive(active: boolean) {
  if (isActive === active) {
    return;
  }
  isActive = active;
  listeners.forEach((listener) => {
    listener(active);
  });
}

export function getJobsSelectionActive() {
  return isActive;
}

export function subscribeJobsSelectionActive(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
