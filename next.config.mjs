/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["node-pty"],
  output: "standalone",
};

export default nextConfig;
