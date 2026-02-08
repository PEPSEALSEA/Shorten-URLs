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

// Icons
const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
);

const QRIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect><path d="M7 7h.01"></path><path d="M17 7h.01"></path><path d="M17 17h.01"></path><path d="M7 17h.01"></path></svg>
);

const DeleteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
);

const ExternalIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
);

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
);

const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
);

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
  const [activeQrUrl, setActiveQrUrl] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState<"url" | "file">("url");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

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
        setUserLinks(data.links || []);
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
        setSuccess("Welcome back!");
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
        setSuccess("Account created! Please login.");
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

      if (selectedFile) {
        setLoadingText("Baking your file...");
        setUploadProgress(0);

        // Convert file to Base64
        const base64Content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
        });

        // Use XMLHttpRequest via fetchWithProgress for percentage bar
        const uploadUrl = `${uploadEndpoint}?action=upload&filename=${encodeURIComponent(selectedFile.name)}&contentType=${encodeURIComponent(selectedFile.type)}`;

        const { fetchWithProgress } = await import("@/utils/api");
        const uploadData = await fetchWithProgress(uploadUrl, base64Content, (percent) => {
          setUploadProgress(percent);
        });

        if (uploadData.success) {
          finalUrl = uploadData.url;
          driveId = uploadData.driveId;
          setUploadProgress(100);
        } else {
          throw new Error(uploadData.error || "File upload failed");
        }
      }

      setLoadingText("Shortening URL...");
      const bodyParams = new URLSearchParams();
      bodyParams.append("action", "create");
      bodyParams.append("originalUrl", finalUrl);
      bodyParams.append("customSlug", customSlug);
      bodyParams.append("userId", currentUser.id);
      if (expiryDate) {
        // Convert local datetime to ISO string to ensure timezone consistency
        const isoDate = new Date(expiryDate).toISOString();
        bodyParams.append("expiryDate", isoDate);
      }
      if (driveId) bodyParams.append("driveId", driveId);

      const data = await optimizedFetch(gasEndpoint, {
        method: "POST",
        body: bodyParams.toString(),
      });

      if (data.success) {
        const baseUrl = window.location.origin;
        const hasSubpath = window.location.pathname.includes('/Shorten-URLs');
        const shortUrl = hasSubpath
          ? `${baseUrl}/Shorten-URLs/${data.shortCode}`
          : `${baseUrl}/${data.shortCode}`;

        setShortUrlResult(shortUrl);
        setOriginalUrl("");
        setCustomSlug("");
        setExpiryDate("");
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        invalidateCache(`userLinks_${currentUser.id}`);
        setSuccess("Short URL generated successfully!");
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

    showLoading(true, "Deleting...");

    try {
      if (driveId) {
        setLoadingText("Removing file...");
        await optimizedFetch(uploadEndpoint, {
          method: "POST",
          body: `action=archiveFiles&driveIds=${JSON.stringify([driveId])}`,
        });
      }

      setLoadingText("Removing link...");
      const data = await optimizedFetch(gasEndpoint, {
        method: "POST",
        body: `action=delete&shortCode=${encodeURIComponent(shortCode)}&userId=${currentUser.id}`,
      });

      if (data.success) {
        setSuccess("Link deleted");
        invalidateCache(`userLinks_${currentUser.id}`);
        loadUserLinks(true);
      } else {
        setError(data.error || "Failed to delete link");
      }
    } catch (err: unknown) {
      setError("Error deleting: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      showLoading(false);
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem("currentUser");
    setUserLinks([]);
    setSuccess("Goodbye!");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setSuccess("Copied to clipboard!");
      setTimeout(() => setSuccess(""), 3000);
    });
  };

  return (
    <div className="container">
      <h1>🔗 LinkSnap</h1>

      {!currentUser ? (
        <div id="authSection" className="fade-in">
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

          <div className="tab-content">
            {authTab === "login" ? (
              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label htmlFor="loginIdentifier">Email or Username</label>
                  <input
                    type="text"
                    id="loginIdentifier"
                    placeholder="Enter your email or username"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="loginPassword">Password</label>
                  <input
                    type="password"
                    id="loginPassword"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="button" disabled={loading}>
                  Sign In
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister}>
                <div className="form-group">
                  <label htmlFor="registerEmail">Email</label>
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
                  <label htmlFor="registerUsername">Username</label>
                  <input
                    type="text"
                    id="registerUsername"
                    placeholder="johndoe"
                    value={registerUsername}
                    onChange={(e) => setRegisterUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="registerPassword">Password</label>
                  <input
                    type="password"
                    id="registerPassword"
                    placeholder="••••••••"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="button" disabled={loading}>
                  Create Account
                </button>
              </form>
            )}
          </div>
        </div>
      ) : (
        <div id="mainApp" className="fade-in">
          <div className="user-info">
            <span>Logged in as <strong>{currentUser.username}</strong></span>
            <button className="button logout-btn small" onClick={logout}>
              <LogoutIcon /> Logout
            </button>
          </div>

          <div className="tab-buttons">
            <button
              className={`tab-button ${mainTab === "create" ? "active" : ""}`}
              onClick={() => setMainTab("create")}
            >
              Shorten URL
            </button>
            <button
              className={`tab-button ${mainTab === "manage" ? "active" : ""}`}
              onClick={() => setMainTab("manage")}
            >
              My Links
            </button>
          </div>

          <div className="tab-content">
            {mainTab === "create" ? (
              <div className="slide-up">
                <div className="tab-buttons sub-tabs" style={{ marginBottom: '20px', background: 'rgba(255,255,255,0.02)', padding: '4px' }}>
                  <button
                    className={`tab-button ${createMode === "url" ? "active" : ""}`}
                    onClick={() => {
                      setCreateMode("url");
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    style={{ padding: '8px', fontSize: '0.85rem' }}
                  >
                    Shorten URL
                  </button>
                  <button
                    className={`tab-button ${createMode === "file" ? "active" : ""}`}
                    onClick={() => {
                      setCreateMode("file");
                      setOriginalUrl("");
                    }}
                    style={{ padding: '8px', fontSize: '0.85rem' }}
                  >
                    Upload File
                  </button>
                </div>

                <form onSubmit={handleCreateUrl}>
                  {createMode === "url" ? (
                    <div className="form-group slide-up">
                      <label htmlFor="originalUrl">Target URL</label>
                      <input
                        type="url"
                        id="originalUrl"
                        placeholder="https://very-long-url.com/path?query=1"
                        value={originalUrl}
                        onChange={(e) => setOriginalUrl(e.target.value)}
                        required
                      />
                    </div>
                  ) : (
                    <div className="pizza-oven-wrapper slide-up">
                      <div
                        className={`pizza-oven ${selectedFile ? 'has-file' : ''} ${isDragging ? 'dragging' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDragging(false);
                          const file = e.dataTransfer.files?.[0];
                          if (file) setSelectedFile(file);
                        }}
                      >
                        <div className="icon">🍕</div>
                        <h3>The Pizza Oven</h3>
                        <p>{selectedFile ? `Selected: ${selectedFile.name}` : "Drop your 'ingredients' (files) here or click to browse"}</p>
                        <input
                          type="file"
                          id="fileInput"
                          ref={fileInputRef}
                          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                          required
                        />
                      </div>

                      {uploadProgress > 0 && uploadProgress < 100 && (
                        <div className="baking-container">
                          <div className="baking-status">
                            <span>Baking your file...</span>
                            <span>{uploadProgress}%</span>
                          </div>
                          <div className="baking-bar-wrapper">
                            <div className="baking-bar" style={{ width: `${uploadProgress}%` }}></div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label htmlFor="customSlug">Custom Slack (Optional)</label>
                      <input
                        type="text"
                        id="customSlug"
                        placeholder="my-link"
                        value={customSlug}
                        onChange={(e) => setCustomSlug(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="expiryDate">
                        Expiry Date (Optional)
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 'normal' }}>
                          [{Intl.DateTimeFormat().resolvedOptions().timeZone}]
                        </span>
                      </label>
                      <input
                        type="datetime-local"
                        id="expiryDate"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <button type="submit" className="button" disabled={loading}>
                    {createMode === "file" ? 'Upload and Shorten' : 'Shorten Now'}
                  </button>
                </form>

                {shortUrlResult && (
                  <div className="result">
                    <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Your Short Link</h3>
                    <div className="short-url">{shortUrlResult}</div>
                    <button className="button" onClick={() => copyToClipboard(shortUrlResult)}>
                      <CopyIcon /> Copy to Clipboard
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="slide-up">
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                  <button className="button small" onClick={() => loadUserLinks(true)} disabled={loading}>
                    <RefreshIcon /> Refresh
                  </button>
                </div>

                <div className="links-table-container">
                  {userLinks.length === 0 ? (
                    <div className="no-links">No links found. Start shortening!</div>
                  ) : (
                    <table className="links-table">
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Destination</th>
                          <th>Expires</th>
                          <th>Clicks</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userLinks.map((link) => {
                          const baseUrl = window.location.origin;
                          const hasSubpath = window.location.pathname.includes('/Shorten-URLs');
                          const shortUrl = hasSubpath
                            ? `${baseUrl}/Shorten-URLs/${link.shortCode}`
                            : `${baseUrl}/${link.shortCode}`;

                          const isExpired = link.expiryDate && new Date(link.expiryDate) < new Date();

                          return (
                            <tr key={link.shortCode} style={{ opacity: isExpired ? 0.5 : 1 }}>
                              <td>
                                <a href={shortUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: "600", textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  {link.shortCode} <ExternalIcon />
                                </a>
                              </td>
                              <td className="url-cell">
                                <details>
                                  <summary>{link.originalUrl.length > 20 ? link.originalUrl.substring(0, 20) + "..." : link.originalUrl}</summary>
                                  <div style={{ padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', marginTop: '4px', fontSize: '0.8rem', wordBreak: 'break-all' }}>
                                    {link.originalUrl}
                                    {link.driveId && <div style={{ color: 'var(--secondary)', marginTop: '4px' }}>Drive File</div>}
                                  </div>
                                </details>
                              </td>
                              <td style={{ fontSize: '0.8rem' }}>{link.expiryDate ? new Date(link.expiryDate).toLocaleString() : 'Never'}</td>
                              <td style={{ textAlign: 'center' }}>{link.clicks}</td>
                              <td>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button className="button small" onClick={() => copyToClipboard(shortUrl)} title="Copy">
                                    <CopyIcon />
                                  </button>
                                  <button className="button small" onClick={() => setActiveQrUrl(shortUrl)} title="QR Code" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}>
                                    <QRIcon />
                                  </button>
                                  <button className="button small danger" onClick={() => deleteLink(link.shortCode, link.driveId)} title="Delete">
                                    <DeleteIcon />
                                  </button>
                                </div>
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
          </div>
        </div>
      )}

      {/* QR Modal */}
      {activeQrUrl && (
        <div className="modal-overlay" onClick={() => setActiveQrUrl(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setActiveQrUrl(null)}>×</button>
            <h3 style={{ marginBottom: '8px' }}>QR Code</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Scan to open the short link</p>
            <div className="qr-container">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(activeQrUrl)}`}
                alt="QR Code"
              />
            </div>
            <div className="short-url" style={{ fontSize: '0.9rem', padding: '8px' }}>{activeQrUrl}</div>
            <div className="modal-actions">
              <button className="button" onClick={() => copyToClipboard(activeQrUrl)}>
                <CopyIcon /> Copy Link
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p style={{ color: 'var(--text)', fontWeight: '500' }}>{loadingText}</p>
        </div>
      )}

      {error && <div className="message error">{error}</div>}
      {success && <div className="message success">{success}</div>}
    </div>
  );
}
