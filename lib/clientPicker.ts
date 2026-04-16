export type ClientPickerSelection = {
  token: string;
  clientId: string | null;
  clientName: string | null;
};

type Listener = (selection: ClientPickerSelection) => void;

const listeners = new Set<Listener>();

export function emitClientPickerSelection(selection: ClientPickerSelection) {
  listeners.forEach((listener) => {
    listener(selection);
  });
}

export function subscribeClientPickerSelection(listener: Listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
