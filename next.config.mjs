/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',
    images: {
        unoptimized: true,
    },
    // Ensure that trailing slashes are handled correctly for GitHub Pages
    trailingSlash: true,
};

export default nextConfig;
