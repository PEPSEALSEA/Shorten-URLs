"use client";

import { useState, useEffect, useCallback, FormEvent, useRef } from "react";
import { optimizedFetch, getGasEndpoint, getUploadEndpoint, invalidateCache } from "@/utils/api";

interface User {
  id: string;
  email: string;
  username: string;
}

interface Link {
  shortCode: string;
  originalUrl: string;
  created: string;
  clicks: number;
  expiryDate?: string;
  driveId?: string;
}

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [mainTab, setMainTab] = useState<"create" | "manage">("create");
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [shortUrlResult, setShortUrlResult] = useState("");
  const [userLinks, setUserLinks] = useState<Link[]>([]);

  // Form states
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");

  const [originalUrl, setOriginalUrl] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  const showLoading = (show: boolean, text = "Loading...") => {
    setLoading(show);
    setLoadingText(text);
  };

  const loadUserLinks = useCallback(async (forceRefresh = false) => {
    if (!currentUser) return;

    const gasEndpoint = getGasEndpoint();
    const cacheKey = `userLinks_${currentUser.id}`;

    showLoading(true, "Loading your links...");
    setError("");

    try {
      const data = await optimizedFetch(
        `${gasEndpoint}?action=getUserLinks&userId=${currentUser.id}`,
        { method: "GET" },
        !forceRefresh,
        cacheKey
      );

      if (data.success) {
        setUserLinks(data.links);
      } else {
        setError(data.error || "Failed to load links");
      }
    } catch (err: unknown) {
      setError("Error loading links: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      showLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && mainTab === "manage") {
      loadUserLinks();
    }
  }, [currentUser, mainTab, loadUserLinks]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    const gasEndpoint = getGasEndpoint();

    showLoading(true, "Logging in...");
    setError("");
    setSuccess("");

    try {
      const data = await optimizedFetch(gasEndpoint, {
        method: "POST",
        body: `action=login&identifier=${encodeURIComponent(loginIdentifier)}&password=${encodeURIComponent(loginPassword)}`,
      });

      if (data.success) {
        const user = data.user;
        setCurrentUser(user);
        localStorage.setItem("currentUser", JSON.stringify(user));
        setSuccess("Login successful!");
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err: unknown) {
      setError("Error connecting to server: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      showLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    const gasEndpoint = getGasEndpoint();

    showLoading(true, "Creating account...");
    setError("");
    setSuccess("");

    try {
      const data = await optimizedFetch(gasEndpoint, {
        method: "POST",
        body: `action=register&email=${encodeURIComponent(registerEmail)}&username=${encodeURIComponent(registerUsername)}&password=${encodeURIComponent(registerPassword)}`,
      });

      if (data.success) {
        setSuccess("Registration successful! Please login.");
        setAuthTab("login");
        setRegisterEmail("");
        setRegisterUsername("");
        setRegisterPassword("");
      } else {
        setError(data.error || "Registration failed");
      }
    } catch (err: unknown) {
      setError("Error connecting to server: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      showLoading(false);
    }
  };

  const handleCreateUrl = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const gasEndpoint = getGasEndpoint();
    const uploadEndpoint = getUploadEndpoint();

    showLoading(true, "Processing request...");
    setError("");
    setSuccess("");
    setShortUrlResult("");

    try {
      let finalUrl = originalUrl;
      let driveId = "";

      // 1. Upload file if selected
      if (selectedFile) {
        setLoadingText("Uploading file to Google Drive...");
        const formData = new FormData();
        formData.append("myFile", selectedFile);
        formData.append("action", "upload");
        formData.append("filename", selectedFile.name);

        const uploadData = await optimizedFetch(uploadEndpoint, {
          method: "POST",
          body: formData,
        });

        if (uploadData.success) {
          finalUrl = uploadData.url;
          driveId = uploadData.driveId;
        } else {
          throw new Error(uploadData.error || "File upload failed");
        }
      }

      // 2. Create Short URL
      setLoadingText("Creating short URL...");
      const bodyParams = new URLSearchParams();
      bodyParams.append("action", "create");
      bodyParams.append("originalUrl", finalUrl);
      bodyParams.append("customSlug", customSlug);
      bodyParams.append("userId", currentUser.id);
      if (expiryDate) bodyParams.append("expiryDate", expiryDate);
      if (driveId) bodyParams.append("driveId", driveId);

      const data = await optimizedFetch(gasEndpoint, {
        method: "POST",
        body: bodyParams.toString(),
      });

      if (data.success) {
        const baseUrl = window.location.origin;
        const shortUrl = `${baseUrl}/${data.shortCode}`;
        setShortUrlResult(shortUrl);
        setOriginalUrl("");
        setCustomSlug("");
        setExpiryDate("");
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        invalidateCache(`userLinks_${currentUser.id}`);
      } else {
        setError(data.error || "Failed to create short URL");
      }
    } catch (err: unknown) {
      setError("Error: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      showLoading(false);
    }
  };

  const deleteLink = async (shortCode: string, driveId?: string) => {
    if (!currentUser || !confirm("Are you sure you want to delete this link?")) return;

    const gasEndpoint = getGasEndpoint();
    const uploadEndpoint = getUploadEndpoint();

    showLoading(true, "Deleting link...");

    try {
      // 1. Delete file from Google Drive if it exists
      if (driveId) {
        setLoadingText("Deleting file from Google Drive...");
        await optimizedFetch(uploadEndpoint, {
          method: "POST",
          body: `action=archiveFiles&driveIds=${JSON.stringify([driveId])}`,
        });
      }

      // 2. Delete URL entry from database
      setLoadingText("Deleting URL entry...");
      const data = await optimizedFetch(gasEndpoint, {
        method: "POST",
        body: `action=delete&shortCode=${encodeURIComponent(shortCode)}&userId=${currentUser.id}`,
      });

      if (data.success) {
        setSuccess("Link deleted successfully!");
        invalidateCache(`userLinks_${currentUser.id}`);
        loadUserLinks(true);
      } else {
        setError(data.error || "Failed to delete link");
      }
    } catch (err: unknown) {
      setError("Error deleting link: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      showLoading(false);
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem("currentUser");
    setUserLinks([]);
    setSuccess("Logged out successfully");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert("Copied to clipboard!");
    });
  };

  return (
    <div className="container">
      <h1>🔗 URL Shortener</h1>

      {!currentUser ? (
        <div id="authSection">
          <div className="tab-buttons">
            <button
              className={`tab-button ${authTab === "login" ? "active" : ""}`}
              onClick={() => setAuthTab("login")}
            >
              Login
            </button>
            <button
              className={`tab-button ${authTab === "register" ? "active" : ""}`}
              onClick={() => setAuthTab("register")}
            >
              Register
            </button>
          </div>

          {authTab === "login" ? (
            <div className="tab-content">
              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label htmlFor="loginIdentifier">Email or Username:</label>
                  <input
                    type="text"
                    id="loginIdentifier"
                    placeholder="user@example.com or username"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="loginPassword">Password:</label>
                  <input
                    type="password"
                    id="loginPassword"
                    placeholder="Password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="button" disabled={loading}>
                  Login
                </button>
              </form>
            </div>
          ) : (
            <div className="tab-content">
              <form onSubmit={handleRegister}>
                <div className="form-group">
                  <label htmlFor="registerEmail">Email:</label>
                  <input
                    type="email"
                    id="registerEmail"
                    placeholder="user@example.com"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="registerUsername">Username:</label>
                  <input
                    type="text"
                    id="registerUsername"
                    placeholder="username"
                    value={registerUsername}
                    onChange={(e) => setRegisterUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="registerPassword">Password:</label>
                  <input
                    type="password"
                    id="registerPassword"
                    placeholder="Password"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="button" disabled={loading}>
                  Register
                </button>
              </form>
            </div>
          )}
        </div>
      ) : (
        <div id="mainApp">
          <div className="user-info">
            Welcome, <strong>{currentUser.username}</strong> ({currentUser.email})
          </div>

          <div className="tab-buttons">
            <button
              className={`tab-button ${mainTab === "create" ? "active" : ""}`}
              onClick={() => setMainTab("create")}
            >
              Create URL
            </button>
            <button
              className={`tab-button ${mainTab === "manage" ? "active" : ""}`}
              onClick={() => setMainTab("manage")}
            >
              My Links
            </button>
          </div>

          {mainTab === "create" ? (
            <div className="tab-content">
              <form onSubmit={handleCreateUrl}>
                <div className="form-group">
                  <label htmlFor="originalUrl">Original URL (or select a file below):</label>
                  <input
                    type="text"
                    id="originalUrl"
                    placeholder="https://example.com"
                    value={originalUrl}
                    onChange={(e) => setOriginalUrl(e.target.value)}
                    disabled={!!selectedFile}
                    required={!selectedFile}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="fileInput">Upload File (Alternative to URL):</label>
                  <input
                    type="file"
                    id="fileInput"
                    ref={fileInputRef}
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    style={{ padding: '10px' }}
                  />
                  {selectedFile && <small style={{ color: 'var(--primary)' }}>File selected: {selectedFile.name}</small>}
                </div>

                <div className="form-group">
                  <label htmlFor="customSlug">Custom Short Code (optional):</label>
                  <input
                    type="text"
                    id="customSlug"
                    placeholder="my-link"
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="expiryDate">Expiry Date (optional):</label>
                  <input
                    type="date"
                    id="expiryDate"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                  />
                </div>

                <button type="submit" className="button" disabled={loading}>
                  {selectedFile ? 'Upload and Create Link' : 'Create Short URL'}
                </button>
              </form>

              {shortUrlResult && (
                <div className="result">
                  <h3>Your Short URL:</h3>
                  <div className="short-url">{shortUrlResult}</div>
                  <button className="button" onClick={() => copyToClipboard(shortUrlResult)}>
                    Copy to Clipboard
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="tab-content">
              <button className="button" onClick={() => loadUserLinks(true)} disabled={loading} style={{ width: "auto", marginBottom: "20px" }}>
                Refresh Links
              </button>

              <div className="links-table-container">
                {userLinks.length === 0 ? (
                  <div className="no-links">You haven&apos;t created any links yet.</div>
                ) : (
                  <table className="links-table">
                    <thead>
                      <tr>
                        <th>Short Code</th>
                        <th>Original URL</th>
                        <th>Expires</th>
                        <th>Clicks</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userLinks.map((link) => {
                        const baseUrl = window.location.origin;
                        const shortUrl = `${baseUrl}/${link.shortCode}`;
                        const isExpired = link.expiryDate && new Date(link.expiryDate) < new Date();

                        return (
                          <tr key={link.shortCode} style={{ opacity: isExpired ? 0.6 : 1 }}>
                            <td>
                              <a href={shortUrl} target="_blank" rel="noopener noreferrer" style={{ color: isExpired ? "#999" : "var(--primary)", fontWeight: "600" }}>
                                {link.shortCode}
                              </a>
                            </td>
                            <td className="url-cell">
                              <details>
                                <summary>{link.originalUrl.length > 30 ? link.originalUrl.substring(0, 30) + "..." : link.originalUrl}</summary>
                                <div style={{ marginTop: "8px", wordBreak: "break-all" }}>{link.originalUrl}</div>
                                {link.driveId && <div style={{ fontSize: '10px', color: '#888' }}>Drive File: {link.driveId}</div>}
                              </details>
                            </td>
                            <td>{link.expiryDate ? new Date(link.expiryDate).toLocaleDateString() : 'Never'}</td>
                            <td>{link.clicks}</td>
                            <td>
                              <button className="button small" onClick={() => copyToClipboard(shortUrl)}>
                                Copy
                              </button>
                              <button className="button small danger" onClick={() => deleteLink(link.shortCode, link.driveId)}>
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          <button className="button logout-btn" onClick={logout}>
            Logout
          </button>
        </div>
      )}

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>{loadingText}</p>
        </div>
      )}

      {error && <div className="message error">{error}</div>}
      {success && <div className="message success">{success}</div>}
    </div>
  );
}
