import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  CheckCircle2,
  Copy,
  Edit3,
  Globe2,
  KeyRound,
  Link2,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";

import {
  createEndpoint,
  deleteEndpoint,
  getEndpoints,
  setEndpointActive,
  updateEndpoint,
  type EndpointMethod,
  type WebhookEndpoint,
} from "../api/endpointsApi";

import {
  getProjects,
  type Project,
} from "../api/projectsApi";

import {
  useAuth,
} from "../context/AuthContext";

// ==========================================================
// PROPS
// ==========================================================

interface EndpointManagerProps {
  onEndpointsChanged?:
    () => void;
}

// ==========================================================
// FORM STATE
// ==========================================================

interface EndpointFormState {
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

const emptyForm:
  EndpointFormState = {
    name:
      "",

    projectId:
      "",

    targetUrl:
      "",

    method:
      "POST",

    maxRetries:
      3,
  };

// ==========================================================
// COMPONENT
// ==========================================================

export default function EndpointManager({
  onEndpointsChanged,
}: EndpointManagerProps) {
  // ========================================================
  // AUTH
  // ========================================================

  const {
    user,
  } =
    useAuth();

  const isDemo =
    user?.role ===
    "demo";

  // ========================================================
  // DATA
  // ========================================================

  const [
    endpoints,
    setEndpoints,
  ] =
    useState<
      WebhookEndpoint[]
    >(
      []
    );

  const [
    projects,
    setProjects,
  ] =
    useState<Project[]>(
      []
    );

  // ========================================================
  // LOADING STATE
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

  // ========================================================
  // CREATE MODAL
  // ========================================================

  const [
    showCreateModal,
    setShowCreateModal,
  ] =
    useState(
      false
    );

  const [
    form,
    setForm,
  ] =
    useState<EndpointFormState>(
      emptyForm
    );

  const [
    creating,
    setCreating,
  ] =
    useState(
      false
    );

  // ========================================================
  // EDIT MODAL
  // ========================================================

  const [
    editingEndpoint,
    setEditingEndpoint,
  ] =
    useState<WebhookEndpoint | null>(
      null
    );

  const [
    editForm,
    setEditForm,
  ] =
    useState<EndpointFormState>(
      emptyForm
    );

  const [
    updating,
    setUpdating,
  ] =
    useState(
      false
    );

  // ========================================================
  // DELETE / TOGGLE
  // ========================================================

  const [
    deletingEndpointId,
    setDeletingEndpointId,
  ] =
    useState<string | null>(
      null
    );

  const [
    togglingEndpointId,
    setTogglingEndpointId,
  ] =
    useState<string | null>(
      null
    );

  // ========================================================
  // SIGNING SECRET
  // ========================================================

  const [
    signingSecret,
    setSigningSecret,
  ] =
    useState<string | null>(
      null
    );

  const [
    secretEndpointId,
    setSecretEndpointId,
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
    copiedSecret,
    setCopiedSecret,
  ] =
    useState(
      false
    );

  // ========================================================
  // LOAD CONFIGURATION
  // ========================================================

  const loadConfiguration =
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

          const [
            endpointResponse,
            projectResponse,
          ] =
            await Promise.all([
              getEndpoints(),
              getProjects(),
            ]);

          const loadedEndpoints =
            Array.isArray(
              endpointResponse.endpoints
            )
              ? endpointResponse.endpoints
              : [];

          const loadedProjects =
            Array.isArray(
              projectResponse.projects
            )
              ? projectResponse.projects
              : [];

          setEndpoints(
            loadedEndpoints
          );

          setProjects(
            loadedProjects
          );

          // Give create form a default project.
          setForm(
            (
              current
            ) => {
              if (
                current.projectId ||
                loadedProjects.length ===
                  0
              ) {
                return current;
              }

              return {
                ...current,

                projectId:
                  loadedProjects[0]
                    .projectId,
              };
            }
          );
        } catch (err) {
          console.error(
            "Load Endpoint Configuration Error:",
            err
          );

          setError(
            err instanceof Error
              ? err.message
              : "Failed to load endpoints"
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
      void loadConfiguration();
    },
    [
      loadConfiguration,
    ]
  );

  // ========================================================
  // OPEN CREATE MODAL
  // ========================================================

  const openCreateModal =
    () => {
      // Frontend demo guard.
      // Backend authorization still provides the real
      // security boundary.
      if (isDemo) {
        return;
      }

      setError(
        ""
      );

      setForm({
        ...emptyForm,

        projectId:
          projects[0]
            ?.projectId ||
          "",
      });

      setShowCreateModal(
        true
      );
    };

  // ========================================================
  // CREATE ENDPOINT
  // ========================================================

  const handleCreate =
    async (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      if (isDemo) {
        return;
      }

      try {
        setCreating(
          true
        );

        setError(
          ""
        );

        const response =
          await createEndpoint({
            name:
              form.name,

            projectId:
              form.projectId,

            targetUrl:
              form.targetUrl,

            method:
              form.method,

            maxRetries:
              form.maxRetries,
          });

        // ==================================================
        // SHOW SIGNING SECRET ONCE
        // ==================================================

        setSigningSecret(
          response.signingSecret
        );

        setSecretEndpointId(
          response.endpoint.endpointId
        );

        setSecretWarning(
          response.warning
        );

        setShowCreateModal(
          false
        );

        setForm({
          ...emptyForm,

          projectId:
            projects[0]
              ?.projectId ||
            "",
        });

        await loadConfiguration(
          true
        );

        onEndpointsChanged?.();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to create endpoint"
        );
      } finally {
        setCreating(
          false
        );
      }
    };

  // ========================================================
  // OPEN EDIT MODAL
  // ========================================================

  const openEditModal =
    (
      endpoint:
        WebhookEndpoint
    ) => {
      if (isDemo) {
        return;
      }

      setEditingEndpoint(
        endpoint
      );

      setEditForm({
        name:
          endpoint.name,

        projectId:
          endpoint.projectId,

        targetUrl:
          endpoint.targetUrl,

        method:
          endpoint.method,

        maxRetries:
          endpoint.maxRetries,
      });

      setError(
        ""
      );
    };

  // ========================================================
  // UPDATE ENDPOINT
  // ========================================================

  const handleUpdate =
    async (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      if (
        isDemo ||
        !editingEndpoint
      ) {
        return;
      }

      try {
        setUpdating(
          true
        );

        setError(
          ""
        );

        await updateEndpoint(
          editingEndpoint.endpointId,
          {
            name:
              editForm.name,

            targetUrl:
              editForm.targetUrl,

            method:
              editForm.method,

            maxRetries:
              editForm.maxRetries,
          }
        );

        setEditingEndpoint(
          null
        );

        await loadConfiguration(
          true
        );

        onEndpointsChanged?.();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to update endpoint"
        );
      } finally {
        setUpdating(
          false
        );
      }
    };

  // ========================================================
  // ENABLE / DISABLE
  // ========================================================

  const handleToggle =
    async (
      endpoint:
        WebhookEndpoint
    ) => {
      if (isDemo) {
        return;
      }

      try {
        setTogglingEndpointId(
          endpoint.endpointId
        );

        setError(
          ""
        );

        await setEndpointActive(
          endpoint.endpointId,
          !endpoint.active
        );

        await loadConfiguration(
          true
        );

        onEndpointsChanged?.();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to change endpoint status"
        );
      } finally {
        setTogglingEndpointId(
          null
        );
      }
    };

  // ========================================================
  // DELETE ENDPOINT
  // ========================================================

  const handleDelete =
    async (
      endpoint:
        WebhookEndpoint
    ) => {
      if (isDemo) {
        return;
      }

      const confirmed =
        window.confirm(
          `Delete endpoint "${endpoint.name}"?\n\nWebhook events will no longer be deliverable to this endpoint.`
        );

      if (!confirmed) {
        return;
      }

      try {
        setDeletingEndpointId(
          endpoint.endpointId
        );

        setError(
          ""
        );

        await deleteEndpoint(
          endpoint.endpointId
        );

        await loadConfiguration(
          true
        );

        onEndpointsChanged?.();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to delete endpoint"
        );
      } finally {
        setDeletingEndpointId(
          null
        );
      }
    };

  // ========================================================
  // COPY SIGNING SECRET
  // ========================================================

  const copySigningSecret =
    async () => {
      if (!signingSecret) {
        return;
      }

      try {
        await navigator.clipboard.writeText(
          signingSecret
        );

        setCopiedSecret(
          true
        );

        window.setTimeout(
          () => {
            setCopiedSecret(
              false
            );
          },
          1500
        );
      } catch {
        setCopiedSecret(
          false
        );
      }
    };

  // ========================================================
  // ACTIVE COUNTS
  // ========================================================

  const activeCount =
    endpoints.filter(
      (
        endpoint
      ) =>
        endpoint.active
    ).length;

  const disabledCount =
    endpoints.length -
    activeCount;

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

          <div className="flex flex-wrap items-center gap-3 mb-2">

            <p className="text-emerald-400 text-xs font-semibold tracking-[0.18em]">
              WEBHOOK CONFIGURATION
            </p>

            {isDemo && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-semibold uppercase tracking-wide">
                Demo Mode
              </span>
            )}

          </div>

          <h2 className="text-3xl font-bold">
            Endpoints
          </h2>

          <p className="text-zinc-500 mt-2 max-w-2xl">
            {isDemo
              ? "Explore preconfigured webhook destinations, delivery methods and retry policies."
              : "Configure target URLs, request methods, retry policies and endpoint availability."}
          </p>

        </div>

        <div className="flex items-center gap-3">

          <button
            type="button"
            onClick={() =>
              void loadConfiguration(
                true
              )
            }
            disabled={
              refreshing
            }
            className="h-11 px-4 rounded-lg bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 flex items-center gap-2 text-sm disabled:opacity-60 transition"
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

          {!isDemo && (
            <button
              type="button"
              onClick={
                openCreateModal
              }
              disabled={
                projects.length ===
                0
              }
              className="h-11 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white flex items-center gap-2 text-sm font-medium transition"
            >

              <Plus
                size={
                  17
                }
              />

              Create Endpoint

            </button>
          )}

        </div>

      </div>

      {/* ====================================================
          DEMO NOTICE
      ==================================================== */}

      {isDemo && (
        <div className="mb-6 px-5 py-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20">

          <p className="text-sm font-medium text-cyan-400">
            Read-only Demo
          </p>

          <p className="text-sm text-zinc-500 mt-1">
            Endpoint creation, editing, activation changes and
            deletion are disabled for this account.
          </p>

        </div>
      )}

      {/* ====================================================
          ERROR
      ==================================================== */}

      {error && (
        <div className="mb-6 px-5 py-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
          {error}
        </div>
      )}

      {/* ====================================================
          NO PROJECT WARNING
      ==================================================== */}

      {!loading &&
        projects.length ===
          0 && (
          <div className="mb-6 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl px-5 py-4">

            {isDemo
              ? "Demo project configuration is currently unavailable."
              : "You need to create a project before creating a webhook endpoint."}

          </div>
        )}

      {/* ====================================================
          SUMMARY
      ==================================================== */}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">

        <SummaryCard
          label="Total Endpoints"
          value={
            loading
              ? "..."
              : endpoints.length
          }
          valueClass="text-white"
        />

        <SummaryCard
          label="Active"
          value={
            loading
              ? "..."
              : activeCount
          }
          valueClass="text-emerald-400"
        />

        <SummaryCard
          label="Disabled"
          value={
            loading
              ? "..."
              : disabledCount
          }
          valueClass="text-zinc-500"
        />

      </div>

      {/* ====================================================
          ENDPOINT LIST
      ==================================================== */}

      {loading ? (
        <div className="h-64 flex items-center justify-center text-zinc-600">

          <RefreshCw
            size={
              24
            }
            className="animate-spin mr-3"
          />

          Loading endpoints...

        </div>
      ) : endpoints.length ===
        0 ? (
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-12 text-center">

          <Link2
            size={
              42
            }
            className="mx-auto text-zinc-700 mb-4"
          />

          <p className="font-medium text-zinc-300">
            No webhook endpoints
          </p>

          <p className="text-sm text-zinc-600 mt-2">
            {isDemo
              ? "Demo endpoint data is currently unavailable."
              : "Create an endpoint to start delivering webhook events."}
          </p>

        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

          {endpoints.map(
            (
              endpoint
            ) => (
              <div
                key={
                  endpoint.endpointId
                }
                className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition"
              >

                {/* ==========================================
                    HEADER
                ========================================== */}

                <div className="flex items-start justify-between gap-4 mb-5">

                  <div className="flex items-start gap-3 min-w-0">

                    <div className="w-10 h-10 shrink-0 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">

                      <Globe2
                        size={
                          19
                        }
                        className="text-cyan-400"
                      />

                    </div>

                    <div className="min-w-0">

                      <div className="flex flex-wrap items-center gap-2">

                        <h3 className="font-semibold text-lg truncate">
                          {endpoint.name}
                        </h3>

                        {isDemo && (
                          <span className="inline-flex px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-500 text-[10px] uppercase tracking-wide">
                            Read Only
                          </span>
                        )}

                      </div>

                      <p className="font-mono text-xs text-zinc-600 mt-1 truncate">
                        {endpoint.endpointId}
                      </p>

                    </div>

                  </div>

                  {/* ========================================
                      STATUS
                  ======================================== */}

                  <span
                    className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-semibold uppercase ${
                      endpoint.active
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-zinc-800 text-zinc-500 border-zinc-700"
                    }`}
                  >

                    {endpoint.active ? (
                      <CheckCircle2
                        size={
                          12
                        }
                      />
                    ) : (
                      <PauseCircle
                        size={
                          12
                        }
                      />
                    )}

                    {endpoint.active
                      ? "Active"
                      : "Disabled"}

                  </span>

                </div>

                {/* ==========================================
                    TARGET URL
                ========================================== */}

                <div className="bg-black border border-zinc-800 rounded-xl p-4 mb-4">

                  <p className="text-[11px] text-zinc-600 uppercase tracking-wider">
                    Target URL
                  </p>

                  <p
                    className="font-mono text-sm text-zinc-300 mt-2 break-all"
                    title={
                      endpoint.targetUrl
                    }
                  >
                    {endpoint.targetUrl}
                  </p>

                </div>

                {/* ==========================================
                    CONFIGURATION
                ========================================== */}

                <div className="grid grid-cols-3 gap-3 mb-5">

                  <ConfigBox
                    label="Method"
                    value={
                      endpoint.method
                    }
                    valueClass="text-cyan-400"
                  />

                  <ConfigBox
                    label="Retries"
                    value={
                      endpoint.maxRetries
                    }
                  />

                  <ConfigBox
                    label="Project"
                    value={
                      endpoint.projectId
                    }
                    small
                  />

                </div>

                {/* ==========================================
                    CREATED
                ========================================== */}

                <p className="text-xs text-zinc-600 mb-5">
                  Created{" "}
                  {new Date(
                    endpoint.createdAt
                  ).toLocaleString()}
                </p>

                {/* ==========================================
                    ACTIONS
                ========================================== */}

                {!isDemo ? (
                  <div className="flex flex-wrap gap-2">

                    {/* ======================================
                        EDIT
                    ====================================== */}

                    <button
                      type="button"
                      onClick={() =>
                        openEditModal(
                          endpoint
                        )
                      }
                      className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-sm flex items-center gap-2 transition"
                    >

                      <Edit3
                        size={
                          14
                        }
                      />

                      Edit

                    </button>

                    {/* ======================================
                        ENABLE / DISABLE
                    ====================================== */}

                    <button
                      type="button"
                      onClick={() =>
                        void handleToggle(
                          endpoint
                        )
                      }
                      disabled={
                        togglingEndpointId ===
                        endpoint.endpointId
                      }
                      className={`px-3 py-2 rounded-lg border text-sm flex items-center gap-2 transition ${
                        endpoint.active
                          ? "bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20"
                          : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                      }`}
                    >

                      {endpoint.active ? (
                        <PauseCircle
                          size={
                            14
                          }
                        />
                      ) : (
                        <PlayCircle
                          size={
                            14
                          }
                        />
                      )}

                      {togglingEndpointId ===
                      endpoint.endpointId
                        ? "Updating..."
                        : endpoint.active
                          ? "Disable"
                          : "Enable"}

                    </button>

                    {/* ======================================
                        DELETE
                    ====================================== */}

                    <button
                      type="button"
                      onClick={() =>
                        void handleDelete(
                          endpoint
                        )
                      }
                      disabled={
                        deletingEndpointId ===
                        endpoint.endpointId
                      }
                      className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-sm flex items-center gap-2 transition"
                    >

                      <Trash2
                        size={
                          14
                        }
                      />

                      {deletingEndpointId ===
                      endpoint.endpointId
                        ? "Deleting..."
                        : "Delete"}

                    </button>

                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-zinc-600">

                    <Globe2
                      size={
                        14
                      }
                    />

                    Endpoint configuration is read-only in Demo Mode

                  </div>
                )}

              </div>
            )
          )}

        </div>
      )}

      {/* ====================================================
          CREATE MODAL
      ==================================================== */}

      {showCreateModal &&
        !isDemo && (
        <EndpointFormModal
          title="Create Endpoint"
          subtitle="Configure a new webhook delivery destination."
          form={
            form
          }
          projects={
            projects
          }
          loading={
            creating
          }
          submitText="Create Endpoint"
          onChange={
            setForm
          }
          onClose={() =>
            setShowCreateModal(
              false
            )
          }
          onSubmit={
            handleCreate
          }
          allowProjectChange
        />
      )}

      {/* ====================================================
          EDIT MODAL
      ==================================================== */}

      {editingEndpoint &&
        !isDemo && (
        <EndpointFormModal
          title="Edit Endpoint"
          subtitle={
            editingEndpoint.endpointId
          }
          form={
            editForm
          }
          projects={
            projects
          }
          loading={
            updating
          }
          submitText="Save Changes"
          onChange={
            setEditForm
          }
          onClose={() =>
            setEditingEndpoint(
              null
            )
          }
          onSubmit={
            handleUpdate
          }
          allowProjectChange={
            false
          }
        />
      )}

      {/* ====================================================
          SIGNING SECRET MODAL
      ==================================================== */}

      {signingSecret &&
        !isDemo && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">

          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />

          <div className="relative w-full max-w-2xl bg-zinc-950 border border-cyan-500/30 rounded-2xl shadow-2xl">

            <div className="px-6 py-5 border-b border-zinc-800">

              <div className="flex items-center gap-3">

                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">

                  <KeyRound
                    size={
                      20
                    }
                    className="text-cyan-400"
                  />

                </div>

                <div>

                  <h3 className="font-semibold text-lg">
                    Signing Secret Generated
                  </h3>

                  <p className="text-sm font-mono text-zinc-600 mt-1">
                    {secretEndpointId}
                  </p>

                </div>

              </div>

            </div>

            <div className="p-6">

              <p className="text-sm text-zinc-500 mb-3">
                Use this secret on your receiving server to
                verify PulseEngine HMAC signatures.
              </p>

              <div className="bg-black border border-zinc-800 rounded-xl p-4">

                <p className="font-mono text-sm text-cyan-400 break-all">
                  {signingSecret}
                </p>

              </div>

              <div className="mt-4 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
                {secretWarning}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6">

                <button
                  type="button"
                  onClick={() =>
                    void copySigningSecret()
                  }
                  className="flex-1 px-4 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 font-medium flex items-center justify-center gap-2 transition"
                >

                  <Copy
                    size={
                      17
                    }
                  />

                  {copiedSecret
                    ? "Copied"
                    : "Copy Signing Secret"}

                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSigningSecret(
                      null
                    );

                    setSecretEndpointId(
                      ""
                    );

                    setSecretWarning(
                      ""
                    );

                    setCopiedSecret(
                      false
                    );
                  }}
                  className="px-5 py-3 rounded-lg bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 transition"
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

// ==========================================================
// ENDPOINT FORM MODAL
// ==========================================================

interface EndpointFormModalProps {
  title:
    string;

  subtitle:
    string;

  form:
    EndpointFormState;

  projects:
    Project[];

  loading:
    boolean;

  submitText:
    string;

  allowProjectChange:
    boolean;

  onChange:
    (
      form:
        EndpointFormState
    ) => void;

  onClose:
    () => void;

  onSubmit:
    (
      event:
        FormEvent<HTMLFormElement>
    ) => void;
}

function EndpointFormModal({
  title,
  subtitle,
  form,
  projects,
  loading,
  submitText,
  allowProjectChange,
  onChange,
  onClose,
  onSubmit,
}: EndpointFormModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">

      {/* ====================================================
          BACKDROP
      ==================================================== */}

      <button
        type="button"
        aria-label="Close modal"
        onClick={
          onClose
        }
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      {/* ====================================================
          MODAL
      ==================================================== */}

      <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl">

        {/* ==================================================
            HEADER
        ================================================== */}

        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">

          <div className="min-w-0">

            <h3 className="font-semibold text-lg">
              {title}
            </h3>

            <p className="text-sm text-zinc-500 mt-1 truncate">
              {subtitle}
            </p>

          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            className="w-9 h-9 shrink-0 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center hover:bg-zinc-800 transition"
          >
            <X
              size={
                17
              }
            />
          </button>

        </div>

        {/* ==================================================
            FORM
        ================================================== */}

        <form
          onSubmit={
            onSubmit
          }
          className="p-6 space-y-5"
        >

          {/* ================================================
              NAME
          ================================================ */}

          <div>

            <label className="block text-sm text-zinc-400 mb-2">
              Endpoint Name
            </label>

            <input
              type="text"
              required
              minLength={
                2
              }
              maxLength={
                100
              }
              value={
                form.name
              }
              onChange={(
                event
              ) =>
                onChange({
                  ...form,

                  name:
                    event.target.value,
                })
              }
              placeholder="Production Payment Webhook"
              className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 outline-none focus:border-emerald-500"
            />

          </div>

          {/* ================================================
              PROJECT
          ================================================ */}

          <div>

            <label className="block text-sm text-zinc-400 mb-2">
              Project
            </label>

            <select
              required
              disabled={
                !allowProjectChange
              }
              value={
                form.projectId
              }
              onChange={(
                event
              ) =>
                onChange({
                  ...form,

                  projectId:
                    event.target.value,
                })
              }
              className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 outline-none focus:border-emerald-500 disabled:text-zinc-600"
            >

              <option value="">
                Select Project
              </option>

              {projects.map(
                (
                  project
                ) => (
                  <option
                    key={
                      project.projectId
                    }
                    value={
                      project.projectId
                    }
                  >
                    {project.name} ({project.projectId})
                  </option>
                )
              )}

            </select>

            {!allowProjectChange && (
              <p className="text-xs text-zinc-600 mt-2">
                Project cannot be changed after endpoint creation.
              </p>
            )}

          </div>

          {/* ================================================
              TARGET URL
          ================================================ */}

          <div>

            <label className="block text-sm text-zinc-400 mb-2">
              Target URL
            </label>

            <input
              type="url"
              required
              value={
                form.targetUrl
              }
              onChange={(
                event
              ) =>
                onChange({
                  ...form,

                  targetUrl:
                    event.target.value,
                })
              }
              placeholder="https://api.example.com/webhooks/payment"
              className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 outline-none focus:border-emerald-500 font-mono text-sm"
            />

            <p className="text-xs text-zinc-600 mt-2">
              PulseEngine will deliver webhook payloads to this URL.
            </p>

          </div>

          {/* ================================================
              METHOD / RETRIES
          ================================================ */}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div>

              <label className="block text-sm text-zinc-400 mb-2">
                HTTP Method
              </label>

              <select
                value={
                  form.method
                }
                onChange={(
                  event
                ) =>
                  onChange({
                    ...form,

                    method:
                      event.target
                        .value as EndpointMethod,
                  })
                }
                className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 outline-none focus:border-emerald-500"
              >

                <option value="POST">
                  POST
                </option>

                <option value="PUT">
                  PUT
                </option>

                <option value="PATCH">
                  PATCH
                </option>

              </select>

            </div>

            <div>

              <label className="block text-sm text-zinc-400 mb-2">
                Max Retries
              </label>

              <input
                type="number"
                required
                min={
                  0
                }
                max={
                  10
                }
                value={
                  form.maxRetries
                }
                onChange={(
                  event
                ) => {
                  const parsed =
                    Number(
                      event.target.value
                    );

                  onChange({
                    ...form,

                    maxRetries:
                      Number.isFinite(
                        parsed
                      )
                        ? parsed
                        : 0,
                  });
                }}
                className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 outline-none focus:border-emerald-500"
              />

            </div>

          </div>

          {/* ================================================
              RETRY DESCRIPTION
          ================================================ */}

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">

            <div className="flex items-start gap-3">

              <RotateCcw
                size={
                  17
                }
                className="text-amber-400 mt-0.5 shrink-0"
              />

              <div>

                <p className="text-sm text-zinc-300">
                  Retry Policy
                </p>

                <p className="text-xs text-zinc-600 mt-1">
                  {form.maxRetries ===
                  0
                    ? "Only the initial delivery attempt will be made."
                    : `${form.maxRetries} retries plus the initial request = ${
                        form.maxRetries +
                        1
                      } total attempts.`}
                </p>

              </div>

            </div>

          </div>

          {/* ================================================
              SUBMIT
          ================================================ */}

          <button
            type="submit"
            disabled={
              loading
            }
            className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 disabled:text-emerald-300 font-medium transition"
          >
            {loading
              ? "Saving..."
              : submitText}
          </button>

        </form>

      </div>

    </div>
  );
}

// ==========================================================
// SUMMARY CARD
// ==========================================================

function SummaryCard({
  label,
  value,
  valueClass,
}: {
  label:
    string;

  value:
    number | string;

  valueClass:
    string;
}) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">

      <p className="text-sm text-zinc-500">
        {label}
      </p>

      <p
        className={`text-3xl font-bold mt-2 ${valueClass}`}
      >
        {value}
      </p>

    </div>
  );
}

// ==========================================================
// CONFIG BOX
// ==========================================================

function ConfigBox({
  label,
  value,
  valueClass =
    "text-zinc-300",
  small =
    false,
}: {
  label:
    string;

  value:
    string | number;

  valueClass?:
    string;

  small?:
    boolean;
}) {
  return (
    <div className="bg-black border border-zinc-800 rounded-lg p-3 min-w-0">

      <p className="text-[10px] uppercase tracking-wider text-zinc-600">
        {label}
      </p>

      <p
        className={`font-semibold mt-1 truncate ${valueClass} ${
          small
            ? "text-xs"
            : "text-sm"
        }`}
        title={
          String(
            value
          )
        }
      >
        {value}
      </p>

    </div>
  );
}