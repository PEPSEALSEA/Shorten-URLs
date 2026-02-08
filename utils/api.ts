
const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbzfXA8wKylXKUYh4Urke_Dd1xgBo_Sng9ywmjfK9HQ4Bo8tqDQREZUZ9sz_rrRGCpMz/exec";
const UPLOAD_ENDPOINT = "https://script.google.com/macros/s/AKfycbxWHUje0tk1zVd37HyhpfOlEuUhzPQxwChdtECtgKtBInpSu142TfoMjGWtVE_74iqm/exec";

// Cache for API responses
const apiCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Request queue to prevent duplicate calls
const requestQueue = new Map<string, Promise<any>>();

export type ProgressCallback = (percent: number) => void;

export async function optimizedFetch(url: string, options: RequestInit = {}, useCache = false, cacheKey: string | null = null) {
    const requestKey = `${url}_${JSON.stringify(options)}`;

    // Check if request is already in progress
    if (requestQueue.has(requestKey)) {
        return requestQueue.get(requestKey);
    }

    // Check cache first
    if (useCache && cacheKey && apiCache.has(cacheKey)) {
        const cached = apiCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            return cached.data;
        }
        apiCache.delete(cacheKey);
    }

    const fetchPromise = fetchWithRetry(url, options);
    requestQueue.set(requestKey, fetchPromise);

    try {
        const result = await fetchPromise;

        // Cache successful responses
        if (useCache && cacheKey && result.success) {
            apiCache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });
        }

        return result;
    } finally {
        requestQueue.delete(requestKey);
    }
}

async function fetchWithRetry(url: string, options: RequestInit = {}, maxRetries = 2): Promise<any> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const isMultipart = options.body instanceof FormData;

            const response = await fetch(url, {
                ...options,
                headers: {
                    ...(isMultipart ? {} : { 'Content-Type': 'application/x-www-form-urlencoded' }),
                    ...options.headers
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error: any) {
            if (attempt === maxRetries) {
                throw error;
            }

            // Exponential backoff
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

export function getGasEndpoint() {
    return GAS_ENDPOINT;
}

export function getUploadEndpoint() {
    return UPLOAD_ENDPOINT;
}

export async function fetchWithProgress(url: string, body: any, onProgress: ProgressCallback): Promise<any> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
                const percent = Math.round((event.loaded / event.total) * 100);
                onProgress(percent);
            }
        });

        xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    resolve(JSON.parse(xhr.responseText));
                } catch (e) {
                    resolve({ success: false, error: "Failed to parse server response" });
                }
            } else {
                reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
            }
        });

        xhr.addEventListener("error", () => reject(new Error("Network connection error")));

        xhr.open("POST", url);
        // Using text/plain for base64 data to avoid auto-parsing issues in GAS
        xhr.setRequestHeader("Content-Type", "text/plain");
        xhr.send(body);
    });
}

export function clearCache() {
    apiCache.clear();
}

export function invalidateCache(key: string) {
    apiCache.delete(key);
}
