// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AccountPrivacy from './AccountPrivacy';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('requires a password and exact confirmation before deletion and preserves errors', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ detail: 'Unable to confirm your password. Please try again later.' }) });
    vi.stubGlobal('fetch', fetch);
    render(<AccountPrivacy />);
    const button = screen.getByRole('button', { name: 'Permanently delete my account' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'WrongPassword1!' } });
    fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), { target: { value: 'DELETE' } });
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Unable to confirm your password. Please try again later.');
    expect(fetch).toHaveBeenCalledWith('/api/account', expect.objectContaining({ method: 'DELETE' }));
});
