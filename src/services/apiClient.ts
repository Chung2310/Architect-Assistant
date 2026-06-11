interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data: T;
}

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

export const apiClient = {
  getAccessToken(): string | null {
    return localStorage.getItem("accessToken");
  },

  setAccessToken(token: string) {
    localStorage.setItem("accessToken", token);
  },

  clearAccessToken() {
    localStorage.removeItem("accessToken");
  },

  async request<T = unknown>(url: string, options: RequestOptions = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    
    // Automatically set Content-Type if body is an object and not FormData
    if (options.body && !(options.body instanceof FormData) && typeof options.body === "object") {
      headers.set("Content-Type", "application/json");
      options.body = JSON.stringify(options.body);
    }

    const token = this.getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    options.headers = headers;

    const response = await fetch(url, options as RequestInit);

    if (response.status === 401) {
      // If it's a 401 and we are not already refreshing
      if (url.includes("/api/v1/auth/refresh-token")) {
        this.clearAccessToken();
        throw new Error("Session expired");
      }

      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshRes = await fetch("/api/v1/auth/refresh-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" }
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            const newToken = refreshData.data.accessToken;
            this.setAccessToken(newToken);
            isRefreshing = false;
            onRefreshed(newToken);
          } else {
            isRefreshing = false;
            this.clearAccessToken();
            window.dispatchEvent(new Event("auth-logout"));
            throw new Error("Session expired");
          }
        } catch (refreshError) {
          isRefreshing = false;
          this.clearAccessToken();
          window.dispatchEvent(new Event("auth-logout"));
          throw refreshError;
        }
      }

      // Queue requests while refreshing
      return new Promise<T>((resolve, reject) => {
        subscribeTokenRefresh((newToken) => {
          const newHeaders = new Headers(options.headers);
          newHeaders.set("Authorization", `Bearer ${newToken}`);
          options.headers = newHeaders;
          fetch(url, options as RequestInit)
            .then(async (res) => {
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                reject(new Error(err.message || "Request failed"));
                return;
              }
              const json = await res.json();
              resolve(json as T);
            })
            .catch(reject);
        });
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Request failed with status ${response.status}`);
    }

    return await response.json() as T;
  },

  async get<T = unknown>(url: string, options: RequestOptions = {}): Promise<T> {
    return apiClient.request<T>(url, { ...options, method: "GET" });
  },

  async post<T = unknown>(url: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return apiClient.request<T>(url, { ...options, method: "POST", body });
  },

  async patch<T = unknown>(url: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return apiClient.request<T>(url, { ...options, method: "PATCH", body });
  },

  async delete<T = unknown>(url: string, options: RequestOptions = {}): Promise<T> {
    return apiClient.request<T>(url, { ...options, method: "DELETE" });
  }
};
