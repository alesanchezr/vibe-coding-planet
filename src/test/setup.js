import { vi } from 'vitest';

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};
global.localStorage = localStorageMock;

// Mock Supabase client
vi.mock('../backend/supabase-client', () => {
    let hasSession = true;
    const mockSession = {
        user: {
            id: 'test-user-id',
            email: null,
            role: 'anon',
        },
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
    };

    return {
        supabase: {
            auth: {
                signInAnonymously: vi.fn().mockImplementation(() => {
                    hasSession = true;
                    localStorageMock.setItem('supabase.auth.token', JSON.stringify(mockSession));
                    return Promise.resolve({
                        data: { session: mockSession },
                        error: null,
                    });
                }),
                getSession: vi.fn().mockImplementation(() => {
                    const storedSession = localStorageMock.getItem('supabase.auth.token');
                    return Promise.resolve({
                        data: { session: storedSession ? JSON.parse(storedSession) : null },
                        error: null,
                    });
                }),
                signOut: vi.fn().mockImplementation(() => {
                    hasSession = false;
                    localStorageMock.removeItem('supabase.auth.token');
                    return Promise.resolve({
                        error: null,
                    });
                }),
            },
        },
    };
});

// Mock environment variables
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key'); 