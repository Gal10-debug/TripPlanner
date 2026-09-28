// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ScenicBackground from './ScenicBackground';

afterEach(cleanup);
it('lets the traveler pause and resume the scenic background', () => {
    const { container } = render(<ScenicBackground />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause background motion' }));
    expect(container.querySelector('.scenic-background--paused')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Resume background motion' }));
    expect(container.querySelector('.scenic-background--paused')).toBeNull();
});
