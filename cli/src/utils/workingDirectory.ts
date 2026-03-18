export const HAPI_SPAWN_TARGET_CWD_ENV = 'HAPI_SPAWN_TARGET_CWD';

export function getWorkingDirectory(): string {
    const targetCwd = process.env[HAPI_SPAWN_TARGET_CWD_ENV]?.trim();
    if (targetCwd) {
        return targetCwd;
    }
    return process.cwd();
}
