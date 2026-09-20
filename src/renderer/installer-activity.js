export function createInstallerActivity() {
    let state = { busy: false, kind: null, outcomes: {} };
    const listeners = new Set();
    const snapshot = () => ({ ...state, outcomes: { ...state.outcomes } });
    const publish = () => {
        for (const listener of listeners) {
            try { listener(snapshot()); } catch (error) { console.error('Installer activity view:', error); }
        }
    };
    return {
        snapshot,
        begin(kind) {
            if (state.busy) return false;
            state = { busy: true, kind, current: 0, total: 0, name: '', success: 0, failed: 0, outcomes: {} };
            publish();
            return true;
        },
        update(patch) {
            state = { ...state, ...patch };
            publish();
        },
        record(id, outcome) {
            state = { ...state, outcomes: { ...state.outcomes, [id]: outcome } };
            publish();
        },
        finish(patch = {}) {
            state = { ...state, ...patch, busy: false };
            publish();
        },
        subscribe(listener) {
            listeners.add(listener);
            listener(snapshot());
            return () => listeners.delete(listener);
        }
    };
}

export const installerActivity = createInstallerActivity();
