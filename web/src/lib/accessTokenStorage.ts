const ACCESS_TOKEN_PREFIX = 'hapi_access_token::'

export function getAccessTokenKey(baseUrl: string): string {
    return `${ACCESS_TOKEN_PREFIX}${baseUrl}`
}

export function getStoredAccessToken(key: string): string | null {
    try {
        return localStorage.getItem(key)
    } catch {
        return null
    }
}

export function storeAccessToken(key: string, token: string): void {
    try {
        localStorage.setItem(key, token)
    } catch {
        // Ignore storage errors
    }
}

export function storeAccessTokenForBaseUrl(baseUrl: string, token: string): void {
    storeAccessToken(getAccessTokenKey(baseUrl), token)
}

export function clearStoredAccessToken(key: string): void {
    try {
        localStorage.removeItem(key)
    } catch {
        // Ignore storage errors
    }
}
