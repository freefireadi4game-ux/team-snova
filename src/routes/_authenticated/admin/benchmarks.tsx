import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Copy,
  Edit3,
  Plus,
  Save,
  Trash2,
  X,
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
import { BENCHMARKS } from "@/data/benchmarks";
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

function AdminBenchmarksPage() {
  const [benchmarks, setBenchmarks] =
    useState<Benchmark[]>(BENCHMARKS);

  const [editing, setEditing] =
    useState<Benchmark | null>(null);

  const [isCreating, setIsCreating] =
    useState(false);

  const startCreate = () => {
    const sourceType: BenchmarkSourceType =
      "training";

    setEditing({
      id: `benchmark-${Date.now()}`,
      name: "New Benchmark",
      description: "",
      source_type: sourceType,
      role: "all",
      status: "draft",
      requirements: [
        createRequirement(sourceType),
      ],
    });

    setIsCreating(true);
  };

  const startEdit = (benchmark: Benchmark) => {
    setEditing({
      ...benchmark,
      requirements: benchmark.requirements.map(
        (requirement) => ({ ...requirement }),
      ),
    });

    setIsCreating(false);
  };

  const duplicateBenchmark = (benchmark: Benchmark) => {
    const copy: Benchmark = {
      ...benchmark,
      id: `benchmark-${Date.now()}`,
      name: `${benchmark.name} Copy`,
      status: "draft",
      requirements: benchmark.requirements.map(
        (requirement) => ({
          ...requirement,
          id: undefined,
          benchmark_id: undefined,
        }),
      ),
    };

    setBenchmarks((current) => [
      ...current,
      copy,
    ]);

    startEdit(copy);
  };

  const deleteBenchmark = (id: string) => {
    setBenchmarks((current) =>
      current.filter(
        (benchmark) => benchmark.id !== id,
      ),
    );

    if (editing?.id === id) {
      setEditing(null);
    }
  };

  const saveBenchmark = () => {
    if (!editing) return;

    if (!editing.name.trim()) {
      return;
    }

    setBenchmarks((current) => {
      const exists = current.some(
        (benchmark) => benchmark.id === editing.id,
      );

      if (exists) {
        return current.map((benchmark) =>
          benchmark.id === editing.id
            ? editing
            : benchmark,
        );
      }

      return [...current, editing];
    });

    setEditing(null);
    setIsCreating(false);
  };

  const updateEditing = (
    changes: Partial<Benchmark>,
  ) => {
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

      const requirements = current.requirements.map(
        (requirement, requirementIndex) =>
          requirementIndex === index
            ? {
                ...requirement,
                ...changes,
              }
            : requirement,
      );

      return {
        ...current,
        requirements,
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
          createRequirement(
            current.source_type,
          ),
        ],
      };
    });
  };

  const removeRequirement = (index: number) => {
    setEditing((current) => {
      if (!current) return current;

      if (current.requirements.length <= 1) {
        return current;
      }

      return {
        ...current,
        requirements:
          current.requirements.filter(
            (_, requirementIndex) =>
              requirementIndex !== index,
          ),
      };
    });
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
              Create role-specific drills and define
              exactly which screenshot metrics a player
              must complete.
            </p>
          </div>

          <Button
            type="button"
            className="glow"
            onClick={startCreate}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Benchmark
          </Button>
        </section>

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

                  <div className="mt-3 grid gap-1">
                    {benchmark.requirements.map(
                      (requirement, index) => (
                        <div
                          key={`${benchmark.id}-${index}`}
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
                    onClick={() =>
                      deleteBenchmark(benchmark.id)
                    }
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </section>

        {editing && (
          <section className="glass rounded-2xl p-5 md:p-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-display text-2xl">
                  {isCreating
                    ? "Create Benchmark"
                    : "Edit Benchmark"}
                </div>

                <div className="text-xs text-muted-foreground">
                  Configure the drill and its requirements.
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditing(null);
                  setIsCreating(false);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <Label>Name</Label>
                <Input
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
                  <SelectTrigger>
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
                              requirement.source_type ??
                              sourceType,
                          }),
                        ),
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    {sourceTypes.map(
                      (sourceType) => (
                        <SelectItem
                          key={sourceType}
                          value={sourceType}
                        >
                          {sourceType.replace(
                            "_",
                            " ",
                          )}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Status</Label>

                <Select
                  value={editing.status}
                  onValueChange={(value) =>
                    updateEditing({
                      status: value as Benchmark["status"],
                    })
                  }
                >
                  <SelectTrigger>
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
                  value={
                    editing.description ?? ""
                  }
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
                            value={
                              requirement.metric
                            }
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
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>

                            <SelectContent>
                              {metrics.map(
                                (metric) => (
                                  <SelectItem
                                    key={metric}
                                    value={metric}
                                  >
                                    {metric.replace(
                                      "_",
                                      " ",
                                    )}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Operator</Label>

                          <Select
                            value={
                              requirement.operator
                            }
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
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>

                            <SelectContent>
                              {operators.map(
                                (operator) => (
                                  <SelectItem
                                    key={operator}
                                    value={operator}
                                  >
                                    {operator}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Target</Label>

                          <Input
                            type="number"
                            min={0}
                            value={
                              requirement.target_value
                            }
                            onChange={(event) =>
                              updateRequirement(
                                index,
                                {
                                  target_value:
                                    Number(
                                      event.target
                                        .value,
                                    ) || 0,
                                },
                              )
                            }
                          />
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
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

                {editing.requirements.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                    No requirements yet. Add at least one.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <Button type="button" className="glow" onClick={saveBenchmark}>
                <Save className="mr-2 h-4 w-4" />
                Save benchmark
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditing(null);
                  setIsCreating(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}
