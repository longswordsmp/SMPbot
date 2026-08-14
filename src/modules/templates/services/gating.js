'use strict';

/**
 * Verification gating for server templates.
 *
 * When a template is applied with gating on, unverified members (who have only
 * `@everyone`) can see NOTHING except the verification channel. Verifying grants
 * the template's member/verified role, which reveals the rest of the server.
 *
 * This works purely by transforming the template's overwrite specs BEFORE they
 * are resolved to ids, so it composes with every existing preset (open /
 * readOnly / staffOnly / logChannel …) without touching them.
 */

const VIEW = 'ViewChannel';
const READ = 'ReadMessageHistory';

/** A synthetic verification channel injected when a gated template has none. */
function verifyCategory() {
  return {
    name: 'WELCOME',
    __synthetic: true,
    channels: [
      {
        name: 'verify',
        type: 'text',
        emoji: '✅',
        marker: 'verification',
        topic: 'Verify here to unlock the rest of the server.',
        overwrites: [{ roleKey: '@everyone', allow: [VIEW, READ], deny: ['SendMessages', 'AddReactions', 'CreatePublicThreads'] }],
      },
    ],
  };
}

/** Does any channel in the template carry the verification marker? */
function hasVerifyChannel(tpl) {
  return tpl.categories.some((c) => c.channels.some((ch) => ch.marker === 'verification'));
}

/** The member/verified role key a gated template reveals channels to. */
function memberRoleKey(tpl) {
  const flagged = tpl.roles.find((r) => r.gate);
  if (flagged) return flagged.key;
  const byKey = tpl.roles.find((r) => r.key === 'member' || r.key === 'verified');
  if (byKey) return byKey.key;
  // Fall back to the lowest non-staff role, if any.
  const nonStaff = tpl.roles.filter((r) => !r.staff);
  return nonStaff.length ? nonStaff[nonStaff.length - 1].key : null;
}

/** Deep-copy overwrite entries so we never mutate the template definition. */
function cloneEntries(entries) {
  return (Array.isArray(entries) ? entries : []).map((e) => ({
    roleKey: e.roleKey,
    allow: Array.isArray(e.allow) ? [...e.allow] : [],
    deny: Array.isArray(e.deny) ? [...e.deny] : [],
  }));
}

function ensureEntry(list, roleKey) {
  let e = list.find((x) => x.roleKey === roleKey);
  if (!e) {
    e = { roleKey, allow: [], deny: [] };
    list.push(e);
  }
  return e;
}
function allow(e, perm) {
  if (!e.allow.includes(perm)) e.allow.push(perm);
  e.deny = e.deny.filter((d) => d !== perm);
}
function deny(e, perm) {
  if (!e.deny.includes(perm)) e.deny.push(perm);
  e.allow = e.allow.filter((a) => a !== perm);
}

function isHidden(entries) {
  return (Array.isArray(entries) ? entries : []).some(
    (o) => o.roleKey === '@everyone' && Array.isArray(o.deny) && o.deny.includes(VIEW),
  );
}

/**
 * Transform one channel/category's overwrite entries for gating.
 * kind: 'verify' | 'staff' | 'normal'
 */
function gateEntries(entries, { memberKey, kind }) {
  const list = cloneEntries(entries);

  if (kind === 'verify') {
    const ev = ensureEntry(list, '@everyone');
    allow(ev, VIEW);
    allow(ev, READ);
    deny(ev, 'SendMessages');
    return list;
  }

  if (kind === 'staff') {
    // Already hidden from everyone — just make sure of it.
    deny(ensureEntry(list, '@everyone'), VIEW);
    return list;
  }

  // Normal channel/category: hide from @everyone, reveal to the member role.
  // Any view/read/send semantics @everyone had are transferred to the member
  // role so read-only info channels stay read-only for verified members.
  const existingEveryone = list.find((x) => x.roleKey === '@everyone');
  if (memberKey && existingEveryone) {
    const mem = ensureEntry(list, memberKey);
    if (existingEveryone.allow.includes(VIEW)) allow(mem, VIEW);
    if (existingEveryone.allow.includes(READ)) allow(mem, READ);
    for (const d of existingEveryone.deny) if (d !== VIEW) deny(mem, d);
  }
  deny(ensureEntry(list, '@everyone'), VIEW);
  if (memberKey) allow(ensureEntry(list, memberKey), VIEW);
  return list;
}

/** Classify a channel/category for gating. */
function kindOf(chDef) {
  if (chDef.marker === 'verification') return 'verify';
  if (isHidden(chDef.overwrites)) return 'staff';
  return 'normal';
}

module.exports = { verifyCategory, hasVerifyChannel, memberRoleKey, gateEntries, kindOf, isHidden };
