import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Copy,
  Edit3,
  Plus,
  Save,
  Trash2,
  X,
  Loader2,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type {
  Benchmark,
  BenchmarkMetric,
  BenchmarkOperator,
  BenchmarkRequirement,
  BenchmarkSourceType,
  PlayerRole,
} from "@/lib/benchmark";

export const Route = createFileRoute("/_authenticated/admin/benchmarks")({
  component: AdminBenchmarksPage,
});

const roles: Array<PlayerRole | "all"> = [
  "all",
  "IGL",
  "Rusher",
  "Sniper",
  "Support",
  "Fragger",
  "Flex",
  "Other",
];

const sourceTypes: BenchmarkSourceType[] = [
  "training",
  "solo_vs_squad",
  "battle_royale",
  "custom",
];

const metrics: BenchmarkMetric[] = [
  "kills",
  "headshots",
  "headshot_rate",
  "damage",
  "booyah",
  "wins",
  "placement",
  "matches",
  "assists",
  "elimination_streak",
  "kd_ratio",
  "custom",
];

const operators: BenchmarkOperator[] = [
  ">=",
  "<=",
  "=",
  ">",
  "<",
];

function createRequirement(
  sourceType: BenchmarkSourceType,
): BenchmarkRequirement {
  return {
    label: "New requirement",
    metric: "kills",
    operator: ">=",
    target_value: 1,
    source_type: sourceType,
    required: true,
  };
}

function makeNewBenchmark(): Benchmark {
  return {
    id: "",
    name: "New Benchmark",
    description: "",
    source_type: "training",
    role: "all",
    status: "draft",
    requirements: [createRequirement("training")],
  };
}

function AdminBenchmarksPage() {
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [editing, setEditing] = useState<Benchmark | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadBenchmarks = async () => {
    setLoading(true);

    try {
      const [{ data: rows, error }, { data: reqs, error: reqError }] =
        await Promise.all([
          supabase
            .from("benchmarks")
            .select(
              "id,name,description,source_type,role,status,created_at,updated_at",
            )
            .order("created_at", { ascending: true }),

          supabase
            .from("benchmark_requirements")
            .select(
              "id,benchmark_id,label,metric,operator,target_value,source_type,required,created_at",
            )
            .order("created_at", { ascending: true }),
        ]);

      if (error) throw error;
      if (reqError) throw reqError;

      const mapped: Benchmark[] = (rows ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description ?? "",
        source_type: row.source_type as BenchmarkSourceType,
        role: row.role as PlayerRole | "all",
        status: row.status as Benchmark["status"],
        created_at: row.created_at,
        updated_at: row.updated_at,
        requirements: (reqs ?? [])
          .filter((req) => req.benchmark_id === row.id)
          .map(
            (req): BenchmarkRequirement => ({
              id: req.id,
              benchmark_id: req.benchmark_id,
              label: req.label,
              metric: req.metric as BenchmarkMetric,
              operator: req.operator as BenchmarkOperator,
              target_value: Number(req.target_value),
              source_type: (req.source_type ??
                row.source_type) as BenchmarkSourceType,
              required: Boolean(req.required),
            }),
          ),
      }));

      setBenchmarks(mapped);
    } catch (error: any) {
      console.error("[Benchmark Manager] load failed", error);
      toast.error(error?.message ?? "Failed to load benchmarks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBenchmarks();
  }, []);

  const startCreate = () => {
    setEditing(makeNewBenchmark());
  };

  const startEdit = (benchmark: Benchmark) => {
    setEditing({
      ...benchmark,
      requirements: benchmark.requirements.map((req) => ({
        ...req,
      })),
    });
  };

  const duplicateBenchmark = (benchmark: Benchmark) => {
    setEditing({
      ...benchmark,
      id: "",
      name: `${benchmark.name} Copy`,
      status: "draft",
      created_at: undefined,
      updated_at: undefined,
      requirements: benchmark.requirements.map((req) => ({
        ...req,
        id: undefined,
        benchmark_id: undefined,
      })),
    });
  };

  const updateEditing = (changes: Partial<Benchmark>) => {
    setEditing((current) =>
      current
        ? {
            ...current,
            ...changes,
          }
        : current,
    );
  };

  const updateRequirement = (
    index: number,
    changes: Partial<BenchmarkRequirement>,
  ) => {
    setEditing((current) => {
      if (!current) return current;

      return {
        ...current,
        requirements: current.requirements.map((req, i) =>
          i === index
            ? {
                ...req,
                ...changes,
              }
            : req,
        ),
      };
    });
  };

  const addRequirement = () => {
    setEditing((current) => {
      if (!current) return current;

      return {
        ...current,
        requirements: [
          ...current.requirements,
          createRequirement(current.source_type),
        ],
      };
    });
  };

  const removeRequirement = (index: number) => {
    setEditing((current) => {
      if (!current) return current;

      if (current.requirements.length <= 1) {
        toast.error("At least one requirement is required");
        return current;
      }

      return {
        ...current,
        requirements: current.requirements.filter(
          (_, i) => i !== index,
        ),
      };
    });
  };

  const deleteBenchmark = async (id: string) => {
    const benchmark = benchmarks.find((item) => item.id === id);

    if (!benchmark) return;

    const confirmed = window.confirm(
      `Delete "${benchmark.name}" permanently?`,
    );

    if (!confirmed) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from("benchmarks")
        .delete()
        .eq("id", id);

      if (error) throw error;

      if (editing?.id === id) {
        setEditing(null);
      }

      toast.success("Benchmark deleted");
      await loadBenchmarks();
    } catch (error: any) {
      console.error("[Benchmark Manager] delete failed", error);
      toast.error(error?.message ?? "Could not delete benchmark");
    } finally {
      setSaving(false);
    }
  };

  const saveBenchmark = async () => {
    if (!editing) return;

    if (!editing.name.trim()) {
      toast.error("Benchmark name is required");
      return;
    }

    if (editing.requirements.length === 0) {
      toast.error("Add at least one requirement");
      return;
    }

    for (const requirement of editing.requirements) {
      if (!requirement.label.trim()) {
        toast.error("Every requirement needs a label");
        return;
      }

      if (!Number.isFinite(Number(requirement.target_value))) {
        toast.error("Every requirement needs a valid target");
        return;
      }
    }

    setSaving(true);

    try {
      let benchmarkId = editing.id;

      if (benchmarkId) {
        const { error } = await supabase
          .from("benchmarks")
          .update({
            name: editing.name.trim(),
            description: editing.description?.trim() || null,
            source_type: editing.source_type,
            role: editing.role,
            status: editing.status,
          })
          .eq("id", benchmarkId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("benchmarks")
          .insert({
            name: editing.name.trim(),
            description: editing.description?.trim() || null,
            source_type: editing.source_type,
            role: editing.role,
            status: editing.status,
          })
          .select("id")
          .single();

        if (error) throw error;

        benchmarkId = data.id;
      }

      const { error: deleteRequirementsError } = await supabase
        .from("benchmark_requirements")
        .delete()
        .eq("benchmark_id", benchmarkId);

      if (deleteRequirementsError) {
        throw deleteRequirementsError;
      }

      const requirementRows = editing.requirements.map((requirement) => ({
        benchmark_id: benchmarkId,
        label: requirement.label.trim(),
        metric: requirement.metric,
        operator: requirement.operator,
        target_value: Number(requirement.target_value),
        source_type:
          requirement.source_type ?? editing.source_type,
        required: requirement.required !== false,
      }));

      const { error: requirementsError } = await supabase
        .from("benchmark_requirements")
        .insert(requirementRows);

      if (requirementsError) {
        throw requirementsError;
      }

      toast.success(
        editing.id
          ? "Benchmark updated successfully"
          : "Benchmark created successfully",
      );

      setEditing(null);
      await loadBenchmarks();
    } catch (error: any) {
      console.error("[Benchmark Manager] save failed", error);
      toast.error(error?.message ?? "Could not save benchmark");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-neon">
              Admin
            </div>

            <h1 className="mt-2 font-display text-4xl md:text-5xl">
              Benchmark Manager
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Create role-specific drills and define exactly which
              screenshot metrics a player must complete.
            </p>
          </div>

          <Button
            type="button"
            className="glow"
            onClick={startCreate}
            disabled={loading || saving}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Benchmark
          </Button>
        </section>

        {loading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton
                key={index}
                className="h-40 rounded-2xl"
              />
            ))}
          </div>
        ) : benchmarks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <div className="font-semibold">
              No benchmarks yet
            </div>

            <div className="mt-1 text-sm text-muted-foreground">
              Create your first drill.
            </div>
          </div>
        ) : (
          <section className="grid gap-3 md:grid-cols-2">
            {benchmarks.map((benchmark) => (
              <div
                key={benchmark.id}
                className="glass rounded-2xl p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">
                      {benchmark.name}
                    </div>

                    <div className="mt-1 flex flex-wrap gap-2">
                      <span className="rounded-full bg-neon-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-neon">
                        {benchmark.role}
                      </span>

                      <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                        {benchmark.source_type.replace(
                          "_",
                          " ",
                        )}
                      </span>

                      <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                        {benchmark.status}
                      </span>
                    </div>

                    {benchmark.description && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {benchmark.description}
                      </div>
                    )}

                    <div className="mt-3 grid gap-1">
                      {benchmark.requirements.map(
                        (requirement, index) => (
                          <div
                            key={
                              requirement.id ??
                              `${benchmark.id}-${index}`
                            }
                            className="flex items-center justify-between gap-3 text-xs"
                          >
                            <span className="text-muted-foreground">
                              {requirement.label}
                            </span>

                            <span className="font-semibold text-neon">
                              {requirement.operator}{" "}
                              {requirement.target_value}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={saving}
                      onClick={() =>
                        duplicateBenchmark(benchmark)
                      }
                    >
                      <Copy className="h-4 w-4" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={saving}
                      onClick={() =>
                        startEdit(benchmark)
                      }
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={saving}
                      onClick={() =>
                        void deleteBenchmark(benchmark.id)
                      }
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}

        {editing && (
          <section className="glass rounded-2xl p-5 md:p-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-display text-2xl">
                  {editing.id
                    ? "Edit Benchmark"
                    : "Create Benchmark"}
                </div>

                <div className="text-xs text-muted-foreground">
                  Changes are saved directly to Supabase.
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setEditing(null)}
                disabled={saving}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <Label>Name</Label>

                <Input
                  className="mt-2"
                  value={editing.name}
                  onChange={(event) =>
                    updateEditing({
                      name: event.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>Role</Label>

                <Select
                  value={editing.role}
                  onValueChange={(value) =>
                    updateEditing({
                      role: value as PlayerRole | "all",
                    })
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem
                        key={role}
                        value={role}
                      >
                        {role === "all"
                          ? "All Roles"
                          : role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Evidence type</Label>

                <Select
                  value={editing.source_type}
                  onValueChange={(value) => {
                    const sourceType =
                      value as BenchmarkSourceType;

                    updateEditing({
                      source_type: sourceType,
                      requirements:
                        editing.requirements.map(
                          (requirement) => ({
                            ...requirement,
                            source_type:
                              sourceType,
                          }),
                        ),
                    });
                  }}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    {sourceTypes.map((sourceType) => (
                      <SelectItem
                        key={sourceType}
                        value={sourceType}
                      >
                        {sourceType.replace(
                          "_",
                          " ",
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Status</Label>

                <Select
                  value={editing.status}
                  onValueChange={(value) =>
                    updateEditing({
                      status:
                        value as Benchmark["status"],
                    })
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="draft">
                      Draft
                    </SelectItem>

                    <SelectItem value="active">
                      Active
                    </SelectItem>

                    <SelectItem value="inactive">
                      Inactive
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <Label>Description</Label>

                <Input
                  className="mt-2"
                  value={editing.description ?? ""}
                  onChange={(event) =>
                    updateEditing({
               description:
                        event.target.value,
                    })
                  }
                  placeholder="Describe the drill..."
                />
              </div>
            </div>

            <div className="mt-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-bold">
                    Requirements
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Every required condition must pass.
                  </div>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={addRequirement}
                  disabled={saving}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add requirement
                </Button>
              </div>

              <div className="mt-4 grid gap-3">
                {editing.requirements.map(
                  (requirement, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-border bg-white/[0.02] p-4"
                    >
                      <div className="grid gap-3 md:grid-cols-[1.3fr_1fr_0.7fr_0.8fr_auto] md:items-end">
                        <div>
                          <Label>Label</Label>

                          <Input
                            className="mt-2"
                            value={requirement.label}
                            onChange={(event) =>
                              updateRequirement(
                                index,
                                {
                                  label:
                                    event.target.value,
                                },
                              )
                            }
                          />
                        </div>

                        <div>
                          <Label>Metric</Label>

                          <Select
                            value={requirement.metric}
                            onValueChange={(value) =>
                              updateRequirement(
                                index,
                                {
                                  metric:
                                    value as BenchmarkMetric,
                                },
                              )
                            }
                          >
                            <SelectTrigger className="mt-2">
                              <SelectValue />
                            </SelectTrigger>

                            <SelectContent>
                              {metrics.map((metric) => (
                                <SelectItem
                                  key={metric}
                                  value={metric}
                                >
                                  {metric.replace(
                                    "_",
                                    " ",
                                  )}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Operator</Label>

                          <Select
                            value={requirement.operator}
                            onValueChange={(value) =>
                              updateRequirement(
                                index,
                                {
                                  operator:
                                    value as BenchmarkOperator,
                                },
                              )
                            }
                          >
                            <SelectTrigger className="mt-2">
                              <SelectValue />
                            </SelectTrigger>

                            <SelectContent>
                              {operators.map((operator) => (
                                <SelectItem
                                  key={operator}
                                  value={operator}
                                >
                                  {operator}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Target</Label>

                          <Input
                            className="mt-2"
                            type="number"
                            value={
                              requirement.target_value
                            }
                            onChange={(event) =>
                              updateRequirement(
                                index,
                                {
                                  target_value: Number(
                                    event.target.value,
                                  ),
                                },
                              )
                            }
                          />
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={
                            saving ||
                            editing.requirements.length <=
                              1
                          }
                          onClick={() =>
                            removeRequirement(index)
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>

            <div className="mt-7 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(null)}
                disabled={saving}
              >
                Cancel
              </Button>

              <Button
                type="button"
                className="glow"
                onClick={() => void saveBenchmark()}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}

                {saving
                  ? "Saving..."
                  : "Save Benchmark"}
              </Button>
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
                }
