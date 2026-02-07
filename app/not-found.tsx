"use client";

import { useEffect, useState } from "react";
import { getGasEndpoint } from "@/utils/api";

export default function NotFound() {
    const [error, setError] = useState("");
    const [isExpired, setIsExpired] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const gasEndpoint = getGasEndpoint();

        // Get the short code from the URL path
        // On GitHub Pages, the path is /Shorten-URLs/code/ or /Shorten-URLs/code
        const path = window.location.pathname;
        const segments = path.split('/').filter(Boolean);

        // The short code is usually the last segment
        // But we avoid 'Shorten-URLs' if that's the only segment
        let shortCode = segments[segments.length - 1];
        if (shortCode === 'Shorten-URLs') shortCode = '';

        if (!shortCode || shortCode === '404' || shortCode === 'index') {
            setLoading(false);
            setError("No short code provided");
            return;
        }

        async function handleRedirect() {
            try {
                const response = await fetch(
                    `${gasEndpoint}?action=get&shortCode=${encodeURIComponent(shortCode)}`
                );
                const data = await response.json();

                if (data.success && data.originalUrl) {
                    // Expiry check
                    if (data.expiryDate) {
                        const expiry = new Date(data.expiryDate);
                        if (expiry < new Date()) {
                            setIsExpired(true);
                            setError("This link has expired");
                            setLoading(false);
                            return;
                        }
                    }
                    // Perform redirection
                    window.location.replace(data.originalUrl);
                } else {
                    setError(data.error || "Short link not found");
                    setLoading(false);
                }
            } catch (err: unknown) {
                console.error("Redirection error:", err);
                setError("Could not retrieve the original URL");
                setLoading(false);
            }
        }

        handleRedirect();
    }, []);

    return (
        <div style={{
            display: 'flex',
            height: '100vh',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            fontFamily: 'sans-serif',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: '20px'
        }}>
            <div style={{
                background: 'rgba(255, 255, 255, 0.95)',
                padding: '40px',
                borderRadius: '20px',
                textAlign: 'center',
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                color: '#333',
                maxWidth: '400px',
                width: '100%'
            }}>
                {loading ? (
                    <>
                        <h1 style={{ fontSize: '48px', marginBottom: '10px' }}>🔗</h1>
                        <h2 style={{ marginBottom: '10px' }}>Redirecting...</h2>
                        <div className="spinner"></div>
                        <p style={{ color: '#666' }}>Finding your destination...</p>
                    </>
                ) : (
                    <>
                        <h1 style={{ fontSize: '48px', marginBottom: '10px' }}>⚠️</h1>
                        <h2 style={{ marginBottom: '10px' }}>{isExpired ? "Link Expired" : "Not Found"}</h2>
                        <p style={{ color: '#666', marginBottom: '30px' }}>{error}. The link may have been deleted or reached its expiration date.</p>
                        <a href="/Shorten-URLs/" style={{
                            display: 'inline-block',
                            padding: '12px 24px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            textDecoration: 'none',
                            borderRadius: '10px',
                            fontWeight: 'bold'
                        }}>
                            Return Home
                        </a>
                    </>
                )}
            </div>
            <style jsx>{`
        .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
        </div>
    );
}
