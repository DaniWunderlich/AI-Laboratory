export async function api<T>(
  path: string,
  body?: unknown,
  method?: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(
    path.startsWith("/healthz") ? path : `/api/v1${path}`,
    {
      signal,
      method: method ?? (body === undefined ? "GET" : "POST"),
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const detail = data.error ?? data.detail ?? response.statusText;
    const message =
      typeof detail === "string"
        ? detail
        : detail.errors
          ? detail.errors
              .map((item: { message: string }) => item.message)
              .join(" ")
          : detail.details
            ? detail.details
                .map(
                  (item: { location: string[]; message: string }) =>
                    `${item.location.join(".")}: ${item.message}`,
                )
                .join(" ")
            : (detail.message ?? JSON.stringify(detail));
    throw new Error(message);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
