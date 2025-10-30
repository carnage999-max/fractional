// lib/safeImport.ts
export async function safeDynamicImport<T>(
    importer: () => Promise<T>,
    retries = 3,
    delay = 500
): Promise<T> {
    try {
        return await importer();
    } catch (err: any) {
        if (retries <= 0) throw err;
        if (err?.name === "ChunkLoadError" || /Loading chunk/.test(err?.message)) {
            console.warn("[safeImport] Chunk load failed, retrying...", retries);
            await new Promise((r) => setTimeout(r, delay));
            return safeDynamicImport(importer, retries - 1, delay * 2);
        }
        throw err;
    }
}
