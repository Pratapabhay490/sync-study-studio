import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth-context";

export interface Profile {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}
export interface Subject {
  id: string;
  name: string;
  icon: string | null;
  created_by: string | null;
  created_at: string;
}
export interface Topic {
  id: string;
  subject_id: string;
  topic_name: string;
  description: string | null;
  added_by: string | null;
  created_at: string;
}
export interface TopicProgress {
  id: string;
  topic_id: string;
  user_id: string;
  completed: boolean;
  completed_at: string | null;
  updated_at: string;
}

interface DataContextValue {
  loading: boolean;
  profiles: Profile[];
  subjects: Subject[];
  topics: Topic[];
  progress: TopicProgress[];
  refresh: () => Promise<void>;
  toggleTopic: (topicId: string, completed: boolean) => Promise<void>;
  addTopic: (subjectId: string, topicName: string, description?: string) => Promise<void>;
  bulkAddTopics: (subjectId: string, topicNames: string[]) => Promise<void>;
  updateTopic: (topicId: string, updates: { topic_name?: string; description?: string | null }) => Promise<void>;
  deleteTopic: (topicId: string) => Promise<void>;
  addSubject: (name: string, icon?: string) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;
  resetMyProgress: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [progress, setProgress] = useState<TopicProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [p, s, t, pr] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at"),
      supabase.from("subjects").select("*").order("name"),
      supabase.from("topics").select("*").order("created_at"),
      supabase.from("topic_progress").select("*"),
    ]);
    if (p.data) setProfiles(p.data as Profile[]);
    if (s.data) setSubjects(s.data as Subject[]);
    if (t.data) setTopics(t.data as Topic[]);
    if (pr.data) setProgress(pr.data as TopicProgress[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    refresh();
    const channel = supabase
      .channel("study-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "subjects" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "topics" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "topic_progress" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  const toggleTopic = useCallback(
    async (topicId: string, completed: boolean) => {
      if (!user) return;
      const existing = progress.find((p) => p.topic_id === topicId && p.user_id === user.id);
      const completed_at = completed ? new Date().toISOString() : null;
      // optimistic
      setProgress((prev) => {
        if (existing) {
          return prev.map((p) => (p.id === existing.id ? { ...p, completed, completed_at: completed_at } : p));
        }
        return [
          ...prev,
          {
            id: `tmp-${topicId}`,
            topic_id: topicId,
            user_id: user.id,
            completed,
            completed_at,
            updated_at: new Date().toISOString(),
          },
        ];
      });
      if (existing) {
        await supabase.from("topic_progress").update({ completed, completed_at }).eq("id", existing.id);
      } else {
        await supabase
          .from("topic_progress")
          .insert({ topic_id: topicId, user_id: user.id, completed, completed_at });
      }
    },
    [user, progress],
  );

  const addTopic = useCallback(
    async (subjectId: string, topicName: string, description?: string) => {
      if (!user) return;
      await supabase.from("topics").insert({
        subject_id: subjectId,
        topic_name: topicName,
        description: description ?? null,
        added_by: user.id,
      });
    },
    [user],
  );

  const bulkAddTopics = useCallback(
    async (subjectId: string, topicNames: string[]) => {
      if (!user) return;
      const rows = topicNames
        .map((n) => n.trim())
        .filter(Boolean)
        .map((topic_name) => ({ subject_id: subjectId, topic_name, added_by: user.id }));
      if (rows.length === 0) return;
      await supabase.from("topics").insert(rows);
    },
    [user],
  );

  const updateTopic = useCallback(async (topicId: string, updates: { topic_name?: string; description?: string | null }) => {
    await supabase.from("topics").update(updates).eq("id", topicId);
  }, []);

  const deleteTopic = useCallback(async (topicId: string) => {
    await supabase.from("topics").delete().eq("id", topicId);
  }, []);

  const addSubject = useCallback(
    async (name: string, icon?: string) => {
      if (!user) return;
      await supabase.from("subjects").insert({ name, icon: icon ?? "BookOpen", created_by: user.id });
    },
    [user],
  );

  const deleteSubject = useCallback(async (id: string) => {
    await supabase.from("subjects").delete().eq("id", id);
  }, []);

  const resetMyProgress = useCallback(async () => {
    if (!user) return;
    await supabase.from("topic_progress").delete().eq("user_id", user.id);
  }, [user]);

  const value = useMemo(
    () => ({
      loading,
      profiles,
      subjects,
      topics,
      progress,
      refresh,
      toggleTopic,
      addTopic,
      bulkAddTopics,
      updateTopic,
      deleteTopic,
      addSubject,
      deleteSubject,
      resetMyProgress,
    }),
    [loading, profiles, subjects, topics, progress, refresh, toggleTopic, addTopic, bulkAddTopics, updateTopic, deleteTopic, addSubject, deleteSubject, resetMyProgress],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}

// Helpers
export function computeUserStats(userId: string, topics: Topic[], progress: TopicProgress[]) {
  const total = topics.length;
  const completed = progress.filter((p) => p.user_id === userId && p.completed).length;
  return { total, completed, pct: total ? Math.round((completed / total) * 100) : 0 };
}

export function computeSubjectStats(subjectId: string, topics: Topic[], progress: TopicProgress[], userIds: string[]) {
  const subjectTopics = topics.filter((t) => t.subject_id === subjectId);
  const total = subjectTopics.length;
  const topicIds = new Set(subjectTopics.map((t) => t.id));
  const completedByUser: Record<string, number> = {};
  for (const uid of userIds) {
    completedByUser[uid] = progress.filter((p) => p.user_id === uid && p.completed && topicIds.has(p.topic_id)).length;
  }
  const anyCompleted = subjectTopics.filter((t) =>
    progress.some((p) => p.topic_id === t.id && p.completed && userIds.includes(p.user_id)),
  ).length;
  return { total, completedByUser, anyCompleted };
}
