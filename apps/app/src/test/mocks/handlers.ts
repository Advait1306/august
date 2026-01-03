import { http, HttpResponse } from "msw";

const API_BASE_URL = process.env.VITE_SERVER_URL || "http://localhost:3001";

export const handlers = [
  // Auth endpoints
  http.get(`${API_BASE_URL}/api/auth/token`, () => {
    return HttpResponse.json({ token: "mock-token" });
  }),

  // Tasks endpoints
  http.get(`${API_BASE_URL}/api/tasks`, () => {
    return HttpResponse.json({
      tasks: [
        { id: "task-1", name: "Test Task 1", status: "available" },
        { id: "task-2", name: "Test Task 2", status: "executing" },
      ],
    });
  }),

  http.post(`${API_BASE_URL}/api/tasks`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      id: "new-task-id",
      ...body,
      createdAt: new Date().toISOString(),
    });
  }),

  // Billing endpoints
  http.get(`${API_BASE_URL}/api/billing/portal`, () => {
    return HttpResponse.json({
      link: "https://billing.example.com/portal",
    });
  }),

  http.get(`${API_BASE_URL}/api/billing/subscription`, () => {
    return HttpResponse.json({
      status: "active",
      plan: "pro",
      currentPeriodEnd: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
    });
  }),

  // User endpoints
  http.get(`${API_BASE_URL}/api/user`, () => {
    return HttpResponse.json({
      id: "test-user-id",
      email: "test@example.com",
      name: "Test User",
    });
  }),
];

// Error handler factories for testing error states
export const createErrorHandler = (endpoint: string, statusCode: number) => {
  return http.get(`${API_BASE_URL}${endpoint}`, () => {
    return new HttpResponse(null, { status: statusCode });
  });
};

export const createNetworkErrorHandler = (endpoint: string) => {
  return http.get(`${API_BASE_URL}${endpoint}`, () => {
    return HttpResponse.error();
  });
};
