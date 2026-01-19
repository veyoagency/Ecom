"use client";

import { useMemo, useState } from "react";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type Tag = {
  id: number;
  name: string;
};

type OrderTagsClientProps = {
  orderPublicId: string;
  initialTags: Tag[];
  availableTags: Tag[];
};

export default function OrderTagsClient({
  orderPublicId,
  initialTags,
  availableTags,
}: OrderTagsClientProps) {
  const [tags, setTags] = useState<Tag[]>(availableTags);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    () => new Set(initialTags.map((tag) => tag.id)),
  );
  const [inputValue, setInputValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTags = useMemo(
    () => tags.filter((tag) => selectedIds.has(tag.id)),
    [selectedIds, tags],
  );

  const toggleTag = async (tagId: number) => {
    const next = new Set(selectedIds);
    if (next.has(tagId)) {
      next.delete(tagId);
    } else {
      next.add(tagId);
    }
    setSelectedIds(next);
    await persistTags(next);
  };

  const persistTags = async (next: Set<number>) => {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderPublicId}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: Array.from(next) }),
      });
      const data = (await response.json()) as { tags?: Tag[]; error?: string };
      if (!response.ok) {
        setError(data?.error || "Failed to update tags.");
        return;
      }
      if (data?.tags) {
        setSelectedIds(new Set(data.tags.map((tag) => tag.id)));
      }
    } catch {
      setError("Failed to update tags.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTag = async (tagId: number) => {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/order-tags", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tagId }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data?.ok) {
        setError(data?.error || "Failed to delete tag.");
        return;
      }
      setTags((prev) => prev.filter((tag) => tag.id !== tagId));
      const next = new Set(selectedIds);
      if (next.has(tagId)) {
        next.delete(tagId);
        setSelectedIds(next);
        await persistTags(next);
      }
    } catch {
      setError("Failed to delete tag.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateTag = async () => {
    const name = inputValue.trim();
    if (!name) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/order-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json()) as { tag?: Tag; error?: string };
      if (!response.ok || !data?.tag) {
        setError(data?.error || "Failed to create tag.");
        return;
      }
      setInputValue("");
      setTags((prev) => {
        if (prev.some((tag) => tag.id === data.tag!.id)) {
          return prev;
        }
        return [...prev, data.tag!].sort((a, b) =>
          a.name.localeCompare(b.name),
        );
      });
      const next = new Set(selectedIds);
      next.add(data.tag.id);
      setSelectedIds(next);
      await persistTags(next);
    } catch {
      setError("Failed to create tag.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          placeholder="Add tag"
          className="h-9 flex-1 rounded-md border border-neutral-200 px-3 text-sm"
        />
        <Button size="sm" onClick={handleCreateTag} disabled={isSaving || !inputValue.trim()}>
          Add
        </Button>
      </div>
      {selectedTags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-2 py-1 text-xs text-neutral-700"
            >
              {tag.name}
              <button
                type="button"
                onClick={() => toggleTag(tag.id)}
                className="text-neutral-400 hover:text-neutral-700"
                aria-label={`Remove ${tag.name}`}
                disabled={isSaving}
              >
                ×
              </button>
              <button
                type="button"
                onClick={() => handleDeleteTag(tag.id)}
                className="text-neutral-400 hover:text-red-600"
                aria-label={`Delete ${tag.name}`}
                disabled={isSaving}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-neutral-400">No tags yet.</p>
      )}
      <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-neutral-100 p-2">
        {tags.map((tag) => (
          <label
            key={tag.id}
            className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm hover:bg-neutral-50"
          >
            <span>{tag.name}</span>
            <input
              type="checkbox"
              checked={selectedIds.has(tag.id)}
              onChange={() => toggleTag(tag.id)}
              disabled={isSaving}
            />
          </label>
        ))}
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
