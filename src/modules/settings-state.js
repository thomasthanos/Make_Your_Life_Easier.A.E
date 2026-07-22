function normalizeSettingsState(value) {
  const state = value && typeof value === 'object' ? value : {};
  return {
    data: state.data && typeof state.data === 'object' && !Array.isArray(state.data) ? state.data : {},
    updated_at: typeof state.updated_at === 'string' ? state.updated_at : null,
    owner_id: typeof state.owner_id === 'string' && state.owner_id ? state.owner_id : null
  };
}

function prepareSettingsForUser(value, userId) {
  const state = normalizeSettingsState(value);
  if (!userId) return { state, changed: false, reset: false };

  if (state.owner_id && state.owner_id !== userId) {
    return {
      state: { data: {}, updated_at: null, owner_id: userId },
      changed: true,
      reset: true
    };
  }

  if (!state.owner_id) {
    return {
      state: { ...state, owner_id: userId },
      changed: true,
      reset: false
    };
  }

  return { state, changed: false, reset: false };
}

module.exports = { normalizeSettingsState, prepareSettingsForUser };
