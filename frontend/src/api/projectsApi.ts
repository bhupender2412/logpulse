import {
  apiClient,
  getApiErrorMessage,
} from "./apiClient";

// ==========================================================
// PROJECT
// ==========================================================

export interface Project {
  _id?:
    string;

  id?:
    string;

  name:
    string;

  projectId:
    string;

  apiKeyLast4:
    string;

  createdBy?:
    string;

  createdAt:
    string;

  updatedAt?:
    string;
}

// ==========================================================
// GET PROJECTS RESPONSE
// ==========================================================

export interface ProjectsResponse {
  success:
    boolean;

  count:
    number;

  projects:
    Project[];
}

// ==========================================================
// CREATE PROJECT INPUT
// ==========================================================

export interface CreateProjectInput {
  name:
    string;

  projectId:
    string;
}

// ==========================================================
// CREATE PROJECT RESPONSE
//
// IMPORTANT:
//
// apiKey is plaintext and returned only once.
// ==========================================================

export interface CreateProjectResponse {
  success:
    boolean;

  project: {
    id:
      string;

    name:
      string;

    projectId:
      string;

    apiKeyLast4:
      string;

    createdAt:
      string;
  };

  apiKey:
    string;

  warning:
    string;
}

// ==========================================================
// ROTATE API KEY RESPONSE
// ==========================================================

export interface RotateProjectKeyResponse {
  success:
    boolean;

  projectId:
    string;

  apiKey:
    string;

  apiKeyLast4:
    string;

  warning:
    string;
}

// ==========================================================
// DELETE PROJECT RESPONSE
// ==========================================================

export interface DeleteProjectResponse {
  success:
    boolean;

  message:
    string;

  projectId:
    string;
}

// ==========================================================
// GET PROJECTS
//
// GET /api/v1/projects
// ==========================================================

export async function getProjects(): Promise<ProjectsResponse> {
  try {
    const response =
      await apiClient.get<ProjectsResponse>(
        "/api/v1/projects"
      );

    return response.data;
  } catch (error) {
    throw new Error(
      getApiErrorMessage(
        error,
        "Failed to fetch projects"
      )
    );
  }
}

// ==========================================================
// CREATE PROJECT
//
// POST /api/v1/projects
// ==========================================================

export async function createProject(
  input:
    CreateProjectInput
): Promise<CreateProjectResponse> {
  try {
    const response =
      await apiClient.post<CreateProjectResponse>(
        "/api/v1/projects",
        {
          name:
            input.name.trim(),

          projectId:
            input.projectId
              .trim()
              .toLowerCase(),
        }
      );

    return response.data;
  } catch (error) {
    throw new Error(
      getApiErrorMessage(
        error,
        "Failed to create project"
      )
    );
  }
}

// ==========================================================
// ROTATE PROJECT API KEY
//
// POST /api/v1/projects/:projectId/rotate-key
// ==========================================================

export async function rotateProjectApiKey(
  projectId:
    string
): Promise<RotateProjectKeyResponse> {
  try {
    const response =
      await apiClient.post<RotateProjectKeyResponse>(
        `/api/v1/projects/${encodeURIComponent(
          projectId
        )}/rotate-key`
      );

    return response.data;
  } catch (error) {
    throw new Error(
      getApiErrorMessage(
        error,
        "Failed to rotate project API key"
      )
    );
  }
}

// ==========================================================
// DELETE PROJECT
//
// DELETE /api/v1/projects/:projectId
// ==========================================================

export async function deleteProject(
  projectId:
    string
): Promise<DeleteProjectResponse> {
  try {
    const response =
      await apiClient.delete<DeleteProjectResponse>(
        `/api/v1/projects/${encodeURIComponent(
          projectId
        )}`
      );

    return response.data;
  } catch (error) {
    throw new Error(
      getApiErrorMessage(
        error,
        "Failed to delete project"
      )
    );
  }
}