import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearChatState,
  getDraft,
  getOpenKey,
  setDraft,
  setOpenKey,
  setStateIdentity,
} from '../../src/js/chat/state.js';

describe('identity-scoped chat session state', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    setStateIdentity(null);
  });

  it('never exposes one seat draft or open thread to another seat', () => {
    setStateIdentity('Lotan');
    setOpenKey('DM|Lotan');
    setDraft('DM|Lotan', 'private draft');

    setStateIdentity('Valentro');
    expect(getOpenKey()).toBeNull();
    expect(getDraft('DM|Lotan')).toBe('');

    setOpenKey('party');
    setStateIdentity('Lotan');
    expect(getOpenKey()).toBe('DM|Lotan');
    expect(getDraft('DM|Lotan')).toBe('private draft');
  });

  it('purges the outgoing seat and removes the unsafe legacy key', () => {
    window.sessionStorage.setItem('vos:chat:state', '{"drafts":{"party":"old"}}');
    setStateIdentity('Lotan');
    setDraft('party', 'leave no trace');

    clearChatState('Lotan');
    setStateIdentity('Lotan');

    expect(getDraft('party')).toBe('');
    expect(window.sessionStorage.getItem('vos:chat:state')).toBeNull();
  });
});
