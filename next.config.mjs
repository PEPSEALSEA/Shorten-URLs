/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',
    images: {
        unoptimized: true,
    },
    // Set the base path to match your GitHub Pages repository name
    basePath: '/Shorten-URLs',
    assetPrefix: '/Shorten-URLs',
    trailingSlash: true,
};

export default nextConfig;
