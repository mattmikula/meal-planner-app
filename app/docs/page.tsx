import Script from "next/script";

export const metadata = {
  title: "Meal Planner API Docs",
  description: "OpenAPI documentation for the Meal Planner API."
};

export default function ApiDocsPage() {
  return (
    <main style={{ minHeight: "100vh" }}>
      <style>{"body { margin: 0; }"}</style>
      <Script
        src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"
        strategy="afterInteractive"
      />
      <redoc
        spec-url="/api/openapi"
        style={{ display: "block", width: "100%", minHeight: "100vh" }}
      ></redoc>
    </main>
  );
}
