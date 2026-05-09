import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "PharmaQuiz API",
      version: "0.1.0",
      description: "API documentation for PharmaQuiz routes. Protected routes use the session cookie.",
    },
    servers: [{ url: "http://localhost:3000", description: "Local development" }],
    components: {
      securitySchemes: {
        cookieAuth: { type: "apiKey", in: "cookie", name: "pharmaquiz_session" },
      },
      schemas: {
        LoginRequest: {
          type: "object",
          required: ["token"],
          properties: { token: { type: "string" } },
        },
      },
    },
    paths: {
      "/api/auth/login": {
        post: {
          summary: "Authenticate with access token",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } },
          },
          responses: { "200": { description: "Login succeeded" }, "401": { description: "Invalid token" } },
        },
      },
      "/api/auth/logout": {
        post: {
          summary: "Logout current user",
          security: [{ cookieAuth: [] }],
          responses: { "307": { description: "Redirects to /login" } },
        },
      },
      "/api/auth/validate": {
        get: {
          summary: "Validate current session cookie",
          security: [{ cookieAuth: [] }],
          responses: { "200": { description: "Session is valid" }, "401": { description: "Session invalid or missing" } },
        },
      },
      "/api/attempts/start": {
        post: {
          summary: "Start a new attempt",
          security: [{ cookieAuth: [] }],
          responses: { "200": { description: "Attempt started" }, "400": { description: "Invalid request" } },
        },
      },
      "/api/attempts/final-mock/start": {
        get: { summary: "Get final mock blueprint", security: [{ cookieAuth: [] }] },
        post: { summary: "Start final mock attempt", security: [{ cookieAuth: [] }] },
      },
      "/api/stats": {
        get: {
          summary: "Get section-level performance stats",
          security: [{ cookieAuth: [] }],
          parameters: [{ name: "mode", in: "query", schema: { type: "string", enum: ["last", "all"] } }],
        },
      },
      "/api/users/active": {
        get: {
          summary: "Get active users snapshot",
          security: [{ cookieAuth: [] }],
        },
      },
      "/api/feedback": {
        post: {
          summary: "Submit user feedback",
          security: [{ cookieAuth: [] }],
        },
      },
    },
  });
}
