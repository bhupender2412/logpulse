import {
  apiClient,
  getApiErrorMessage,
} from "./apiClient";

// ==========================================================
// HTTP METHOD
// ==========================================================

export type EndpointMethod =
  | "POST"
  | "PUT"
  | "PATCH";

// ==========================================================
// ENDPOINT
// ==========================================================

export interface WebhookEndpoint {
  _id?:
    string;

  id?:
    string;

  endpointId:
    string;

  name:
    string;

  projectId:
    string;

  targetUrl:
    string;

  method:
    EndpointMethod;

  maxRetries:
    number;

  active:
    boolean;

  createdBy?:
    string;

  createdAt:
    string;

  updatedAt?:
    string;
}

// ==========================================================
// GET ENDPOINTS RESPONSE
// ==========================================================

export interface EndpointsResponse {
  success:
    boolean;

  count:
    number;

  endpoints:
    WebhookEndpoint[];
}

// ==========================================================
// SINGLE ENDPOINT RESPONSE
// ==========================================================

export interface EndpointResponse {
  success:
    boolean;

  endpoint:
    WebhookEndpoint;
}

// ==========================================================
// CREATE ENDPOINT INPUT
// ==========================================================

export interface CreateEndpointInput {
  name:
    string;

  projectId:
    string;

  targetUrl:
    string;

  method:
    EndpointMethod;

  maxRetries:
    number;
}

// ==========================================================
// CREATE ENDPOINT RESPONSE
//
// IMPORTANT:
//
// signingSecret is returned when endpoint is created.
// ==========================================================

export interface CreateEndpointResponse {
  success:
    boolean;

  endpoint: {
    id:
      string;

    endpointId:
      string;

    name:
      string;

    projectId:
      string;

    targetUrl:
      string;

    method:
      EndpointMethod;

    maxRetries:
      number;

    active:
      boolean;

    createdAt:
      string;
  };

  signingSecret:
    string;

  warning:
    string;
}

// ==========================================================
// UPDATE ENDPOINT INPUT
// ==========================================================

export interface UpdateEndpointInput {
  name?:
    string;

  targetUrl?:
    string;

  method?:
    EndpointMethod;

  maxRetries?:
    number;

  active?:
    boolean;
}

// ==========================================================
// UPDATE RESPONSE
// ==========================================================

export interface UpdateEndpointResponse {
  success:
    boolean;

  message:
    string;

  endpoint:
    WebhookEndpoint;
}

// ==========================================================
// DELETE RESPONSE
// ==========================================================

export interface DeleteEndpointResponse {
  success:
    boolean;

  message:
    string;

  endpoint: {
    endpointId:
      string;

    name:
      string;

    projectId:
      string;
  };
}

// ==========================================================
// GET ALL ENDPOINTS
//
// GET /api/v1/endpoints
// ==========================================================

export async function getEndpoints(): Promise<EndpointsResponse> {
  try {
    const response =
      await apiClient.get<EndpointsResponse>(
        "/api/v1/endpoints"
      );

    return response.data;
  } catch (error) {
    throw new Error(
      getApiErrorMessage(
        error,
        "Failed to fetch endpoints"
      )
    );
  }
}

// ==========================================================
// GET SINGLE ENDPOINT
//
// GET /api/v1/endpoints/:endpointId
// ==========================================================

export async function getEndpoint(
  endpointId:
    string
): Promise<EndpointResponse> {
  try {
    const response =
      await apiClient.get<EndpointResponse>(
        `/api/v1/endpoints/${encodeURIComponent(
          endpointId
        )}`
      );

    return response.data;
  } catch (error) {
    throw new Error(
      getApiErrorMessage(
        error,
        "Failed to fetch endpoint"
      )
    );
  }
}

// ==========================================================
// CREATE ENDPOINT
//
// POST /api/v1/endpoints
// ==========================================================

export async function createEndpoint(
  input:
    CreateEndpointInput
): Promise<CreateEndpointResponse> {
  try {
    const response =
      await apiClient.post<CreateEndpointResponse>(
        "/api/v1/endpoints",
        {
          name:
            input.name.trim(),

          projectId:
            input.projectId.trim(),

          targetUrl:
            input.targetUrl.trim(),

          method:
            input.method,

          maxRetries:
            input.maxRetries,
        }
      );

    return response.data;
  } catch (error) {
    throw new Error(
      getApiErrorMessage(
        error,
        "Failed to create endpoint"
      )
    );
  }
}

// ==========================================================
// UPDATE ENDPOINT
//
// PATCH /api/v1/endpoints/:endpointId
// ==========================================================

export async function updateEndpoint(
  endpointId:
    string,
  updates:
    UpdateEndpointInput
): Promise<UpdateEndpointResponse> {
  try {
    const payload:
      UpdateEndpointInput = {};

    if (
      updates.name !==
      undefined
    ) {
      payload.name =
        updates.name.trim();
    }

    if (
      updates.targetUrl !==
      undefined
    ) {
      payload.targetUrl =
        updates.targetUrl.trim();
    }

    if (
      updates.method !==
      undefined
    ) {
      payload.method =
        updates.method;
    }

    if (
      updates.maxRetries !==
      undefined
    ) {
      payload.maxRetries =
        updates.maxRetries;
    }

    if (
      updates.active !==
      undefined
    ) {
      payload.active =
        updates.active;
    }

    const response =
      await apiClient.patch<UpdateEndpointResponse>(
        `/api/v1/endpoints/${encodeURIComponent(
          endpointId
        )}`,
        payload
      );

    return response.data;
  } catch (error) {
    throw new Error(
      getApiErrorMessage(
        error,
        "Failed to update endpoint"
      )
    );
  }
}

// ==========================================================
// TOGGLE ENDPOINT
// ==========================================================

export async function setEndpointActive(
  endpointId:
    string,
  active:
    boolean
): Promise<UpdateEndpointResponse> {
  return updateEndpoint(
    endpointId,
    {
      active,
    }
  );
}

// ==========================================================
// DELETE ENDPOINT
//
// DELETE /api/v1/endpoints/:endpointId
// ==========================================================

export async function deleteEndpoint(
  endpointId:
    string
): Promise<DeleteEndpointResponse> {
  try {
    const response =
      await apiClient.delete<DeleteEndpointResponse>(
        `/api/v1/endpoints/${encodeURIComponent(
          endpointId
        )}`
      );

    return response.data;
  } catch (error) {
    throw new Error(
      getApiErrorMessage(
        error,
        "Failed to delete endpoint"
      )
    );
  }
}