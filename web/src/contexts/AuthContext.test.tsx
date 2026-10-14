import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('../lib/api/client', () => ({
  apiClient: {
    GET: (...args: unknown[]) => mockGet(...args),
    POST: (...args: unknown[]) => mockPost(...args),
  },
}));

function Probe() {
  const { user, isLoading, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="user">{user ? user.email : 'null'}</span>
      <button data-testid="login" onClick={() => login({ id: 'u1', email: 'login@test', name: 'Login', role: 'CUSTOMER' })}>
        login
      </button>
      <button data-testid="logout" onClick={() => void logout()}>
        logout
      </button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  it('menginisialisasi user dari GET /auth/me', async () => {
    mockGet.mockResolvedValue({
      data: { id: 'u1', email: 'me@test', name: 'Me', role: 'CUSTOMER' },
      error: undefined,
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('me@test');
    });
    expect(screen.getByTestId('loading').textContent).toBe('false');
    expect(mockGet).toHaveBeenCalledWith('/auth/me');
  });

  it('menyetel user null saat /auth/me gagal', async () => {
    mockGet.mockResolvedValue({ data: undefined, error: { statusCode: 401 } });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('menyetel user null saat /auth/me melempar error', async () => {
    mockGet.mockRejectedValue(new Error('network down'));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('login mengubah state user', async () => {
    mockGet.mockResolvedValue({ data: undefined, error: { statusCode: 401 } });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    act(() => {
      screen.getByTestId('login').click();
    });

    expect(screen.getByTestId('user').textContent).toBe('login@test');
  });

  it('logout memanggil POST /auth/logout dan mereset user', async () => {
    mockGet.mockResolvedValue({
      data: { id: 'u1', email: 'me@test', name: 'Me', role: 'CUSTOMER' },
      error: undefined,
    });
    mockPost.mockResolvedValue({ data: undefined, error: undefined });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('me@test');
    });

    await act(async () => {
      screen.getByTestId('logout').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('null');
    });
    expect(mockPost).toHaveBeenCalledWith('/auth/logout', { body: {} });
  });

  it('event auth:unauthorized mereset user ke null', async () => {
    mockGet.mockResolvedValue({
      data: { id: 'u1', email: 'me@test', name: 'Me', role: 'CUSTOMER' },
      error: undefined,
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('me@test');
    });

    act(() => {
      window.dispatchEvent(new Event('auth:unauthorized'));
    });

    expect(screen.getByTestId('user').textContent).toBe('null');
  });
});
