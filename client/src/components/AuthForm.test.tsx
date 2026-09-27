// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AuthForm from './AuthForm';
import { requestPasswordReset, resetPassword } from '../services/authServices';
vi.mock('../services/authServices', () => ({ requestPasswordReset: vi.fn(), resetPassword: vi.fn() }));
afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());

function startRecovery() {
  render(<AuthForm onAuthenticated={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Forgot your password?' }));
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'traveler@example.com' } });
}
function enterNewPassword() {
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'NewPassword123!' } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'NewPassword123!' } });
}
it('completes the email-code flow when production returns no token', async () => {
  vi.mocked(requestPasswordReset).mockResolvedValue(null);
  vi.mocked(resetPassword).mockResolvedValue(undefined);
  startRecovery();
  fireEvent.click(screen.getByRole('button', { name: /Send reset code/ }));
  expect(await screen.findByRole('heading', { name: 'Choose a new password' })).toBeTruthy();
  expect(screen.getByLabelText('Reset code')).toHaveProperty('value', '');
  fireEvent.change(screen.getByLabelText('Reset code'), { target: { value: ' emailed-code ' } });
  enterNewPassword();
  fireEvent.click(screen.getByRole('button', { name: /Update password/ }));
  expect(await screen.findByText('Password updated. You can now sign in.')).toBeTruthy();
  expect(resetPassword).toHaveBeenCalledWith('traveler@example.com', 'emailed-code', 'NewPassword123!');
});
it('accepts an existing code after reopening the site and displays reset errors', async () => {
  vi.mocked(resetPassword).mockRejectedValue(new Error('The reset code is invalid or has expired.'));
  startRecovery();
  fireEvent.click(screen.getByRole('button', { name: 'I already have a reset code' }));
  fireEvent.change(screen.getByLabelText('Reset code'), { target: { value: 'expired-code' } });
  enterNewPassword();
  fireEvent.click(screen.getByRole('button', { name: /Update password/ }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'The reset code is invalid or has expired.');
  fireEvent.click(screen.getByRole('button', { name: 'Request another reset code' }));
  expect(screen.getByRole('button', { name: /Send reset code/ })).toBeTruthy();
});
it('retains the development token shortcut', async () => {
  vi.mocked(requestPasswordReset).mockResolvedValue('development-code');
  startRecovery();
  fireEvent.click(screen.getByRole('button', { name: /Send reset code/ }));
  expect(await screen.findByLabelText('Reset code')).toHaveProperty('value', 'development-code');
});
it('shows email service failures without advancing to the reset form', async () => {
  vi.mocked(requestPasswordReset).mockRejectedValue(new Error('Password reset is temporarily unavailable. Please try again later.'));
  startRecovery();
  fireEvent.click(screen.getByRole('button', { name: /Send reset code/ }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByLabelText('Reset code')).toBeNull();
});
it('rejects mismatched new passwords before submitting a reset', async () => {
  startRecovery();
  fireEvent.click(screen.getByRole('button', { name: 'I already have a reset code' }));
  fireEvent.change(screen.getByLabelText('Reset code'), { target: { value: 'code' } });
  enterNewPassword();
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'Different123!' } });
  fireEvent.click(screen.getByRole('button', { name: /Update password/ }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'The passwords do not match.');
  expect(resetPassword).not.toHaveBeenCalled();
});
