"use client";
import { Suspense, type ComponentType } from "react";
// Pages read ?id= from the URL, which needs a Suspense boundary for static export.
export function withSuspense<P extends object>(C: ComponentType<P>) { return function Wrapped(props: P) { return <Suspense fallback={<p className="small">Loading…</p>}><C {...props} /></Suspense>; }; }
export const now = () => new Date().toISOString();
