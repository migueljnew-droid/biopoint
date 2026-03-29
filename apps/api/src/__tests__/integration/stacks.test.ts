import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createApiClient } from "../utils/apiClient.js";
import { setupTestDatabase, teardownTestDatabase, TestDatabase } from "../utils/testDatabase.js";
import type { ApiClient } from "../utils/apiClient.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

describe("Stacks Integration Tests", () => {
  let apiClient: ApiClient;
  let testDb: TestDatabase;
  let authToken: string;
  let testUser: any;

  beforeEach(async () => {
    apiClient = await createApiClient();
    testDb = await setupTestDatabase();

    testUser = await testDb.createTestUser({
      email: "stacks@example.com",
      password: "TestPassword123!",
    });

    const loginResponse = await apiClient.login({
      email: "stacks@example.com",
      password: "TestPassword123!",
    });

    authToken = loginResponse.body.tokens.accessToken;
  });

  afterEach(async () => {
    await apiClient.teardown();
    await teardownTestDatabase();
  });

  it("GET /api/stacks returns user stacks", async () => {
    await testDb.createStack({
      userId: testUser.id,
      name: "Morning Stack",
      goal: "Energy",
      items: [
        {
          name: "Caffeine",
          dose: 100,
          unit: "mg",
          frequency: "Daily",
          route: "Oral",
        },
      ],
    });

    const response = await apiClient.makeRequest("GET", "/api/stacks", { token: authToken });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(1);
    expect(response.body[0].name).toBe("Morning Stack");
    expect(response.body[0].items.length).toBe(1);
  });

  it("POST /api/stacks creates a stack", async () => {
    const response = await apiClient.makeRequest("POST", "/api/stacks", {
      token: authToken,
      data: {
        name: "Focus Stack",
        goal: "Cognitive focus",
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Focus Stack");
    expect(response.body.goal).toBe("Cognitive focus");
    expect(response.body.items).toEqual([]);
  });

  it("GET /api/stacks/:id returns stack details", async () => {
    const stack = await testDb.createStack({
      userId: testUser.id,
      name: "Recovery Stack",
      items: [
        {
          name: "Magnesium",
          dose: 200,
          unit: "mg",
          frequency: "Nightly",
          route: "Oral",
        },
      ],
    });

    const response = await apiClient.makeRequest("GET", `/api/stacks/${stack.id}`, {
      token: authToken,
    });

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(stack.id);
    expect(response.body.items.length).toBe(1);
  });

  it("PUT /api/stacks/:id updates a stack", async () => {
    const stack = await testDb.createStack({
      userId: testUser.id,
      name: "Old Stack",
      goal: "Old goal",
    });

    const response = await apiClient.makeRequest("PUT", `/api/stacks/${stack.id}`, {
      token: authToken,
      data: {
        name: "Updated Stack",
        goal: "Updated goal",
        isActive: false,
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Updated Stack");
    expect(response.body.goal).toBe("Updated goal");
    expect(response.body.isActive).toBe(false);
  });

  it("DELETE /api/stacks/:id deletes a stack", async () => {
    const stack = await testDb.createStack({
      userId: testUser.id,
      name: "Delete Stack",
    });

    const deleteResponse = await apiClient.makeRequest("DELETE", `/api/stacks/${stack.id}`, {
      token: authToken,
    });

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.success).toBe(true);

    const fetchResponse = await apiClient.makeRequest("GET", `/api/stacks/${stack.id}`, {
      token: authToken,
    });

    expect(fetchResponse.status).toBe(404);
  });

  it("POST /api/stacks/:id/items adds a stack item", async () => {
    const stack = await testDb.createStack({
      userId: testUser.id,
      name: "Item Stack",
    });

    const response = await apiClient.makeRequest("POST", `/api/stacks/${stack.id}/items`, {
      token: authToken,
      data: {
        name: "Creatine",
        dose: 5,
        unit: "g",
        frequency: "Daily",
        route: "Oral",
        timing: "AM",
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Creatine");
    expect(response.body.stackId).toBe(stack.id);
  });

  it("PUT /api/stacks/:id/items/:itemId updates a stack item", async () => {
    const stack = await testDb.createStack({
      userId: testUser.id,
      name: "Update Item Stack",
    });

    const item = await testDb.createStackItem({
      stackId: stack.id,
      name: "B12",
      dose: 1,
      unit: "mg",
      frequency: "Weekly",
      route: "IM",
    });

    const response = await apiClient.makeRequest(
      "PUT",
      `/api/stacks/${stack.id}/items/${item.id}`,
      {
        token: authToken,
        data: {
          name: "B12",
          dose: 2,
          unit: "mg",
          frequency: "Weekly",
          route: "IM",
          isActive: false,
        },
      }
    );

    expect(response.status).toBe(200);
    expect(response.body.dose).toBe(2);
    expect(response.body.isActive).toBe(false);
  });

  it("DELETE /api/stacks/:id/items/:itemId deletes a stack item", async () => {
    const stack = await testDb.createStack({
      userId: testUser.id,
      name: "Delete Item Stack",
    });

    const item = await testDb.createStackItem({
      stackId: stack.id,
      name: "Vitamin D",
      dose: 1000,
      unit: "IU",
      frequency: "Daily",
      route: "Oral",
    });

    const response = await apiClient.makeRequest(
      "DELETE",
      `/api/stacks/${stack.id}/items/${item.id}`,
      { token: authToken }
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("POST /api/stacks/compliance logs compliance events", async () => {
    const stack = await testDb.createStack({
      userId: testUser.id,
      name: "Compliance Stack",
    });

    const item = await testDb.createStackItem({
      stackId: stack.id,
      name: "Omega-3",
      dose: 1,
      unit: "g",
      frequency: "Daily",
      route: "Oral",
    });

    const response = await apiClient.makeRequest("POST", "/api/stacks/compliance", {
      token: authToken,
      data: {
        stackItemId: item.id,
        notes: "Taken after breakfast",
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.stackItemId).toBe(item.id);
    expect(response.body.stackItemName).toBe("Omega-3");
  });
});
