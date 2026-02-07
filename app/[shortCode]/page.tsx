
import { redirect } from "next/navigation";
import { getGasEndpoint } from "@/utils/api";

interface PageProps {
    params: {
        shortCode: string;
    };
}

export default async function RedirectPage({ params }: PageProps) {
    const { shortCode } = params;

    // We need to bypass some Reserved paths in Next.js if they leak into here
    const reservedPaths = ['favicon.ico', 'api', '_next', 'static', 'globals.css'];
    if (reservedPaths.includes(shortCode)) {
        return null;
    }

    const gasEndpoint = getGasEndpoint();

    let errorMessage = "Short URL not found";
    let isExpired = false;

    try {
        const response = await fetch(
            `${gasEndpoint}?action=get&shortCode=${encodeURIComponent(shortCode)}`,
            {
                method: 'GET',
                next: { revalidate: 0 } // Don't cache redirects to handle expiry accurately
            }
        );

        if (!response.ok) {
            throw new Error('Failed to fetch from GAS');
        }

        const data = await response.json();

        if (data.success && data.originalUrl) {
            // Check for expiry on the client side just in case GAS doesn't handle it
            if (data.expiryDate) {
                const expiry = new Date(data.expiryDate);
                if (expiry < new Date()) {
                    isExpired = true;
                    errorMessage = "This link has expired";
                }
            }

            if (!isExpired) {
                redirect(data.originalUrl);
            }
        } else if (data.error) {
            errorMessage = data.error;
        }
    } catch (error) {
        console.error("Redirection error:", error);
        errorMessage = "Could not retrieve the original URL";
    }

    return (
        <div style={{
            display: 'flex',
            height: '100vh',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            fontFamily: 'sans-serif',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white'
        }}>
            <div style={{
                background: 'rgba(255, 255, 255, 0.95)',
                padding: '40px',
                borderRadius: '20px',
                textAlign: 'center',
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                color: '#333',
                maxWidth: '400px'
            }}>
                <h1 style={{ fontSize: '48px', marginBottom: '10px' }}>⚠️</h1>
                <h2 style={{ marginBottom: '10px' }}>{isExpired ? "Link Expired" : "Not Found"}</h2>
                <p style={{ color: '#666', marginBottom: '30px' }}>{errorMessage}. The link may have been deleted or reached its expiration date.</p>
                <a href="/" style={{
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
            </div>
        </div>
    );
}
