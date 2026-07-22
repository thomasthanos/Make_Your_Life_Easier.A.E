function profileFromUser(user, providerOverride = null) {
  if (!user) return null;
  const metadata = user.user_metadata || {};
  const provider = providerOverride || user.app_metadata?.provider || user.identities?.[0]?.provider || 'unknown';
  return {
    id: user.id,
    name: metadata.full_name || metadata.name || metadata.user_name || user.email || 'User',
    avatar: metadata.avatar_url || metadata.picture || null,
    provider
  };
}

module.exports = { profileFromUser };
