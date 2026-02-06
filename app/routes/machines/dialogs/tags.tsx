import { Plus, TagsIcon, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFetcher } from "react-router";

import type { Machine } from "~/types";

import Button from "~/components/Button";
import Dialog from "~/components/Dialog";
import Link from "~/components/Link";
import Select from "~/components/Select";
import TableList from "~/components/TableList";
import cn from "~/utils/cn";

interface TagsProps {
  machine: Machine;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  existingTags?: string[];
}

export default function Tags({ machine, isOpen, setIsOpen, existingTags }: TagsProps) {
  const fetcher = useFetcher();
  const submittingRef = useRef(false);
  const [tags, setTags] = useState([...machine.tags]);
  const [tag, setTag] = useState("tag:");
  const tagIsInvalid = useMemo(() => {
    return tag.length === 0 || !tag.startsWith("tag:") || tags.includes(tag);
  }, [tag, tags]);

  const validNodeTags = useMemo(() => {
    return existingTags?.filter((nodeTag) => !tags.includes(nodeTag)) || [];
  }, [tags]);

  const error = fetcher.data && !fetcher.data.success ? fetcher.data.error : null;

  useEffect(() => {
    if (fetcher.data?.success) {
      submittingRef.current = false;
      setIsOpen(false);
    }

    if (fetcher.state === "idle" && fetcher.data && !fetcher.data.success) {
      submittingRef.current = false;
    }
  }, [fetcher.data, fetcher.state]);

  useEffect(() => {
    if (isOpen) {
      setTags([...machine.tags]);
    }
  }, [isOpen]);

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && submittingRef.current) return;
        setIsOpen(open);
      }}
    >
      <Dialog.Panel
        onSubmit={(event) => {
          event.preventDefault();
          submittingRef.current = true;
          const form = new FormData();
          form.set("action_id", "update_tags");
          form.set("node_id", machine.id);
          form.set("tags", tags.filter((t) => t !== "").join(","));
          fetcher.submit(form, { method: "POST" });
        }}
        isDisabled={fetcher.state !== "idle"}
      >
        <Dialog.Title>Edit ACL tags for {machine.givenName}</Dialog.Title>
        <Dialog.Text>
          ACL tags can be used to reference machines in your ACL policies. See the{" "}
          <Link name="Tailscale documentation" to="https://tailscale.com/kb/1068/acl-tags">
            Tailscale documentation
          </Link>{" "}
          for more information.
        </Dialog.Text>
        {error ? (
          <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </p>
        ) : null}
        <TableList className="mt-4">
          {tags.length === 0 ? (
            <TableList.Item className="flex flex-col items-center gap-2.5 py-4 opacity-70">
              <TagsIcon />
              <p className="font-semibold">No tags are set on this machine</p>
            </TableList.Item>
          ) : (
            tags.map((item) => (
              <TableList.Item className="font-mono" id={item} key={item}>
                {item}
                <Button
                  className="rounded-md p-0.5"
                  onPress={() => {
                    setTags(tags.filter((tag) => tag !== item));
                  }}
                >
                  <X className="p-1" />
                </Button>
              </TableList.Item>
            ))
          )}
        </TableList>

        <div className="mt-2 flex items-center gap-2">
          <Select
            allowsCustomValue
            aria-label="Add a tag"
            className="w-full"
            inputValue={tag}
            isInvalid={tag.length > 0 && tagIsInvalid}
            onInputChange={setTag}
            placeholder="tag:example"
          >
            {validNodeTags.map((nodeTag) => {
              return <Select.Item key={nodeTag}>{nodeTag}</Select.Item>;
            })}
          </Select>
          <Button
            className={cn("rounded-md p-1", tagIsInvalid && "opacity-50 cursor-not-allowed")}
            isDisabled={tagIsInvalid}
            onPress={() => {
              setTags([...tags, tag]);
              setTag("tag:");
            }}
          >
            <Plus className="p-1" size={30} />
          </Button>
        </div>
        <p className="mt-2 text-sm opacity-50">
          Not seeing the tags you expect? Tags need to be defined in your access control policy
          before they can be assigned to machines.
        </p>
      </Dialog.Panel>
    </Dialog>
  );
}
