import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  Copy,
  FolderKanban,
  KeyRound,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";

import {
  createProject,
  deleteProject,
  getProjects,
  rotateProjectApiKey,
  type Project,
} from "../api/projectsApi";

// ==========================================================
// PROPS
// ==========================================================

interface ProjectManagerProps {
  onProjectsChanged?:
    () => void;
}

// ==========================================================
// COMPONENT
// ==========================================================

export default function ProjectManager({
  onProjectsChanged,
}: ProjectManagerProps) {
  // ========================================================
  // DATA
  // ========================================================

  const [
    projects,
    setProjects,
  ] =
    useState<Project[]>(
      []
    );

  // ========================================================
  // UI STATE
  // ========================================================

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(
      false
    );

  const [
    error,
    setError,
  ] =
    useState(
      ""
    );

  const [
    showCreateForm,
    setShowCreateForm,
  ] =
    useState(
      false
    );

  // ========================================================
  // CREATE FORM
  // ========================================================

  const [
    name,
    setName,
  ] =
    useState(
      ""
    );

  const [
    projectId,
    setProjectId,
  ] =
    useState(
      ""
    );

  const [
    creating,
    setCreating,
  ] =
    useState(
      false
    );

  // ========================================================
  // SECRET DISPLAY
  // ========================================================

  const [
    revealedApiKey,
    setRevealedApiKey,
  ] =
    useState<string | null>(
      null
    );

  const [
    revealedProjectId,
    setRevealedProjectId,
  ] =
    useState(
      ""
    );

  const [
    secretWarning,
    setSecretWarning,
  ] =
    useState(
      ""
    );

  const [
    copied,
    setCopied,
  ] =
    useState(
      false
    );

  // ========================================================
  // ROTATING / DELETING
  // ========================================================

  const [
    rotatingProjectId,
    setRotatingProjectId,
  ] =
    useState<string | null>(
      null
    );

  const [
    deletingProjectId,
    setDeletingProjectId,
  ] =
    useState<string | null>(
      null
    );

  // ========================================================
  // LOAD PROJECTS
  // ========================================================

  const loadProjects =
    useCallback(
      async (
        silent =
          false
      ) => {
        try {
          if (silent) {
            setRefreshing(
              true
            );
          } else {
            setLoading(
              true
            );
          }

          setError(
            ""
          );

          const response =
            await getProjects();

          setProjects(
            Array.isArray(
              response.projects
            )
              ? response.projects
              : []
          );
        } catch (err) {
          console.error(
            "Load Projects Error:",
            err
          );

          setError(
            err instanceof Error
              ? err.message
              : "Failed to load projects"
          );

          setProjects(
            []
          );
        } finally {
          setLoading(
            false
          );

          setRefreshing(
            false
          );
        }
      },
      []
    );

  // ========================================================
  // INITIAL LOAD
  // ========================================================

  useEffect(
    () => {
      void loadProjects();
    },
    [
      loadProjects,
    ]
  );

  // ========================================================
  // CREATE PROJECT
  // ========================================================

  const handleCreateProject =
    async (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      try {
        setCreating(
          true
        );

        setError(
          ""
        );

        const response =
          await createProject({
            name,
            projectId,
          });

        // ==================================================
        // SHOW RAW API KEY ONCE
        // ==================================================

        setRevealedApiKey(
          response.apiKey
        );

        setRevealedProjectId(
          response.project.projectId
        );

        setSecretWarning(
          response.warning
        );

        // ==================================================
        // RESET FORM
        // ==================================================

        setName(
          ""
        );

        setProjectId(
          ""
        );

        setShowCreateForm(
          false
        );

        // ==================================================
        // REFRESH
        // ==================================================

        await loadProjects(
          true
        );

        onProjectsChanged?.();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to create project"
        );
      } finally {
        setCreating(
          false
        );
      }
    };

  // ========================================================
  // ROTATE API KEY
  // ========================================================

  const handleRotate =
    async (
      project:
        Project
    ) => {
      const confirmed =
        window.confirm(
          `Rotate API key for "${project.name}"?\n\nThe current API key will immediately stop working.`
        );

      if (!confirmed) {
        return;
      }

      try {
        setRotatingProjectId(
          project.projectId
        );

        setError(
          ""
        );

        const response =
          await rotateProjectApiKey(
            project.projectId
          );

        setRevealedApiKey(
          response.apiKey
        );

        setRevealedProjectId(
          response.projectId
        );

        setSecretWarning(
          response.warning
        );

        await loadProjects(
          true
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to rotate API key"
        );
      } finally {
        setRotatingProjectId(
          null
        );
      }
    };

  // ========================================================
  // DELETE PROJECT
  // ========================================================

  const handleDelete =
    async (
      project:
        Project
    ) => {
      const confirmed =
        window.confirm(
          `Delete project "${project.name}"?\n\nThis action cannot be undone.`
        );

      if (!confirmed) {
        return;
      }

      try {
        setDeletingProjectId(
          project.projectId
        );

        setError(
          ""
        );

        await deleteProject(
          project.projectId
        );

        await loadProjects(
          true
        );

        onProjectsChanged?.();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to delete project"
        );
      } finally {
        setDeletingProjectId(
          null
        );
      }
    };

  // ========================================================
  // COPY API KEY
  // ========================================================

  const copyApiKey =
    async () => {
      if (!revealedApiKey) {
        return;
      }

      try {
        await navigator.clipboard.writeText(
          revealedApiKey
        );

        setCopied(
          true
        );

        window.setTimeout(
          () => {
            setCopied(
              false
            );
          },
          1500
        );
      } catch {
        setCopied(
          false
        );
      }
    };

  // ========================================================
  // UI
  // ========================================================

  return (
    <div>

      {/* ====================================================
          HEADER
      ==================================================== */}

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">

        <div>

          <p className="text-emerald-400 text-xs font-semibold tracking-[0.18em] mb-2">
            PROJECT CONFIGURATION
          </p>

          <h2 className="text-3xl font-bold">
            Projects
          </h2>

          <p className="text-zinc-500 mt-2">
            Manage developer projects and API credentials.
          </p>

        </div>

        <div className="flex items-center gap-3">

          <button
            type="button"
            onClick={() =>
              void loadProjects(
                true
              )
            }
            disabled={
              refreshing
            }
            className="h-11 px-4 rounded-lg bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 flex items-center gap-2 text-sm"
          >

            <RefreshCw
              size={
                16
              }
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            />

            Refresh

          </button>

          <button
            type="button"
            onClick={() =>
              setShowCreateForm(
                true
              )
            }
            className="h-11 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 text-sm font-medium"
          >

            <Plus
              size={
                17
              }
            />

            Create Project

          </button>

        </div>

      </div>

      {/* ====================================================
          ERROR
      ==================================================== */}

      {error && (
        <div className="mb-6 px-5 py-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
          {error}
        </div>
      )}

      {/* ====================================================
          SUMMARY
      ==================================================== */}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">

          <p className="text-sm text-zinc-500">
            Total Projects
          </p>

          <p className="text-3xl font-bold mt-2">
            {loading
              ? "..."
              : projects.length}
          </p>

        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">

          <div className="flex items-center gap-3">

            <KeyRound
              size={
                20
              }
              className="text-emerald-400"
            />

            <div>

              <p className="text-sm text-zinc-500">
                API Authentication
              </p>

              <p className="font-medium mt-1 text-emerald-400">
                SHA-256 Hashed Keys
              </p>

            </div>

          </div>

        </div>

      </div>

      {/* ====================================================
          PROJECT LIST
      ==================================================== */}

      {loading ? (
        <div className="h-64 flex items-center justify-center text-zinc-600">

          <RefreshCw
            size={
              25
            }
            className="animate-spin mr-3"
          />

          Loading projects...

        </div>
      ) : projects.length ===
        0 ? (
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-12 text-center">

          <FolderKanban
            size={
              42
            }
            className="mx-auto text-zinc-700 mb-4"
          />

          <p className="font-medium text-zinc-300">
            No projects yet
          </p>

          <p className="text-sm text-zinc-600 mt-2">
            Create your first project to receive a PulseEngine API key.
          </p>

        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

          {projects.map(
            (
              project
            ) => (
              <div
                key={
                  project.projectId
                }
                className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition"
              >

                {/* PROJECT */}

                <div className="flex items-start justify-between gap-4 mb-5">

                  <div className="flex items-start gap-3 min-w-0">

                    <div className="w-10 h-10 shrink-0 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">

                      <FolderKanban
                        size={
                          19
                        }
                      />

                    </div>

                    <div className="min-w-0">

                      <h3 className="font-semibold text-lg truncate">
                        {project.name}
                      </h3>

                      <p className="font-mono text-xs text-zinc-500 mt-1 break-all">
                        {project.projectId}
                      </p>

                    </div>

                  </div>

                </div>

                {/* API KEY */}

                <div className="bg-black border border-zinc-800 rounded-xl p-4 mb-5">

                  <p className="text-[11px] uppercase tracking-wider text-zinc-600">
                    Project API Key
                  </p>

                  <div className="flex items-center gap-2 mt-2">

                    <KeyRound
                      size={
                        15
                      }
                      className="text-zinc-600"
                    />

                    <span className="font-mono text-sm text-zinc-400">
                      lp_live_••••••••••••
                      {project.apiKeyLast4}
                    </span>

                  </div>

                  <p className="text-xs text-zinc-700 mt-2">
                    Full key is never stored or displayed.
                  </p>

                </div>

                {/* DATE */}

                <p className="text-xs text-zinc-600 mb-5">
                  Created{" "}
                  {new Date(
                    project.createdAt
                  ).toLocaleString()}
                </p>

                {/* ACTIONS */}

                <div className="flex flex-wrap items-center gap-3">

                  <button
                    type="button"
                    onClick={() =>
                      void handleRotate(
                        project
                      )
                    }
                    disabled={
                      rotatingProjectId ===
                      project.projectId
                    }
                    className="px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-sm flex items-center gap-2"
                  >

                    <RotateCcw
                      size={
                        15
                      }
                      className={
                        rotatingProjectId ===
                        project.projectId
                          ? "animate-spin"
                          : ""
                      }
                    />

                    {rotatingProjectId ===
                    project.projectId
                      ? "Rotating..."
                      : "Rotate Key"}

                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void handleDelete(
                        project
                      )
                    }
                    disabled={
                      deletingProjectId ===
                      project.projectId
                    }
                    className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-sm flex items-center gap-2"
                  >

                    <Trash2
                      size={
                        15
                      }
                    />

                    {deletingProjectId ===
                    project.projectId
                      ? "Deleting..."
                      : "Delete"}

                  </button>

                </div>

              </div>
            )
          )}

        </div>
      )}

      {/* ====================================================
          CREATE PROJECT MODAL
      ==================================================== */}

      {showCreateForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">

          <button
            type="button"
            aria-label="Close"
            onClick={() =>
              setShowCreateForm(
                false
              )
            }
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          <div className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl">

            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">

              <div>

                <h3 className="font-semibold text-lg">
                  Create Project
                </h3>

                <p className="text-sm text-zinc-500 mt-1">
                  Generate a new developer project.
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setShowCreateForm(
                    false
                  )
                }
                className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center"
              >
                <X
                  size={
                    17
                  }
                />
              </button>

            </div>

            <form
              onSubmit={
                handleCreateProject
              }
              className="p-6 space-y-5"
            >

              <div>

                <label className="block text-sm text-zinc-400 mb-2">
                  Project Name
                </label>

                <input
                  type="text"
                  required
                  minLength={
                    2
                  }
                  value={
                    name
                  }
                  onChange={(
                    event
                  ) =>
                    setName(
                      event.target.value
                    )
                  }
                  placeholder="Payment Service"
                  className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 outline-none focus:border-emerald-500"
                />

              </div>

              <div>

                <label className="block text-sm text-zinc-400 mb-2">
                  Project ID
                </label>

                <input
                  type="text"
                  required
                  value={
                    projectId
                  }
                  onChange={(
                    event
                  ) =>
                    setProjectId(
                      event.target.value
                        .toLowerCase()
                        .replace(
                          /\s+/g,
                          "-"
                        )
                    )
                  }
                  placeholder="payment-service"
                  className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 outline-none focus:border-emerald-500 font-mono"
                />

                <p className="text-xs text-zinc-600 mt-2">
                  Lowercase letters, numbers, hyphens and underscores.
                </p>

              </div>

              <button
                type="submit"
                disabled={
                  creating
                }
                className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 font-medium"
              >
                {creating
                  ? "Creating..."
                  : "Create Project"}
              </button>

            </form>

          </div>

        </div>
      )}

      {/* ====================================================
          API KEY REVEAL MODAL
      ==================================================== */}

      {revealedApiKey && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">

          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />

          <div className="relative w-full max-w-2xl bg-zinc-950 border border-emerald-500/30 rounded-2xl shadow-2xl">

            <div className="px-6 py-5 border-b border-zinc-800">

              <div className="flex items-center gap-3">

                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">

                  <KeyRound
                    size={
                      20
                    }
                    className="text-emerald-400"
                  />

                </div>

                <div>

                  <h3 className="font-semibold text-lg">
                    API Key Generated
                  </h3>

                  <p className="text-sm text-zinc-500">
                    {revealedProjectId}
                  </p>

                </div>

              </div>

            </div>

            <div className="p-6">

              <div className="bg-black border border-zinc-800 rounded-xl p-4">

                <p className="font-mono text-sm text-emerald-400 break-all">
                  {revealedApiKey}
                </p>

              </div>

              <div className="mt-4 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
                ⚠ {secretWarning}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6">

                <button
                  type="button"
                  onClick={() =>
                    void copyApiKey()
                  }
                  className="flex-1 px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-medium flex items-center justify-center gap-2"
                >

                  <Copy
                    size={
                      17
                    }
                  />

                  {copied
                    ? "Copied"
                    : "Copy API Key"}

                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRevealedApiKey(
                      null
                    );

                    setRevealedProjectId(
                      ""
                    );

                    setSecretWarning(
                      ""
                    );

                    setCopied(
                      false
                    );
                  }}
                  className="px-5 py-3 rounded-lg bg-zinc-900 border border-zinc-700 hover:bg-zinc-800"
                >
                  I Saved It
                </button>

              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}