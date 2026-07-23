import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlayerAvatar, TournamentImage } from "@/components/PlayerAvatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getTournament,
  listAchievements,
  listPlayers,
  listStatsForTournament,
  matchPoints,
  positionPoints,
  sum,
} from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { uploadFile } from "@/lib/storage";
import { toast } from "sonner";
import { Save, Upload, CheckCircle2, ArrowLeft, Trash2, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/tournaments/$id")({
  component: ManageTournament,
});

        function ManageTournament() {
  return (
    <div
      style={{
        padding: "50px",
        color: "white",
        fontSize: "32px",
      }}
    >
      HELLO MANAGE PAGE
    </div>
  );
        }
