import { Form } from "@base-ui/react/form";
import { closestCorners, DndContext, DragOverlay } from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Lock } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";

import ActionDialog from "~/components/action-dialog";
import Button from "~/components/button";
import Callout from "~/components/callout";
import Input from "~/components/input";
import List from "~/components/list";
import cn from "~/utils/cn";
import type { ActionResult } from "~/utils/form";

interface Props {
  searchDomains: string[];
  isDisabled: boolean;
  magic?: string;
}

export default function ManageDomains({ searchDomains, isDisabled, magic }: Props) {
  const fetcher = useFetcher<ActionResult>();
  const [activeId, setActiveId] = useState<number | string | null>(null);
  const [localDomains, setLocalDomains] = useState(searchDomains);
  const [prevDomains, setPrevDomains] = useState(searchDomains);
  if (prevDomains !== searchDomains) {
    setPrevDomains(searchDomains);
    setLocalDomains(searchDomains);
  }

  const errors = fetcher.data?.ok === false ? fetcher.data.errors : undefined;

  return (
    <div className="flex w-full flex-col sm:w-2/3">
      <h2 className="mb-4 text-lg font-semibold">Search Domains</h2>
      <p className="mb-4">
        Set custom DNS search domains for your Tailnet. When using Magic DNS, your tailnet domain is
        used as the first search domain.
      </p>
      <DndContext
        collisionDetection={closestCorners}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={(event) => {
          setActiveId(null);
          const { active, over } = event;
          if (!over) {
            return;
          }

          const activeItem = localDomains[(active.id as number) - 1];
          const overItem = localDomains[(over.id as number) - 1];

          if (!activeItem || !overItem) {
            return;
          }

          const oldIndex = localDomains.indexOf(activeItem);
          const newIndex = localDomains.indexOf(overItem);

          if (oldIndex !== newIndex) {
            setLocalDomains(arrayMove(localDomains, oldIndex, newIndex));
          }
        }}
        onDragStart={(event) => {
          setActiveId(event.active.id);
        }}
      >
        <List>
          {magic ? (
            <List.Item key="magic-dns-sd">
              <div
                className={cn(
                  "flex items-center gap-4",
                  isDisabled ? "flex-row-reverse justify-between w-full" : "",
                )}
              >
                <Lock className="p-0.5" />
                <p className="py-0.5 font-mono text-sm">{magic}</p>
              </div>
            </List.Item>
          ) : undefined}
          <SortableContext items={localDomains} strategy={verticalListSortingStrategy}>
            {localDomains.map((sd, index) => (
              <Domain domain={sd} id={index + 1} isDisabled={isDisabled} key={sd} />
            ))}
            <DragOverlay adjustScale>
              {activeId ? (
                <Domain
                  domain={localDomains[(activeId as number) - 1]}
                  id={(activeId as number) - 1}
                  isDisabled={isDisabled}
                  isDragging
                />
              ) : undefined}
            </DragOverlay>
          </SortableContext>
          {isDisabled ? undefined : (
            <List.Item key="add-sd">
              <Form
                className="flex w-full items-start justify-between"
                errors={errors}
                // Remounts after each change so a submitted domain clears.
                key={searchDomains.join()}
                render={<fetcher.Form method="POST" />}
              >
                <input name="intent" type="hidden" value="add_domain" />
                <Input
                  className={cn(
                    "border-none font-mono p-0 text-sm",
                    "rounded-none focus:ring-0 w-full ml-1",
                  )}
                  required
                  label="Search Domain"
                  labelHidden
                  name="domain"
                  placeholder="Search Domain"
                  type="text"
                />
                <Button
                  pending={fetcher.formData?.get("intent") === "add_domain"}
                  size="sm"
                  type="submit"
                >
                  Add
                </Button>
              </Form>
            </List.Item>
          )}
        </List>
      </DndContext>
      {errors?.form && (
        <Callout className="mt-4" variant="error">
          {errors.form}
        </Callout>
      )}
    </div>
  );
}

interface DomainProps {
  domain: string;
  id: number;
  isDragging?: boolean;
  isDisabled: boolean;
}

function Domain({ domain, id, isDragging, isDisabled }: DomainProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id });

  return (
    <List.Item
      className={cn(isSortableDragging ? "opacity-50" : "", isDragging ? "ring-3 bg-raised" : "")}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <p className="flex items-center gap-4 font-mono text-sm">
        {isDisabled ? undefined : (
          <GripVertical
            {...attributes}
            {...listeners}
            className="rounded-md p-0.5 outline-hidden focus:ring-3"
          />
        )}
        {domain}
      </p>
      {isDragging ? undefined : (
        <ActionDialog
          description="Devices stop appending this domain to short names."
          fields={{ domain }}
          intent="remove_domain"
          isDestructive
          submitLabel="Remove"
          title={`Remove search domain ${domain}?`}
          trigger={
            <Button
              className="text-bad hover:bg-bad-subtle hover:text-bad"
              disabled={isDisabled}
              size="sm"
              variant="ghost"
            >
              Remove
            </Button>
          }
        />
      )}
    </List.Item>
  );
}
