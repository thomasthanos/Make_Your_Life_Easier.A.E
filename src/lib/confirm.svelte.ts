// Promise-based confirmation dialog: `if (await confirm({...})) { ... }`

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as destructive/risky. */
  danger?: boolean;
}

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

class ConfirmState {
  current = $state<Pending | null>(null);

  ask(options: ConfirmOptions): Promise<boolean> {
    this.current?.resolve(false);
    return new Promise((resolve) => {
      this.current = { ...options, resolve };
    });
  }

  answer(ok: boolean) {
    const pending = this.current;
    this.current = null;
    pending?.resolve(ok);
  }
}

export const confirmState = new ConfirmState();

export function confirm(options: ConfirmOptions): Promise<boolean> {
  return confirmState.ask(options);
}
