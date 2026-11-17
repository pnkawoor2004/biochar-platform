/** @type {import('next').NextConfig} */
const isStatic = process.env.STATIC_EXPORT === "1";
export default { ...(isStatic ? { output: "export", images: { unoptimized: true }, trailingSlash: true } : {}), env: { NEXT_PUBLIC_STATIC: isStatic ? "1" : "" }, eslint: { ignoreDuringBuilds: true } };
