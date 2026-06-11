interface RequestOptions extends RequestInit {
  body?: any;
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

  async request(url: string, options: RequestOptions = {}): Promise<any> {
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

    try {
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
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((newToken) => {
            const newHeaders = new Headers(options.headers);
            newHeaders.set("Authorization", `Bearer ${newToken}`);
            options.headers = newHeaders;
            resolve(
              fetch(url, options as RequestInit).then(async (res) => {
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  throw new Error(err.message || "Request failed");
                }
                return res.json();
              }).catch(reject)
            );
          });
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Request failed with status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  async get(url: string, options: RequestOptions = {}) {
    return this.request(url, { ...options, method: "GET" });
  },

  async post(url: string, body?: any, options: RequestOptions = {}) {
    return this.request(url, { ...options, method: "POST", body });
  },

  async patch(url: string, body?: any, options: RequestOptions = {}) {
    return this.request(url, { ...options, method: "PATCH", body });
  },

  async delete(url: string, options: RequestOptions = {}) {
    return this.request(url, { ...options, method: "DELETE" });
  }
};
