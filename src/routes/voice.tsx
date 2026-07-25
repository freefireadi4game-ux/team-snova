import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, type RemoteParticipant, type LocalParticipant } from "livekit-client";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { getVoiceToken } from "@/lib/livekit.functions";
import { useSession, useCanVoice } from "@/lib/auth";
import { Mic, MicOff, PhoneOff, Volume2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/voice")({
  head: () => ({ meta: [{ title: "Team Voice — SNOVA ESP" }] }),
  component: VoicePage,
});

function VoicePage() {
  const { session, loading } = useSession();
  const canVoice = useCanVoice();
  const fetchToken = useServerFn(getVoiceToken);
  const roomRef = useRef<Room | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [peers, setPeers] = useState<{ id: string; name: string; speaking: boolean; muted: boolean }[]>([]);

  const refreshPeers = (room: Room) => {
    const list: { id: string; name: string; speaking: boolean; muted: boolean }[] = [];
    const lp = room.localParticipant as LocalParticipant;
    list.push({
      id: lp.identity,
      name: (lp.name || "You") + " (you)",
      speaking: lp.isSpeaking,
      muted: !lp.isMicrophoneEnabled,
    });
    room.remoteParticipants.forEach((p: RemoteParticipant) => {
      const micPub = p.getTrackPublication(Track.Source.Microphone);
      list.push({
        id: p.identity,
        name: p.name || p.identity.slice(0, 6),
        speaking: p.isSpeaking,
        muted: !!micPub?.isMuted || !micPub,
      });
    });
    setPeers(list);
  };

  const connect = async () => {
    if (!session) return toast.error("Sign in first");
    setConnecting(true);
    try {
      const { token, url } = await fetchToken({
        data: { room: "team-snova", name: session.user.email?.split("@")[0] ?? "Player" },
      });
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        publishDefaults: { dtx: true, red: true, audioPreset: { maxBitrate: 32000 } },
      });
      roomRef.current = room;
      room
        .on(RoomEvent.ParticipantConnected, () => refreshPeers(room))
        .on(RoomEvent.ParticipantDisconnected, () => refreshPeers(room))
        .on(RoomEvent.TrackMuted, () => refreshPeers(room))
        .on(RoomEvent.TrackUnmuted, () => refreshPeers(room))
        .on(RoomEvent.ActiveSpeakersChanged, () => refreshPeers(room))
        .on(RoomEvent.Disconnected, () => {
          setConnected(false);
          setPeers([]);
        });
      await room.connect(url, token);
      await room.localParticipant.setMicrophoneEnabled(true);
      setConnected(true);
      setMuted(false);
      refreshPeers(room);
      toast.success("Connected to team voice");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message ?? "Failed to connect");
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    await roomRef.current?.disconnect();
    roomRef.current = null;
    setConnected(false);
  };

  const toggleMute = async () => {
    const lp = roomRef.current?.localParticipant;
    if (!lp) return;
    const now = !muted;
    await lp.setMicrophoneEnabled(!now);
    setMuted(now);
  };

  useEffect(() => {
    return () => {
      roomRef.current?.disconnect();
    };
  }, []);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-black gradient-text">Team Voice</h1>
        <p className="text-sm text-muted-foreground mt-1">Low-latency comms for the squad. Runs in background while you play.</p>
      </div>

      {loading ? null : !session ? (
        <div className="glass rounded-2xl p-8 text-center">
          <div className="text-sm text-muted-foreground">Sign in first.</div>
        </div>
      ) : !canVoice.data ? (
        <div className="glass rounded-2xl p-8 text-center">
          <div className="font-bold mb-1">Access restricted</div>
          <div className="text-sm text-muted-foreground">Voice is for team members. Ask an admin for the player invite link.</div>
        </div>
      ) : (
        <>
          <div className="glass rounded-2xl p-5 flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-neon">Room</div>
              <div className="font-display text-2xl">team-snova</div>
              <div className="text-xs text-muted-foreground">{peers.length} in room</div>
            </div>
            <div className="flex gap-2">
              {!connected ? (
                <Button size="lg" onClick={connect} disabled={connecting} className="glow">
                  <Volume2 className="h-4 w-4 mr-1" /> {connecting ? "Connecting…" : "Join voice"}
                </Button>
              ) : (
                <>
                  <Button size="lg" variant="secondary" onClick={toggleMute}>
                    {muted ? <MicOff className="h-4 w-4 mr-1" /> : <Mic className="h-4 w-4 mr-1" />}
                    {muted ? "Unmute" : "Mute"}
                  </Button>
                  <Button size="lg" variant="destructive" onClick={disconnect}>
                    <PhoneOff className="h-4 w-4 mr-1" /> Leave
                  </Button>
                </>
              )}
            </div>
          </div>

          {connected && (
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
              {peers.map((p) => (
                <div
                  key={p.id}
                  className={`glass rounded-2xl p-4 text-center transition-all ${
                    p.speaking ? "ring-2 ring-neon" : ""
                  }`}
                >
                  <div className="mx-auto h-14 w-14 rounded-full bg-white/10 flex items-center justify-center font-bold text-lg">
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="mt-2 font-semibold truncate text-sm">{p.name}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-1">
                    {p.muted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3 text-neon" />}
                    {p.speaking ? "Speaking" : p.muted ? "Muted" : "Idle"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
